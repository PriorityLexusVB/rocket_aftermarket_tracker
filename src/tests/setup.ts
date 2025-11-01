// src/tests/setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Window helpers some tests expect:
vi.stubGlobal('openNewDealModal', vi.fn())
vi.stubGlobal('closeModal', vi.fn())

// Turn on V2 form path by default in tests:
Object.assign(import.meta.env, {
  VITE_DEAL_FORM_V2: 'true',
})
