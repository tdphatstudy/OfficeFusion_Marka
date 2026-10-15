import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { build } from 'vite'

await build({
  configFile: false,
  logLevel: 'warn',
  resolve: { alias: { '@': resolve('src/renderer') } },
  ssr: { noExternal: true },
  build: {
    ssr: resolve('tests/core.test.ts'),
    target: 'node20',
    outDir: 'tmp/tests',
    emptyOutDir: true,
    rollupOptions: {
      external: [/^node:/],
      output: { format: 'es', entryFileNames: 'core.test.mjs', inlineDynamicImports: true }
    }
  }
})
const result = spawnSync(process.execPath, ['--test', resolve('tmp/tests/core.test.mjs')], {
  stdio: 'inherit'
})
process.exitCode = result.status ?? 1
