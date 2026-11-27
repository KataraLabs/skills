import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

// Every regular file under dir, as forward-slash paths relative to dir, sorted.
export function walkFiles(dir, { skip = ['.git', 'node_modules'] } = {}) {
  const out = [];
  const visit = (d) => {
    for (const name of readdirSync(d).sort()) {
      if (skip.includes(name)) continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) visit(p);
      else if (st.isFile()) out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  visit(dir);
  return out.sort();
}

// Every folder holding a SKILL.md, relative to root.
export function findSkills(root) {
  return walkFiles(root)
    .filter((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md'))
    .map((p) => p.slice(0, -'/SKILL.md'.length));
}
