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
