import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareUpstream, expandMappings, loadSources, verify, root } from '../scripts/sources.mjs';
import { sha256, walkFiles } from '../scripts/lib/files.mjs';

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'skills-test-'));
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
}

test('expandMappings maps directories, single files and exclusions', () => {
  const up = tree({ 'LICENSE': 'mit', 'skills/a/SKILL.md': 'a', 'skills/b/SKILL.md': 'b', 'skills/b/x.md': 'x', 'cmd/a.toml': 't' });
  const local = tree({ 'out/LICENSE': 'mit', 'out/a/SKILL.md': 'a-edited', 'out/c/SKILL.md': 'converted' });
  try {
    const files = expandMappings({ id: 's', commit: 'c', mappings: [
      { upstream: 'LICENSE', local: 'out/LICENSE' },
      { upstream: 'skills/', local: 'out/', exclude: ['skills/b/'] },
      { upstream: 'cmd/a.toml', local: 'out/c/SKILL.md' },
    ] }, up, local);
    assert.deepEqual(files.map((f) => [f.upstream, f.local]), [
      ['LICENSE', 'out/LICENSE'], ['skills/a/SKILL.md', 'out/a/SKILL.md'], ['cmd/a.toml', 'out/c/SKILL.md'],
    ]);
    assert.equal(files[0].sha256, files[0].local_sha256);
    assert.notEqual(files[1].sha256, files[1].local_sha256);
    assert.throws(() => expandMappings({ id: 's', commit: 'c', mappings: [{ upstream: 'nope/', local: 'x/' }] }, up, local), /matches nothing/);
  } finally { rmSync(up, { recursive: true }); rmSync(local, { recursive: true }); }
});

test('verify flags missing, changed and drifted-from-upstream files', () => {
  const local = tree({ 'a': 'one', 'b': 'two' });
  try {
    const doc = { sources: [{ id: 's', modified: false, files: [
      { local: 'a', sha256: sha256('one'), local_sha256: sha256('one') },
      { local: 'b', sha256: sha256('upstream two'), local_sha256: sha256('two') },
      { local: 'c', sha256: 'x', local_sha256: 'x' },
    ] }, { id: 'm', modified: true, files: [{ local: 'a', sha256: sha256('old'), local_sha256: sha256('changed') }] }] };
    const { problems, count } = verify(doc, local);
    assert.equal(count, 4);
    assert.equal(problems.length, 3);
    assert.match(problems[0], /recorded as an unchanged copy/);
    assert.match(problems[1], /missing c/);
    assert.match(problems[2], /changed since it was pinned/);
  } finally { rmSync(local, { recursive: true }); }
});

test('compareUpstream reports changed, removed and newly added mapped files', () => {
  const source = {
    mappings: [{ upstream: 'skills/', local: 'x/', exclude: ['skills/skip/'] }, { upstream: 'LICENSE', local: 'x/LICENSE' }],
    files: [{ upstream: 'skills/a/SKILL.md', sha256: '1' }, { upstream: 'skills/b/SKILL.md', sha256: '2' }, { upstream: 'LICENSE', sha256: '3' }],
  };
  const now = new Map([['skills/a/SKILL.md', '1'], ['LICENSE', '9'], ['skills/new/SKILL.md', '4'], ['skills/skip/SKILL.md', '5'], ['README.md', '6']]);
  assert.deepEqual(compareUpstream(source, now), { changed: ['LICENSE'], removed: ['skills/b/SKILL.md'], added: ['skills/new/SKILL.md'] });
});

test('sources.json loads, pins full shas, and matches the files here', () => {
  const doc = loadSources();
  assert.ok(doc.sources.length >= 4);
  const { problems } = verify(doc);
  assert.deepEqual(problems, []);
});

test('every file under an outside folder is pinned or is our own folder README', () => {
  const doc = loadSources();
  const pinned = new Set(doc.sources.flatMap((s) => s.files.map((f) => f.local)));
  const stray = [];
  for (const s of doc.sources) {
    for (const p of walkFiles(join(root, s.folder))) {
      const rel = `${s.folder}/${p}`;
      if (!pinned.has(rel) && p !== 'README.md') stray.push(rel);
    }
  }
  assert.deepEqual(stray, []);
});
