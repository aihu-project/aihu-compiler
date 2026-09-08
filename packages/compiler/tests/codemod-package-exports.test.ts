import { migrate } from '@aihu/compiler/codemods/macro-simplification'
import { migrateStateWrappers } from '@aihu/compiler/codemods/state-wrapper'
import { migrateTemplateGrammar } from '@aihu/compiler/codemods/template-grammar-v2'
import { describe, expect, it } from 'vitest'

describe('published codemod entry points', () => {
  it('exports the macro simplification migration', () => {
    expect(migrate('@state {\n  $prop hue: number = 215\n}').rewritten).toContain('$prop: {')
  })

  it('exports the state wrapper migration', () => {
    expect(
      migrateStateWrappers('@state {\n  const [count, setCount] = signal(0)\n}').rewritten,
    ).toContain('let count = state(0)')
  })

  it('exports the template grammar migration', () => {
    expect(
      migrateTemplateGrammar('@template {\n  <button $on.click={save}>Save</button>\n}').rewritten,
    ).toContain('on:click={save}')
  })
})
