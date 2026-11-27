import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { build, collect } from '../scripts/release.mjs';
import { header, tar } from '../scripts/lib/tar.mjs';
import { sha256 } from '../scripts/lib/files.mjs';

const entries = [
  { path: 'LICENSE', data: Buffer.from('mit\n'), mode: 0o644 },
  { path: `skills/${'a'.repeat(90)}/${'b'.repeat(40)}/SKILL.md`, data: Buffer.from('---\nname: b\n---\n'), mode: 0o644 },
  { path: 'skills/x/run.sh', data: Buffer.from('#!/bin/sh\n'), mode: 0o755 },
];

test('tar headers carry a valid checksum and split long paths into prefix and name', () => {
  const h = header(entries[1].path, 10);
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
  assert.equal(parseInt(h.subarray(148, 155).toString('ascii'), 8), sum);
  assert.ok(h.subarray(345, 500).toString('utf8').replace(/\0+$/, '').startsWith('skills/aaaa'));
  assert.throws(() => header(`${'x'.repeat(200)}/${'y'.repeat(120)}`, 1), /too long/);
});

test('build is reproducible and the system tar can read it', () => {
  const a = build('1.2.3', entries);
  const b = build('1.2.3', entries);
  assert.equal(a.sha256, b.sha256);
  assert.equal(a.sha256, sha256(a.archive));
  assert.equal(a.name, 'skills-1.2.3.tar.gz');
  const dir = mkdtempSync(join(tmpdir(), 'skills-release-'));
  try {
    writeFileSync(join(dir, a.name), a.archive);
    const list = execFileSync('tar', ['-tzf', join(dir, a.name)], { encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(list, [
      'skills-1.2.3/LICENSE',
      'skills-1.2.3/MANIFEST.json',
      `skills-1.2.3/${entries[1].path}`,
      'skills-1.2.3/skills/x/run.sh',
    ]);
    execFileSync('tar', ['-xzf', join(dir, a.name), '-C', dir]);
    const man = JSON.parse(readFileSync(join(dir, 'skills-1.2.3', 'MANIFEST.json'), 'utf8'));
    for (const f of man.files) assert.equal(sha256(readFileSync(join(dir, 'skills-1.2.3', f.path))), f.sha256);
  } finally { rmSync(dir, { recursive: true }); }
});

test('build rejects a malformed version, and a different version changes the checksum', () => {
  assert.throws(() => build('v1', entries), /version/);
  assert.notEqual(build('1.0.0', entries).sha256, build('1.0.1', entries).sha256);
});

test('the archive ends with two zero blocks and pads each file', () => {
  const t = gunzipSync(build('0.0.1', entries).archive);
  assert.equal(t.length % 512, 0);
  assert.ok(t.subarray(-1024).every((x) => x === 0));
  assert.equal(tar([]).length, 1024);
});

test('collect includes the top files and every skill file', () => {
  const files = collect().map((e) => e.path);
  for (const f of ['LICENSE', 'NOTICE', 'sources.json', 'skills/katara/go/SKILL.md']) assert.ok(files.includes(f), f);
  assert.ok(!files.some((f) => f.startsWith('evals/') || f.startsWith('test/')));
});

test('build puts index.json in the archive and in the manifest when given', () => {
  const idx = { name: 'skills', version: '1.0.0', skills: [] };
  const r = build('1.0.0', entries, idx);
  const t = gunzipSync(r.archive).toString('latin1');
  assert.ok(t.includes('skills-1.0.0/index.json'));
  const man = JSON.parse(r.manifest);
  assert.ok(man.files.some((f) => f.path === 'index.json' && f.sha256 === sha256(r.index)));
});
