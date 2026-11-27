---
name: build
description: Implements planned tasks one test-backed slice at a time, or the whole plan after a single approval. Use when the user asks to build, implement the next task, or build the whole plan from an existing spec.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/build.toml
  changes: edited to name no particular agent or tool
---

# Build

Apply the incremental-implementation skill (skills/addyosmani/incremental-implementation) together with the test-driven-development skill (skills/addyosmani/test-driven-development).

## Modes

- **One task (default):** implement the next pending task, then stop.
- **Whole plan:** if the user asks to build the whole plan (or says "auto" or "all"), make a plan if needed, get one approval, then implement every task without stopping between them.

The whole-plan mode is no faster per task. It runs the same test-driven loop and only removes the user's stepping between tasks.

## One task

Pick the next pending task from the plan, then:

1. Read the task's acceptance criteria.
2. Load the relevant context: existing code, patterns, types.
3. Write a failing test for the expected behavior (red).
4. Write the minimum code that makes it pass (green).
5. Run the full test suite for regressions, or ask the user to run it and share the output.
6. Run the build, or ask the user to run it.
7. Commit with a descriptive message, or leave the change for the user to commit.
8. Mark the task complete and stop.

## Whole plan

1. **Require a spec** at a known path: `SPEC.md` at the repository root, a root-level `SPEC-<change>.md` delta spec, `docs/SPEC.md`, or a file under `spec/`. A delta spec for the change being built takes precedence over `SPEC.md`; if there are several, use the one whose `Status:` line is not implemented, and if more than one remains, ask which to build. A README or other document does not count. If no spec exists, stop and suggest the spec skill. Do not invent requirements.
2. **Start from a clean baseline.** If you have git access, check for uncommitted changes outside the planning files (`SPEC.md`, `SPEC-*.md`, `docs/SPEC.md`, `spec/*`, `tasks/plan.md`, `tasks/todo.md`); otherwise ask the user. If there are any, stop and ask how to handle them, so per-task commits do not absorb unrelated work.
3. **Plan if needed.** With no `tasks/plan.md`, follow the plan skill and put a `Source spec: <path>` line at the top of the plan. Reuse an existing plan only when its `Source spec:` line matches the spec chosen in step 1. On a mismatch, or a plan with no such line, ask whether to archive or replace it.
4. **One checkpoint.** Present the full plan and wait for a clear yes ("approve", "go", "yes"). Hedged replies such as "looks reasonable" are not approval. After approval, run without further stops. If you wrote the plan, commit it on its own first, or leave it for the user to commit.
5. **Run every task in dependency order**, using the one-task loop above. Each task gets its own commit containing only the files it touched and its status update, so any point is a clean rollback. If you cannot commit, keep a per-task list of changed files for the user.
6. **Stop and ask** rather than push through when:
   - a test cannot be made to pass or the build breaks without an obvious fix (follow the debugging-and-error-recovery skill);
   - the spec is ambiguous, or a task needs a decision the spec does not cover;
   - a task is high-risk or irreversible: auth or permission changes, destructive migrations, payments, deletions, deploys, secrets, or anything a revert cannot undo (follow the doubt-driven-development skill and get explicit sign-off).

   Once the user resolves the blocker and asks to continue, resume from the next pending task.
7. **Summarize** the tasks completed, tests added, commits made, and anything skipped, flagged or left for the user.

If any step fails, follow the debugging-and-error-recovery skill.
