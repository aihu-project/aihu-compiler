import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const expected = {
  'darwin-arm64': { os: ['darwin'], cpu: ['arm64'] },
  'darwin-x64': { os: ['darwin'], cpu: ['x64'] },
  'linux-arm64-gnu': { os: ['linux'], cpu: ['arm64'], libc: ['glibc'] },
  'linux-x64-gnu': { os: ['linux'], cpu: ['x64'], libc: ['glibc'] },
  'win32-x64-msvc': { os: ['win32'], cpu: ['x64'] },
}

export function assertCompilerPlatform(manifest, platform) {
  const want = expected[platform]
  if (!want) throw new Error(`unknown compiler platform: ${platform}`)
  for (const field of ['os', 'cpu', 'libc']) {
    if (JSON.stringify(manifest[field]) !== JSON.stringify(want[field]))
      throw new Error(`${platform} manifest has unexpected ${field} metadata`)
  }
}

const packageDir = process.argv[2]
if (packageDir) {
  const root = resolve(packageDir)
  const platform = basename(root)
  assertCompilerPlatform(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')), platform)
  console.log(`verified compiler platform metadata for ${platform}`)
}
