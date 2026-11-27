---
name: rust
description: Use when writing, changing, reviewing or testing Rust code (.rs files, or a project with Cargo.toml). Covers finding the crate's conventions, ownership-aware idiomatic style, error handling, crate and workspace layout, running cargo test and clippy, and common Rust mistakes.
license: MIT
metadata:
  file-types: "*.rs"
  project-files: "Cargo.toml Cargo.lock rust-toolchain.toml"
---

# Rust

## Find the project's conventions first

1. `Cargo.toml`: edition, `rust-version` (minimum supported Rust), features, dependencies, and
   `[workspace]` members. `rust-toolchain.toml` pins the toolchain.
2. Error crates in use: `thiserror` for library errors, `anyhow` or `eyre` for applications.
3. Async runtime, if any: `tokio`, `async-std`, `smol`. Do not mix runtimes.
4. Lint config: `[lints]` in `Cargo.toml`, `clippy.toml`, `rustfmt.toml`, and `#![deny(...)]`
   attributes at the crate root.
5. Neighbouring modules: how they name things, structure tests and document public items.

## Style

- `rustfmt` output is the formatting. Clippy warnings are fixed, not silenced, unless the
  project allows that lint with a reason.
- Borrow by default: take `&str`, `&[T]`, `&T` in parameters; return owned values. Clone only
  when ownership really has to split, and know why.
- Return `Result<T, E>` for failures and propagate with `?`. Add context
  (`.with_context(|| format!("reading {path}"))` with anyhow, or a variant with a source field
  with thiserror).
- No `unwrap()` / `expect()` on values that can fail at runtime in library or server code.
  `expect("reason")` is acceptable for real invariants, with the reason stated.
- Use enums to make invalid states unrepresentable; match exhaustively.
- Iterators and combinators where they read clearly; a `for` loop when there are early exits
  or several side effects.
- Derive what the type supports (`Debug`, `Clone`, `PartialEq`, `Eq`, `Hash`, `Default`).
  `Eq` and `Hash` must agree, and so must `Ord` and `PartialOrd`.
- Keep `unsafe` blocks small, justify each with a `// SAFETY:` comment, and prefer a safe crate.
- Public items get `///` doc comments; examples in them are tests.

## Layout

```text
Cargo.toml
src/lib.rs          library root
src/main.rs         binary root (or src/bin/<name>.rs)
src/<module>.rs     modules
tests/              integration tests, each file its own crate
benches/            benchmarks
examples/           runnable examples
```

Workspaces put crates under `crates/` with a root `Cargo.toml` listing members.

## Tests

If your agent can run commands, run these; otherwise give the user the exact commands.

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo test -p parser empty_input
```

If the project uses cargo-nextest, run `cargo nextest run` instead of `cargo test`.

- Unit tests live in a `#[cfg(test)] mod tests` block in the same file and can reach private items.
- Integration tests in `tests/` use only the public API.
- Async tests use the runtime's attribute (`#[tokio::test]`).
- Property tests with `proptest` or `quickcheck` when the project has them.
- Run with the feature combinations the project tests (`--no-default-features`, `--all-features`).

## Common mistakes

- Fighting the borrow checker with `.clone()` everywhere or `Rc<RefCell<_>>` where restructuring
  ownership is simpler.
- `unwrap()` on input parsing, I/O or lock poisoning in production paths.
- Holding a `std::sync::Mutex` guard across an `.await`.
- Blocking calls (file I/O, `std::thread::sleep`, heavy CPU) inside async tasks; use
  `spawn_blocking` or the runtime's async API.
- Indexing slices with unchecked values (`v[i]`) on untrusted input; use `.get(i)`.
- Lossy numeric casts with `as`; use `try_from`.
- Raising the minimum Rust version by using a newer API without noticing `rust-version`.
- Adding a dependency with default features when only one is needed.
