import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const archive = process.argv[2]
const packageDir = process.argv[3]
if (!archive || !packageDir)
  throw new Error('usage: node scripts/consumer-smoke.mjs /absolute/path/package.tgz package-dir')
const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'aihu-compiler-consumer-'))
execFileSync('npm', ['init', '-y'], { cwd: dir, stdio: 'ignore' })
const platformOptions = []
if (manifest.os?.length === 1) platformOptions.push(`--os=${manifest.os[0]}`)
if (manifest.cpu?.length === 1) platformOptions.push(`--cpu=${manifest.cpu[0]}`)
if (manifest.libc?.length === 1) platformOptions.push(`--libc=${manifest.libc[0]}`)
execFileSync(
  'npm',
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
const binaryEntry =
  (typeof manifest.main === 'string' && /\.(?:node|exe)$/.test(manifest.main)
    ? manifest.main
    : undefined) ??
  (Array.isArray(manifest.files)
    ? manifest.files.find((entry) => /^aihu-compile(?:\.exe)?$/.test(entry))
    : undefined)
if (binaryEntry) {
  if (!existsSync(resolve(installed, binaryEntry))) throw new Error('consumer binary is missing')
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
