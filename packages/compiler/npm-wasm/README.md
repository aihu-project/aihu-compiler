# @aihu/compiler-wasm

The browser-ready WebAssembly distribution of the Aihu Single File Component compiler.

```ts
import init, { wasm_compile } from '@aihu/compiler-wasm'

await init()
const result = wasm_compile('@state { count: 0 }')
```

The package version is kept in lockstep with `@aihu/compiler`.
