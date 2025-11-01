import '@testing-library/jest-dom'

// Stub Supabase for tests to avoid "Missing VITE_SUPABASE_URL" errors
globalThis.import = globalThis.import || {};
(globalThis.import as any).meta = (globalThis.import as any).meta || {};
(globalThis.import as any).meta.env = (globalThis.import as any).meta.env || {};

// Set test environment variables
(globalThis.import as any).meta.env.VITE_DEAL_FORM_V2 = 'true';
(globalThis.import as any).meta.env.VITE_SUPABASE_URL = 'http://localhost:54321';
(globalThis.import as any).meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-placeholder';
