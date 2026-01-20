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

  const noopChannel = () => ({
    on() {
      return this
    },
    subscribe: async () => ({ data: { subscription: { state: 'SUBSCRIBED' } }, error: null }),
    unsubscribe: async () => ({ data: null, error: null }),
  })

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
    channel: () => noopChannel(),
    removeChannel: async () => ({ data: null, error: null }),
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }),
      getSession: async () => ({
        data: { session: { user: { id: 'test-user', email: 'test@example.com' } } },
        error: null,
      }),
      signInWithPassword: async ({ email }) => ({
        data: { user: { id: 'test-user', email } },
        error: null,
      }),
    },
  }

  // Export additional helpers for compatibility
  isSupabaseConfiguredFn = () => true
  testSupabaseConnectionFn = async () => true
  isNetworkOnlineFn = () => true
  recoverSessionFn = () => null
} else {
  // Production mode - original implementation
  // Environment variables with enhanced validation
  const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY

  // Guardrail: prevent accidental production project usage during local development.
  // We do not throw (to avoid blocking emergency debugging), but we make it extremely obvious.
  const inferProjectRefFromUrl = (url) => {
    const m = String(url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)
    return m?.[1] || null
  }
  const urlRef = inferProjectRefFromUrl(supabaseUrl)
  const isKnownProdRef = urlRef === 'ogjtmtndgiqqdtwatsue'
  if (import.meta?.env?.DEV && isKnownProdRef) {
    console.error(
      '[Supabase] DEV ENV WARNING: VITE_SUPABASE_URL is pointed at the known production project ref.'
    )
    try {
      if (typeof window !== 'undefined') {
        window.__ROCKET_SUPABASE_ENV_WARNING__ = {
          type: 'known-production-ref',
          ref: urlRef,
          url: supabaseUrl,
          timestamp: new Date().toISOString(),
        }
      }
    } catch {
      // ignore
    }
  }

  // Only log environment check in development mode
  if (import.meta?.env?.DEV) {
    console.log('Supabase Environment Check:', {
      url: supabaseUrl ? 'Present' : 'Missing',
      anonKey: supabaseAnonKey ? 'Present' : 'Missing',
      urlValid: supabaseUrl?.includes('supabase.co') || supabaseUrl?.includes('localhost'),
      keyValid: supabaseAnonKey?.length > 50,
    })
  }
  // Validate environment variables & build optional dev stub when missing
  const isProd = import.meta?.env?.PROD
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

  const clearPersistedAuthStorage = () => {
    try {
      if (typeof window === 'undefined') return
      const host = String(supabaseUrl || '')
        ?.split('//')
        ?.pop()
        ?.split('/')
        ?.shift()

      // Our configured auth storage key
      window.localStorage?.removeItem?.('priority-automotive-auth')
      window.sessionStorage?.removeItem?.('priority-automotive-auth')

      // Common Supabase defaults (kept for backward compatibility with older builds)
      window.localStorage?.removeItem?.('supabase.auth.token')
      if (host) {
        window.localStorage?.removeItem?.(`sb-${host}-auth-token`)
        window.sessionStorage?.removeItem?.(`sb-${host}-auth-token`)
      }
    } catch (e) {
      // Never block app startup on storage cleanup
      console.warn('[Supabase] Failed to clear persisted auth storage:', e?.message)
    }
  }

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

        // If a stored refresh token has become invalid (revoked/expired), Supabase will attempt a
        // refresh on boot and can spam the console. Auto-recover by clearing persisted auth and
        // signing out locally.
        try {
          supabaseInstance?.auth?.onAuthStateChange?.((event) => {
            if (event === 'TOKEN_REFRESH_FAILED') {
              console.warn('[Supabase] Token refresh failed; clearing local session')
              clearPersistedAuthStorage()
              supabaseInstance?.auth?.signOut?.({ scope: 'local' })?.catch?.(() => {})
            }
          })
        } catch (e) {
          console.warn('[Supabase] Failed to attach auth state listener:', e?.message)
        }

        // One-time boot check: if the persisted session is corrupt, clear it.
        // Avoid throwing — this is purely for UX hygiene.
        supabaseInstance?.auth
          ?.getSession?.()
          ?.then(({ error }) => {
            const msg = String(error?.message || '')
            if (error && (msg.includes('Invalid Refresh Token') || msg.includes('refresh_token'))) {
              console.warn('[Supabase] Invalid refresh token detected; resetting local session')
              clearPersistedAuthStorage()
              return supabaseInstance?.auth?.signOut?.({ scope: 'local' })
            }
          })
          ?.catch?.(() => {})

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

  // Clear a possibly-corrupted session (e.g. "Invalid Refresh Token") so the UI can recover.
  // Returns null when no valid session remains.
  recoverSessionFn = async () => {
    try {
      clearPersistedAuthStorage()
      await supabaseClient?.auth?.signOut?.({ scope: 'local' })
    } catch (e) {
      // If it's a refresh token error during sign out, ignore it since we're clearing local state anyway.
      const msg = String(e?.message || '')
      if (msg.includes('Invalid Refresh Token') || msg.includes('refresh_token')) {
        return null
      }
      console.warn('[Supabase] Session recovery signOut failed (non-fatal):', e?.message)
    }
    return null
  }
}

export const supabase = supabaseClient
export const isSupabaseConfigured = isSupabaseConfiguredFn
export const testSupabaseConnection = testSupabaseConnectionFn
export const isNetworkOnline = isNetworkOnlineFn
export const recoverSession = recoverSessionFn
export default supabaseClient
