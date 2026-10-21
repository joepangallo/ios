# iOS Development Studio

A self-contained, interactive course page for learning iOS development with
Swift and SwiftUI. Everything lives in one HTML file: Swift programs run inside
the page through an in-browser Swift engine, SwiftUI examples render in a live
iPhone preview, every line of code carries a five-part explanation (who, what,
where, when, why), and each module ends with simulations and quizzes.

## Open the page

Open `ios-development.html` in a browser. No server or install is needed; the
file works from disk. A printable companion, `ios-development-study-guide.pdf`,
is built from the same content.

## Working on the course

Requirements: Node 24 (see `.nvmrc`; anything from Node 22 works). Run `npm ci`
once. The browser checks also need Playwright's Chromium
(`npx playwright install chromium`).

| Script | What it does |
| --- | --- |
| `npm run build` | Rebuilds `ios-development.html` from `src/`. Deterministic: the same sources always produce the same file. |
| `npm run check` | The quality gate: content validation, compiler-diagnostic and fixture comparisons, the WebAssembly module check, unit tests with coverage, then a build. Runs anywhere. |
| `npm run check:browser` | Renders every SwiftUI example in Chromium (`preview-check`) and walks the whole page end to end (`e2e`). Needs Playwright Chromium. |
| `npm run check:xcode` | Verifies every code example against the real Swift compiler. macOS with Xcode command line tools only. |
| `npm test` | Unit tests only. `npm run test:coverage` adds the coverage report. |
| `npm run e2e` | The end-to-end walk on its own. Options: `--browser=webkit`, `--from=N`, `--only=lesson-id`, `--shots=/abs/dir`. |
| `npm run pdf` | Rebuilds the study guide PDF (needs Playwright Chromium). |
| `npm run build:wasm` | Recompiles `src/wasm/SwiftCore.swift` to WebAssembly (needs the swift.org toolchain named in `tools/build-wasm.sh`). |

Individual tools under `tools/` can be run directly with `node tools/<name>.mjs`;
each file starts with a comment describing its options.

### Expectation files

Two sets of recorded compiler behaviour pin the in-browser engine to real Swift:

- `tests/fixtures/*.out` is what `xcrun swift` printed for each `*.swift` file.
- `tests/diagnostics/*.err` is the first error `swiftc` reported for each file.

`npm run check` compares the engine against these files and never changes them.
To regenerate them after editing a fixture, run `node tools/conformance.mjs --refresh`
or `node tools/diag-check.mjs --refresh` on a Mac with Xcode; both refuse to run
without it.

### Continuous integration

`.github/workflows/ci.yml` runs `npm run check`, fails if the committed
`ios-development.html` is stale (rebuild and commit it after changing anything
under `src/`), then installs Chromium and runs `npm run check:browser`.

## Folder layout

```
ios-development.html   the built course page (committed; rebuild after changes)
src/app/               page shell: navigation, editor, console, previews, runtime, styles
src/content/           one module per file, numbered 00-09 (lessons and steps)
src/engine/            the in-browser Swift engine: lexer, parser, interpreter, built-ins
src/engine/swiftui/    the live SwiftUI preview renderer
src/widgets/           interactive simulations and figures used by the modules
src/wasm/              SwiftCore.swift and its compiled SwiftCore.wasm
src/shared/            helpers shared by the app and widgets
src/generated/         registry written by the build (ignored by git)
tools/                 build, validation and verification scripts
tests/unit/            vitest suites (engine, previews, content, widgets, tooling, wasm)
tests/e2e/             the Playwright walk of the built page
tests/fixtures/        Swift programs with recorded compiler output
tests/diagnostics/     beginner mistakes with recorded compiler errors
```

## How content is structured

Each file in `src/content/` exports one module: `id`, `number`, `title`,
`short`, `summary`, `objectives` and a list of `lessons`. A lesson has an `id`,
a `title` and an ordered list of `steps`. A step has a `kind`:

- `concept`: a short explanation (`body`, optional `points`, `callout`, `figure`).
  Limited to about 230 words so it fits one screen.
- `code`: an example with `run` set to `swift` (runs in the console; needs
  `expect`, `expectError` or `nondeterministic`), `swiftui` (live preview),
  `static` (read-along; `context` may be prepended for verification) or
  `swifttest` (Swift Testing; needs `expectTests`).
- `compare`: two code panes, `left` and `right`, each with a `label` and `lines`.
- `widget`: an interactive simulation named by `widget`.
- `quiz`: at least three `questions`, each with `q`, `choices`, `answer` and `explain`.

Code is written as `lines`: an array of `[codeString, note]` pairs. Every line
that is not blank or closing punctuation needs a note with five strings:
`who`, `what`, `where`, `when` and `why`. Steps are limited to 26 lines so
they fit on one screen.

Widgets live in `src/widgets/`. A widget file exports objects with a `name`,
optional `css`, and a `mount(element, props, ctx)` function that returns an
object with `destroy()`. The `ctx` runtime gives widgets the Swift engine, the
compiled WebAssembly core, safe storage, fetch with timeouts, icons and toasts.

## Adding a step

1. Add the step object to the right lesson in `src/content/NN-name.js`.
2. For a `swift` example, set `expect` to the exact output of the real compiler.
3. Run `npm run validate` for structure, then `npm run check:xcode` on a Mac to
   confirm the compiler agrees, then `npm run check` and `npm run build`.
4. Commit the rebuilt `ios-development.html` with the source change.

## What needs Xcode

Only `npm run check:xcode` (`tools/verify-swift.mjs`) and the `--refresh` modes
of `tools/conformance.mjs` and `tools/diag-check.mjs` call the real Swift
compiler through `xcrun`. They exit with code 2 and a message when it is not
available. Everything else, including the unit tests, the browser checks and
the build, runs on any platform with Node.
