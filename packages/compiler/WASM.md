# aihu-compiler — WASM Build

`aihu-compiler` cross-compiles to WebAssembly via `wasm-pack`, exposing a
`wasm_compile(source: string)` function for use in browser playgrounds.

This unlocks **Directive 1** (homepage interactive playground per `docs/roadmap/_user-directives.md`) and **arch-4 §4.6** — compile `.aihu` source files entirely client-side at <200ms p50 for 50-line fixtures.

## Build

Prerequisites:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack   # one-time
```

Build the WASM bundle:

```bash
cd packages/compiler
wasm-pack build --target web --out-dir pkg-wasm
# or: bun run build:wasm
```

Output (gitignored):

- `pkg-wasm/aihu_compiler_bg.wasm` — the WASM binary
- `pkg-wasm/aihu_compiler.js` — JS glue (ESM, `--target web`)
- `pkg-wasm/aihu_compiler.d.ts` — TypeScript types
- `pkg-wasm/package.json` — package metadata

## Integration (Homepage Playground)

```typescript
import init, { wasm_compile, wasm_version } from '@aihu/compiler-wasm/aihu_compiler.js'

// One-time initialization (lazy-load the .wasm file)
await init()

console.log(`aihu-compiler v${wasm_version()}`)

// Compile a .aihu source string
const result = wasm_compile(source)
// result: { js: string, manifest_json: string, route_json: string | null }
```

The `wasm_compile` function runs the full parse → compile_full → emit pipeline in one call. Tag name is resolved from `@state.meta.name` → `@route.name` → `"aihu-component"`.

## Performance Targets (Directive 1)

| Metric | Target | Source |
|---|---|---|
| Compile latency, 50-line fixture | <200ms p50 | Directive 1 acceptance criterion #2 |
| Initial JS bundle | <1 MB | Directive 1 acceptance criterion #3 |
| `.wasm` gzipped size | <500 KB | arch-4 §4.6 + Directive 1 |
| WASM init | one-time, lazy | Behind playground iframe boundary |

To measure bundle size after build:

```bash
gzip -9 -c pkg-wasm/aihu_compiler_bg.wasm | wc -c
```

## Size Budget & Measured Sizes

The gzipped `.wasm` budget is **<500 KB (512,000 B)** — Directive 1 acceptance
criterion #3 + arch-4 §4.6. Since W2 (advanced-js-template-expressions) the
release CI **hard-fails** past the budget (previously a non-blocking warning).

W2 embedded `oxc_parser` (expression validation behind `--expr-parser ast`) and
adopted a size-optimized `[profile.release]` at the workspace root
(`opt-level = "z"`, fat LTO, `codegen-units = 1`, `panic = "abort"`,
`strip = true`) so the combined cdylib stays comfortably inside budget.

Measured 2026-07-10 (wasm-pack `--target web`, local Apple Silicon; gzip -9):

| Build | rustc | raw `.wasm` | gzipped |
|---|---|---|---|
| Pre-W2 baseline (no oxc, default O3 release profile) | 1.87.0 | 668,236 B | 250,786 B |
| W2 (oxc 0.139 embedded, `z`+LTO profile) | 1.95.0 | 926,337 B | **325,133 B** |
| W3 (AST signal rewrite: + `oxc_ast_visit`), same pipeline as the W2 row | 1.95.0 | 956,746 B | 335,556 B |
| W3 shipped (`wasm-opt -Oz` re-enabled — see note) | 1.95.0 | 843,862 B | **342,532 B** |

Net cost of real-JS expression parsing (W2): **+258 KB raw / +74 KB gzip**
after the profile change. Net cost of the W3 scope-aware rewrite itself
(row 3 vs row 2, identical pipeline): **+30 KB raw / +10 KB gzip** — the
visitor + span-edit machinery rides on the parser weight W2 already paid.
Shipped W3 artifact: **66.9% of budget used, ~166 KB gzip headroom.**

**wasm-opt note (W3):** rustc ≥ 1.94 (the W2 MSRV bump) emits
bulk-memory/sign-ext ops by default, which wasm-pack's bundled binaryen
(version 117) rejects — wasm-pack then SKIPS `wasm-opt` with a non-fatal
warning, so the W2 row above (and any CI build since the toolchain bump) was
effectively unoptimized. W3 re-enables it via
`[package.metadata.wasm-pack.profile.release] wasm-opt = ["-Oz",
"--enable-bulk-memory", "--enable-sign-ext",
"--enable-nontrapping-float-to-int"]` in `packages/compiler/Cargo.toml`
(−112 KB raw ⇒ faster instantiation; +7 KB gzip — the size-graded opcodes
compress slightly worse).


## Smoke Benchmark

`bench/wasm-smoke.html` runs a 5-iteration benchmark of the 50-line fixture and reports min / max / p50. WASM requires a real HTTP server (not `file://`):

```bash
cd packages/compiler
python3 -m http.server 8080
# open http://localhost:8080/bench/wasm-smoke.html
```

PASS = p50 < 200ms (Directive 1 §2). FAIL surfaces the actual measurement.

## Native Build (Unchanged)

`cargo build --release -p aihu-compiler` and `cargo test -p aihu-compiler` continue to work unchanged. The `[lib] crate-type = ["cdylib", "rlib"]` preserves the rlib for native consumers; cdylib is only activated by `wasm-pack`. The `wasm-bindgen` and `serde-wasm-bindgen` deps are gated under `[target.'cfg(target_arch = "wasm32")'.dependencies]` so they don't enter the native build at all.

## Published package

Every compiler release builds the browser bundle once and publishes it as
`@aihu/compiler-wasm` at the same version as `@aihu/compiler`. The package
contains the wasm-pack JavaScript glue, the `.wasm` binary, and its type
declaration; it has no native dependency or postinstall step.

The release job follows this sequence:

1. Build `packages/compiler/pkg-wasm/` with `wasm-pack` for
   `wasm32-unknown-unknown`.
2. Stage only runtime files with `scripts/stage-wasm-package.ts`.
3. Run `npm pack --dry-run` against the staged package, then publish it when
   the release is not a dry run.
4. Publish `@aihu/compiler` only after its CLI platform packages, native
   addons, and WASM package have all published successfully.

Consumers should install a matching `@aihu/compiler-wasm` version and copy or
import its `aihu_compiler.js` and `aihu_compiler_bg.wasm` files. This gives the
browser the same versioned compiler used by build tooling without making a
website's CI install Rust or compile the compiler source.

The release job fails if the gzip-compressed `.wasm` exceeds 500 KB. See
"Size Budget & Measured Sizes" for the current baseline.
