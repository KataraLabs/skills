// Every SKILL.md front matter must be valid YAML under a strict parser, since clients parse it
// with real YAML libraries. Our own lenient reader would accept text they reject.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { findSkills } from '../scripts/lib/files.mjs';
import { parseFrontMatter, splitFrontMatter } from '../scripts/lib/frontmatter.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('every SKILL.md front matter parses as strict YAML and agrees with our reader', () => {
  const problems = [];
  for (const dir of findSkills(join(root, 'skills'))) {
    const text = readFileSync(join(root, 'skills', dir, 'SKILL.md'), 'utf8');
    const { yaml } = splitFrontMatter(text);
    const doc = YAML.parseDocument(yaml, { strict: true, uniqueKeys: true, prettyErrors: false });
    if (doc.errors.length) { problems.push(`skills/${dir}: ${doc.errors[0].message.split('\n')[0]}`); continue; }
    const data = doc.toJS();
    if (!data || typeof data !== 'object' || Array.isArray(data)) { problems.push(`skills/${dir}: front matter is not a mapping`); continue; }
    if (typeof data.name !== 'string' || typeof data.description !== 'string') {
      problems.push(`skills/${dir}: name and description must be strings`);
      continue;
    }
    const ours = parseFrontMatter(text).data;
    if (ours.name !== data.name) problems.push(`skills/${dir}: name reads as ${ours.name}, YAML says ${data.name}`);
    if (ours.description.replace(/\s+/g, ' ').trim() !== data.description.replace(/\s+/g, ' ').trim()) {
      problems.push(`skills/${dir}: description differs between our reader and YAML`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the strict parser rejects an unquoted colon-space in a plain scalar', () => {
  const doc = YAML.parseDocument('name: x\ndescription: Use when: things\n', { strict: true });
  assert.ok(doc.errors.length > 0);
});
