---
name: react
description: Use when building, changing, reviewing or testing React components and hooks (.jsx/.tsx files, or a project depending on react). Covers finding the project's conventions, component and hook style, state and effects, layout, running component tests, and common React mistakes. For React Native, use the React Native skills alongside this one.
license: MIT
---

# React

## Find the project's conventions first

1. `package.json`: React version, framework (Next.js, Remix, Vite, Expo), router, state library,
   data-fetching library (TanStack Query, SWR, Apollo), styling (CSS modules, Tailwind,
   styled-components), and the test scripts.
2. The framework's conventions decide file placement: Next.js `app/` routes and server
   components, Remix route modules, plain Vite `src/`.
3. An existing component close to what you are building. Copy its prop typing, file naming,
   styling approach, test file and story file if there is one.
4. Any design-system package or `components/ui` folder. Use its button, input and dialog
   rather than writing new ones.

## Components

- Function components only. Name them in PascalCase; one exported component per file unless the
  project groups small ones.
- Type props with a named type (`type ButtonProps = {...}`) and destructure them in the
  signature. Pass `children` explicitly in the type when used.
- Keep components pure: the same props and state render the same output. Side effects go in
  event handlers first, effects only when synchronizing with something outside React.
- Derive values during render instead of copying props into state. If it can be computed from
  props or state, compute it.
- Lift state to the closest common parent; reach for context only when many levels need it,
  and split contexts so a change does not re-render everything.
- Lists need stable `key`s from the data (an id), not the array index when items move.
- Accessibility: use real elements (`button`, `a`, `label`, `input`), give images `alt`, connect
  labels to inputs, and keep focus visible.

## Hooks and effects

- Call hooks at the top level of a component or custom hook, never inside conditions or loops.
- Every value from the component used inside `useEffect`, `useMemo` or `useCallback` belongs in
  the dependency array. If the lint rule `react-hooks/exhaustive-deps` complains, fix the code;
  do not disable the rule.
- Effects that subscribe, start timers or fetch must return a cleanup, and a fetch must ignore
  or abort a stale response.
- Prefer the project's data-fetching library over hand-written fetch-in-effect.
- `useMemo`/`useCallback` only for measured cost or for referential stability a child or effect
  depends on. The React Compiler, when enabled, makes most of them unnecessary.
- Extract a custom hook (`useSomething`) when the same stateful logic appears in two places.

## Server components (Next.js app router and similar)

Components are server components by default. Add `"use client"` only to the smallest component
that needs state, effects or browser APIs. Do not import server-only modules (database clients,
secrets) into client components.

## Tests

Use what the project has; usually Vitest or Jest with React Testing Library.

```bash
npx vitest run src/components/Button.test.tsx
```

- Query the way a user finds things: `getByRole("button", { name: "Save" })`, then
  `getByLabelText`, then `getByText`. `getByTestId` is the last resort.
- Drive interaction with `@testing-library/user-event` and assert on what renders.
- Wait for async UI with `findBy...` or `waitFor`, not fixed timeouts.
- Mock the network at the boundary (MSW or the project's fetch mock), not the component's hooks.
- Browser end-to-end tests (Playwright, Cypress) belong in their own folder and are slower; run
  them when the change crosses pages or depends on a real browser.

If your agent can run commands, run the tests and the type check; otherwise give the user the
commands.

## Common mistakes

- Setting state during render, or in an effect that runs on every render, causing loops.
- Mutating state (`items.push(x); setItems(items)`) instead of creating a new array or object.
- Using a stale value in a closure (an interval or handler created once); use the updater form
  `setCount((c) => c + 1)`.
- Effects that exist only to transform props into state.
- Missing cleanup, leaving subscriptions and timers running after unmount.
- Index keys on reorderable lists, which mixes up item state.
- `"use client"` at the top of a whole page instead of the one interactive leaf.
- Testing implementation details (state values, hook calls) so tests break on every refactor.
