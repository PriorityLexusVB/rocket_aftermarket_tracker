// Flat ESLint config (ESLint v9+) for React (JS/TS/JSX/TSX), Playwright, Vitest.
// Incremental hardening: start with parsing + essential rules to clear errors.
// Follow-up (deferred): accessibility, import ordering, complexity budgets.
import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  // Ignore generated & output folders
  {
    ignores: [
      'dist/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      // Supabase edge function build artifacts (if any) & CSV sample data
      'supabase/.branches/**',
      'data/*.csv',
      '**/*.old.jsx',
      // Legacy config files not used by flat config
      '.eslintrc.cjs',
      '.eslintignore',
      'postcss.config.cjs',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // Global language options (applies to all file types)
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // NOTE: No project reference to keep initial parsing fast & avoid TS program cost.
      },
      globals: {
        // Browser globals (React app)
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        ClipboardItem: 'readonly',
        Response: 'readonly',
        btoa: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        FileReader: 'readonly',
        crypto: 'readonly',
        // Playwright globals (e2e)
        browser: 'readonly',
        page: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': tsPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React JSX runtime (React 17+) does not require React in scope
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      // Temporarily disabled due to plugin incompatibility with ESLint v9 API (context.getSource error).
      // Re-enable after upgrading eslint-plugin-react-hooks once it supports v9.
      'react-hooks/exhaustive-deps': 'off',
      // General JS hygiene
      'no-unused-vars': 'warn',
      'no-console': 'off', // console used for operational diagnostics; refine later
      // Disabled initially to avoid overwhelming legacy code with strictness; revisit after refactor.
      'no-unsafe-optional-chaining': 'off',
      'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-useless-catch': 'off',
      'no-prototype-builtins': 'off',
      'no-undef': 'off',
      'no-constant-binary-expression': 'off',
    },
  },

  // TypeScript-specific overrides (only .ts/.tsx for stricter TS rules later)
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Placeholder for future stricter TS rules (explicit-module-boundary-types, etc.)
    },
  },

  // Test + spec files: relax certain rules & enable test globals
  {
    files: [
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/*.test.{js,jsx,ts,tsx}',
      'tests/**/*.{js,jsx,ts,tsx}',
      'src/tests/**/*.{js,jsx,ts,tsx}',
      'e2e/**/*.{js,ts}',
    ],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        // Node-style globals in test context
        process: 'readonly',
        require: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Supabase edge functions (Node runtime) – allow commonjs if needed later
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        Deno: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        btoa: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },

  // Node and tooling files (scripts, configs, API handlers)
  {
    files: [
      '**/*.config.{js,cjs,ts,mjs}',
      'scripts/**/*.{js,ts}',
      'api/**/*.{js,ts}',
      'global.setup.ts',
      'playwright.config.ts',
      'vitest.config.ts',
      'tests/e2e/**/*.{js,ts}',
    ],
    languageOptions: {
      sourceType: 'module',
      globals: {
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
]
