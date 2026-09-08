import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { assertPublicRegistrySemverDependencies } from './verify-pack-contract.mjs'

const root = resolve('.')
const repo = basename(root)
const workflow = readFileSync(resolve(root, '.github/workflows/release.yml'), 'utf8')
const pack = readFileSync(resolve(root, 'scripts/verify-pack-contract.mjs'), 'utf8')
const auth = readFileSync(resolve(root, 'scripts/check-oidc-auth.mjs'), 'utf8')
if (/--force|registry-url|secrets\.NPM_TOKEN|NODE_AUTH_TOKEN/.test(workflow))
  throw new Error('release workflow contains a token or platform bypass')
if (!workflow.includes('--ignore-scripts'))
  throw new Error('release workflow must disable lifecycle scripts during install')
for (const marker of [
  'NPM_CONFIG_USERCONFIG',
  'NPM_CONFIG_GLOBALCONFIG',
  '_authToken',
  '_auth',
  '_password',
])
  if (!auth.includes(marker)) throw new Error(`OIDC guard omits ${marker}`)
for (const marker of [
  'verify-pack.mjs',
  'consumer-smoke.mjs',
  'assert-unpublished.mjs',
  'assert-reviewed-release.mjs',
  '--provenance',
])
  if (!workflow.includes(marker)) throw new Error(`release workflow omits ${marker}`)
for (const marker of ['github.sha', 'merge-base --is-ancestor'])
  if (!workflow.includes(marker))
    throw new Error(`release workflow omits exact tag binding marker ${marker}`)
if (
  ['aihu-compiler', 'aihu-router', 'aihu-editor'].includes(repo)
    ? !workflow.includes('{commit}')
    : !workflow.includes('refs/tags/')
)
  throw new Error('release workflow omits exact tag binding')
assertPublicRegistrySemverDependencies({ dependencies: { valid: '^1.2.3' } })
assertPublicRegistrySemverDependencies({ peerDependencies: { valid: '>= 1.2.3 < 2.0.0' } })
for (const file of execFileSync('git', ['ls-files', 'package.json', '**/package.json'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean))
  assertPublicRegistrySemverDependencies(JSON.parse(readFileSync(file, 'utf8')))
for (const spec of [
  'workspace:*',
  'file:../x',
  'link:../x',
  'git+https://example.test/x.git',
  'https://example.test/x.tgz',
  'latest',
]) {
  try {
    assertPublicRegistrySemverDependencies({ dependencies: { invalid: spec } })
    throw new Error(`dependency bypass accepted: ${spec}`)
  } catch (error) {
    if (error.message.startsWith('dependency bypass accepted:')) throw error
  }
}
if (repo === 'aihu-compiler') {
  const { assertCompilerPlatform } = await import('./assert-compiler-platform.mjs')
  assertCompilerPlatform({ os: ['linux'], cpu: ['x64'], libc: ['glibc'] }, 'linux-x64-gnu')
  try {
    assertCompilerPlatform({ os: ['linux'], cpu: ['x64'] }, 'linux-x64-gnu')
    throw new Error('compiler platform bypass accepted: missing libc')
  } catch (error) {
    if (error.message.startsWith('compiler platform bypass accepted:')) throw error
  }
}
for (const field of [
  'exports',
  'main',
  'module',
  'types',
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'os',
  'cpu',
  'libc',
])
  if (!pack.includes(`'${field}'`)) throw new Error(`pack contract omits manifest field ${field}`)
if (
  repo === 'aihu-compiler' &&
  (/workflow_dispatch:/.test(workflow) || /wasm-pack\.github/.test(workflow))
)
  throw new Error('compiler release permits an arbitrary manual source or unpinned wasm installer')
if (repo === 'aihu-compiler' && !workflow.includes('assert-compiler-platform.mjs'))
  throw new Error('compiler release does not assert native platform metadata')
if (
  repo === 'aihu-dom' &&
  (!/push:\s*\n\s*tags:/.test(workflow) ||
    /workflow_dispatch:/.test(workflow) ||
    !workflow.includes('signals-v*') ||
    !workflow.includes('reactive-v*') ||
    !workflow.includes('arbor-v*') ||
    !workflow.includes('dom-v*'))
)
  throw new Error('DOM release is missing exact future tag/version bindings')
if ((repo === 'aihu-css' || repo === 'aihu-server') && !/matrix\.os/.test(workflow))
  throw new Error('native release lacks matrix platform parity checks')
console.log(`release regression checks passed for ${repo}`)
