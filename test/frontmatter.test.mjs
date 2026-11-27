import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter, splitFrontMatter, validateSkill, FrontMatterError } from '../scripts/lib/frontmatter.mjs';

test('plain, quoted and continued scalars', () => {
  const { data, body } = parseFrontMatter('---\nname: go\ndescription: "Use when: Go"\nother: one\n  two\n---\n# Body\n');
  assert.equal(data.name, 'go');
  assert.equal(data.description, 'Use when: Go');
  assert.equal(data.other, 'one two');
  assert.equal(body, '# Body\n');
});

test('folded and literal block scalars', () => {
  const { data } = parseFrontMatter('---\nname: x\ndescription: >\n  first line\n  second line\nnotes: |\n  a\n  b\n---\nbody');
  assert.equal(data.description, 'first line second line');
  assert.equal(data.notes, 'a\nb');
});

test('nested maps are kept as raw text and do not swallow later keys', () => {
  const { data } = parseFrontMatter('---\nname: x\nmetadata:\n  author: someone\n  version: "1"\ndescription: d\n---\nb');
  assert.match(data.metadata, /author: someone/);
  assert.equal(data.description, 'd');
});

test('CRLF and BOM are accepted; missing or unclosed front matter is not', () => {
  assert.equal(parseFrontMatter('﻿---\r\nname: a\r\n---\r\nbody').data.name, 'a');
  assert.throws(() => splitFrontMatter('# no front matter'), FrontMatterError);
  assert.throws(() => splitFrontMatter('---\nname: a\n'), /not closed/);
});

test('validateSkill checks name shape, folder match, description and body', () => {
  assert.deepEqual(validateSkill('---\nname: go\ndescription: Use for Go.\n---\nbody', 'go'), []);
  assert.deepEqual(validateSkill('---\nname: Go\ndescription: d\n---\nbody'), ['name "Go" must be lowercase words joined by hyphens']);
  assert.deepEqual(validateSkill('---\nname: go\ndescription: d\n---\nbody', 'rust'), ['name "go" does not match folder "rust"']);
  assert.deepEqual(validateSkill('---\nname: go\n---\n'), ['missing description', 'empty body']);
  assert.deepEqual(validateSkill(`---\nname: go\ndescription: ${'x'.repeat(1025)}\n---\nb`), ['description longer than 1024 characters']);
});
