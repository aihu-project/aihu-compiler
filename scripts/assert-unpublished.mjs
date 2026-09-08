import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? 'packages/compiler')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const spec = `${manifest.name}@${manifest.version}`
const result = spawnSync(
  'npm',
  ['view', spec, 'version', '--json', '--registry=https://registry.npmjs.org'],
  { encoding: 'utf8' },
)
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
if (result.status === 0) throw new Error(`${spec} already exists on npm; refusing to publish`)
const codes = [...output.matchAll(/(?:npm )?error code (E\d+)/gi)].map((match) =>
  match[1].toUpperCase(),
)
if (
  !/E404|No match found for version/i.test(output) ||
  codes.some((code) => code !== 'E404') ||
  /ECONN|ETIMEDOUT|ENETUNREACH|EAI_AGAIN/i.test(output)
)
  throw new Error(`npm absence check did not fail closed with E404 for ${spec}`)
console.log(`confirmed E404-only absence for ${spec}`)
