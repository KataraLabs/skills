---
name: spec
description: Writes a structured specification before any code. Use when the user asks to write a spec, define requirements, or plan what to build before building it, or when a change to an existing spec needs a delta spec.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/spec.toml
  changes: edited to name no particular agent or tool
---

# Spec

Follow the spec-driven-development skill (skills/addyosmani/spec-driven-development).

First check whether `SPEC.md` exists in the project root. That decides which flow applies.

## New spec

Use this when there is no `SPEC.md`, or the request is unrelated to what it describes.

Ask clarifying questions about:

1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries: what to always do, what to ask about first, and what never to do

Then write a spec covering the six core areas: objective, commands, project structure, code style, testing strategy and boundaries.

If the request bundles several independently testable capabilities, first propose a capability map (module ids, dependency direction, build order) as the skill's Phase 0 describes, get it approved, then spec each module in dependency order.

Save the spec as `SPEC.md` in the project root, or give it to the user to save if you cannot write files. Confirm with the user before going further.

## Delta spec

Use this when `SPEC.md` exists and the request changes what it describes. Do not overwrite it. Write a delta spec (for example `SPEC-<change-slug>.md`) covering only the change, as the skill's Spec Evolution section describes, and confirm with the user before going further.
