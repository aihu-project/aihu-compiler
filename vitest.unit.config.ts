import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/compiler/tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      // These execute compiler output against framework implementations. They
      // belong in the release-candidate compatibility matrix, where they run
      // against published Arbor, Runtime, Signals, and CSS provider versions.
      'packages/compiler/tests/**/*-drive.test.ts',
      'packages/compiler/tests/classify-island.test.ts',
      'packages/compiler/tests/css-engine-hook.test.ts',
      'packages/compiler/tests/vite-build-utility-css.e2e.test.ts',
      // These run generated sidecars through TypeScript against framework type
      // declarations. They are also release-candidate compatibility tests.
      'packages/compiler/tests/b3b-sidecar-tsc.test.ts',
      'packages/compiler/tests/gx-data-sidecar-tsc.test.ts',
      'packages/compiler/tests/state-model-sidecar-tsc.test.ts',
      'packages/compiler/tests/strict-templates-sidecar-tsc.test.ts',
      'packages/compiler/tests/tsgen-sidecar-tsc.test.ts',
    ],
    passWithNoTests: false,
  },
})
