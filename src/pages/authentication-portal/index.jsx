import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandHeader from './components/BrandHeader'
import LoginForm from './components/LoginForm'
import SecurityBadges from './components/SecurityBadges'
import SystemInfo from './components/SystemInfo'

const AuthenticationPortal = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const userRole = localStorage.getItem('userRole')
    const rememberMe = localStorage.getItem('rememberMe')

    if (userRole && rememberMe === 'true') {
      navigate('/deals')
    }
  }, [navigate])

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full 0 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full 0 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 md:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden rounded-3xl border border-border 0 p-8 shadow-xl backdrop-blur lg:block">
            <BrandHeader />
            <div className="mt-8 rounded-2xl border border-border 0 p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Quick Access After Login</h3>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>• Deals Management</div>
                <div>• Calendar Scheduling</div>
                <div>• Loaner Operations</div>
                <div>• Claims Workflow</div>
              </div>
            </div>
            <SystemInfo />
          </section>

          <section className="rounded-3xl border border-border 0 p-6 shadow-2xl backdrop-blur md:p-8">
            <div className="mb-6 lg:hidden">
              <BrandHeader />
            </div>
            <LoginForm />
            <SecurityBadges />

            <div className="mt-6 rounded-xl border border-border bg-card p-4 text-center">
              <h3 className="text-sm font-medium text-foreground">Customer Claims</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Customers can submit claims here instead of showing up unannounced.
              </p>
              <a
                href="/guest-claims-submission-form"
                className="mt-3 inline-flex items-center justify-center rounded-md border border-border 0 px-3 py-2 text-xs font-semibold text-foreground 0"
              >
                Open Claims Form
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default AuthenticationPortal
