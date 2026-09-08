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
let installed
if (manifest.os || manifest.cpu || manifest.libc) {
  execFileSync('tar', ['-xzf', resolve(archive), '-C', dir], { stdio: 'inherit' })
  installed = resolve(dir, 'package')
} else {
  execFileSync('npm', ['init', '-y'], { cwd: dir, stdio: 'ignore' })
  execFileSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-package-lock',
      '--no-audit',
      '--no-fund',
      resolve(archive),
    ],
    { cwd: dir, stdio: 'inherit' },
  )
  installed = resolve(dir, 'node_modules', ...manifest.name.split('/'))
}
if (typeof manifest.main === 'string' && /\.(?:node|exe)$/.test(manifest.main)) {
  if (!existsSync(resolve(installed, manifest.main))) throw new Error('consumer binary is missing')
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
