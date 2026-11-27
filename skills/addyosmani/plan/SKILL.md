---
name: plan
description: Breaks work into small, verifiable tasks with acceptance criteria and dependency order. Use when the user asks for a plan or task breakdown, usually after a spec exists and before implementation starts.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/planning.toml
  changes: edited to name no particular agent or tool
---

# Plan

Follow the planning-and-task-breakdown skill (skills/addyosmani/planning-and-task-breakdown).

Read the existing spec (`SPEC.md` or equivalent) and the relevant parts of the codebase. Then:

1. Stay read-only while planning. Make no code changes.
2. Identify the dependency graph between components.
3. Slice the work vertically: one complete path per task, not horizontal layers.
4. Write each task with acceptance criteria and verification steps.
5. Add checkpoints between phases.
6. Present the plan for the user to review.

Save the plan to `tasks/plan.md` and the task list to `tasks/todo.md`, or hand both to the user if you cannot write files. If the project's agent rules or the user name an issue tracker, create one tracker item per task (or list them for the user to create) and keep the plan's Task List section as an ordered index of tracker ids or links.

If `tasks/plan.md` or `tasks/todo.md` already holds unchecked tasks for different work, stop and ask before writing. Never overwrite an incomplete plan without asking.
