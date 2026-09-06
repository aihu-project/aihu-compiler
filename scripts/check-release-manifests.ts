import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type PackageManifest = {
  name: string
  version: string
  optionalDependencies?: Record<string, string>
}

const root = process.cwd()
const compilerDir = join(root, 'packages', 'compiler')
const readManifest = (path: string): PackageManifest =>
  JSON.parse(readFileSync(path, 'utf8')) as PackageManifest

const compiler = readManifest(join(compilerDir, 'package.json'))
const packageDirs = ['npm', 'npm-native'].flatMap((kind) =>
  readdirSync(join(compilerDir, kind), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(compilerDir, kind, entry.name, 'package.json')),
)
const platforms = packageDirs.map(readManifest)
const expectedNames = new Set(platforms.map((pkg) => pkg.name))
const pinnedNames = new Set(Object.keys(compiler.optionalDependencies ?? {}))
const errors: string[] = []

for (const pkg of platforms) {
  if (pkg.version !== compiler.version) {
    errors.push(`${pkg.name} is ${pkg.version}; expected ${compiler.version}`)
  }
  if (compiler.optionalDependencies?.[pkg.name] !== compiler.version) {
    errors.push(`${pkg.name} is not pinned to ${compiler.version} by @aihu/compiler`)
  }
}

for (const name of pinnedNames) {
  if (name.startsWith('@aihu/compiler') && !expectedNames.has(name)) {
    errors.push(`@aihu/compiler pins ${name}, but no local platform package exists`)
  }
}

if (errors.length > 0) {
  console.error('Compiler release-manifest check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Compiler release manifests are synchronized: ${compiler.name}@${compiler.version} + ${platforms.length} platform packages.`,
)
