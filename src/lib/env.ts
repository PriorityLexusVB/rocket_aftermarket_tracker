// Helper to detect if running in test environment
// Detects both Vitest (unit tests) and Playwright (E2E tests)
export const isTest = !!(
  // Vitest unit tests
  (typeof import.meta !== 'undefined' && import.meta.env?.VITEST) ||
  // Playwright E2E tests (via explicit env var)
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_E2E_TEST) ||
  // Playwright E2E tests (via navigator.webdriver detection)
  (typeof navigator !== 'undefined' && navigator.webdriver === true)
)
