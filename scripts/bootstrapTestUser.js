// Dev helper to bootstrap a test user in Supabase Auth
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

// Load .env and .env.local if present
const root = process.cwd()
const envLocalPath = path.join(root, '.env.local')
const envPath = path.join(root, '.env')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.TEST_USER_EMAIL || process.env.E2E_EMAIL
const PASSWORD = process.env.TEST_USER_PASSWORD || process.env.E2E_PASSWORD
const FULL_NAME = process.env.TEST_USER_NAME || 'Test User'

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
    process.exit(1)
  }
  if (!EMAIL || !PASSWORD) {
    console.error('Missing TEST_USER_EMAIL/TEST_USER_PASSWORD (or E2E_EMAIL/E2E_PASSWORD) in env')
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // If exists, exit gracefully
    const { data: existing, error: getErr } = await admin.auth.admin.getUserByEmail(EMAIL)
    if (getErr) {
      console.warn('Lookup warning:', getErr.message)
    }
    if (existing?.user) {
      console.log(`User already exists: ${EMAIL} (id: ${existing.user.id})`)
      process.exit(0)
    }

    // Create new user (email confirmed so it can sign in immediately)
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    })
    if (error) {
      console.error('Create user failed:', error.message)
      process.exit(1)
    }

    console.log(`Created test user: ${EMAIL} (id: ${data.user.id})`)
    console.log('Note: user_profiles will be auto-created on first login via the app.')
  } catch (e) {
    console.error('Bootstrap error:', e?.message || e)
    process.exit(1)
  }
}

main()
