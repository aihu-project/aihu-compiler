/**
 * #14 — `$computed`/`$action` collection-macro bodies, end-to-end through the
 * real pipeline (same b3b/tsgen harness shape): `transform(src, id,
 * { sidecarOut })` → the Rust binary writes the `.aihu.ts` sidecar → real
 * `tsc --noEmit --strict`.
 *
 * Before this fix, `$computed`/`$action` entries were the one remaining
 * harvest gap in the sidecar (`sidecar_ts.rs` acknowledged it directly): the
 * macro's whole body was blanked and the binding it introduced was declared
 * `any`, so a genuine type error inside an action or computed body passed
 * `tsc` silently — a false green checkmark. `$prop` (synthetic accessor) and
 * template loop aliases already got real typing; this closes the same gap
 * for the two collection kinds whose bodies are ordinary code.
 *
 * Each case is asserted in both directions — the correct body passes, and a
 * genuine type error inside the body still fails, citing the real `.aihu`
 * line (not a bunched-up preamble line).
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { transform } from '../js/index.ts'

// Real `tsc` subprocess per test — see tsgen-sidecar-tsc.test.ts for the same
// timeout-headroom rationale.
vi.setConfig({ testTimeout: 20_000 })

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const SCRATCH = join(__dirname, '.scratch')
mkdirSync(SCRATCH, { recursive: true })

/** Same tsc harness as tsgen-sidecar-tsc.test.ts (path-mapped workspace types). */
function runTsc(sidecarPath: string): { code: number; stderr: string; stdout: string } {
  const cfgPath = join(dirname(sidecarPath), 'tsconfig.json')
  writeFileSync(
    cfgPath,
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        skipLibCheck: true,
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        baseUrl: '.',
        paths: { '@aihu/*': [`${repoRoot}/packages/*/dist/index.d.ts`] },
      },
      files: [sidecarPath],
    }),
  )
  try {
    const stdout = execFileSync('bunx', ['tsc', '--noEmit', '-p', cfgPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string }
    const stdout = typeof err.stdout === 'string' ? err.stdout : (err.stdout?.toString() ?? '')
    const stderr = typeof err.stderr === 'string' ? err.stderr : (err.stderr?.toString() ?? '')
    return { code: err.status ?? 1, stdout, stderr }
  }
}

function checkSidecar(
  name: string,
  src: string,
): {
  code: number
  combined: string
  sidecar: string
} {
  const tmp = mkdtempSync(join(SCRATCH, `aihu-ac-${name}-`))
  try {
    const sidecarOut = join(tmp, `aihu-${name}.aihu.ts`)
    // No `@aihu/signals` import: `signal` stays the ambient framework global,
    // so this test needs no workspace package resolution (module names must
    // be hyphenated custom-element tags, hence the `aihu-` prefix).
    transform(src, join(tmp, `aihu-${name}.aihu`), { sidecarOut })
    const sidecar = readFileSync(sidecarOut, 'utf8')
    const result = runTsc(sidecarOut)
    return { code: result.code, combined: `${result.stdout}\n${result.stderr}`, sidecar }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const TSC_SUITE = { timeout: 120_000 }

describe('#14 — $computed body lowers to a real, checkable accessor', TSC_SUITE, () => {
  it('a correct body passes and reads through __aihu_ctx at its true value type', () => {
    const { code, combined, sidecar } = checkSidecar(
      'computed-pass',
      `@state {
  const [count, setCount] = signal(0)
  $computed: {
    double: () => count() * 2,
  }
}
@template {
  <p>{double().toFixed(1)}</p>
}
`,
    )
    expect(sidecar).toContain('let double = () => (count() * 2);')
    expect(code, `a correct computed body must pass:\n${combined}`).toBe(0)
  })

  it('a type error inside the body fails, citing the .aihu line (not any)', () => {
    const src = `@state {
  const [count, setCount] = signal(0)
  $computed: {
    double: () => count().toUpperCase(),
  }
}
@template {
  <p>{double()}</p>
}
`
    const { code, combined } = checkSidecar('computed-fail', src)
    expect(code).not.toBe(0)
    // The $computed entry sits on .aihu line 4.
    expect(combined).toMatch(/\(4,\d+\): error TS2339: Property 'toUpperCase' does not exist/)
  })

  it('a bare (non-arrow) computed entry still lowers and checks', () => {
    const src = `@state {
  const [count, setCount] = signal(0)
  $computed: {
    doubled: count().toUpperCase(),
  }
}
@template {
  <p>{doubled()}</p>
}
`
    const { code, combined } = checkSidecar('computed-bare-fail', src)
    expect(code).not.toBe(0)
    expect(combined).toMatch(/\(4,\d+\): error TS2339: Property 'toUpperCase' does not exist/)
  })
})

describe('#14 — $action body lowers to a real, checkable function declaration', TSC_SUITE, () => {
  it('a correct body passes and the action is callable from the template', () => {
    const { code, combined, sidecar } = checkSidecar(
      'action-pass',
      `@state {
  const [count, setCount] = signal(0)
  $action: {
    increment: (n: number) => { setCount(count() + n) },
  }
}
@template {
  <button on:click={() => increment(1)}>+</button>
}
`,
    )
    expect(sidecar).toContain('function increment(n: number) { setCount(count() + n) }')
    expect(code, `a correct action body must pass:\n${combined}`).toBe(0)
  })

  it('a type error inside the body fails, citing the .aihu line (not any)', () => {
    const src = `@state {
  const [count, setCount] = signal(0)
  $action: {
    increment: (n: number) => { setCount(count().toUpperCase()) },
  }
}
@template {
  <button on:click={() => increment(1)}>+</button>
}
`
    const { code, combined } = checkSidecar('action-fail', src)
    expect(code).not.toBe(0)
    // The $action entry sits on .aihu line 4.
    expect(combined).toMatch(/\(4,\d+\): error TS2339: Property 'toUpperCase' does not exist/)
  })

  it('a wrapped entry (handler: key) lowers its handler body the same way', () => {
    const src = `@state {
  const [count, setCount] = signal(0)
  $action: {
    reset: { handler: () => { setCount(count().toUpperCase()) }, describe: 'reset it' },
  }
}
@template {
  <button on:click={() => reset()}>reset</button>
}
`
    const { code, combined } = checkSidecar('action-wrapped-fail', src)
    expect(code).not.toBe(0)
    expect(combined).toMatch(/\(4,\d+\): error TS2339: Property 'toUpperCase' does not exist/)
  })

  it('an action can call another action declared later in the same block (hoisting)', () => {
    // Real `$action` lowers to a hoisted `function` at runtime (state_emit.rs)
    // specifically so actions can call each other regardless of authored
    // order. The sidecar must mirror that — an arrow `let` here would falsely
    // TS2448 on this legal, common shape.
    const { code, combined } = checkSidecar(
      'action-forward-ref',
      `@state {
  const [count, setCount] = signal(0)
  $action: {
    bump: () => { increment(1) },
    increment: (n: number) => { setCount(count() + n) },
  }
}
@template {
  <button on:click={() => bump()}>+</button>
}
`,
    )
    expect(code, `forward references between actions must not TS2448:\n${combined}`).toBe(0)
  })
})
