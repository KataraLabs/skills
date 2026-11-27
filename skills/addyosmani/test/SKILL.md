---
name: test
description: Runs a test-driven workflow, writing failing tests before the code, and proves bug fixes with a reproducing test. Use when the user asks to add tests, work test-first, or fix a bug with a test that proves it.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/test.toml
  changes: edited to name no particular agent or tool
---

# Test

Follow the test-driven-development skill (skills/addyosmani/test-driven-development).

## New features

1. Write tests that describe the expected behavior. They should fail.
2. Write the code that makes them pass.
3. Refactor while the tests stay green.

## Bug fixes (Prove-It pattern)

1. Write a test that reproduces the bug. It must fail.
2. Confirm that it fails.
3. Fix the bug.
4. Confirm that the test passes.
5. Run the full suite for regressions.

Run the tests yourself if your agent can run commands; otherwise ask the user to run them and share the output.

For browser-facing issues, also apply the browser-testing-with-devtools skill if you can inspect the page in a browser, or ask the user to check the behavior there.
