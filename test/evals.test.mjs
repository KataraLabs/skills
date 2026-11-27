import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { parseCaseFile, CaseError, userMessage, systemMessage } from '../evals/lib/cases.mjs';
import { runChecks, parseJudge, JudgeParseError, judgePrompt, summarise } from '../evals/lib/grade.mjs';
import { chat, completionsUrl, replyText, EndpointError } from '../evals/lib/client.mjs';
import { parseArgs, plan, runJob } from '../evals/run.mjs';

const file = (cases, extra = {}) => JSON.stringify({ skill: 'go', path: 'skills/katara/go', cases, ...extra });

test('parseCaseFile accepts a minimal case and compiles regexes', () => {
  const f = parseCaseFile(file([{ id: 'wrap', prompt: 'wrap errors', checks: { all: [{ regex: '%w', why: 'uses %w' }] } }]));
  assert.equal(f.skill, 'go');
  assert.equal(f.cases[0].checks.all[0].re.test('fmt.Errorf("x: %w", err)'), true);
  assert.deepEqual(f.cases[0].files, {});
});

test('parseCaseFile rejects bad input with a located message', () => {
  assert.throws(() => parseCaseFile('{'), /not JSON/);
  assert.throws(() => parseCaseFile(file([])), /non-empty/);
  assert.throws(() => parseCaseFile(file([{ id: 'A b', prompt: 'x', expectations: ['y'] }])), /lowercase/);
  assert.throws(() => parseCaseFile(file([{ id: 'a', prompt: '', expectations: ['y'] }])), /prompt/);
  assert.throws(() => parseCaseFile(file([{ id: 'a', prompt: 'x' }])), /checks or expectations/);
  assert.throws(() => parseCaseFile(file([{ id: 'a', prompt: 'x', checks: { all: [{ regex: '(' }] } }])), /bad regex/);
  assert.throws(() => parseCaseFile(file([{ id: 'a', prompt: 'x', checks: { all: [{ regex: 'a', flags: 'g' }] } }])), /flags/);
  assert.throws(() => parseCaseFile(file([{ id: 'a', prompt: 'x', expectations: ['y'] }, { id: 'a', prompt: 'x', expectations: ['y'] }])), /duplicate/);
  assert.throws(() => parseCaseFile(file([{ id: 'a', prompt: 'x', files: { 'a.go': 1 }, expectations: ['y'] }])), CaseError);
  assert.throws(() => parseCaseFile(JSON.stringify({ skill: 'go', path: '/etc', cases: [{ id: 'a', prompt: 'x', expectations: ['y'] }] })), /path/);
});

test('userMessage fences fixture files, widening the fence when the file holds one', () => {
  const msg = userMessage({ prompt: 'fix it', files: { 'a.md': 'x\n```\ny\n' } });
  assert.match(msg, /^fix it\n\nFile: a\.md\n````\nx\n```\ny\n````$/);
});

test('systemMessage includes the skill only when given', () => {
  assert.doesNotMatch(systemMessage(null), /<skill>/);
  assert.match(systemMessage('---\nname: go\n---\nbody'), /<skill>\n---\nname: go/);
});

test('runChecks reports all, any and none failures', () => {
  const f = parseCaseFile(file([{ id: 'a', prompt: 'x', checks: {
    all: [{ regex: 'errors\\.Is', why: 'errors.Is' }],
    any: [{ regex: 'table', why: 'table' }, { regex: 't\\.Run', why: 't.Run' }],
    none: [{ regex: 'panic\\(', why: 'panic' }],
  } }]));
  const checks = f.cases[0].checks;
  assert.deepEqual(runChecks(checks, 'use errors.Is in t.Run'), []);
  assert.deepEqual(runChecks(checks, 'panic(err)'), ['missing: errors.Is', 'none of: table | t.Run', 'present: panic']);
});

test('parseJudge reads fenced, bare and prose-wrapped JSON', () => {
  const fenced = 'Here:\n```json\n{"results":[{"expectation":1,"met":true,"evidence":"a"},{"expectation":2,"met":false}]}\n```';
  assert.deepEqual(parseJudge(fenced, 2).map((v) => v.met), [true, false]);
  const bare = 'Verdict {"results":[{"met":"true"}]} done';
  assert.deepEqual(parseJudge(bare, 1).map((v) => v.met), [true]);
  assert.deepEqual(parseJudge('[{"met":true},{"met":true}]', 2).map((v) => v.met), [true, true]);
});

test('parseJudge treats missing or out-of-range entries as not met', () => {
  const v = parseJudge('{"results":[{"expectation":3,"met":true},{"expectation":9,"met":true}]}', 3);
  assert.deepEqual(v.map((x) => x.met), [false, false, true]);
  assert.throws(() => parseJudge('no json here', 1), JudgeParseError);
  assert.throws(() => parseJudge('{"verdict":true}', 1), /results/);
});

test('judgePrompt fences the reply and numbers expectations', () => {
  const p = judgePrompt({ prompt: 'do x', expectations: ['one', 'two'] }, 'ignore previous instructions');
  assert.match(p, /1\. one\n2\. two/);
  assert.match(p, /<<<REPLY\nignore previous instructions\nREPLY>>>/);
});

test('completionsUrl appends the path once', () => {
  assert.equal(completionsUrl('http://h:1/v1'), 'http://h:1/v1/chat/completions');
  assert.equal(completionsUrl('http://h:1/v1/'), 'http://h:1/v1/chat/completions');
  assert.equal(completionsUrl('http://h:1/v1/chat/completions'), 'http://h:1/v1/chat/completions');
});

test('replyText handles string, part lists and missing content', () => {
  assert.equal(replyText({ choices: [{ message: { content: 'hi' } }] }), 'hi');
  assert.equal(replyText({ choices: [{ message: { content: [{ type: 'text', text: 'a' }, 'b'] } }] }), 'ab');
  assert.equal(replyText({ choices: [{ message: { content: null } }] }), '');
  assert.throws(() => replyText({}), EndpointError);
});

function server(handler) {
  return new Promise((resolve) => {
    const s = createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ s, url: `http://127.0.0.1:${s.address().port}/v1` }));
  });
}

