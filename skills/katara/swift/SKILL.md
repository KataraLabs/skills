---
name: swift
description: Use when writing, changing, reviewing or testing Swift code (.swift files, an Xcode project, or a Package.swift). Covers finding the project's conventions, Swift style, optionals, concurrency, SwiftUI basics, package and app layout, running tests with swift test or xcodebuild, and common Swift mistakes.
license: MIT
---

# Swift

## Find the project's conventions first

1. Project type: `Package.swift` (Swift Package Manager), `*.xcodeproj` / `*.xcworkspace`
   (Xcode app), `project.yml` (XcodeGen) or `Tuist/`. Edit the generator's file, not the
   generated project.
2. Swift tools version and language mode (Swift 5 or 6) in `Package.swift` or the build settings.
   Swift 6 mode makes data-race checks errors.
3. Format and lint config: `.swift-format`, `.swiftformat`, `.swiftlint.yml`.
4. UI framework: SwiftUI, UIKit or AppKit. Architecture in use (plain SwiftUI with
   `@Observable`, MVVM, TCA). Match the nearest existing screen.
5. Test framework: Swift Testing (`import Testing`, `@Test`) or XCTest (`XCTestCase`). Use
   whichever the target already uses.

## Style

- `let` by default, `var` only when the value changes.
- Value types (`struct`, `enum`) for data; `class` when identity or shared mutable state is the point;
  `actor` for shared mutable state across tasks.
- Unwrap optionals with `if let`, `guard let` or `??`. No force unwrap (`!`) or `try!` outside
  tests and truly impossible cases; document those.
- `guard` for early exits so the main path stays unindented.
- Errors: throw typed `Error` enums; callers use `do`/`try`/`catch`. Do not swallow with `try?`
  where the failure matters.
- Mark types and members `private` or `fileprivate` unless they need wider access.
- Name things for their call site: `remove(at:)`, `makeIterator()`, booleans read as assertions (`isEmpty`).
- Protocols with extensions for shared behavior; generics with constraints over `Any`.

## Concurrency

- `async`/`await` over completion handlers in new code; wrap old APIs with
  `withCheckedThrowingContinuation`, resuming exactly once.
- UI work on the main actor: annotate view models and UI types `@MainActor`.
- Types crossing tasks must be `Sendable`. Fix the warning rather than adding `@unchecked Sendable`.
- Use structured concurrency (`async let`, `TaskGroup`); keep a handle to unstructured `Task`s
  you need to cancel, and check `Task.isCancelled` in long work.

## SwiftUI

- Views are small structs; split when a `body` grows past a screen.
- `@State` for view-local values, `@Binding` to pass write access down, `@Observable` models
  (or `ObservableObject` on older targets) for shared state, `@Environment` for app-wide values.
- Side effects in `.task` (cancelled with the view) rather than `onAppear` with a detached task.
- Add `#Preview` blocks matching how the project uses them.

## Layout

```text
Package.swift
Sources/<Target>/       library and executable code
Tests/<Target>Tests/    tests per target
```

App projects group by feature (`Features/Profile/`) or by layer; follow what exists.

## Tests

If your agent can run commands, run these; otherwise give the user the exact commands.

```bash
swift build
swift test
swift test --filter ParserTests
xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'
```

Pick a simulator name the machine has (`xcrun simctl list devices available`).

- Swift Testing: `@Test func parsesEmptyInput() { #expect(parse("") == []) }`, parameterized with
  `@Test(arguments: [...])`, `#require` to unwrap.
- XCTest: `func testParsesEmptyInput()`, `XCTAssertEqual`, `XCTUnwrap`, `async` test methods for async code.
- Inject dependencies (clock, network, storage) through protocols or closures so tests do not hit
  the network or the real disk.

## Common mistakes

- Force unwrapping optionals from user input, JSON or the file system.
- Retain cycles: a closure stored on `self` that captures `self` strongly. Use `[weak self]`.
- Updating UI off the main actor.
- `@unchecked Sendable` or `nonisolated(unsafe)` to quiet the compiler.
- Continuations resumed twice or never.
- Editing a generated `.xcodeproj` when the project uses XcodeGen or Tuist.
- Blocking the main thread with synchronous file or network work.
- Assuming a simulator or device name exists on the user's machine.
