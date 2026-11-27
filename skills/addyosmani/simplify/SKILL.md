---
name: simplify
description: Simplifies code for clarity and maintainability without changing its behavior. Use when the user asks to simplify, clean up or reduce the complexity of recent changes or a named part of the code.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/code-simplify.toml
  changes: edited to name no particular agent or tool
---

# Simplify

Follow the code-simplification skill (skills/addyosmani/code-simplification).

Simplify the recently changed code, or the scope the user names, while keeping its behavior exactly the same:

1. Read the project's agent rules (such as `AGENTS.md`) and study its conventions.
2. Identify the target code: recent changes unless the user names a wider scope.
3. Understand the code's purpose, callers, edge cases and test coverage before touching it.
4. Look for simplifications:
   - deep nesting: guard clauses or extracted helpers
   - long functions: split by responsibility
   - nested ternaries: if/else or switch
   - generic names: descriptive names
   - duplicated logic: shared functions
   - dead code: remove once confirmed unused
5. Apply each simplification on its own and run the tests after each one, or ask the user to run them and share the output.
6. Check that all tests pass, the build succeeds and the diff is clean.

If tests fail after a simplification, revert that change and reconsider. Review the result with the code-review-and-quality skill.
