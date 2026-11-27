---
name: webperf
description: Runs a web performance audit of a browser-facing application against Core Web Vitals, loading, rendering and network behavior. Use when the user asks for a web performance or page speed audit; not for libraries, command-line tools or server-only code.
license: MIT
metadata:
  source: https://github.com/addyosmani/agent-skills
  upstream-path: commands/webperf.toml
  changes: edited to name no particular agent or tool
---

# Webperf

Follow the performance-optimization skill (skills/addyosmani/performance-optimization).

This audit is for web applications only. Do not use it for utility libraries, command-line tools or server-only code with no browser-facing output.

## Choose the mode

**Deep mode** applies when any of these is available:

- a Lighthouse JSON report (for example from `npx lighthouse <url> --output json --output-path ./report.json`, run by you if your agent can run commands, or by the user);
- a PageSpeed Insights JSON response, which includes Lighthouse and CrUX data;
- a CrUX API response (the API key comes from an environment variable such as `$CRUX_API_KEY`; never write key values into config files);
- a performance trace recorded in the browser;
- a live URL you can measure in a browser.

**Quick mode** is the default when none of these is available. Scan the source for structural problems and label every finding `potential impact`.

## Run the audit

Audit as a web performance engineer who ranks findings by their actual or likely effect on Core Web Vitals. If your agent can start a separate reviewer with fresh context, give it the brief below; otherwise do the audit yourself in a fresh pass. The brief:

- the files, components or diff under review;
- any report paths (Lighthouse JSON, PageSpeed Insights JSON, CrUX response, trace) or pasted JSON;
- the target URL or page, when known;
- the expected mode (Quick or Deep), so missing inputs are named if Deep was intended.

## Output

Return the full report to the user: a scorecard holding only sourced values (mark anything unmeasured `not measured` and never invent a metric), findings ranked by impact, what the page already does well, and recommendations.
