import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

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
          manualChunks: {
            'vendor-tiptap': [
              '@tiptap/core',
              '@tiptap/react',
              '@tiptap/starter-kit',
              'tiptap-markdown'
            ],
            'vendor-codemirror': [
              '@codemirror/state',
              '@codemirror/view',
              '@codemirror/language',
              '@codemirror/lang-markdown'
            ]
          }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@': resolve(__dirname, 'src/renderer')
      }
    },
    plugins: [react()]
  }
})
