# Aihu Compiler

The Rust and TypeScript implementation of `@aihu/compiler`, including its
native binary and N-API addon package sources.

This repository is being extracted from `aihu-project/aihu` to isolate compiler
and native-platform checks from application, documentation, and provider work.
The public package name remains `@aihu/compiler`.

## Verify

```sh
bun install --frozen-lockfile
bun run check
```

## Release modes

The compiler host and browser WASM package may take a patch release without
rebuilding the ten native platform packages. In that case, the host keeps exact
pins to the last compatible native version and the release workflow skips the
CLI and N-API matrices. The manifest check also verifies that native source has
not changed since that native version's release tag.

Any Rust, native build, or platform-package change requires a lockstep release:
the host, WASM, CLI packages, N-API packages, and exact optional-dependency pins
must all use the new version.
