// The skills index: one entry per skill with its id, description, source, license and digest.
// Clients that pin a release use it to list skills and to check a skill's files.
//
// Digest rule (shared with the clients and the server that store organization skills):
// take every file of the skill folder, SKILL.md included, with paths relative to that folder;
// sort by path in byte order; for each, append path + "\n" + lowercase hex sha256 of the file's
// bytes + "\n"; the digest is the lowercase hex sha256 of that text. For UTF-8 text the bytes are
// the UTF-8 encoding, so the rule matches clients that hash text content. Folders holding their
// own SKILL.md are separate skills and are left out of the parent's file set.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, sha256File, walkFiles } from './files.mjs';
import { parseFrontMatter } from './frontmatter.mjs';

function byteCompare(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

// files: [{ path, sha256 }] with paths relative to the skill folder.
export function digestOf(files) {
  const lines = [...files].sort((a, b) => byteCompare(a.path, b.path)).map((f) => `${f.path}\n${f.sha256}\n`);
  return sha256(lines.join(''));
}

// Files of the skill at dir, excluding nested skills.
export function skillFiles(dir) {
  const all = walkFiles(dir);
  const nested = all
    .filter((p) => p.endsWith('/SKILL.md'))
    .map((p) => p.slice(0, -'SKILL.md'.length));
  return all
    .filter((p) => !nested.some((n) => p.startsWith(n)))
    .map((p) => ({ path: p, size: readFileSync(join(dir, p)).length, sha256: sha256File(join(dir, p)) }));
}

// Language detection hints from front matter metadata: space-separated lists a client can
// match against a project before it offers the skill.
const DETECT = { 'file-types': 'file_types', 'project-files': 'project_files', 'package-dependencies': 'package_dependencies' };

export function detectHints(metadata) {
  if (typeof metadata !== 'string') return null;
  const out = {};
  for (const line of metadata.split('\n')) {
    const m = /^\s+([a-z-]+):\s*(.*)$/.exec(line);
    if (!m || !DETECT[m[1]]) continue;
    const v = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    out[DETECT[m[1]]] = v.split(/\s+/).filter(Boolean);
  }
  return Object.keys(out).length ? out : null;
}

// One description line: front matter descriptions may be folded over several lines.
function oneLine(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

const KINDS = new Set(['language', 'framework', 'workflow']);

// Adds kind, detect, default and servable from classification.json. A skill's own entry wins
// over its folder's; skills from other repositories that are not listed are workflow skills.
export function classify(entry, c) {
  const own = c.skills?.[entry.name] ?? {};
  const folder = entry.folder ? Object.entries(c.folders ?? {}).find(([f]) => entry.folder === f || entry.folder.startsWith(`${f}/`))?.[1] : null;
  const kind = own.kind ?? folder?.kind ?? 'workflow';
  if (!KINDS.has(kind)) throw new Error(`${entry.name}: unknown kind ${kind}`);
  entry.kind = kind;
  if (own.detect) entry.detect = { ...(entry.detect ?? {}), ...own.detect };
  // Language and framework skills are attached whenever their signals match, so their default
  // is on and not switchable; workflow skills are off unless listed in default_on.
  if (kind === 'workflow') entry.default = (c.default_on ?? []).includes(entry.name) ? 'on' : 'off';
  else if (!entry.detect || !Object.values(entry.detect).some((v) => v.length)) {
    throw new Error(`${entry.name}: a ${kind} skill needs detect signals`);
  } else entry.default = 'on';
  const blocked = (c.not_servable_licenses ?? []).includes(entry.license);
  entry.servable = !entry.source?.external && !blocked;
  // sha256 is the digest of what a server may hand out; null when it may not hand it out.
  // digest stays set either way, so a client that fetches an external skill can still check it.
  entry.sha256 = entry.servable ? entry.digest : null;
  return entry;
}

// skills: paths like "skills/katara/go"; sources: parsed sources.json; bundled: set of names.
export function buildIndex({ root, version, skills, sources, bundled, external = [], classification = null }) {
  const sourceFor = (dir) => sources.sources.find((s) => dir === s.folder || dir.startsWith(`${s.folder}/`));
  const entries = skills.map((dir) => {
    const { data } = parseFrontMatter(readFileSync(join(root, dir, 'SKILL.md'), 'utf8'));
    const files = skillFiles(join(root, dir));
    const src = sourceFor(dir);
    const name = data.name;
    const detect = detectHints(data.metadata);
    return {
      id: `${bundled.has(name) ? 'bundled' : 'catalog'}:${name}`,
      name,
      description: oneLine(data.description),
      folder: dir,
      source: src
        ? { repository: src.repository, commit: src.commit, modified: Boolean(src.modified) }
        : { repository: 'https://github.com/KataraLabs/skills', commit: null, modified: false },
      license: src ? src.license : 'MIT',
      attribution: src ? src.attribution ?? null : null,
      version,
      digest: digestOf(files),
      files: files.length,
      size: files.reduce((n, f) => n + f.size, 0),
      ...(detect ? { detect } : {}),
    };
  });
  const missing = [...bundled].filter((n) => !entries.some((e) => e.name === n));
  if (missing.length) throw new Error(`bundle names skills that do not exist: ${missing.join(', ')}`);
  for (const x of external) {
    for (const k of ['name', 'description', 'repository', 'commit', 'path', 'digest']) {
      if (!x[k]) throw new Error(`external catalog entry ${x.name ?? '?'} lacks "${k}"`);
    }
    if (entries.some((e) => e.name === x.name)) throw new Error(`external catalog entry ${x.name} clashes with a bundled or catalog skill`);
    entries.push({
      id: `catalog:${x.name}`,
      name: x.name,
      description: oneLine(x.description),
      folder: null,
      source: { repository: x.repository, commit: x.commit, path: x.path, modified: false, external: true },
      license: x.license ?? null,
      attribution: x.attribution ?? null,
      version: x.version ?? x.commit,
      digest: x.digest,
    });
  }
  if (classification) for (const e of entries) classify(e, classification);
  entries.sort((a, b) => byteCompare(a.id, b.id));
  const ids = new Set();
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error(`duplicate skill id ${e.id}`);
    ids.add(e.id);
  }
  return {
    name: 'skills',
    version,
    digest_rule: 'sha256 over the skill folder files sorted by path in byte order, each contributing path + "\\n" + lowercase hex sha256 of its bytes + "\\n"; nested skill folders excluded',
    skills: entries,
  };
}
