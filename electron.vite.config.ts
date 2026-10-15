import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { createRequire } from 'node:module'

const dependencyRequire = createRequire(import.meta.url)
const katexStyles = createRequire(dependencyRequire.resolve('rehype-katex')).resolve(
  'katex/dist/katex.min.css'
)

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main/index.ts')
      }
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main')
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
        output: {
          manualChunks: id => {
            if (id.includes('/node_modules/katex/')) {
              return 'vendor-katex'
            }
            if (id.includes('/node_modules/highlight.js/')) {
              return 'vendor-highlight'
            }
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return 'vendor-react'
            }
            if (/\/node_modules\/(tiptap-markdown|markdown-it|prosemirror-markdown)\//.test(id)) {
              return 'vendor-markdown'
            }
            if (/\/node_modules\/prosemirror-[^/]+\//.test(id)) {
              return 'vendor-prosemirror'
            }
            if (id.includes('/node_modules/@tiptap/')) {
              return 'vendor-tiptap'
            }
            if (id.includes('/node_modules/@lezer/')) {
              return 'vendor-lezer'
            }
            if (id.includes('/node_modules/@codemirror/')) {
              return 'vendor-codemirror'
            }
            return undefined
          }
        }
      }
    },
    resolve: {
      conditions: ['worker', 'module', 'browser', 'development|production'],
      alias: {
        'katex/dist/katex.min.css': katexStyles,
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@': resolve(__dirname, 'src/renderer')
      }
    },
    plugins: [react()]
  }
})
