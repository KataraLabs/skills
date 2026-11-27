import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex, classify, detectHints, digestOf, skillFiles } from '../scripts/lib/index.mjs';
import { index } from '../scripts/release.mjs';

const h = (s) => createHash('sha256').update(s).digest('hex');

test('digestOf follows the shared rule: byte-order paths, path NL hex NL', () => {
  // "Z" (0x5a) sorts before "a" (0x61) in byte order, unlike a locale sort.
  const files = [{ path: 'a.md', sha256: h('a') }, { path: 'SKILL.md', sha256: h('s') }, { path: 'Z.md', sha256: h('z') }];
  const expected = h(`SKILL.md\n${h('s')}\nZ.md\n${h('z')}\na.md\n${h('a')}\n`);
  assert.equal(digestOf(files), expected);
  assert.equal(digestOf([...files].reverse()), expected);
});

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'skills-index-'));
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
}

test('skillFiles leaves nested skills out of the parent', () => {
  const dir = tree({ 'SKILL.md': 's', 'ref/a.md': 'a', 'child/SKILL.md': 'c', 'child/x.md': 'x' });
  try {
    assert.deepEqual(skillFiles(dir).map((f) => f.path), ['SKILL.md', 'ref/a.md']);
  } finally { rmSync(dir, { recursive: true }); }
});

test('buildIndex assigns bundled and catalog ids, sources and licenses', () => {
  const root = tree({
    'skills/katara/go/SKILL.md': '---\nname: go\ndescription: >\n  Use for\n  Go.\n---\nbody\n',
    'skills/up/x/SKILL.md': '---\nname: x\ndescription: X.\n---\nbody\n',
  });
  try {
    const sources = { sources: [{ folder: 'skills/up', repository: 'https://example.com/up', commit: 'c'.repeat(40), license: 'CC-BY-SA-4.0', modified: false }] };
    const idx = buildIndex({ root, version: '1.0.0', skills: ['skills/katara/go', 'skills/up/x'], sources, bundled: new Set(['go']),
      external: [{ name: 'ext', description: 'E.', repository: 'https://example.com/e', commit: 'e'.repeat(40), path: 'skills/ext', digest: 'd'.repeat(64) }] });
    assert.deepEqual(idx.skills.map((s) => s.id), ['bundled:go', 'catalog:ext', 'catalog:x']);
    const go = idx.skills[0];
    assert.equal(go.description, 'Use for Go.');
    assert.equal(go.license, 'MIT');
    assert.equal(go.digest, digestOf([{ path: 'SKILL.md', sha256: h('---\nname: go\ndescription: >\n  Use for\n  Go.\n---\nbody\n') }]));
    assert.equal(idx.skills[2].license, 'CC-BY-SA-4.0');
    assert.equal(idx.skills[1].source.external, true);
    assert.throws(() => buildIndex({ root, version: '1', skills: ['skills/katara/go'], sources, bundled: new Set(['nope']) }), /do not exist/);
    assert.throws(() => buildIndex({ root, version: '1', skills: ['skills/katara/go'], sources, bundled: new Set(), external: [{ name: 'go', description: 'd', repository: 'r', commit: 'c', path: 'p', digest: 'd' }] }), /clashes/);
    assert.throws(() => buildIndex({ root, version: '1', skills: [], sources, bundled: new Set(), external: [{ name: 'e' }] }), /lacks/);
  } finally { rmSync(root, { recursive: true }); }
});

