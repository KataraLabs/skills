#!/usr/bin/env node
// Builds a versioned, reproducible release of the skills.
//
//   node scripts/release.mjs 1.0.0 [--out dist]
//
// Writes, under the output folder:
//   skills-<version>.tar.gz          skills/, top-level files, index.json and MANIFEST.json,
//                                    all under a top folder skills-<version>/
//   skills-<version>.manifest.json   the same manifest: every file's path, size and sha256
//   skills-<version>.index.json      the skills index (also index.json in the archive): id,
//                                    name, description, folder, source, license, version, digest
//   skills-<version>.tar.gz.sha256   the archive's checksum, in sha256sum format
//
// The archive is byte-for-byte reproducible from the same commit: entries are sorted, and
// timestamps, owners and modes are fixed. A client pins the archive checksum and can check
// each extracted file against the manifest.

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { findSkills, sha256, walkFiles } from './lib/files.mjs';
import { buildIndex } from './lib/index.mjs';
import { tar } from './lib/tar.mjs';
import { loadSources, verify } from './sources.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const TOP_FILES = ['LICENSE', 'NOTICE', 'sources.json', 'bundle.json', 'catalog-external.json'];

export function collect(base = root) {
  const files = [...TOP_FILES, ...walkFiles(join(base, 'skills')).map((p) => `skills/${p}`)].sort();
  return files.map((p) => {
    const data = readFileSync(join(base, p));
    // Keep the executable bit for helper scripts; everything else is 0644.
    const exec = (statSync(join(base, p)).mode & 0o111) !== 0;
    return { path: p, data, mode: exec ? 0o755 : 0o644 };
  });
}

export function manifest(version, entries) {
  return {
    name: 'skills',
    version,
    files: entries.map((e) => ({ path: e.path, size: e.data.length, sha256: sha256(e.data) })),
  };
}

export function index(version, base = root) {
  const read = (f) => JSON.parse(readFileSync(join(base, f), 'utf8'));
  return buildIndex({
    root: base,
    version,
    skills: findSkills(join(base, 'skills')).map((p) => `skills/${p}`),
    sources: read('sources.json'),
    bundled: new Set(read('bundle.json').bundled),
    external: read('catalog-external.json').entries,
  });
}

export function build(version, entries, idx = null) {
  checkVersion(version);
  const extra = [];
  let indexBytes = null;
  if (idx) {
    indexBytes = Buffer.from(JSON.stringify(idx, null, 2) + '\n');
    extra.push({ path: 'index.json', data: indexBytes, mode: 0o644 });
  }
  const man = manifest(version, [...entries, ...extra]);
  const manBytes = Buffer.from(JSON.stringify(man, null, 2) + '\n');
  const top = `skills-${version}`;
  const all = [...entries, ...extra, { path: 'MANIFEST.json', data: manBytes, mode: 0o644 }]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((e) => ({ ...e, path: `${top}/${e.path}` }));
  const archive = gzipSync(tar(all), { level: 9 });
  return { archive, manifest: manBytes, index: indexBytes, sha256: sha256(archive), name: `${top}.tar.gz` };
}

function checkVersion(version) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`version must look like 1.2.3, got ${version}`);
}

function main(argv) {
  const version = argv[0];
  if (!version) { console.error('usage: release.mjs VERSION [--out DIR]'); return 2; }
  const i = argv.indexOf('--out');
  const out = i === -1 ? join(root, 'dist') : argv[i + 1];
  const { problems } = verify(loadSources());
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error('release: sources.json does not match the files; fix that first');
    return 1;
  }
  checkVersion(version);
  const r = build(version, collect(), index(version));
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, r.name), r.archive);
  writeFileSync(join(out, `skills-${version}.manifest.json`), r.manifest);
  writeFileSync(join(out, `skills-${version}.index.json`), r.index);
  writeFileSync(join(out, `${r.name}.sha256`), `${r.sha256}  ${r.name}\n`);
  console.log(`${r.name}  ${r.archive.length} bytes`);
  console.log(`sha256 ${r.sha256}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`error: ${e.message}`); process.exitCode = 2; }
}
