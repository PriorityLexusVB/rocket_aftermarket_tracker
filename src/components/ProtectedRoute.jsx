import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { isAuthed, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Priority Automotive</h2>
          <p className="text-gray-600">Authenticating and loading your workspace...</p>
        </div>
      </div>
    )
  }

  if (!isAuthed) {
    return <Navigate to="/auth" replace />
  }

  return children
}

export default ProtectedRoute
