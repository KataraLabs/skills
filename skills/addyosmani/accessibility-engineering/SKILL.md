---
name: accessibility-engineering
description: Audits existing interfaces for WCAG 2.2 AA conformance and remediates the violations found. Use when auditing a page or component for accessibility, running axe-core or pa11y, triaging a11y violations, or checking screen reader and contrast issues before shipping.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: skills/accessibility-engineering
  changes: edited to name no particular agent or tool
---

# Accessibility Engineering

## Overview

Accessibility is not a polish step. It's a legal requirement in many jurisdictions, an engineering quality standard, and a prerequisite for shipping. This skill audits existing interfaces, triages the findings, and remediates verified violations. The goal is WCAG 2.2 AA compliance supported by automated tools and manual testing.

## When to Use

- Before shipping a user-facing change that needs an accessibility audit
- When a11y issues are reported (e.g., "screen reader can't read this", "keyboard navigation broken")
- When auditing an existing interface for compliance
- When triaging axe-core or pa11y findings
- When remediating verified accessibility violations

**Do NOT use** for building new UI components from scratch; use `frontend-ui-engineering` for construction guidance. Do not use for backend-only changes, CLIs, or library code with no UI output.

## Workflow

### Phase 1: Route New UI Work

For component construction, interaction patterns, and focus-management guidance, use `../frontend-ui-engineering/SKILL.md`. Do not restate that skill here. Return to this workflow once an interface exists and needs auditing or remediation.

### Phase 2: Run Automated Audit

Run accessibility checks in this order. If your agent can run commands, run them yourself; otherwise ask the user to run them and share the output. The first command runs the axe-core rules through the pinned `@axe-core/cli` (the `axe-core` package ships no CLI). The second keeps a JSON report for triage. The third runs the pinned pa11y for HTML validation (WCAG2AA rules through HTML_CodeSniffer).

```bash
npx --yes @axe-core/cli@4.13.0 http://localhost:3000 --exit
npx --yes @axe-core/cli@4.13.0 http://localhost:3000 --dir ./accessibility-reports --save axe.json
npx --yes pa11y@9.1.1 http://localhost:3000
```

For a combined report, an optional helper script is available if your agent can run commands: resolve [scripts/audit-a11y.sh](scripts/audit-a11y.sh) relative to this skill's directory, then run `bash "<absolute-skill-directory>/scripts/audit-a11y.sh" url <url> --json`. Replace `<absolute-skill-directory>` with the absolute path to the directory containing this loaded `SKILL.md`; a per-skill install may place it outside the project being audited. It runs both pinned tools, records their status and versions, and fails rather than reporting a clean result when either tool does not produce a valid report.

Review the violations grouped by severity:
- **Critical:** Blocks screen reader access entirely (missing alt text on info images, empty buttons)
- **Serious:** Makes content difficult or impossible to access (low contrast, missing labels)
- **Moderate:** Causes confusion or extra effort (heading level skips, redundant ARIA)
- **Minor:** Cosmetic or progressive enhancement (missing lang attribute on inner elements)

For each violation, verify it's a real issue (not a false positive) by inspecting the element. If you can inspect the page in a browser, do it yourself; otherwise ask the user to check the element and report what they see.

### Phase 3: Manual Testing

Automated checks are a smoke test, not proof of conformance. Complete the audit manually.

**Keyboard audit:**
1. Tab through every interactive element. Can you see where you are?
2. Activate buttons and links with Enter/Space
3. Close modals with Escape
4. Navigate lists with Arrow keys
5. Verify no keyboard traps exist

**Screen reader audit (VoiceOver on macOS, NVDA on Windows):**
1. Navigate by heading (VoiceOver: Ctrl+Option+Cmd+H). Is the structure logical?
2. Navigate by landmark (open the rotor with Ctrl+Option+U, choose Landmarks). Are regions labeled?
3. Navigate by link (open the rotor with Ctrl+Option+U, choose Links). Do link descriptions make sense out of context?
4. Interact with a form. Are labels announced? Are error messages read?
5. Navigate a dynamic update. Are changes announced?

