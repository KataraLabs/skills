#!/usr/bin/env node
// Pins every file copied from another repository: its source repository, the exact
// commit, the upstream path and the sha256 of the upstream bytes, plus the sha256 of the
// file as it stands here (equal for files kept unchanged).
//
//   node scripts/sources.mjs verify              local files match sources.json
//   node scripts/sources.mjs drift [--id NAME]   compare the pins with upstream's default branch
//   node scripts/sources.mjs generate --checkout ID=DIR ...
//                                                rewrite sources.json from checkouts at the pinned commits
//
// verify needs nothing but this repository. drift and generate need git and network access
// (generate takes local checkouts so it never fetches on its own).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File, walkFiles } from './lib/files.mjs';

export const root = fileURLToPath(new URL('..', import.meta.url));

export function loadSources(path = join(root, 'sources.json')) {
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  if (doc.version !== 1 || !Array.isArray(doc.sources)) throw new Error('sources.json: expected {"version": 1, "sources": [...]}');
  for (const s of doc.sources) {
    for (const k of ['id', 'repository', 'commit', 'license', 'folder', 'mappings', 'files']) {
      if (s[k] === undefined) throw new Error(`sources.json: source ${s.id ?? '?'} lacks "${k}"`);
    }
    if (!/^[0-9a-f]{40}$/.test(s.commit)) throw new Error(`sources.json: ${s.id}: commit must be a full 40-character sha`);
  }
  return doc;
}

// Expand mappings against an upstream checkout into file entries. A mapping copies one
// upstream directory or file to a local path; `exclude` drops upstream paths by prefix;
// `local` may be a file path for single-file mappings (a renamed or converted file).
export function expandMappings(source, checkoutDir, localRoot = root) {
  const all = walkFiles(checkoutDir);
  const files = [];
  for (const m of source.mappings) {
    const isDir = m.upstream.endsWith('/');
    const picked = isDir ? all.filter((p) => p.startsWith(m.upstream)) : all.filter((p) => p === m.upstream);
    if (!picked.length) throw new Error(`${source.id}: mapping ${m.upstream} matches nothing at ${source.commit}`);
    for (const up of picked) {
      if ((m.exclude ?? []).some((x) => up.startsWith(x))) continue;
      const local = isDir ? m.local + up.slice(m.upstream.length) : m.local;
      const localPath = join(localRoot, local);
      files.push({
        upstream: up,
        sha256: sha256File(join(checkoutDir, up)),
        local,
        local_sha256: existsSync(localPath) ? sha256File(localPath) : null,
      });
    }
  }
  return files;
}

// Local files must exist with the recorded hash, and a file recorded as unchanged must
// still hash to the upstream bytes.
export function verify(doc, localRoot = root) {
  const problems = [];
  let count = 0;
  for (const s of doc.sources) {
    for (const f of s.files) {
      count++;
      const p = join(localRoot, f.local);
      if (!existsSync(p)) { problems.push(`${s.id}: missing ${f.local}`); continue; }
      const actual = sha256File(p);
      if (actual !== f.local_sha256) problems.push(`${s.id}: ${f.local} changed since it was pinned (sha256 ${actual.slice(0, 12)}, pinned ${String(f.local_sha256).slice(0, 12)})`);
      if (!s.modified && f.local_sha256 !== f.sha256) problems.push(`${s.id}: ${f.local} is recorded as an unchanged copy but differs from upstream`);
    }
  }
  return { problems, count };
}

// Compare pinned upstream hashes with a newer upstream tree. Returns changed, removed and
// added paths (added only within mapped directories, so unrelated upstream work is quiet).
export function compareUpstream(source, upstreamHashes) {
  const pinned = new Map(source.files.map((f) => [f.upstream, f.sha256]));
  const changed = [];
  const removed = [];
  for (const [path, sum] of pinned) {
    if (!upstreamHashes.has(path)) removed.push(path);
    else if (upstreamHashes.get(path) !== sum) changed.push(path);
  }
  const added = [];
  for (const path of upstreamHashes.keys()) {
    if (pinned.has(path)) continue;
    const mapped = source.mappings.some((m) => m.upstream.endsWith('/') && path.startsWith(m.upstream) && !(m.exclude ?? []).some((x) => path.startsWith(x)));
    if (mapped) added.push(path);
  }
  return { changed: changed.sort(), removed: removed.sort(), added: added.sort() };
}

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function hashTree(dir) {
  return new Map(walkFiles(dir).map((p) => [p, sha256File(join(dir, p))]));
}

function drift(doc, onlyId) {
  let drifted = 0;
  for (const s of doc.sources) {
    if (onlyId && s.id !== onlyId) continue;
    const dir = mkdtempSync(join(tmpdir(), `skills-drift-${s.id}-`));
    try {
      git(['clone', '--quiet', '--depth', '1', s.repository, dir]);
      const head = git(['-C', dir, 'rev-parse', 'HEAD']);
      const r = compareUpstream(s, hashTree(dir));
      const n = r.changed.length + r.removed.length + r.added.length;
      if (head === s.commit) console.log(`${s.id}: upstream is at the pinned commit ${head.slice(0, 12)}`);
      else console.log(`${s.id}: pinned ${s.commit.slice(0, 12)}, upstream ${head.slice(0, 12)}; ${n} file(s) differ in the copied paths`);
      for (const p of r.changed) console.log(`  changed  ${p}`);
      for (const p of r.removed) console.log(`  removed  ${p}`);
      for (const p of r.added) console.log(`  added    ${p}`);
      if (n) drifted++;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return drifted;
}

function generate(doc, checkouts) {
  for (const s of doc.sources) {
    const dir = checkouts[s.id];
    if (!dir) { console.log(`${s.id}: no checkout given, kept as is`); continue; }
    const head = git(['-C', dir, 'rev-parse', 'HEAD']);
    if (head !== s.commit) throw new Error(`${s.id}: checkout is at ${head}, sources.json pins ${s.commit}`);
    s.files = expandMappings(s, dir);
    const missing = s.files.filter((f) => f.local_sha256 === null);
    if (missing.length) throw new Error(`${s.id}: ${missing.length} mapped file(s) not present here, first ${missing[0].local}`);
    console.log(`${s.id}: ${s.files.length} files pinned at ${s.commit.slice(0, 12)}`);
  }
  writeFileSync(join(root, 'sources.json'), JSON.stringify(doc, null, 2) + '\n');
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (name) => { const i = rest.indexOf(name); return i === -1 ? undefined : rest[i + 1]; };
  const doc = loadSources();
  if (cmd === 'verify') {
    const { problems, count } = verify(doc);
    for (const p of problems) console.error(p);
    console.log(problems.length ? `sources: ${problems.length} problem(s) in ${count} pinned files` : `sources: ${count} pinned files match`);
    return problems.length ? 1 : 0;
  }
  if (cmd === 'drift') {
    return drift(doc, opt('--id')) ? 3 : 0;
  }
  if (cmd === 'generate') {
    const checkouts = {};
    rest.forEach((a, i) => { if (rest[i - 1] === '--checkout') { const [id, dir] = a.split('='); checkouts[id] = dir; } });
    generate(doc, checkouts);
    return 0;
  }
  console.error('usage: sources.mjs verify | drift [--id NAME] | generate --checkout ID=DIR ...');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`error: ${e.message}`); process.exitCode = 2; }
}
