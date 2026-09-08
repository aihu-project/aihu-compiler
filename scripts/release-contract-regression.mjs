import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

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
for (const marker of ['verify-pack.mjs', 'consumer-smoke.mjs', '--provenance'])
  if (!workflow.includes(marker)) throw new Error(`release workflow omits ${marker}`)
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
if (repo === 'aihu-dom' && /push:\s*\n\s*tags:/.test(workflow))
  throw new Error('DOM release still auto-runs for already-published versions')
if ((repo === 'aihu-css' || repo === 'aihu-server') && !/matrix\.os/.test(workflow))
  throw new Error('native release lacks matrix platform parity checks')
console.log(`release regression checks passed for ${repo}`)
