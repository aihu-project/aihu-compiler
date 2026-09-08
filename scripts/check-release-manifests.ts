import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type PackageManifest = {
  name: string
  version: string
  optionalDependencies?: Record<string, string>
}

type StableVersion = {
  major: number
  minor: number
  patch: number
}

const root = process.cwd()
const compilerDir = join(root, 'packages', 'compiler')
const allowHostOnly = process.argv.slice(2).includes('--allow-host-only')
const checkNativeHistory = process.argv.slice(2).includes('--check-native-history')
const mode = allowHostOnly ? 'allow-host-only' : 'strict'
const errors: string[] = []

const nativeSensitivePaths = [
  'Cargo.toml',
  'Cargo.lock',
  'rust-toolchain.toml',
  'packages/compiler/Cargo.toml',
  'packages/compiler/Cargo.lock',
  'packages/compiler/src/',
  'packages/compiler/src-native/',
  'packages/compiler/npm/',
  'packages/compiler/npm-native/',
  'packages/compiler/scripts/build-native.ts',
] as const

const platformPackages = [
  ['npm', 'darwin-arm64', '@aihu/compiler-darwin-arm64'],
  ['npm', 'darwin-x64', '@aihu/compiler-darwin-x64'],
  ['npm', 'linux-arm64-gnu', '@aihu/compiler-linux-arm64-gnu'],
  ['npm', 'linux-x64-gnu', '@aihu/compiler-linux-x64-gnu'],
  ['npm', 'win32-x64-msvc', '@aihu/compiler-win32-x64-msvc'],
  ['npm-native', 'darwin-arm64', '@aihu/compiler-native-darwin-arm64'],
  ['npm-native', 'darwin-x64', '@aihu/compiler-native-darwin-x64'],
  ['npm-native', 'linux-arm64-gnu', '@aihu/compiler-native-linux-arm64-gnu'],
  ['npm-native', 'linux-x64-gnu', '@aihu/compiler-native-linux-x64-gnu'],
  ['npm-native', 'win32-x64-msvc', '@aihu/compiler-native-win32-x64-msvc'],
] as const

const expectedPlatformNames = new Set(platformPackages.map(([, , name]) => name))

const readManifest = (path: string): PackageManifest | null => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PackageManifest
  } catch (error) {
    errors.push(`could not read ${path}: ${(error as Error).message}`)
    return null
  }
}

const parseStableVersion = (version: unknown): StableVersion | null => {
  if (typeof version !== 'string') return null
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)
  if (match === null) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

const compiler = readManifest(join(compilerDir, 'package.json'))
const wasm = readManifest(join(compilerDir, 'npm-wasm', 'package.json'))
const platforms: PackageManifest[] = []

for (const [kind, directory, expectedName] of platformPackages) {
  const path = join(compilerDir, kind, directory, 'package.json')
  const pkg = readManifest(path)
  if (pkg === null) continue
  platforms.push(pkg)
  if (pkg.name !== expectedName)
    errors.push(`${path} is named ${pkg.name}; expected ${expectedName}`)
}

for (const kind of ['npm', 'npm-native'] as const) {
  const expectedDirectories = new Set(
    platformPackages
      .filter(([packageKind]) => packageKind === kind)
      .map(([, directory]) => directory),
  )
  try {
    for (const entry of readdirSync(join(compilerDir, kind), { withFileTypes: true })) {
      if (entry.isDirectory() && !expectedDirectories.has(entry.name)) {
        errors.push(`${kind}/${entry.name} is an extra platform package directory`)
      }
    }
  } catch (error) {
    errors.push(`could not read ${join(compilerDir, kind)}: ${(error as Error).message}`)
  }
}

const compilerVersion = compiler?.version
const wasmVersion = wasm?.version
const platformVersions = platforms.map((pkg) => pkg.version)
const versionSummary = `host=${compilerVersion ?? '<missing>'}, platforms=${
  platformVersions.length === 0 ? '<missing>' : [...new Set(platformVersions)].join(',')
}, wasm=${wasmVersion ?? '<missing>'}`

console.log(`Compiler release-manifest check (mode: ${mode}; ${versionSummary})`)

