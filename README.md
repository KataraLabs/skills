<p><img src="https://katara.com/katara-logo.svg" alt="Katara" width="160"></p>

# Katara Skills

Skills for coding agents, in the open SKILL.md format: a folder per skill with a `SKILL.md`
whose front matter says when to use it. Any agent that reads SKILL.md files can load them.

The repository has two kinds of skills. Skills written here cover TypeScript, React, Python, Go,
Swift, Rust and SQL. Skills from other open-source projects cover engineering workflow, React
Native, test frameworks, and language and testing practice. Every copied file is pinned to an
exact upstream commit and checksum.

## Install

```bash
npx skills add KataraLabs/skills
```

List the skills, or install one by name:

```bash
npx skills add KataraLabs/skills --list
```

```bash
npx skills add KataraLabs/skills --skill python
```

Or copy a skill folder into the folder your agent reads skills from.

## Layout

```text
skills/
  katara/        TypeScript, React, Python, Go, Swift, Rust, SQL       MIT
  addyosmani/    workflow: spec, plan, build, test, review, ship, ...  MIT, edited
  callstack/     React Native                                          MIT
  lambdatest/    test frameworks: pytest, Jest, Playwright, ...        MIT
  trailofbits/   modern Python and C++, property and mutation
                 testing, fuzzing                                      CC BY-SA 4.0
evals/           tasks and pass criteria for each skill, and a runner
scripts/         source pinning, drift check, release build
sources.json     upstream repository, commit and sha256 of every copied file
```

The language skills each say how to find a project's own conventions first, the idiomatic
style, the usual layout, the test runner and how to run it, and the common mistakes.

The workflow skills under `skills/addyosmani/` are edited so they name no particular agent and
work whether or not the agent can run commands, commit, or start a separate reviewer. Nine of
them are entry points with short names: `spec`, `plan`, `build`, `test`, `review`, `ship`,
`simplify`, `a11y` and `webperf`.

## Licenses

| Folder | License | Source |
| --- | --- | --- |
| `skills/katara/`, `scripts/`, `evals/`, `test/` | MIT | this repository |
| `skills/addyosmani/` | MIT | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), edited |
| `skills/callstack/` | MIT | [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) |
| `skills/lambdatest/` | MIT | [LambdaTest/agent-skills](https://github.com/LambdaTest/agent-skills) |
| `skills/trailofbits/` | CC BY-SA 4.0 | [trailofbits/skills](https://github.com/trailofbits/skills), made by Trail of Bits |

Each folder carries its license text and a README with the source commit. Files under
`skills/trailofbits/` are unchanged and stay under CC BY-SA 4.0; an adaptation of them must be
shared under the same license. [NOTICE](NOTICE) lists every source.

## Checks

Node.js 20 or later. `npm install` fetches the one test dependency, a YAML parser.

```bash
npm test
```

```bash
npm run verify
```

```bash
npm run drift
```

`verify` checks every copied file against `sources.json`. `drift` clones each upstream
repository and lists the files that changed, disappeared or appeared since the pinned commit.

## Evals

Each skill has a case file in `evals/cases/` with small tasks. A case passes when the reply
meets its regular-expression checks and, if a judge model is given, every expectation.
`evals/run.mjs` sends the cases to any OpenAI-compatible chat completions endpoint:

```bash
node evals/run.mjs --base-url http://localhost:8000/v1 --model my-model --skill go --baseline
```

`--baseline` runs each case without the skill as well, so the difference shows what the skill
adds. `--judge-model` grades the expectations; `--dry-run` lists the requests without sending
any. Every request is charged at whatever the endpoint charges. Results go to `evals/results/`.

## Releases

```bash
node scripts/release.mjs 0.1.0
```

This writes `dist/skills-0.1.0.tar.gz`, its sha256, a manifest with the sha256 of every file,
and `index.json`, which lists every skill with its id, description, folder, source, license and
digest. The index and manifest are also inside the archive. The archive is reproducible: the
same commit gives the same bytes.

Skills named in `bundle.json` get ids of the form `bundled:<name>`; the rest are
`catalog:<name>`. `classification.json` gives each skill a `kind`: `language`, `framework` or
`workflow`. Language and framework skills carry `detect` signals (source file types, project
files such as `playwright.config.*` or `go.mod`, and package dependencies) so a client can offer
them only in projects that use them. Workflow skills carry `default: on` or `off`. `servable`
says whether the skill's license lets a hosted service send the skill's text to users. `catalog-external.json` lists skills offered from other repositories by
repository, commit, path and digest, without copying their files. A skill's digest is the
sha256 of its files' paths and sha256 values: sort the files by path in byte order and join
`path`, a newline, the file's lowercase hex sha256 and a newline for each. Nested skill folders
are left out of their parent's digest.

## Contributing

Issues and pull requests are welcome.

- A new skill goes in its own folder with a `SKILL.md`. The `name` matches the folder, and the
  `description` says when to use it.
- Keep skills short and concrete. Do not name a particular agent product, and do not assume the
  agent has a shell; say what to do if it can and if it cannot.
- Add a case file under `evals/cases/` with two or three small tasks.
- To bring in a skill from another project, the license must allow it. Copy the folder, add a
  mapping to `sources.json`, and run `node scripts/sources.mjs generate` against a checkout at
  the pinned commit.
- Run `npm test` before opening the pull request.