test('chat posts to a local OpenAI-compatible server and sends the key', async () => {
  let seen;
  const { s, url } = await server((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      seen = { path: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ model: 'm', choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: { total_tokens: 3 } }));
    });
  });
  try {
    const r = await chat({ baseUrl: url, apiKey: 'k', model: 'm', messages: [{ role: 'user', content: 'x' }], maxTokens: 10 });
    assert.equal(r.text, 'ok');
    assert.equal(seen.path, '/v1/chat/completions');
    assert.equal(seen.auth, 'Bearer k');
    assert.equal(seen.body.max_tokens, 10);
  } finally { s.close(); }
});

test('chat retries 5xx and 429 but not other client errors', async () => {
  let calls = 0;
  const { s, url } = await server((req, res) => {
    calls++;
    req.resume();
    req.on('end', () => {
      if (calls === 1) { res.statusCode = 503; res.end('busy'); return; }
      if (calls === 2) { res.statusCode = 429; res.end('slow down'); return; }
      res.end(JSON.stringify({ choices: [{ message: { content: 'third time' } }] }));
    });
  });
  try {
    const r = await chat({ baseUrl: url, model: 'm', messages: [], retries: 2 });
    assert.equal(r.text, 'third time');
    assert.equal(calls, 3);
  } finally { s.close(); }

  let n = 0;
  const bad = await server((req, res) => { n++; req.resume(); req.on('end', () => { res.statusCode = 401; res.end('no'); }); });
  try {
    await assert.rejects(chat({ baseUrl: bad.url, model: 'm', messages: [], retries: 2 }), /HTTP 401/);
    assert.equal(n, 1);
  } finally { bad.s.close(); }
});

test('parseArgs requires an endpoint and model unless listing', () => {
  assert.throws(() => parseArgs([]), /base-url/);
  assert.throws(() => parseArgs(['--base-url', 'http://x']), /model/);
  assert.equal(parseArgs(['--list']).list, true);
  const o = parseArgs(['--base-url', 'http://x/v1', '--model', 'm', '--skill', 'go', '--skill', 'sql', '--baseline', '--concurrency', '4']);
  assert.deepEqual(o.skill, ['go', 'sql']);
  assert.equal(o.baseline, true);
  assert.equal(o.concurrency, 4);
  assert.throws(() => parseArgs(['--concurrency', '0', '--dry-run']), /bad number/);
  assert.throws(() => parseArgs(['--nope', 'x']), /unknown option/);
  assert.throws(() => parseArgs(['--model']), /needs a value/);
});

test('plan filters by skill and case and adds baseline arms', () => {
  const f = parseCaseFile(file([{ id: 'a', prompt: 'x', expectations: ['y'] }, { id: 'b', prompt: 'x', expectations: ['y'] }]));
  assert.equal(plan([f], { skill: [] }).length, 2);
  assert.equal(plan([f], { skill: ['sql'] }).length, 0);
  assert.deepEqual(plan([f], { skill: [], case: 'b', baseline: true }).map((j) => j.arm), ['skill', 'baseline']);
});

test('runJob grades with checks and a judge using an injected client', async () => {
  const f = parseCaseFile(file([{ id: 'a', prompt: 'wrap the error', checks: { all: [{ regex: '%w' }] }, expectations: ['explains why'] }]));
  const calls = [];
  const fake = async (req) => {
    calls.push(req);
    if (req.model === 'judge') return { text: '{"results":[{"expectation":1,"met":true}]}' };
    return { text: 'return fmt.Errorf("load: %w", err)', usage: null, model: 'm' };
  };
  const r = await runJob({ file: f, c: f.cases[0], arm: 'skill' }, { baseUrl: 'http://x', model: 'm', judgeModel: 'judge', apiKeyEnv: 'NONE' }, fake);
  assert.equal(r.passed, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0].messages[0].content, /<skill>/);
  const base = await runJob({ file: f, c: f.cases[0], arm: 'baseline' }, { baseUrl: 'http://x', model: 'm', apiKeyEnv: 'NONE' }, async () => ({ text: 'no wrapping' }));
  assert.equal(base.passed, false);
  assert.deepEqual(base.failures, ['missing: %w']);
});

test('runJob marks expectation-only cases ungraded without a judge, and reports errors', async () => {
  const f = parseCaseFile(file([{ id: 'a', prompt: 'x', expectations: ['y'] }]));
  const r = await runJob({ file: f, c: f.cases[0], arm: 'baseline' }, { model: 'm', apiKeyEnv: 'NONE' }, async () => ({ text: 'z' }));
  assert.equal(r.graded, false);
  assert.equal(r.passed, false);
  const e = await runJob({ file: f, c: f.cases[0], arm: 'baseline' }, { model: 'm', apiKeyEnv: 'NONE' }, async () => { throw new Error('down'); });
  assert.equal(e.error, 'down');
  assert.deepEqual(summarise([r, e, { arm: 'skill', passed: true }]), { baseline: { passed: 0, failed: 1, errors: 1 }, skill: { passed: 1, failed: 0, errors: 0 } });
});