if (compiler === null) errors.push('missing @aihu/compiler package manifest')
if (wasm === null) errors.push('missing @aihu/compiler-wasm package manifest')
if (platforms.length !== platformPackages.length) {
  errors.push(`expected ${platformPackages.length} platform packages; found ${platforms.length}`)
}

const hostSemver = parseStableVersion(compilerVersion)
if (hostSemver === null) {
  errors.push(`@aihu/compiler has unstable or invalid semver ${compilerVersion ?? '<missing>'}`)
}
if (parseStableVersion(wasmVersion) === null) {
  errors.push(
    `${wasm?.name ?? '@aihu/compiler-wasm'} has unstable or invalid semver ${wasmVersion ?? '<missing>'}`,
  )
}

const platformSemvers = platforms.map((pkg) => ({ pkg, version: parseStableVersion(pkg.version) }))
for (const { pkg, version } of platformSemvers) {
  if (version === null) errors.push(`${pkg.name} has unstable or invalid semver ${pkg.version}`)
}

if (wasmVersion !== compilerVersion) {
  errors.push(
    `${wasm?.name ?? '@aihu/compiler-wasm'} is ${wasmVersion ?? '<missing>'}; expected ${compilerVersion ?? '<missing>'}`,
  )
}

const distinctPlatformVersions = new Set(platformVersions)
if (distinctPlatformVersions.size > 1) {
  errors.push(`platform package versions are mixed: ${[...distinctPlatformVersions].join(', ')}`)
}

const verifyNativeHistory = (platformVersion: string): void => {
  const tag = `compiler-v${platformVersion}`
  try {
    execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
      cwd: root,
      stdio: 'ignore',
    })
  } catch {
    errors.push(`native history check failed: required tag ${tag} does not exist`)
    return
  }

  const result = spawnSync(
    'git',
    ['diff', '--quiet', `${tag}..HEAD`, '--', ...nativeSensitivePaths],
    {
      cwd: root,
      stdio: 'ignore',
    },
  )
  if (result.error) {
    errors.push(`native history check failed while running git diff: ${result.error.message}`)
  } else if (result.status === 1) {
    errors.push(`native history check failed: native-sensitive files changed since ${tag}`)
  } else if (result.status !== 0) {
    errors.push(
      `native history check failed: git diff exited with status ${result.status ?? 'unknown'}`,
    )
  }
}

if (allowHostOnly && hostSemver !== null) {
  for (const { pkg, version } of platformSemvers) {
    if (version === null) continue
    if (version.major !== hostSemver.major || version.minor !== hostSemver.minor) {
      errors.push(
        `${pkg.name} is ${pkg.version}; host ${compilerVersion} must share its major/minor version`,
      )
    } else if (version.patch > hostSemver.patch) {
      errors.push(
        `${pkg.name} is ${pkg.version}; platform patch must not be newer than host ${compilerVersion}`,
      )
    }
  }
}

if (
  allowHostOnly &&
  checkNativeHistory &&
  compilerVersion !== undefined &&
  distinctPlatformVersions.size === 1
) {
  const platformVersion = platformVersions[0]
  if (platformVersion !== undefined && compilerVersion !== platformVersion) {
    verifyNativeHistory(platformVersion)
  }
}

for (const { pkg } of platformSemvers) {
  if (!allowHostOnly && pkg.version !== compilerVersion) {
    errors.push(`${pkg.name} is ${pkg.version}; expected ${compilerVersion ?? '<missing>'}`)
  }
}

const pinned = compiler?.optionalDependencies ?? {}
for (const name of expectedPlatformNames) {
  const expectedPin = allowHostOnly ? platformVersions[0] : compilerVersion
  if (!(name in pinned)) {
    errors.push(`@aihu/compiler is missing optionalDependency pin for ${name}`)
  } else if (pinned[name] !== expectedPin) {
    errors.push(`${name} is pinned to ${pinned[name]}; expected ${expectedPin ?? '<missing>'}`)
  }
}
for (const name of Object.keys(pinned)) {
  if (!expectedPlatformNames.has(name)) {
    errors.push(`@aihu/compiler pins ${name}, but it is not one of the ten platform packages`)
  }
}

if (errors.length > 0) {
  console.error(`Compiler release-manifest check failed (mode: ${mode}; ${versionSummary}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Compiler release manifests are synchronized (mode: ${mode}; ${versionSummary}).`)
