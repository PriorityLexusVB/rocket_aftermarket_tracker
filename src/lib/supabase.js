import { createClient } from '@supabase/supabase-js'

// Detect vitest
const isTest = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITEST

let supabaseClient
let isSupabaseConfiguredFn
let testSupabaseConnectionFn
let isNetworkOnlineFn
let recoverSessionFn

if (isTest) {
  // Minimal in-memory stub with method chaining for tests
  const ok = (data = []) => ({ data, error: null })

  const chain = (rows = []) => ({
    select: () => ok(rows),
    insert: (payload) => ok(Array.isArray(payload) ? payload : [payload]),
    update: () => ok(rows),
    delete: () => ok(rows),
    eq: () => chain(rows),
    order: () => ok(rows),
    single: () => ok(rows[0] ?? null),
  })

  supabaseClient = {
    from: () => chain([]),
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) },
  }

  // Export additional helpers for compatibility
  isSupabaseConfiguredFn = () => true
  testSupabaseConnectionFn = async () => true
  isNetworkOnlineFn = () => true
  recoverSessionFn = () => null
} else {
  // Production mode - original implementation
  // Environment variables with enhanced validation
  // Support both Vite import.meta.env and injected process.env (e.g., Playwright webServer env)
  const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL || process?.env?.VITE_SUPABASE_URL
  const supabaseAnonKey =
    import.meta?.env?.VITE_SUPABASE_ANON_KEY || process?.env?.VITE_SUPABASE_ANON_KEY

  // Only log environment check in development mode
  if (import.meta.env.DEV) {
    console.log('Supabase Environment Check:', {
      url: supabaseUrl ? 'Present' : 'Missing',
      anonKey: supabaseAnonKey ? 'Present' : 'Missing',
      urlValid: supabaseUrl?.includes('supabase.co') || supabaseUrl?.includes('localhost'),
      keyValid: supabaseAnonKey?.length > 50,
    })
  }
  // Validate environment variables & build optional dev stub when missing
  const isProd = import.meta.env.PROD
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '❌ Supabase env vars missing. Required: VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY'
    )
    if (isProd) {
      throw new Error('Missing required Supabase environment variables in production build')
    } else {
      console.warn(
        '[Supabase] Dev fallback activated – using in‑memory stub client. Add .env.local with real values to enable live API.'
      )
      const ok = (data = []) => ({ data, error: null })
      const chain = (rows = []) => ({
        select: () => chain(rows),
        insert: (payload) => ok(Array.isArray(payload) ? payload : [payload]),
        update: () => chain(rows),
        delete: () => chain(rows),
        eq: () => chain(rows),
        order: () => chain(rows),
        limit: () => chain(rows),
        // Add noop filtering helpers used by services in dev fallback
        in: () => chain(rows),
        or: () => chain(rows),
        // Provide throwOnError compatibility returning a resolved result shape
        throwOnError: async () => ok(rows),
        single: () => ok(rows[0] ?? null),
        maybeSingle: () => ok(rows[0] ?? null),
      })
      supabaseClient = {
        from: () => chain([]),
        rpc: async () => ({ data: null, error: { message: 'Supabase not configured (dev stub)' } }),
        channel: () => ({
          on() {
            return this
          },
          subscribe: async () => ({ data: { subscription: { state: 'SUBSCRIBED' } }, error: null }),
          unsubscribe() {},
        }),
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: { message: 'Supabase not configured (dev stub)' },
          }),
          getSession: async () => ({
            data: { session: null },
            error: { message: 'Supabase not configured (dev stub)' },
          }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } }, error: null }),
          signInWithPassword: async () => ({
            data: null,
            error: { message: 'Supabase not configured (dev stub)' },
          }),
          signOut: async () => ({ error: null }),
        },
      }
      isSupabaseConfiguredFn = () => false
      testSupabaseConnectionFn = async () => false
      isNetworkOnlineFn = () => navigator?.onLine ?? true
      recoverSessionFn = () => null
    }
  }

  // Ensure single instance to prevent multiple GoTrueClient warnings
  let supabaseInstance = null

  const createSupabaseClient = () => {
    if (!supabaseInstance) {
      try {
        // Only surface a storage object when running in the browser to avoid SSR issues
        const browserStorage =
          typeof window !== 'undefined' && window?.localStorage ? window.localStorage : undefined

        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            // Keep session persistence and refresh enabled for SPA behavior
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // Provide storage only when available (avoid referencing window during SSR)
            storage: browserStorage,
            storageKey: 'priority-automotive-auth',
            // Prefer the PKCE flow for modern browser-based auth
            flowType: 'pkce',
          },
          db: {
            schema: 'public',
          },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
          // Intentionally do NOT set global.headers here — let the SDK manage required headers.
        })

        console.log('✅ Supabase client created successfully')
      } catch (error) {
        console.error('❌ Failed to create Supabase client:', error)
        throw error
      }
    }
    return supabaseInstance
  }

  // Only create the real client if we passed validation
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient()
  }

  // Helper function to check if Supabase is properly configured
  isSupabaseConfiguredFn = () => {
    return Boolean(supabaseUrl && supabaseAnonKey && supabaseClient)
  }

  // Enhanced connection test with proper authentication check
  testSupabaseConnectionFn = async (retries = 2) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (!supabaseClient) {
          throw new Error('Supabase client is not configured')
        }

        // Prefer an RPC that validates auth/role-specific reachability when available.
        // If the RPC doesn't exist or fails, fall back to a safe select that tolerates RLS/permission responses.
        try {
          const { error: rpcError } = await supabaseClient.rpc('check_auth_connection')
          if (!rpcError) {
            console.log(`✅ Supabase RPC check_auth_connection success (attempt ${attempt})`)
            return true
          }

          // If rpc returns permission/RLS-related error, treat the endpoint as reachable
          if (
            rpcError &&
            (rpcError.code === 'PGRST116' ||
              rpcError.message?.toLowerCase().includes('permission') ||
              rpcError.message?.toLowerCase().includes('rls'))
          ) {
            console.log(
              '⚠️ Supabase RPC returned RLS/permission info but endpoint is reachable:',
              rpcError.message
            )
            return true
          }

          // Otherwise fall through to the fallback select below
          console.warn(
            '⚠️ Supabase RPC returned an unexpected error, falling back to safe select:',
            rpcError?.message
          )
        } catch (rpcException) {
          // If the RPC call throws unexpectedly, ignore and try the fallback select
          console.warn(
            '⚠️ Supabase RPC check failed (will try fallback select):',
            rpcException?.message
          )
        }

        // Fallback: safe, small select that works under RLS. Treat permission/RLS errors as "reachable".
        const { error } = await supabaseClient.from('user_profiles').select('id').limit(1)

        if (error) {
          const msg = String(error?.message ?? '').toLowerCase()
          // Accept a handful of errors as signs that the DB is reachable but protected by RLS/permissions.
          if (
            ['pgrst116', '42501'].includes(String(error?.code).toLowerCase()) ||
            msg.includes('permission') ||
            msg.includes('rls') ||
            msg.includes('not found')
          ) {
            console.log(
              '⚠️ Supabase select returned RLS/permission info but DB is reachable:',
              error.message
            )
            return true
          }
          throw error
        }

        console.log(`✅ Supabase connection test successful (attempt ${attempt})`)
        return true
      } catch (error) {
        console.warn(
          `⚠️ Supabase connection test failed (attempt ${attempt}/${retries}):`,
          error?.message
        )

        if (attempt === retries) {
          console.error('❌ Supabase connection test failed after all attempts:', {
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            code: error?.code,
          })
          return false
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }

    return false
  }

  // Network status monitoring
  let isOnline = navigator?.onLine ?? true

  window?.addEventListener?.('online', () => {
    isOnline = true
    console.log('🌐 Network connection restored')
  })

  window?.addEventListener?.('offline', () => {
    isOnline = false
    console.warn('📡 Network connection lost')
  })

  isNetworkOnlineFn = () => isOnline

  recoverSessionFn = (...args) => {
    console.warn('Placeholder: recoverSession is not implemented yet.', args)
    return null
  }
}

export const supabase = supabaseClient
export const isSupabaseConfigured = isSupabaseConfiguredFn
export const testSupabaseConnection = testSupabaseConnectionFn
export const isNetworkOnline = isNetworkOnlineFn
export const recoverSession = recoverSessionFn
export default supabaseClient