**Visual audit:**
1. Verify color contrast (4.5:1 text, 3:1 large text, 3:1 UI components)
2. Zoom to 200%. Does layout break or overlap?
3. Test with forced colors / high contrast mode (Windows High Contrast)
4. Reduce motion (prefers-reduced-motion). Are animations disabled?
5. Test focus visibility. Is the focus ring visible against all backgrounds?

### Phase 4: Fix Violations

For each finding, apply the remediation in order:

1. **Fix the root cause:** Replace a `<div>` with `<button>`, add `<label>`, set `alt` text
2. **Add ARIA as bridge:** If native HTML can't express the pattern, add ARIA attributes
3. **Test the fix:** Re-run the automated check and manual verification

Apply the accessibility checklist (`references/shared/accessibility-checklist.md`) as a minimal baseline.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll fix a11y later" | Delayed remediation compounds across components and can create legal liability. Audit before shipping. |
| "Automated tools caught everything" | Automated checks cannot prove keyboard or screen reader behavior. Manual testing is mandatory. |
| "Screen reader users are a tiny minority" | Accessibility is a requirement, not a usage-share calculation. Keyboard navigation, captions, and clear structure also help users across contexts. |
| "This is an internal tool, it doesn't need a11y" | Internal tools are subject to the same regulations. Disabled employees and contractors need access. |
| "I'll just use aria-label everywhere" | ARIA is a bridge, not a foundation. Semantic HTML first. Overusing ARIA creates maintenance burden and can make things worse. |
| "The design system handles accessibility" | Design systems provide accessible primitives. How you compose them determines whether the result is accessible. |
| "The audit passed axe-core, so we're done" | Pass axe-core as a smoke test, then test with screen readers and keyboard. A green lighthouse score is not a clean bill of health. |

## Red Flags

- Elements that look clickable but aren't keyboard-focusable
- Color as the sole indicator of state (red for error, green for success)
- Focus outline removed without a visible replacement
- Missing labels on form inputs
- No heading hierarchy or skipped heading levels
- Empty or unlabeled buttons and links
- Modals that don't trap focus or restore focus on close
- No `alt` text on meaningful images (or `alt=""` missing on decorative ones)
- Touch targets that fail SC 2.5.8's 24x24 CSS px size-or-spacing requirement and do not qualify for an exception (AA; 44x44 is the AAA target, SC 2.5.5)
- Autoplaying video or audio without controls
- Low contrast text (especially on hover, disabled states, placeholders)

## See Also

- `references/shared/accessibility-checklist.md`: quick reference for WCAG 2.2 AA
- `../frontend-ui-engineering/SKILL.md`: building accessible components from the start
- The a11y skill: a dedicated accessibility audit for deep reviews. If your agent can start a separate reviewer with fresh context, hand the audit to it; otherwise run it yourself in a fresh pass.

## Verification

After completing the accessibility workflow:

- [ ] Automated audit passes with no Critical or Serious violations
- [ ] All interactive elements are keyboard accessible (Tab, Enter, Escape, Arrow keys)
- [ ] Screen reader navigation by heading, landmark, and link verified with a named browser + AT pair (or recorded as `manual` and untested, never reported as verified)
- [ ] Focus order matches visual order
- [ ] Color contrast passes 4.5:1 text / 3:1 large text / 3:1 UI components
- [ ] All form inputs have associated labels
- [ ] All images have appropriate `alt` text
- [ ] Dynamic content changes are announced (aria-live)
- [ ] Page is usable at 200% zoom with no content loss
- [ ] Touch targets satisfy SC 2.5.8's 24x24 CSS px size-or-spacing requirement or a normative exception (AA); 44x44 is the enhanced AAA target (SC 2.5.5)
