# @aihu/compiler

> **Aihu** — agentic discovery and interaction, for human purpose.

Single File Component (.aihu) compiler — Rust binary + JS glue.

Part of the **compiler + toolchain** layer of Aihu. Build-time only — does not ship to the client. The compiler reads `.aihu` SFC source (per the [Block Structure spec](../../docs/superpowers/specs/2026-05-02-spec-block-structure.md)) and emits standards-compliant Web Components.

<!-- BEGIN_HANDWRITTEN: prose -->

The package exposes the compiler plugin and transform API from its root entry point. Migration tools are available as stable subpath exports so framework tooling does not need to import compiler source files:

```ts
import { migrate } from '@aihu/compiler/codemods/macro-simplification'
import { migrateStateWrappers } from '@aihu/compiler/codemods/state-wrapper'
import { migrateTemplateGrammar } from '@aihu/compiler/codemods/template-grammar-v2'
```

<!-- END_HANDWRITTEN: prose -->

## Install

<!-- BEGIN_AUTOGEN: install -->
<!-- regenerate: bun scripts/sync-readme.ts (also runs in pre-commit + CI) -->

```bash
npm install @aihu/compiler
# or
bun add @aihu/compiler
```

<sub><i>Auto-generated against `@aihu/compiler@1.3.5`.</i></sub>

<!-- END_AUTOGEN: install -->

## Package facts

<!-- BEGIN_AUTOGEN: stats -->
<!-- regenerate: bun scripts/sync-readme.ts (also runs in pre-commit + CI) -->

| | |
|---|---|
| **Version** | `1.3.5` |
| **Tier** | D — Compiler — Single-File Component (.aihu) → Web Component |
| **Published files** | 4 entries |
| **License** | MIT |

<sub><i>Auto-generated against `@aihu/compiler@1.3.5`.</i></sub>

<!-- END_AUTOGEN: stats -->

## Exports

<!-- BEGIN_AUTOGEN: exports -->
<!-- regenerate: bun scripts/sync-readme.ts (also runs in pre-commit + CI) -->

| Subpath | ESM | CJS |
|---|---|---|
| `.` | `./dist/index.js` | `—` |
| `./codemods/macro-simplification` | `./dist/codemods/macro-simplification.js` | `—` |
| `./codemods/state-wrapper` | `./dist/codemods/state-wrapper.js` | `—` |
| `./codemods/template-grammar-v2` | `./dist/codemods/template-grammar-v2.js` | `—` |

<sub><i>Auto-generated against `@aihu/compiler@1.3.5`.</i></sub>

<!-- END_AUTOGEN: exports -->

## Dependencies

<!-- BEGIN_AUTOGEN: deps -->
<!-- regenerate: bun scripts/sync-readme.ts (also runs in pre-commit + CI) -->

**Peer dependencies:**

- `vite` — `>=5.0.0`
- `@aihu/css-engine` — `>=0.6.1`

**Optional dependencies (platform-specific):**

- `@aihu/compiler-darwin-arm64` — `1.3.4`
- `@aihu/compiler-darwin-x64` — `1.3.4`
- `@aihu/compiler-linux-x64-gnu` — `1.3.4`
- `@aihu/compiler-linux-arm64-gnu` — `1.3.4`
- `@aihu/compiler-win32-x64-msvc` — `1.3.4`
- `@aihu/compiler-native-darwin-arm64` — `1.3.4`
- `@aihu/compiler-native-darwin-x64` — `1.3.4`
- `@aihu/compiler-native-linux-x64-gnu` — `1.3.4`
- `@aihu/compiler-native-linux-arm64-gnu` — `1.3.4`
- `@aihu/compiler-native-win32-x64-msvc` — `1.3.4`

<sub><i>Auto-generated against `@aihu/compiler@1.3.5`.</i></sub>

<!-- END_AUTOGEN: deps -->

## See also

<!-- BEGIN_AUTOGEN: see-also -->
<!-- regenerate: bun scripts/sync-readme.ts (also runs in pre-commit + CI) -->

- [Block Structure spec](../../docs/superpowers/specs/2026-05-02-spec-block-structure.md)
- [Template Attribute Syntax spec](../../docs/superpowers/specs/2026-05-02-spec-template-attribute-syntax.md)
- [Macro Vocabulary spec](../../docs/superpowers/specs/2026-05-02-spec-macro-vocabulary.md)
- [Aihu framework root](../../README.md)

<sub><i>Auto-generated against `@aihu/compiler@1.3.5`.</i></sub>

<!-- END_AUTOGEN: see-also -->

## License

<!-- BEGIN_AUTOGEN: license -->
<!-- regenerate: bun scripts/sync-readme.ts (also runs in pre-commit + CI) -->

MIT — see [LICENSE](../../LICENSE).

<sub><i>Auto-generated against `@aihu/compiler@1.3.5`.</i></sub>

<!-- END_AUTOGEN: license -->
