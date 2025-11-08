// Helper to detect if running in test environment
export const isTest = typeof import.meta !== 'undefined' && !!import.meta.env?.VITEST
