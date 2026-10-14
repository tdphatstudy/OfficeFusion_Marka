import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginReactRefresh from 'eslint-plugin-react-refresh'

const noCommentsPlugin = {
  rules: {
    'disallow-comments': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Strictly disallow any comments in source code'
        },
        schema: [],
        messages: {
          noComment: 'Comments are strictly prohibited in this codebase. Code must be self-explanatory.'
        }
      },
      create(context) {
        return {
          Program() {
            const comments = context.sourceCode.getAllComments()
            for (const comment of comments) {
              context.report({
                loc: comment.loc,
                messageId: 'noComment'
              })
            }
          }
        }
      }
    }
  }
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/out/**',
      '**/dist/**',
      '**/.vite/**',
      'scripts/**',
      '*.config.*'
    ]
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'no-comments': noCommentsPlugin,
      'react-hooks': pluginReactHooks,
      'react-refresh': pluginReactRefresh
    },
    extends: [
      ...tseslint.configs.strict,
      pluginReact.configs.flat.recommended,
      pluginReact.configs.flat['jsx-runtime']
    ],
    rules: {
      'no-comments/disallow-comments': 'error',
      'no-inline-comments': 'error',

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' }
      ],
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-empty-function': 'error',

      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/self-closing-comp': 'error',
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': [
        'error',
        { props: 'never', children: 'never' }
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],

      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'object-shorthand': ['error', 'always'],
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'yoda': 'error',
      'no-duplicate-imports': 'error',
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-lonely-if': 'error',
      'no-else-return': 'error',
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error'
    },
    settings: {
      react: { version: 'detect' }
    }
  },
  {
    files: ['src/renderer/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off'
    }
  },
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  }
)
