#!/usr/bin/env bun
/** Stage the published @aihu/compiler-wasm package from wasm-pack output. */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const outArg = process.argv[2]
if (!outArg) {
  console.error('Usage: bun scripts/stage-wasm-package.ts <output-directory>')
  process.exit(1)
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compilerDir = join(repoRoot, 'packages', 'compiler')
const sourceDir = join(compilerDir, 'pkg-wasm')
const manifestPath = join(compilerDir, 'npm-wasm', 'package.json')
const outDir = resolve(outArg)
const runtimeFiles = ['aihu_compiler.js', 'aihu_compiler_bg.wasm', 'aihu_compiler.d.ts']

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  name?: string
  version?: string
}
const compiler = JSON.parse(await readFile(join(compilerDir, 'package.json'), 'utf8')) as {
  version?: string
}
if (manifest.name !== '@aihu/compiler-wasm' || manifest.version !== compiler.version) {
  throw new Error(
    `Expected @aihu/compiler-wasm@${compiler.version}; found ${manifest.name ?? 'unknown'}@${manifest.version ?? 'unknown'}`,
  )
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
for (const file of runtimeFiles) await cp(join(sourceDir, file), join(outDir, file))
await cp(manifestPath, join(outDir, 'package.json'))
await cp(join(compilerDir, 'npm-wasm', 'README.md'), join(outDir, 'README.md'))
await cp(join(compilerDir, 'LICENSE'), join(outDir, 'LICENSE'))

await writeFile(join(outDir, '.npmignore'), '*.wasm.d.ts\n', 'utf8')
console.log(`Staged @aihu/compiler-wasm@${compiler.version} → ${outDir}`)
