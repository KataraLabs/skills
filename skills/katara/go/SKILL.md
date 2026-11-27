---
name: go
description: Use when writing, changing, reviewing or testing Go code (.go files, or a project with go.mod). Covers finding the module's conventions, idiomatic Go style and error handling, package layout, running go test with the race detector, and common Go mistakes.
license: MIT
metadata:
  file-types: "*.go"
  project-files: "go.mod go.work"
---

# Go

## Find the project's conventions first

1. `go.mod`: module path, Go version (and `toolchain` line), dependencies. A `go.work` file means
   a multi-module workspace.
2. `Makefile`, `Taskfile.yml`, `magefile.go` or CI config for the real build, lint and test commands.
3. Lint config: `.golangci.yml`. Run the same linters.
4. Code generation: `//go:generate` lines, `sqlc.yaml`, `buf.yaml`, mock generators. Edit the
   source, then regenerate; never hand-edit files marked `// Code generated ... DO NOT EDIT.`
5. Neighbouring packages: how they wrap errors, take a `context.Context`, log, and structure tests.

## Style

- `gofmt` (or `goimports`) output is the only formatting. Run it on files you change.
- Short, lowercase package names that describe what they provide; no `util` or `common`.
- Return errors; do not panic for expected failures. Wrap with context:
  `fmt.Errorf("load config %s: %w", path, err)`. Check with `errors.Is` / `errors.As`.
- Handle every error or explain in a comment why it is safe to ignore.
- `context.Context` is the first parameter of functions that do I/O or may block; pass it down,
  do not store it in structs.
- Accept interfaces, return concrete types. Define small interfaces where they are used, not
  next to the implementation.
- Make the zero value useful when possible; constructors (`NewThing`) when it is not.
- Goroutines need an owner and an exit path: a `context` cancel, a closed channel or a
  `sync.WaitGroup`/`errgroup`. Never start one you cannot stop.
- Protect shared state with a mutex or confine it to one goroutine; document which.
- Exported identifiers get a doc comment starting with the name.

## Layout

```text
go.mod
cmd/<binary>/main.go    entry points, thin
internal/<pkg>/         code not importable by other modules
<pkg>/                  public packages of a library
<pkg>/<file>_test.go    tests next to the code
testdata/               fixtures, ignored by the go tool
```

## Tests

If your agent can run commands, run these; otherwise give the user the exact commands.

```bash
go build ./...
go vet ./...
go test ./...
go test -race ./internal/store/...
go test -run 'TestParse/empty' ./internal/parse
```

- Table-driven tests with `t.Run(name, ...)` for each case.
- `t.Helper()` in helpers, `t.TempDir()` for files, `t.Cleanup` for teardown,
  `t.Setenv` for environment variables.
- `t.Parallel()` only when the test shares no global state.
- Compare structs with `reflect.DeepEqual` or `github.com/google/go-cmp/cmp` if the project uses it.
- Run with `-race` when the change touches goroutines, channels or shared state.
- Integration tests often sit behind a build tag (`//go:build integration`) or an environment
  check; read how the project gates them before running.
- Fuzz tests (`func FuzzX(f *testing.F)`) run with `go test -fuzz=FuzzX` for a bounded time.

## Common mistakes

- Ignoring an error with `_` or shadowing `err` inside an `if` block so the outer one is never checked.
- Loop variable capture in goroutines on Go versions before 1.22.
- Closing a channel from the receiver, or twice.
- A nil pointer stored in an interface is not a nil interface; return a literal `nil`.
- `defer` inside a long loop, holding resources until the function returns.
- Forgetting `resp.Body.Close()` after an HTTP request, or `rows.Close()` / `rows.Err()` after a query.
- Using `time.Sleep` in tests to wait for goroutines instead of synchronization.
- Changing an exported signature without searching for callers in the whole module (`go build ./...` finds them).
- Adding a dependency when the standard library covers it; run `go mod tidy` after changes to imports.
