#!/usr/bin/env node
// Runs the eval cases against any OpenAI-compatible chat completions endpoint.
//
//   node evals/run.mjs --base-url URL --model NAME [options]
//
//   --base-url URL         endpoint base, e.g. http://localhost:8000/v1
//   --model NAME           model under test
//   --api-key-env VAR      environment variable holding the key (default OPENAI_API_KEY; optional)
//   --skill NAME           only this skill (repeatable); default every case file
//   --case ID              only this case id
//   --baseline             also run each case without the skill, to see what the skill adds
//   --judge-model NAME     grade expectations with this model (same endpoint unless --judge-base-url)
//   --judge-base-url URL   endpoint for the judge
//   --judge-api-key-env V  key variable for the judge (default: the --api-key-env value)
//   --temperature N        sampling temperature for the model under test
//   --max-tokens N         reply limit
//   --concurrency N        parallel requests (default 2)
//   --out DIR              where results go (default evals/results, git-ignored)
//   --dry-run              list what would run; send nothing
//   --list                 list skills with case files and exit
//
// Without a judge only the deterministic checks grade a case; cases that have only
// expectations are reported as ungraded. Every request costs whatever the endpoint charges.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCaseFile, systemMessage, userMessage } from './lib/cases.mjs';
import { chat } from './lib/client.mjs';
import { judgePrompt, parseJudge, runChecks, summarise } from './lib/grade.mjs';
import { walkFiles } from '../scripts/lib/files.mjs';
import { splitFrontMatter } from '../scripts/lib/frontmatter.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export function parseArgs(argv) {
  const opts = { skill: [], concurrency: 2, apiKeyEnv: 'OPENAI_API_KEY', out: join(root, 'evals', 'results') };
  const flags = new Set(['baseline', 'dry-run', 'list']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const key = a.slice(2);
    if (flags.has(key)) { opts[camel(key)] = true; continue; }
    const v = argv[++i];
    if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
    switch (key) {
      case 'skill': opts.skill.push(v); break;
      case 'concurrency': case 'max-tokens': case 'temperature': {
        const n = Number(v);
        if (!Number.isFinite(n) || (key !== 'temperature' && (!Number.isInteger(n) || n < 1))) throw new Error(`${a}: bad number ${v}`);
        opts[camel(key)] = n;
        break;
      }
      case 'base-url': case 'model': case 'api-key-env': case 'case': case 'judge-model':
      case 'judge-base-url': case 'judge-api-key-env': case 'out':
        opts[camel(key)] = v; break;
      default: throw new Error(`unknown option ${a}`);
    }
  }
  if (!opts.list && !opts.dryRun) {
    if (!opts.baseUrl) throw new Error('--base-url is required');
    if (!opts.model) throw new Error('--model is required');
  }
  return opts;
}

function camel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

export function loadCaseFiles(dir = join(root, 'evals', 'cases')) {
  return walkFiles(dir).filter((p) => p.endsWith('.json')).map((p) => parseCaseFile(readFileSync(join(dir, p), 'utf8'), `evals/cases/${p}`));
}

function skillText(path) {
  const p = join(root, path, 'SKILL.md');
  if (!existsSync(p)) throw new Error(`${path}/SKILL.md does not exist`);
  const text = readFileSync(p, 'utf8');
  splitFrontMatter(text);
  return text;
}

export function plan(files, opts) {
  const jobs = [];
  for (const f of files) {
    if (opts.skill.length && !opts.skill.includes(f.skill)) continue;
    for (const c of f.cases) {
      if (opts.case && c.id !== opts.case) continue;
      jobs.push({ file: f, c, arm: 'skill' });
      if (opts.baseline) jobs.push({ file: f, c, arm: 'baseline' });
    }
  }
  return jobs;
}

export async function runJob(job, opts, chatImpl = chat) {
  const { file, c, arm } = job;
  const base = { skill: file.skill, case: c.id, arm };
  try {
    const messages = [
      { role: 'system', content: systemMessage(arm === 'skill' ? skillText(file.path) : null) },
      { role: 'user', content: userMessage(c) },
    ];
    const r = await chatImpl({
      baseUrl: opts.baseUrl, apiKey: process.env[opts.apiKeyEnv], model: opts.model,
      messages, temperature: opts.temperature, maxTokens: opts.maxTokens,
    });
    const failures = runChecks(c.checks, r.text);
    let verdicts = null;
    if (opts.judgeModel && c.expectations.length) {
      const j = await chatImpl({
        baseUrl: opts.judgeBaseUrl ?? opts.baseUrl,
        apiKey: process.env[opts.judgeApiKeyEnv ?? opts.apiKeyEnv],
        model: opts.judgeModel,
        messages: [{ role: 'user', content: judgePrompt(c, r.text) }],
        temperature: 0,
      });
      verdicts = parseJudge(j.text, c.expectations.length);
      verdicts.forEach((v, i) => { if (!v.met) failures.push(`expectation not met: ${c.expectations[i]}`); });
    }
    const hasChecks = c.checks.all.length + c.checks.any.length + c.checks.none.length > 0;
    const graded = hasChecks || verdicts !== null;
    return { ...base, passed: graded && failures.length === 0, graded, failures, verdicts, reply: r.text, usage: r.usage, model: r.model };
  } catch (e) {
    return { ...base, passed: false, graded: false, error: e.message };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const files = loadCaseFiles();
  if (opts.list) {
    for (const f of files) console.log(`${f.skill}\t${f.cases.length} case(s)\t${f.path}`);
    return 0;
  }
  const jobs = plan(files, opts);
  if (!jobs.length) { console.error('no cases match'); return 2; }
  if (opts.dryRun) {
    for (const j of jobs) console.log(`${j.file.skill}/${j.c.id} [${j.arm}]`);
    console.log(`${jobs.length} request(s) to the model under test${opts.judgeModel ? ', plus one judge request per case with expectations' : ''}`);
    return 0;
  }
  const results = await pool(jobs, opts.concurrency, async (j) => {
    const r = await runJob(j, opts);
    const mark = r.error ? 'ERROR' : !r.graded ? 'UNGRADED' : r.passed ? 'PASS' : 'FAIL';
    console.log(`${mark.padEnd(8)} ${r.skill}/${r.case} [${r.arm}]${r.error ? `: ${r.error}` : r.failures?.length ? `: ${r.failures[0]}` : ''}`);
    return r;
  });
  mkdirSync(opts.out, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(opts.out, `run-${stamp}.json`);
  const summary = summarise(results);
  writeFileSync(path, JSON.stringify({ model: opts.model, judge: opts.judgeModel ?? null, baseUrl: opts.baseUrl, summary, results }, null, 2));
  for (const [arm, s] of Object.entries(summary)) console.log(`${arm}: ${s.passed} passed, ${s.failed} failed, ${s.errors} errors`);
  console.log(`results: ${path}`);
  return results.some((r) => r.arm === 'skill' && (r.error || (r.graded && !r.passed))) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(`error: ${e.message}`); process.exitCode = 2; });
}
