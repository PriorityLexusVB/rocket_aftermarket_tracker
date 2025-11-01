import '@testing-library/jest-dom'

// Provide window stubs some tests expect to spy on
// @ts-ignore
globalThis.openNewDealModal = vi.fn()
// @ts-ignore
globalThis.closeModal = vi.fn()

// Lightweight Supabase mock with chainable .eq().order().in().not().limit()...
vi.mock('@/lib/supabase', () => {
  const rows: any[] = []
  const chain = () => ({
    select: () => chain(),
    insert: (d: any) => chain(),
    upsert: (d: any) => chain(),
    update: (d: any) => chain(),
    delete: () => chain(),
    eq: () => chain(),
    order: () => chain(),
    in: () => chain(),
    not: () => chain(),
    limit: () => chain(),
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (resolve: any) => resolve({ data: rows, error: null }),
  })
  return { supabase: { from: () => chain(), rpc: () => Promise.resolve({ data: null, error: null }) } }
})
