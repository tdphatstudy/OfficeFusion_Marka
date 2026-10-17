import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { build } from 'vite'

for (const name of ['core', 'connections', 'files', 'recovery']) {
  await build({
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: { '@': resolve('src/renderer') } },
    ssr: { noExternal: true },
    build: {
      ssr: resolve(`tests/${name}.test.ts`),
      target: 'node20',
      outDir: 'tmp/tests',
      emptyOutDir: name === 'core',
      rollupOptions: {
        external: [/^node:/, 'ssh2'],
        output: { format: 'es', entryFileNames: `${name}.test.mjs`, inlineDynamicImports: true }
      }
    }
  })
}
const result = spawnSync(
  process.execPath,
  [
    '--test',
    ...['core', 'connections', 'files', 'recovery'].map(name => resolve(`tmp/tests/${name}.test.mjs`))
  ],
  {
    stdio: 'inherit'
  }
)
process.exitCode = result.status ?? 1
