import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const checker = resolve(__dirname, '../../../scripts/check-release-manifests.ts')
const fixtureRoot = mkdtempSync(join(tmpdir(), 'aihu-release-manifests-'))

const platforms = [
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

type FixtureOptions = {
  host?: string
  wasm?: string
  platformVersions?: string[]
  pinVersions?: Record<string, string | undefined>
  omitPins?: string[]
  extraPin?: [string, string]
  extraDirectory?: [string, string]
}

function writeFixture(options: FixtureOptions = {}): string {
  const host = options.host ?? '1.3.7'
  const wasm = options.wasm ?? host
  const versions =
    options.platformVersions ?? Array.from({ length: platforms.length }, () => '1.3.5')
  const pins: Record<string, string> = {}
  for (const [, , name] of platforms) pins[name] = '1.3.5'
  for (const [name, version] of Object.entries(options.pinVersions ?? {})) {
    if (version === undefined) delete pins[name]
    else pins[name] = version
  }
  for (const name of options.omitPins ?? []) delete pins[name]
  if (options.extraPin) pins[options.extraPin[0]] = options.extraPin[1]

  const root = join(fixtureRoot, String(Math.random()).slice(2))
  const compilerDir = join(root, 'packages/compiler')
  mkdirSync(compilerDir, { recursive: true })
  writeFileSync(
    join(compilerDir, 'package.json'),
    JSON.stringify({ name: '@aihu/compiler', version: host, optionalDependencies: pins }),
  )
  mkdirSync(join(compilerDir, 'npm-wasm'), { recursive: true })
  writeFileSync(
    join(compilerDir, 'npm-wasm/package.json'),
    JSON.stringify({ name: '@aihu/compiler-wasm', version: wasm }),
  )

  for (const [index, [kind, directory, name]] of platforms.entries()) {
    const packageDir = join(compilerDir, kind, directory)
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(
      join(packageDir, 'package.json'),
      JSON.stringify({ name, version: versions[index] }),
    )
  }
  if (options.extraDirectory) {
    const [kind, directory] = options.extraDirectory
    mkdirSync(join(compilerDir, kind, directory), { recursive: true })
    writeFileSync(
      join(compilerDir, kind, directory, 'package.json'),
      JSON.stringify({ name: '@aihu/compiler-extra', version: '1.3.4' }),
    )
  }
  return root
}

function run(root: string, ...args: string[]): { status: number; output: string } {
  try {
    const output = execFileSync('bun', [checker, ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, output }
  } catch (error) {
    const result = error as { status?: number; stdout?: string; stderr?: string }
    return { status: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
  }
}

function git(root: string, ...args: string[]): void {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' })
}

function commitFixture(root: string, message: string): void {
  git(root, 'add', '.')
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Release Manifest Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit',
      '-m',
      message,
    ],
    { cwd: root, stdio: 'ignore' },
  )
}

function writeNativeHistoryFixture(options: { tag?: boolean; changed?: boolean } = {}): string {
  const root = writeFixture({ host: '1.3.5', wasm: '1.3.5' })
  mkdirSync(join(root, 'packages/compiler/src'), { recursive: true })
  writeFileSync(join(root, 'packages/compiler/src/fixture.ts'), 'export const fixture = true\n')
  git(root, 'init', '-q')
  commitFixture(root, 'platform release')
  if (options.tag !== false) git(root, 'tag', 'compiler-v1.3.5')

  writeFileSync(
    join(root, 'packages/compiler/package.json'),
    JSON.stringify({
      name: '@aihu/compiler',
      version: '1.3.7',
      optionalDependencies: Object.fromEntries(platforms.map(([, , name]) => [name, '1.3.5'])),
    }),
  )
  writeFileSync(
    join(root, 'packages/compiler/npm-wasm/package.json'),
    JSON.stringify({ name: '@aihu/compiler-wasm', version: '1.3.7' }),
  )
  if (options.changed) {
    writeFileSync(
      join(root, 'packages/compiler/src/native-history-probe.rs'),
      'pub const PROBE: bool = true;\n',
    )
  }
  commitFixture(root, 'host release')
  return root
}

afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }))

