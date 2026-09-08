# Releasing @aihu/compiler

The compiler ships a JavaScript package plus optional platform packages. The
release workflow is tag-driven and publishes only from a reviewed commit on
the default branch.

## Release modes

After the release change has landed and its pull request is reviewed, create
the exact tag that matches the host package version:

```bash
git tag compiler-v1.3.7
git push origin compiler-v1.3.7
```

A host-only patch release keeps the host and WASM packages in lockstep while
the ten platform packages remain at the most recent native release. For this
release, `@aihu/compiler` and `@aihu/compiler-wasm` are `1.3.7`, the platform
packages are `1.3.5`, and the host's optional dependency pins are `1.3.5`.
The workflow validates this with:

```bash
bun run check:release-manifests
```

When the host and platform versions match, the workflow also builds and
publishes the native CLI and N-API matrices. Do not tag a release until the
native history check, package allowlists, isolated npm consumers, and E404
checks pass for every package being released.

## Local development bypass

If you build from source, set `AIHU_COMPILE_BIN` to the local CLI binary:

```bash
export AIHU_COMPILE_BIN=$(pwd)/target/release/aihu-compile
bun install
```

The compiler resolver uses that path before looking for an installed platform
package. On Windows, point at the `.exe`:

```powershell
$env:AIHU_COMPILE_BIN = "$pwd\target\release\aihu-compile.exe"
bun install
```

## Verifying published packages

After a release lands, verify the host and platform package versions before
testing a local compile:

```bash
npm view @aihu/compiler@1.3.7 version
npm view @aihu/compiler-wasm@1.3.7 version
npm view @aihu/compiler-linux-x64-gnu@1.3.5 version
npm view @aihu/compiler-native-linux-x64-gnu@1.3.5 version
npm install --ignore-scripts @aihu/compiler@1.3.7
```

## Asset naming

| Platform          | Runner       | Rust target               | Asset name                    |
| ---------------- | ------------ | ------------------------- | ----------------------------- |
| darwin-arm64     | macos-14     | aarch64-apple-darwin      | aihu-compile-darwin-arm64     |
| darwin-x64       | macos-14     | x86_64-apple-darwin       | aihu-compile-darwin-x64       |
| linux-x64-gnu    | ubuntu-22.04 | x86_64-unknown-linux-gnu  | aihu-compile-linux-x64-gnu    |
| linux-arm64-gnu  | ubuntu-22.04 | aarch64-unknown-linux-gnu | aihu-compile-linux-arm64-gnu  |
| win32-x64-msvc   | windows-2022 | x86_64-pc-windows-msvc    | aihu-compile-win32-x64-msvc   |

The release workflow rejects unsupported platform metadata, missing binaries,
unexpected tarball files, non-OIDC npm credentials, and published versions
that are not E404-only before any package is published.
