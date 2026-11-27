// Checks over the repository itself: every skill is well formed, names are unique, every
// skill has eval cases, and every case file points at a real skill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSkills } from '../scripts/lib/files.mjs';
import { parseFrontMatter, validateSkill } from '../scripts/lib/frontmatter.mjs';
import { loadCaseFiles } from '../evals/run.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const skills = findSkills(join(root, 'skills')).map((p) => `skills/${p}`);

test('every SKILL.md has a valid name and description', () => {
  const problems = [];
  for (const dir of skills) {
    const text = readFileSync(join(root, dir, 'SKILL.md'), 'utf8');
    // Copies kept unchanged are checked for parseable front matter only; their names are upstream's.
    const ours = dir.startsWith('skills/katara/') || dir.startsWith('skills/addyosmani/');
    for (const p of validateSkill(text, ours ? basename(dir) : undefined)) problems.push(`${dir}: ${p}`);
  }
  assert.deepEqual(problems, []);
});

test('skill names are unique across the repository', () => {
  const seen = new Map();
  const dupes = [];
  for (const dir of skills) {
    const { name } = parseFrontMatter(readFileSync(join(root, dir, 'SKILL.md'), 'utf8')).data;
    if (seen.has(name)) dupes.push(`${name}: ${seen.get(name)} and ${dir}`);
    seen.set(name, dir);
  }
  assert.deepEqual(dupes, []);
});

test('every skill has eval cases and every case file names a real skill', () => {
  const files = loadCaseFiles();
  const covered = new Set(files.map((f) => f.path));
  const missing = skills.filter((s) => !covered.has(s));
  assert.deepEqual(missing, [], 'skills without eval cases');
  for (const f of files) {
    assert.ok(existsSync(join(root, f.path, 'SKILL.md')), `${f.path} has no SKILL.md`);
    const { name } = parseFrontMatter(readFileSync(join(root, f.path, 'SKILL.md'), 'utf8')).data;
    assert.equal(f.skill, name, `case file for ${f.path} names ${f.skill}, the skill is ${name}`);
  }
});
