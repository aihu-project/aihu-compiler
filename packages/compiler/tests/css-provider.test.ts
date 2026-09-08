/**
 * Explicit CSS provider seam tests.
 *
 * These tests intentionally do not import @aihu/css-engine. A provider is an
 * opt-in replacement, so the compiler must be able to fold an alternate
 * engine's complete stylesheet with only the public provider contract.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  type AihuCssProvider,
  type AihuCssProviderContext,
  aihuCompilerPlugin,
} from '../js/index.ts'

type TransformFn = (
  this: unknown,
  code: string,
  id: string,
) => Promise<{ code: string; map: null } | null | undefined>

const SFC = `@template {
  <div class="provided">hello</div>
}

@style {
  .authored { color: red; }
}`

const tmpDirs: string[] = []

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function runPlugin(
  source: string,
  id: string,
  provider: AihuCssProvider,
  transformContext: unknown = {},
): Promise<{ code: string; plugin: ReturnType<typeof aihuCompilerPlugin> }> {
  const dir = mkdtempSync(join(tmpdir(), 'aihu-css-provider-'))
  tmpDirs.push(dir)
  const plugin = aihuCompilerPlugin({ cssProvider: provider })
  const transform = plugin.transform as unknown as TransformFn
  const result = await transform.call(transformContext, source, join(dir, id))
  if (result == null) throw new Error('provider transform returned no result')
  return { code: result.code, plugin }
}

describe('explicit CSS provider', () => {
  it('folds a complete shadow stylesheet and resolves the runtime defaults', async () => {
    const contexts: AihuCssProviderContext[] = []
    const provider: AihuCssProvider = (context) => {
      contexts.push(context)
      return `.provided { color: blue; }\n.authored { color: red; }`
    }

    const { code } = await runPlugin(SFC, 'x-card.aihu', provider)

    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({
      id: expect.stringMatching(/x-card\.aihu$/),
      shadowMode: 'shadow',
      target: 'universal',
    })
    expect(code).toContain('.provided { color: blue; }')
    expect(code).toContain('.authored { color: red; }')
    expect(code).toContain('adoptedStyleSheets = [__style__]')
  })

  it('routes a light provider stylesheet through the virtual CSS module', async () => {
    const contexts: AihuCssProviderContext[] = []
    const provider: AihuCssProvider = (context) => {
      contexts.push(context)
      return '.provided-light { color: green; }'
    }

    const { code, plugin } = await runPlugin(SFC, 'src/layouts/app.aihu', provider)

    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({ shadowMode: 'light', target: 'universal' })
    expect(contexts[0]?.lightScopeId).toMatch(/^[0-9a-f]{8}$/)
    const virtualId = code.match(/(virtual:aihu-utility\/[^"' ]+\.css)["']/)?.[1]
    expect(virtualId).toBeDefined()
    expect(await plugin.load?.(`\0${virtualId}`)).toBe('.provided-light { color: green; }')
  })

  it('passes the resolved server target to an alternate provider', async () => {
    const contexts: AihuCssProviderContext[] = []
    const provider: AihuCssProvider = (context) => {
      contexts.push(context)
      return '.server-only { display: block; }'
    }

    const { code } = await runPlugin(SFC, 'x-server.aihu', provider, {
      environment: { config: { consumer: 'server' } },
    })

    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({ shadowMode: 'shadow', target: 'server' })
    expect(code).toContain('.server-only { display: block; }')
    expect(code).toContain('export const __aihu_css__')
  })
})
