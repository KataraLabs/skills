---
name: review
description: Reviews code changes across correctness, readability, architecture, security and performance. Use when the user asks for a code review of staged changes, recent commits or a diff.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/review.toml
  changes: edited to name no particular agent or tool
---

# Review

Follow the code-review-and-quality skill (skills/addyosmani/code-review-and-quality).

Review the current changes (staged, recent commits, or the diff the user gives you) on five axes:

1. **Correctness:** Does it match the spec? Are edge cases handled? Are the tests adequate?
2. **Readability:** Clear names, plain logic, sensible organization?
3. **Architecture:** Does it follow existing patterns, keep clean boundaries, and sit at the right level of abstraction?
4. **Security:** Is input validated, are secrets safe, is auth checked? Apply the security-and-hardening skill.
5. **Performance:** No N+1 queries or unbounded operations? Apply the performance-optimization skill.

Sort findings into Critical, Required, Optional and Nit. Give a structured review with `file:line` references and a recommended fix for each finding.
