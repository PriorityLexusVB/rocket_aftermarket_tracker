// Minimal flat ESLint config to enable lint script with ESLint v9+
// Follow-up: adopt full rules/plugins as needed.
export default [
  {
    ignores: ['dist/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'],
  },
]
