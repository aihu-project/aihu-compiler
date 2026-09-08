import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

for (const [n, v] of Object.entries(process.env))
  if (
    (v && /^(?:NPM_TOKEN|NODE_AUTH_TOKEN)$/i.test(n)) ||
    (v && /^npm_config_.*(?:authtoken|_auth|_password|token)$/i.test(n))
  )
    throw new Error(
      'classic npm authentication environment is set; trusted publishing requires OIDC',
    )
const paths = new Set([
  '.npmrc',
  process.env.NPM_CONFIG_USERCONFIG,
  process.env.NPM_CONFIG_GLOBALCONFIG,
])
for (const c of [
  ['config', 'get', 'userconfig'],
  ['config', 'get', 'globalconfig'],
])
  try {
    paths.add(execFileSync('npm', c, { encoding: 'utf8' }).trim())
  } catch {}
for (const p of paths) {
  if (!p || !existsSync(p)) continue
  if (
    readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .some((l) =>
        /^\s*(?:[^#;=]+:)?(?:_authToken|_auth|username|_password|email|token)\s*=\s*/i.test(l),
      )
  )
    throw new Error(
      'classic npm authentication was found in npm config; trusted publishing requires OIDC',
    )
}
const v = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim().split('.').map(Number)
if (v[0] < 11 || (v[0] === 11 && (v[1] < 5 || (v[1] === 5 && v[2] < 1))))
  throw new Error(`npm ${v.join('.')} is below the trusted-publishing minimum 11.5.1`)
console.log(`verified npm ${v.join('.')}, sanitized config, and OIDC-only auth contract`)
