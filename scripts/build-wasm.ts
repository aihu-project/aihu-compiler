#!/usr/bin/env bun
/** Build the compiler's browser target with the pinned Rustup toolchain when present. */

import { spawnSync } from 'node:child_process'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compilerDir = join(repoRoot, 'packages', 'compiler')

function rustupAwareEnv(): NodeJS.ProcessEnv {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['rustup'], {
    encoding: 'utf8',
  })
  const rustupPath = probe.status === 0 ? probe.stdout.trim().split(/\r?\n/)[0] : undefined
  if (!rustupPath) return process.env
  return {
    ...process.env,
    PATH: `${dirname(rustupPath)}${delimiter}${process.env.PATH ?? ''}`,
  }
}

const result = spawnSync('wasm-pack', ['build', '--target', 'web', '--out-dir', 'pkg-wasm'], {
  cwd: compilerDir,
  env: rustupAwareEnv(),
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
