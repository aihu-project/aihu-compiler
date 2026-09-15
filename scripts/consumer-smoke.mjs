import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// `npm` is a .cmd shim on Windows; Node cannot spawn it without a shell.
const npm = (args, options) =>
  execFileSync('npm', args, { ...options, shell: process.platform === 'win32' })

const archive = process.argv[2]
const packageDir = process.argv[3]
if (!archive || !packageDir)
  throw new Error('usage: node scripts/consumer-smoke.mjs /absolute/path/package.tgz package-dir')
const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'aihu-compiler-consumer-'))
npm(['init', '-y'], { cwd: dir, stdio: 'ignore' })
const platformOptions = []
if (manifest.os?.length === 1) platformOptions.push(`--os=${manifest.os[0]}`)
if (manifest.cpu?.length === 1) platformOptions.push(`--cpu=${manifest.cpu[0]}`)
if (manifest.libc?.length === 1) platformOptions.push(`--libc=${manifest.libc[0]}`)
npm(
  [
    'install',
    '--ignore-scripts',
    '--no-package-lock',
    '--no-audit',
    '--no-fund',
    ...platformOptions,
    resolve(archive),
  ],
  { cwd: dir, stdio: 'inherit' },
)
const installed = resolve(dir, 'node_modules', ...manifest.name.split('/'))
if (typeof manifest.main === 'string' && /\.(?:node|exe)$/.test(manifest.main)) {
  if (!existsSync(resolve(installed, manifest.main))) throw new Error('consumer binary is missing')
} else if (typeof manifest.main !== 'string' && manifest.exports === undefined) {
  // Binary-only platform package (the CLI's `aihu-compile`): it has no module
  // entry to import, so prove every shipped file installed and is non-empty.
  const shipped = (manifest.files ?? []).filter((file) => !/[*?]/.test(file))
  if (shipped.length === 0) throw new Error('binary-only package declares no files to verify')
  for (const file of shipped) {
    const path = resolve(installed, file)
    if (!existsSync(path) || statSync(path).size === 0)
      throw new Error(`consumer binary is missing or empty: ${file}`)
  }
} else {
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const mod = await import(${JSON.stringify(manifest.name)}); if (typeof mod !== 'object') throw new Error('compiler import failed')`,
    ],
    { cwd: dir, stdio: 'inherit' },
  )
}
console.log(`isolated consumer passed against ${archive}`)
