---
name: typescript
description: Use when writing, changing, reviewing or testing TypeScript code (.ts, .tsx, .mts, .cts files, or a project with a tsconfig.json). Covers finding the project's own conventions, type-safe style, layout, running the type checker and tests, and the mistakes that most often break TypeScript builds.
license: MIT
---

# TypeScript

## Find the project's conventions first

Before writing code, read what the project already decided. In order:

1. `package.json`: the `scripts` (the real names of `test`, `lint`, `typecheck`, `build`), the
   package manager (`packageManager` field, or which lockfile exists: `pnpm-lock.yaml`,
   `yarn.lock`, `bun.lock`, `package-lock.json`), and `"type": "module"`.
2. `tsconfig.json` and anything it `extends`: `strict`, `noUncheckedIndexedAccess`,
   `module`/`moduleResolution` (decides whether relative imports need a `.js` extension),
   `paths` aliases, `jsx`.
3. Lint and format config: `eslint.config.*`, `biome.json`, `.prettierrc`. Follow them; do not
   reformat lines you did not change.
4. Two or three files next to the one you are changing. Match their naming, export style
   (named or default), error handling and test placement.

Use the project's package manager for every command. Mixing `npm install` into a pnpm project
writes a second lockfile.

## Style

- Let inference type locals; annotate function parameters, exported return types and public
  object shapes.
- Prefer `unknown` to `any` at boundaries (parsed JSON, `catch` variables, messages from other
  processes) and narrow it with a check or a schema parser the project already uses.
- Model states with discriminated unions (`{ kind: "ok", value } | { kind: "error", error }`)
  rather than optional fields that must agree with each other. Check exhaustiveness with a
  `never` default in `switch`.
- `type` for unions and computed types, `interface` for object shapes others extend. Follow
  the project if it picked one.
- `as const` for literal tables; `satisfies` to check a value against a type without widening.
- Avoid `!` non-null assertions and `as` casts. When one is needed, keep it next to the check
  that justifies it.
- `readonly` arrays and properties for data a function must not change.
- Async: always `await` or return a promise. Run independent work with `Promise.all`.
- No `enum` in new code unless the project uses them; a union of string literals plus an
  `as const` object does the same with no runtime surprises.

## Layout

A common shape, though the project's own wins:

```text
src/            source, one module per concern
src/index.ts    public entry of a library
test/ or *.test.ts next to the source
dist/           build output, never edited, usually git-ignored
```

Monorepos keep packages under `packages/` or `apps/`, with a workspace file
(`pnpm-workspace.yaml`, `workspaces` in `package.json`). Run commands from the package directory
or with the workspace filter the project uses (`pnpm --filter <name> test`).

## Checks and tests

Run what the project defines, in this order: type check, lint, tests. If your agent can run
commands, run them yourself; otherwise give the user the exact commands.

```bash
npx tsc --noEmit
npm run lint
npm test
```

Replace `npm` with the project's package manager. Common runners:

- Vitest: `npx vitest run` (one pass; plain `vitest` watches). One file: `npx vitest run path/to/file.test.ts`.
- Jest: `npx jest path/to/file.test.ts`; with TypeScript it needs `ts-jest` or a Babel/SWC transform already configured.
- Node's runner: `node --test`, often with a loader for TypeScript.

Tests sit beside the code (`foo.test.ts`) or under `test/`; copy the existing pattern. Test the
behavior callers see, not private helpers.

## Common mistakes

- Importing `./foo` where the project uses `NodeNext` resolution and needs `./foo.js`.
- Silencing errors with `any`, `// @ts-ignore` or `as unknown as T` instead of fixing the type.
  If a suppression is unavoidable, use `// @ts-expect-error` with a reason.
- Treating `array[i]` or `record[key]` as defined when `noUncheckedIndexedAccess` is off. Check it.
- Floating promises: a missing `await` in a loop or a `forEach(async ...)` that nobody waits for.
- Assuming a type check proves runtime shape. Data from the network, disk or users still needs
  validation.
- Changing a shared type without running the type checker over the whole project; the error
  shows up in a file you did not open.
- Adding a dependency for something the standard library or an existing dependency already does.
- Editing generated files (`dist/`, `*.d.ts` output, generated API clients) instead of their source.
