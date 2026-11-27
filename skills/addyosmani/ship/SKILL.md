---
name: ship
description: Runs the pre-launch checklist as three independent specialist reviews and merges them into a go or no-go decision with a rollback plan. Use when the user asks whether a change is ready to ship, release or deploy to production.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/ship.toml
  changes: edited to name no particular agent or tool
---

# Ship

Follow the shipping-and-launch skill (skills/addyosmani/shipping-and-launch).

Three specialist reviews run independently against the current change, then one merge step turns their reports into a single go or no-go decision with a rollback plan. The reviews share no state and depend on no order, so they can run side by side.

## Phase A: three independent reviews

1. **Code reviewer:** a five-axis review (correctness, readability, architecture, security, performance) of the staged changes or recent commits, as the review skill describes.
2. **Security auditor:** a vulnerability and threat-model pass covering the OWASP Top 10, secrets handling, authentication and authorization, and dependency CVEs. Apply the security-and-hardening skill.
3. **Test engineer:** test coverage for the change, with gaps in the happy path, edge cases, error paths and concurrency.

If your agent can start separate reviewers with fresh context, start all three at once and give each only its own brief. Otherwise run them yourself one after another, each as a fresh pass that ignores the others' findings, and treat the three reports as if they arrived together. Keep it flat: no review hands work to another. For reviewers that talk to each other rather than only reporting back, see `references/orchestration-patterns.md`.

If the user or project defines its own versions of these reviewer roles, use theirs.

## Phase B: merge

Once all three reports are in, merge them yourself:

1. **Code quality:** Critical and Required findings from the code review, plus any failing tests, lint or build output. Remove duplicates between reports.
2. **Security:** any Critical or High security finding becomes a launch blocker. Cross-check it with the code review's security axis.
3. **Performance:** from the code review's performance axis; check Core Web Vitals where they apply.
4. **Accessibility:** keyboard navigation, screen reader support, contrast. No review covers these, so check them here or apply the a11y skill.
5. **Infrastructure:** environment variables, migrations, monitoring, feature flags.
6. **Documentation:** README, ADRs, changelog.

## Phase C: decision and rollback

Produce one output:

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [Source review: Critical finding + file:line]

### Recommended fixes (should fix before ship)
- [Source review: Important finding + file:line]

### Acknowledged risks (shipping anyway)
- [Risk + mitigation]

### Rollback plan
- Trigger conditions: [what signals would prompt rollback]
- Rollback procedure: [exact steps]
- Recovery time objective: [target]

### Specialist reports (full)
- [code reviewer report]
- [security auditor report]
- [test engineer report]
```

## Rules

1. The three reviews stay independent of each other.
2. Reviews do not call each other; the merge happens in Phase B.
3. No GO without a rollback plan.
4. Any Critical finding makes the default verdict NO-GO unless the user explicitly accepts the risk.
5. Skip the three reviews only when the change touches two files or fewer, the diff is under 50 lines, and it touches no auth, payments, data access, config or environment. Otherwise run them, even when the diff looks small.
