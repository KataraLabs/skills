# Orchestration Patterns

Reference catalog of orchestration patterns these skills endorse, plus anti-patterns to avoid. Read this before adding a workflow that coordinates several review perspectives (personas), or before introducing a persona that "wraps" existing ones.

A persona here is a focused role with its own instructions, such as a code reviewer, a security auditor or a test engineer. Some agents can start separate workers with fresh context and give each one a persona; others run everything in one context. Every pattern below has a form for both.

The governing rule: **the user (or a command skill the user invoked) is the orchestrator. Personas do not invoke other personas.** Skills are mandatory hops inside a persona's workflow.

---

## Endorsed patterns

### 1. Direct invocation (no orchestration)

Single persona, single perspective, single artifact. The default and the cheapest option.

```text
user → code-reviewer → report → user
```

**Use when:** the work is one perspective on one artifact and you can describe it in one sentence.

**Examples:**
- "Review this PR" → `code-reviewer`
- "Find security issues in `auth.ts`" → `security-auditor`
- "What tests are missing for the checkout flow?" → `test-engineer`

**Cost:** one round trip. The baseline you should always compare orchestrated patterns against.

---

### 2. Single-persona command skill

A command skill that wraps one persona with the project's skills. Saves the user from re-explaining the workflow every time.

```text
review → code-reviewer (with code-review-and-quality skill) → report
```

**Use when:** the same single-persona invocation happens repeatedly with the same setup.

**Examples in these skills:** the review, test and simplify command skills.

**Cost:** same as direct invocation. The command skill is a saved prompt.

**Anti-signal:** if the command's body is mostly "decide which persona to call," delete it and let the user call the persona directly.

---

### 3. Parallel fan-out with merge

Several personas look at the same input, each producing an independent report. A merge step synthesizes them into a single decision.

```text
                   ┌─→ code-reviewer    ─┐
ship → fan out  ───┼─→ security-auditor ─┤→ merge → go/no-go + rollback
                   └─→ test-engineer    ─┘
```

**If your agent can start separate workers with fresh context,** start one per persona at the same time (in a single step, so they run concurrently rather than one after another), give each the same input and its own persona, and merge their reports in the main context.

**If it cannot,** run the personas yourself as separate passes: finish one lens, write its findings down, then start the next lens from the input rather than from your previous findings. Merge at the end. You lose the speed and some of the independence, but you keep the distinct kinds of finding.

**Use when:**
- The sub-tasks are genuinely independent (no shared mutable state, no ordering dependency)
- Each perspective benefits from its own clean context
- The merge step is small enough to stay in the main context
- Wall-clock latency matters (only relevant with separate workers)

**Examples in these skills:** the ship command skill.

**Cost:** N worker contexts plus one merge turn. Higher than direct invocation, but faster wall-clock and better reports, because each worker stays focused on its single perspective.

**Validation checklist before adopting this pattern:**
- [ ] Can all perspectives run at the same time without ordering issues?
- [ ] Does each persona produce a different *kind* of finding, not the same finding from a different angle?
- [ ] Will the merge step fit in the main agent's remaining context?
- [ ] Is the user's wait time long enough that parallelism is noticeable?

If any answer is "no," fall back to direct invocation or a single-persona command skill.

---

### 4. Sequential pipeline driven by the user

The user invokes command skills in a defined order, carrying context (or commit history) between them. There is no orchestrator agent. The user is the orchestrator.

```text
user runs:  spec  →  plan  →  build  →  test  →  review  →  ship
```

