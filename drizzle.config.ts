import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // DATABASE_URL required for drizzle:generate script - not used at runtime
    // This is only for introspection/generation, not for runtime DB access
    // We don't actually push schema changes via Drizzle - migrations are managed in supabase/migrations
    url:
      process.env.DATABASE_URL ||
      (() => {
        throw new Error('DATABASE_URL required for drizzle:generate')
      })(),
  },
})
