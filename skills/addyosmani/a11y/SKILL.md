---
name: a11y
description: Runs an accessibility audit for WCAG 2.2 AA covering keyboard navigation, screen readers, contrast, form labels and structure. Use when the user asks for an accessibility audit or a11y check of a page, component or diff.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/a11y.toml
  changes: edited to name no particular agent or tool
---

# A11y

Follow the accessibility-engineering skill (skills/addyosmani/accessibility-engineering).

The audit checks keyboard navigation, screen reader support, color contrast, form labeling and structural WCAG 2.2 AA conformance.

## Choose the mode

**Deep mode** applies when any of these is available:

- an axe-core or pa11y JSON report (the accessibility-engineering skill explains how to produce a combined one with its audit script);
- a live URL: if your agent can run commands, run the audit script against it; otherwise ask the user to run it and share the JSON;
- a page you can inspect in a browser, for live DOM, contrast and rendering checks.

**Quick mode** is the default when there is no tool output. Scan the source for structural problems: missing labels, `div` used as a button, missing alt text, skipped heading levels.

## Run the audit

Audit as an accessibility engineer who ranks findings by real user impact and legal risk. If your agent can start a separate reviewer with fresh context, give it the brief below; otherwise do the audit yourself in a fresh pass. The brief:

- the files, components or diff under review;
- any report paths (axe-core JSON, pa11y JSON, audit script output);
- the target URL or component, when known;
- the expected mode (Quick or Deep), so missing inputs are named if Deep was intended.

## Output

Return the full report to the user: a WCAG scorecard, findings ranked by severity, what the interface already does well, and remediation guidance with code examples.