describe('release manifest checker', () => {
  it('keeps the checked-in release version set and optional pins consistent', () => {
    const read = (relativePath: string) =>
      JSON.parse(readFileSync(resolve(__dirname, '../', relativePath), 'utf8')) as {
        name: string
        version: string
        optionalDependencies?: Record<string, string>
      }
    const compiler = read('package.json')
    const wasm = read('npm-wasm/package.json')
    const platformManifests = platforms.map(([kind, directory]) =>
      read(`${kind}/${directory}/package.json`),
    )

    expect(compiler.version).toBe('1.3.7')
    expect(wasm.version).toBe(compiler.version)
    expect(new Set(platformManifests.map(({ version }) => version))).toEqual(new Set(['1.3.5']))
    expect(compiler.optionalDependencies).toEqual(
      Object.fromEntries(platformManifests.map(({ name, version }) => [name, version])),
    )
  })

  it('accepts a fully synchronized strict release', () => {
    const result = run(writeFixture({ host: '1.3.5', wasm: '1.3.5' }))
    expect(result.status).toBe(0)
    expect(result.output).toContain('mode: strict')
    expect(result.output).toContain('host=1.3.5')
  })

  it('accepts a host-only patch release and prints the selected mode and versions', () => {
    const result = run(writeFixture(), '--allow-host-only')
    expect(result.status).toBe(0)
    expect(result.output).toContain('mode: allow-host-only')
    expect(result.output).toContain('host=1.3.7')
    expect(result.output).toContain('platforms=1.3.5')
    expect(result.output).toContain('wasm=1.3.7')
  })

  it('keeps the default strict mode and rejects the host-only split', () => {
    const result = run(writeFixture())
    expect(result.status).not.toBe(0)
    expect(result.output).toContain('mode: strict')
    expect(result.output).toContain('@aihu/compiler-darwin-arm64 is 1.3.5; expected 1.3.7')
  })

  it('rejects mixed, newer, and cross-major platform versions', () => {
    const mixed = run(
      writeFixture({ platformVersions: ['1.3.5', ...Array.from({ length: 9 }, () => '1.3.6')] }),
      '--allow-host-only',
    )
    expect(mixed.status).not.toBe(0)
    expect(mixed.output).toContain('platform package versions are mixed')

    const newer = run(
      writeFixture({ platformVersions: Array.from({ length: 10 }, () => '1.3.8') }),
      '--allow-host-only',
    )
    expect(newer.status).not.toBe(0)
    expect(newer.output).toContain('platform patch must not be newer')

    const crossMajor = run(
      writeFixture({ platformVersions: Array.from({ length: 10 }, () => '2.0.0') }),
      '--allow-host-only',
    )
    expect(crossMajor.status).not.toBe(0)
    expect(crossMajor.output).toContain('must share its major/minor version')
  })

  it('requires the optional pin set to be complete and exact', () => {
    const [, , missing] = platforms[0]
    const missingResult = run(writeFixture({ omitPins: [missing] }), '--allow-host-only')
    expect(missingResult.status).not.toBe(0)
    expect(missingResult.output).toContain(`missing optionalDependency pin for ${missing}`)

    const extraResult = run(
      writeFixture({ extraPin: ['@aihu/compiler-extra', '1.3.4'] }),
      '--allow-host-only',
    )
    expect(extraResult.status).not.toBe(0)
    expect(extraResult.output).toContain('not one of the ten platform packages')

    const extraDirectoryResult = run(
      writeFixture({ extraDirectory: ['npm', 'extra-platform'] }),
      '--allow-host-only',
    )
    expect(extraDirectoryResult.status).not.toBe(0)
    expect(extraDirectoryResult.output).toContain('extra platform package directory')

    const mismatchedPinResult = run(
      writeFixture({ pinVersions: { '@aihu/compiler-darwin-arm64': '1.3.6' } }),
      '--allow-host-only',
    )
    expect(mismatchedPinResult.status).not.toBe(0)
    expect(mismatchedPinResult.output).toContain(
      '@aihu/compiler-darwin-arm64 is pinned to 1.3.6; expected 1.3.5',
    )
  })

  it('requires WASM to match the host version in both modes', () => {
    const allowResult = run(writeFixture({ wasm: '1.3.5' }), '--allow-host-only')
    expect(allowResult.status).not.toBe(0)
    expect(allowResult.output).toContain('@aihu/compiler-wasm is 1.3.5; expected 1.3.7')

    const strictResult = run(writeFixture({ host: '1.3.5', wasm: '1.3.6' }))
    expect(strictResult.status).not.toBe(0)
    expect(strictResult.output).toContain('@aihu/compiler-wasm is 1.3.6; expected 1.3.5')
  })

  it('allows an unchanged host-only release when its platform tag exists', () => {
    const result = run(writeNativeHistoryFixture(), '--allow-host-only', '--check-native-history')
    expect(result.status).toBe(0)
    expect(result.output).toContain('mode: allow-host-only')
  })

  it('rejects host-only releases with native-sensitive changes since the platform tag', () => {
    const result = run(
      writeNativeHistoryFixture({ changed: true }),
      '--allow-host-only',
      '--check-native-history',
    )
    expect(result.status).not.toBe(0)
    expect(result.output).toContain('native-sensitive files changed since compiler-v1.3.5')
  })

  it('rejects host-only releases that change the JavaScript native ABI boundary', () => {
    const root = writeNativeHistoryFixture()
    mkdirSync(join(root, 'packages/compiler/js'), { recursive: true })
    writeFileSync(
      join(root, 'packages/compiler/js/native.ts'),
      'export const changedNativeBoundary = true\n',
    )
    commitFixture(root, 'change native JavaScript boundary')

    const result = run(root, '--allow-host-only', '--check-native-history')
    expect(result.status).not.toBe(0)
    expect(result.output).toContain('native-sensitive files changed since compiler-v1.3.5')
  })

  it('rejects host-only releases when the platform version tag is missing', () => {
    const result = run(
      writeNativeHistoryFixture({ tag: false }),
      '--allow-host-only',
      '--check-native-history',
    )
    expect(result.status).not.toBe(0)
    expect(result.output).toContain('required tag compiler-v1.3.5 does not exist')
  })
})
