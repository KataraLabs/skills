// Eval case files: evals/cases/<folder>/<skill>.json
//
// {
//   "skill": "go",                       skill name, matches the SKILL.md front matter
//   "path": "skills/katara/go",          folder holding SKILL.md
//   "cases": [
//     {
//       "id": "wrap-errors",
//       "prompt": "...",                 the user's request, sent verbatim
//       "files": { "store.go": "..." },  optional fixture files shown to the model
//       "checks": {                      optional, deterministic, graded on the reply
//         "all": [{ "regex": "%w", "flags": "i", "why": "wraps with %w" }],
//         "any": [...],                  at least one must match
//         "none": [...]                  none may match
//       },
//       "expectations": ["..."]          graded by a judge model when one is given
//     }
//   ]
// }
//
// A case passes when every deterministic check holds and, if a judge ran, the judge marks
// every expectation as met. A case needs checks, expectations, or both.

export class CaseError extends Error {}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkList(list, where) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new CaseError(`${where}: must be a list`);
  return list.map((c, i) => {
    const at = `${where}[${i}]`;
    if (!c || typeof c.regex !== 'string' || !c.regex) throw new CaseError(`${at}: needs a "regex" string`);
    const flags = c.flags ?? '';
    if (!/^[imsu]*$/.test(flags)) throw new CaseError(`${at}: flags may only use i, m, s, u`);
    let re;
    try { re = new RegExp(c.regex, flags); } catch (e) { throw new CaseError(`${at}: bad regex: ${e.message}`); }
    return { re, regex: c.regex, flags, why: c.why ?? c.regex };
  });
}

export function parseCaseFile(text, source = 'case file') {
  let doc;
  try { doc = JSON.parse(text); } catch (e) { throw new CaseError(`${source}: not JSON: ${e.message}`); }
  if (!doc || typeof doc !== 'object') throw new CaseError(`${source}: expected an object`);
  if (typeof doc.skill !== 'string' || !ID.test(doc.skill)) throw new CaseError(`${source}: "skill" must be a skill name`);
  if (typeof doc.path !== 'string' || !doc.path.startsWith('skills/')) throw new CaseError(`${source}: "path" must point under skills/`);
  if (!Array.isArray(doc.cases) || !doc.cases.length) throw new CaseError(`${source}: "cases" must be a non-empty list`);
  const seen = new Set();
  const cases = doc.cases.map((c, i) => {
    const at = `${source}: cases[${i}]`;
    if (typeof c.id !== 'string' || !ID.test(c.id)) throw new CaseError(`${at}: "id" must be lowercase words joined by hyphens`);
    if (seen.has(c.id)) throw new CaseError(`${at}: duplicate id ${c.id}`);
    seen.add(c.id);
    if (typeof c.prompt !== 'string' || !c.prompt.trim()) throw new CaseError(`${at}: "prompt" is required`);
    const files = c.files ?? {};
    if (typeof files !== 'object' || Array.isArray(files) || Object.values(files).some((v) => typeof v !== 'string')) {
      throw new CaseError(`${at}: "files" maps file names to their text`);
    }
    const checks = c.checks ?? {};
    const parsed = {
      all: checkList(checks.all, `${at}.checks.all`),
      any: checkList(checks.any, `${at}.checks.any`),
      none: checkList(checks.none, `${at}.checks.none`),
    };
    const expectations = c.expectations ?? [];
    if (!Array.isArray(expectations) || expectations.some((e) => typeof e !== 'string' || !e.trim())) {
      throw new CaseError(`${at}: "expectations" is a list of statements`);
    }
    if (!parsed.all.length && !parsed.any.length && !parsed.none.length && !expectations.length) {
      throw new CaseError(`${at}: needs checks or expectations`);
    }
    return { id: c.id, prompt: c.prompt, files, checks: parsed, expectations };
  });
  return { skill: doc.skill, path: doc.path, cases };
}

// The user message: the request, then any fixture files as fenced blocks.
export function userMessage(c) {
  const parts = [c.prompt.trim()];
  for (const [name, text] of Object.entries(c.files)) {
    const fence = text.includes('```') ? '````' : '```';
    parts.push(`File: ${name}\n${fence}\n${text.replace(/\n$/, '')}\n${fence}`);
  }
  return parts.join('\n\n');
}

export function systemMessage(skillText) {
  const base = 'You are a coding assistant working in the user\'s project. You cannot run commands or edit files directly in this conversation: reply with the changes, commands and reasoning as text.';
  if (!skillText) return base;
  return `${base}\n\nFollow this skill for the request:\n\n<skill>\n${skillText.trim()}\n</skill>`;
}
