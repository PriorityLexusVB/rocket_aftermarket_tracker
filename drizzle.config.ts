import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // This is used only for introspection/generation, not for runtime DB access
    // We don't actually push schema changes via Drizzle - migrations are managed in supabase/migrations
    url: process.env.DATABASE_URL || '',
  },
});
