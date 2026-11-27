// Reads the YAML front matter of a SKILL.md file. Skills use a small subset of YAML:
// scalar keys, folded or literal block scalars (`>` / `|`), and nested maps or lists that
// we keep as raw text. A full YAML parser would be a dependency for two fields.

export class FrontMatterError extends Error {}

export function splitFrontMatter(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!src.startsWith('---\n')) throw new FrontMatterError('no front matter: the file must start with ---');
  const end = src.indexOf('\n---', 4);
  if (end === -1) throw new FrontMatterError('front matter is not closed with ---');
  const after = src.indexOf('\n', end + 4);
  return { yaml: src.slice(4, end + 1), body: after === -1 ? '' : src.slice(after + 1) };
}

function unquote(v) {
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    const inner = v.slice(1, -1);
    return v[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner.replace(/''/g, "'");
  }
  return v;
}

export function parseFrontMatter(text) {
  const { yaml, body } = splitFrontMatter(text);
  const lines = yaml.split('\n');
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const m = /^([A-Za-z0-9_-]+):(?:\s(.*)|)$/.exec(line);
    if (!m) continue; // continuation lines of a nested value are consumed below
    const key = m[1];
    const raw = (m[2] ?? '').trim();
    const block = [];
    let j = i + 1;
    while (j < lines.length && (lines[j] === '' || /^\s/.test(lines[j]))) block.push(lines[j++]);
    while (block.length && block.at(-1).trim() === '') block.pop();
    if (raw === '>' || raw === '>-' || raw === '|' || raw === '|-') {
      const indent = Math.min(...block.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
      const parts = block.map((l) => l.slice(indent));
      data[key] = raw.startsWith('>')
        ? parts.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ').trim()
        : parts.join('\n').trimEnd();
      i = j - 1;
    } else if (raw === '') {
      data[key] = block.join('\n');
      i = j - 1;
    } else {
      // A plain scalar may continue on more-indented lines.
      const cont = block.map((l) => l.trim()).filter(Boolean);
      data[key] = unquote([raw, ...cont].join(' '));
      i = j - 1;
    }
  }
  return { data, body };
}

// The open SKILL.md format requires a name (lowercase, digits, hyphens) and a description.
export function validateSkill(text, folderName) {
  const problems = [];
  let parsed;
  try { parsed = parseFrontMatter(text); } catch (e) { return [e.message]; }
  const { name, description } = parsed.data;
  if (!name) problems.push('missing name');
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) problems.push(`name "${name}" must be lowercase words joined by hyphens`);
  else if (folderName && name !== folderName) problems.push(`name "${name}" does not match folder "${folderName}"`);
  if (!description || !String(description).trim()) problems.push('missing description');
  else if (String(description).length > 1024) problems.push('description longer than 1024 characters');
  if (!parsed.body.trim()) problems.push('empty body');
  return problems;
}
