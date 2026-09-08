import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig({
  input: {
    index: 'js/index.ts',
    'resolve-binary': 'js/resolve-binary.ts',
    'codemods/macro-simplification': 'js/codemods/macro-simplification/migrate.ts',
    'codemods/state-wrapper': 'js/codemods/state-wrapper/migrate.ts',
    'codemods/template-grammar-v2': 'js/codemods/template-grammar-v2/migrate.ts',
  },
  external: [
    'vite',
    'node:child_process',
    'node:crypto',
    'node:fs',
    'node:module',
    'node:path',
    'node:url',
  ],
  checks: { circularDependency: true },
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    minify: true,
  },
  plugins: [dts()],
})