**Use when:** the workflow has dependencies (each step needs the previous step's output) and human judgment between steps adds value.

**Examples in these skills:** the entire DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP lifecycle.

**Cost:** one context per step. Nothing extra for orchestration, because there is no orchestrator agent.

**Why not automate it:** an LLM "lifecycle orchestrator" would (a) lose nuance between steps because it has to condense each hand-off, (b) skip the human checkpoints that catch wrong-direction work early, and (c) double the token cost via paraphrasing turns.

---

### 5. Research isolation (context preservation)

When a task requires reading large amounts of material that shouldn't pollute the main context, isolate the reading and keep only a digest.

```text
main agent → research worker (reads 50 files) → digest → main agent continues
```

**If your agent can start separate workers,** hand the research to one that returns only the digest. Prefer a read-only worker if your agent offers one; it cannot change files by accident.

**If it cannot,** do the reading in a bounded burst, write the digest down (in the conversation or a scratch note), and from then on work from the digest rather than from the raw files.

**Use when:**
- The main session needs to stay focused on a downstream task
- The investigation result is much smaller than the input it consumes
- The decision quality benefits from the main agent having room to think after

**Examples:** "Find every call site of this deprecated API across the monorepo," "Condense what these 30 ADRs say about caching."

**Cost:** one isolated context. Worth it any time the alternative is loading hundreds of files into the main context.

---

## Mapping the patterns onto your agent

The catalog does not depend on any one agent product. What matters is which of these capabilities your agent has:

| Capability | Patterns it enables | Without it |
|---|---|---|
| Start separate workers with fresh context | 3 (fan-out), 5 (research isolation) | Run each lens as its own pass; keep a written digest |
| Workers that can message each other | Competing-hypothesis investigation (below) | Run the hypotheses one at a time and argue against each in writing |
| Choose a model per worker | Cheaper models for scans, stronger ones for audits | Use one model for everything |

### Where personas live

Keep each persona as its own file with a name, a one-line description and its instructions. How your agent discovers those files varies; follow its own conventions for agent or persona definitions. The persona text should not depend on how it is started, so the same definition works as a separate worker, as a teammate in a collaborating group, or as a pass you run yourself.

### Rules worth enforcing

- **Workers do not start other workers.** This blocks Anti-pattern B (persona calls persona) and Anti-pattern D (deep persona trees). Some agents enforce it; where they don't, treat it as a rule.
- **Groups do not nest.** A collaborating teammate does not start its own team.

### Parallel means one step

Where your agent supports parallel workers, fan-out needs all workers started in the same step. Starting them across several turns serializes the work. The ship command skill calls this out; any new orchestrating workflow should do the same.

---

## Worked example: competing-hypothesis debugging

This example shows when collaborating investigators beat the ship skill's independent fan-out. Both use the same three personas, but the value comes from a different place.

### The scenario

> *Checkout occasionally hangs for ~30 seconds before completing. It happens roughly once every 50 sessions. No errors in logs. Started after last week's release.*

Plausible root causes (mutually exclusive, all fit the symptoms):

1. A race condition in the new payment-confirmation flow
2. An auth check that occasionally falls through to a slow synchronous network call
3. A missing index on a query that scales with cart size
4. A flaky third-party API where the SDK retries silently before timing out

A single agent will pick the first plausible theory and stop investigating. An independent fan-out would have each persona report on its own, but their reports never meet, so nothing rules out the wrong theories. With several investigators actively trying to disprove each other, the theory that survives is much more likely to be the real root cause.

### Why this is *not* a ship job

| | Independent fan-out (ship) | Collaborating investigators |
|--|--------------------|-------------|
| Workers see | The same diff, different lenses | A shared task list, each other's messages |
| Output | Three independent reports → one merge | Adversarial debate → consensus root cause |
| Right when | You want a verdict on a known artifact | You want to *find* the artifact among hypotheses |

Ship is a verdict; collaborating investigators run an investigation.

### The trigger prompt

If your agent can start a group of workers that message each other, ask the lead in plain language:

```text
Users report checkout hangs for ~30 seconds intermittently after last
week's release. No errors in logs.

Debug this with competing hypotheses. Start three investigators using
the existing personas:

  - code-reviewer: investigate race conditions and blocking calls
                   in the checkout code path
  - security-auditor: investigate auth checks, session handling,
                      and any synchronous network calls added recently
  - test-engineer: propose tests that would distinguish between the
                   hypotheses and check coverage gaps in checkout

Have them message each other directly to challenge each other's
theories. Update findings as consensus emerges. Only converge when
two investigators agree they can disprove the others'.
```

Each investigator gets its persona's instructions plus the prompt above as its task.

### What happens

1. Each investigator explores the codebase in its own context, from its own lens.
2. Investigators send findings to each other directly. The lead doesn't have to relay.
3. A shared task list shows who is investigating what.
4. When `code-reviewer` finds a `Promise.all` that should be sequential, it asks `security-auditor` to confirm the auth call isn't part of the race. `security-auditor` checks and replies, either confirming the race or producing counter-evidence.
5. `test-engineer` proposes a focused integration test for whichever theory is winning, which the group uses to verify before declaring consensus.
6. The lead synthesizes the converged finding and presents it to you.

If your agent lets you, step in on a single investigator to redirect one that has gone down a wrong path. When the investigation lands on a root cause, ask the lead to wind the group down; the lead has the full picture, the individual investigators do not.

### Single-agent fallback

Without collaborating workers, run the same debate yourself. Write each hypothesis down. For each one in turn, take the persona whose lens fits it and try to disprove it with evidence from the code, logs or a focused test. Record what you found against each. Keep only the hypotheses that survive, then design the test that separates the survivors. This is slower, but it keeps the key property: every theory is attacked, including the ones that look unlikely.

### Cost expectation

Three investigators running for 10 to 15 minutes cost noticeably more than the same three personas in an independent fan-out. The justification is *quality of conclusion*. For production debugging where the wrong fix is expensive, the extra tokens are a bargain. For a routine PR review, stick with ship.

### Anti-pattern in this scenario

Do **not** rebuild this as a command skill that fans out independent workers. Independent workers can't message each other, so you'd lose the adversarial debate that makes the pattern work. If the workflow keeps coming up, keep the trigger prompt above as a snippet.

### When *not* to use collaborating investigators

- Production-bound verdict on a known diff → the ship command skill (independent fan-out).
- One specialist perspective on one artifact → direct persona invocation.
- Sequential lifecycle (spec → plan → build) → user-driven command skills (Pattern 4).
- Read-heavy research with a small digest → research isolation (Pattern 5).

Reach for collaborating investigators only when they **need** to challenge each other to produce the right answer.

---

## Anti-patterns

### A. Router persona ("meta-orchestrator")

A persona whose job is to decide which other persona to call.

```text
work → router-persona → "this needs a review" → code-reviewer → router (paraphrases) → user
```

**Why it fails:**
- Pure routing layer with no domain value
- Adds two paraphrasing hops → information loss + roughly 2× token cost
- The user already knew they wanted a review; they could have invoked the review skill directly
- Replicates the work that command skills and the intent mapping in `AGENTS.md` already do

**What to do instead:** add or refine command skills. Document intent → skill mapping in `AGENTS.md`.

---

### B. Persona that calls another persona

A `code-reviewer` that internally invokes `security-auditor` when it sees auth code.

**Why it fails:**
- A persona exists to produce a single perspective; chaining them defeats that
- The condensed hand-off the calling persona passes loses context the called persona needs
- Failure modes multiply (which persona's output format wins? whose rules apply?)
- Hides cost from the user

**What to do instead:** have the calling persona *recommend* a follow-up audit in its report. The user or a command skill runs the second pass.

---

### C. Sequential orchestrator that paraphrases

An agent that runs spec, then plan, then build, and so on, on the user's behalf.

**Why it fails:**
- Loses the human checkpoints that catch wrong-direction work
- Each hand-off condenses context, so drift accumulates over a long pipeline
- Doubles token cost: orchestrator turn + worker turn for every step
- Removes user agency at exactly the points where judgment matters most

**What to do instead:** keep the user as the orchestrator. Document the recommended sequence in `README.md` and let users invoke it.

---

### D. Deep persona trees

The ship skill calls a `pre-ship-coordinator` that calls a `quality-coordinator` that calls `code-reviewer`.

**Why it fails:**
- Each layer adds latency and tokens with no decision value
- Debugging becomes a multi-level investigation
- The leaf personas lose context to several condensing steps

**What to do instead:** keep the orchestration depth at most 1 (command skill → personas). The merge happens in the main agent.

---

## Decision flow

When considering a new orchestrated workflow, walk this flow:

```text
Is the work one perspective on one artifact?
├── Yes → Direct invocation. Stop.
└── No  → Will the same composition repeat?
         ├── No  → Direct invocation, ad hoc. Stop.
         └── Yes → Are sub-tasks independent?
                  ├── No  → Sequential command skills run by the user (Pattern 4).
                  └── Yes → Parallel fan-out with merge (Pattern 3).
                           Validate against the checklist above.
                           If any check fails → fall back to a single-persona command skill (Pattern 2).
```

---

## When to add a new pattern to this catalog

Add a new entry only after:

1. You've used the pattern at least twice in real work
2. You can name a concrete artifact in these skills that demonstrates it
3. You can explain why an existing pattern wouldn't have worked
4. You can describe its anti-pattern shadow (what people will mistakenly build instead)

Premature catalog entries become aspirational documentation that no one follows.
