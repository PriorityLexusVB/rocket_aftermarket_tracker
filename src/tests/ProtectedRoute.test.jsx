import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

const authState = vi.hoisted(() => ({
  current: { isAuthed: true, loading: false, profileLoading: false, role: 'manager' },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState.current,
}))

import ProtectedRoute from '@/components/ProtectedRoute'

function renderProtected(auth, allowedRoles) {
  authState.current = auth
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div>Admin workspace</div>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<div>Home workspace</div>} />
        <Route path="/auth" element={<div>Sign in</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute role gate', () => {
  it('allows Sam-style manager access to admin routes', () => {
    renderProtected({ isAuthed: true, loading: false, profileLoading: false, role: 'manager' }, [
      'admin',
      'manager',
    ])
    expect(screen.getByText('Admin workspace')).toBeInTheDocument()
  })

  it.each(['staff', 'vendor'])('redirects %s users away from admin routes', (role) => {
    renderProtected({ isAuthed: true, loading: false, profileLoading: false, role }, [
      'admin',
      'manager',
    ])
    expect(screen.getByText('Home workspace')).toBeInTheDocument()
  })

  it('redirects inactive or missing-profile sessions to sign in', () => {
    renderProtected({ isAuthed: false, loading: false, profileLoading: false, role: null }, [
      'admin',
      'manager',
    ])
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
})
