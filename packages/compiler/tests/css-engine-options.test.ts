/**
 * `aihuCompilerPlugin({ css })` forwards project-level css-engine inputs
 * (`theme`, `hostTokens`) as `compileSfc`'s fourth argument — aihu #836
 * follow-ups. The engine is mocked, so this runs without the css-core binary.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AihuCompilerPluginOptions } from '../js/index.ts'

type TransformFn = (
  this: unknown,
  code: string,
  id: string,
) => Promise<{ code: string; map: null } | null | undefined>

const SFC = `@template {
  <div class="bg-primary">x</div>
}`

async function compileWith(options?: AihuCompilerPluginOptions, cssProvider = false) {
  const compileSfc = vi.fn(() => '.bg-primary { background-color: var(--color-primary); }')
  vi.resetModules()
  vi.doMock('@aihu/css-engine', () => ({ compileSfc }))
  const mod = await import('../js/index.ts')
  const tmp = mkdtempSync(join(tmpdir(), 'aihu-css-options-'))
  try {
    const plugin = mod.aihuCompilerPlugin({
      ...options,
      ...(cssProvider ? { cssProvider: () => '.p { color: red; }' } : {}),
    })
    const transform = plugin.transform as unknown as TransformFn
    await transform.call({}, SFC, join(tmp, 'x-themed.aihu'))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return compileSfc
}

afterEach(() => {
  vi.doUnmock('@aihu/css-engine')
  vi.resetModules()
})

describe('aihuCompilerPlugin({ css }) → css-engine compileSfc options', () => {
  it('forwards theme and hostTokens as the fourth argument', async () => {
    const css = { theme: '@theme { --color-primary: #0a7; }', hostTokens: false }
    const compileSfc = await compileWith({ css })
    expect(compileSfc).toHaveBeenCalledTimes(1)
    expect(compileSfc.mock.calls[0]).toHaveLength(4)
    expect(compileSfc.mock.calls[0]?.[3]).toEqual(css)
  })

  it('keeps the three-argument call when no css option is set', async () => {
    const compileSfc = await compileWith()
    expect(compileSfc).toHaveBeenCalledTimes(1)
    expect(compileSfc.mock.calls[0]).toHaveLength(3)
  })

  it('does not consult css-engine when an explicit cssProvider is set', async () => {
    const compileSfc = await compileWith({ css: { hostTokens: false } }, true)
    expect(compileSfc).not.toHaveBeenCalled()
  })
})