test('the repository index lists every skill once with a valid id and digest', () => {
  const idx = index('0.0.0');
  assert.ok(idx.skills.length > 100);
  for (const s of idx.skills) {
    assert.match(s.id, /^(bundled|catalog):[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(s.name.length <= 64, `${s.name} longer than 64`);
    assert.match(s.digest, /^[0-9a-f]{64}$/);
    assert.ok(s.description, `${s.id} has no description`);
  }
  const bundled = idx.skills.filter((s) => s.id.startsWith('bundled:'));
  assert.equal(bundled.length, 35);
  assert.ok(bundled.every((s) => s.folder.startsWith('skills/addyosmani/') && s.kind === 'workflow'));
  assert.deepEqual(idx.skills.filter((s) => s.kind === 'workflow' && s.default === 'on').map((s) => s.name).sort(),
    ['code-review-and-quality', 'debugging-and-error-recovery', 'planning-and-task-breakdown', 'test-driven-development']);
  for (const n of ['typescript', 'react', 'python', 'go', 'swift', 'rust', 'sql']) {
    const s = idx.skills.find((x) => x.id === `catalog:${n}`);
    assert.equal(s.kind, 'language');
    assert.ok(s.detect?.file_types?.length, `${n} has no file types`);
  }
  assert.deepEqual(idx.skills.find((x) => x.id === 'catalog:go').detect, { file_types: ['*.go'], project_files: ['go.mod', 'go.work'] });
  for (const s of idx.skills) {
    assert.ok(['language', 'framework', 'workflow'].includes(s.kind), `${s.id} kind`);
    assert.equal(typeof s.servable, 'boolean');
    assert.ok(['on', 'off'].includes(s.default), `${s.id} default`);
    if (s.kind !== 'workflow') assert.equal(s.default, 'on');
    assert.equal(s.sha256, s.servable ? s.digest : null, `${s.id} sha256`);
    for (const k of ['id', 'name', 'description', 'version', 'kind', 'default', 'servable']) assert.ok(k in s, `${s.id} lacks ${k}`);
    assert.ok('license' in s && 'sha256' in s);
  }
  const vercel = idx.skills.filter((s) => s.source.external);
  assert.equal(vercel.length, 5);
  assert.ok(vercel.every((s) => s.servable === false && s.sha256 === null && s.digest.length === 64));
  assert.ok(idx.skills.filter((s) => s.folder?.startsWith('skills/trailofbits/')).every((s) => s.kind === 'workflow' && s.default === 'off' && s.id.startsWith('catalog:')));
  assert.ok(idx.skills.filter((s) => s.folder?.startsWith('skills/callstack/react-')).every((s) => s.kind === 'framework'));
  assert.equal(idx.skills.find((s) => s.name === 'pytest-skill').kind, 'framework');
  for (const n of ['github-actions', 'test-framework-migration-skill', 'flaky-test-fixes-skill', 'api-graphql-grpc', 'openapi-spec-generator', 'api-mock-helper', 'api-to-testcase-generator']) {
    assert.equal(idx.skills.find((s) => s.name === n).kind, 'framework', n);
  }
  assert.deepEqual(idx.skills.find((s) => s.name === 'github-actions').detect.requires, { package_dependencies: ['react-native'] });
  assert.equal(idx.skills.find((s) => s.name === 'accessibility-skill').kind, 'workflow');
});

test('classify applies own entry over folder, defaults and servable', () => {
  const c = {
    folders: { 'skills/a': { kind: 'workflow' } },
    default_on: ['core'],
    not_servable_licenses: [null],
    skills: { fw: { kind: 'framework', detect: { project_files: ['x.config.js'] } }, bad: { kind: 'framework' } },
  };
  const e = (name, extra = {}) => ({ name, folder: `skills/a/${name}`, license: 'MIT', source: {}, ...extra });
  assert.deepEqual(classify({ ...e('core'), digest: 'd' }, c), { ...e('core'), digest: 'd', kind: 'workflow', default: 'on', servable: true, sha256: 'd' });
  assert.equal(classify(e('other'), c).default, 'off');
  const fw = classify(e('fw'), c);
  assert.equal(fw.kind, 'framework');
  assert.equal(fw.default, 'on');
  assert.deepEqual(fw.detect, { project_files: ['x.config.js'] });
  assert.throws(() => classify(e('bad'), c), /needs detect signals/);
  const g = { ...c, generic_project_files: ['package.json'], skills: { pj: { kind: 'framework', detect: { project_files: ['package.json'] } } } };
  assert.throws(() => classify(e('pj'), g), /names an ecosystem/);
  assert.throws(() => classify(e('k'), { skills: { k: { kind: 'tool' } } }), /unknown kind/);
  const ext = classify({ name: 'ext', folder: null, license: null, digest: 'd', source: { external: true } }, c);
  assert.equal(ext.servable, false);
  assert.equal(ext.sha256, null);
});

test('detectHints reads space-separated lists and ignores other metadata', () => {
  assert.deepEqual(detectHints('  file-types: "*.ts *.tsx"\n  project-files: tsconfig.json\n  source: x'), { file_types: ['*.ts', '*.tsx'], project_files: ['tsconfig.json'] });
  assert.equal(detectHints('  source: x'), null);
  assert.equal(detectHints(undefined), null);
});
