import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? 'packages/compiler')
const dir = resolve(process.env.PACK_DIR ?? '.release/pack')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const s = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const p = JSON.parse(
  execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dir], {
    cwd: root,
    encoding: 'utf8',
  }),
)
if (p.length !== 1) throw new Error('npm pack did not produce exactly one archive')
const a = resolve(dir, p[0].filename)
if (!existsSync(a) || readdirSync(dir).filter((x) => x.endsWith('.tgz')).length !== 1)
  throw new Error('pack directory must contain exactly one tarball')
const g = JSON.parse(
  execFileSync('tar', ['-xOzf', a, 'package/package.json'], { encoding: 'utf8' }),
)
for (const f of [
  'name',
  'version',
  'main',
  'module',
  'types',
  'exports',
  'bin',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
])
  if (JSON.stringify(g[f]) !== JSON.stringify(s[f]))
    throw new Error(`manifest field ${f} changed in tarball`)
const e = execFileSync('tar', ['-tzf', a], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
for (const f of ['package/package.json', 'package/README.md'])
  if (!e.includes(f)) throw new Error(`tarball is missing ${f}`)
for (const f of s.files ?? []) {
  const path = `package/${f}`
  const prefix = path.endsWith('/') ? path : `${path}/`
  if (!e.some((entry) => entry === path || entry.startsWith(prefix)))
    throw new Error(`tarball is missing package file ${f}`)
}
for (const f of [s.main, s.module, s.types].filter((value) => typeof value === 'string'))
  if (!e.includes(`package/${f}`)) throw new Error(`tarball is missing manifest file ${f}`)
if (e.some((f) => /^package\/(?:src|tests|scripts|node_modules|\.github)(?:\/|$)/.test(f)))
  throw new Error('disallowed files leaked into tarball')
if (process.env.GITHUB_ENV)
  writeFileSync(process.env.GITHUB_ENV, `AIHU_PACK_PATH=${a}\n`, { flag: 'a' })
console.log(`verified ${a}: ${g.name}@${g.version}`)
