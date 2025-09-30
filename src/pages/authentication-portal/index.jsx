import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandHeader from './components/BrandHeader';
import LoginForm from './components/LoginForm';
import SecurityBadges from './components/SecurityBadges';
import SystemInfo from './components/SystemInfo';

const AuthenticationPortal = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    const userRole = localStorage.getItem('userRole');
    const rememberMe = localStorage.getItem('rememberMe');
    
    if (userRole && rememberMe === 'true') {
      // Redirect to Executive Analytics Dashboard as primary landing page
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.3'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Main Authentication Card */}
          <div className="bg-card border border-border rounded-2xl shadow-elevation-3 p-8">
            {/* Brand Header */}
            <BrandHeader />
            
            {/* Login Form */}
            <LoginForm />
            
            {/* Security Badges */}
            <SecurityBadges />
          </div>
          
          {/* System Information */}
          <div className="mt-6">
            <SystemInfo />
          </div>
          
          {/* Quick Access Information */}
          <div className="mt-4 text-center">
            <div className="bg-card/80 backdrop-blur border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Quick Access After Login</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Dashboard Overview</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Sales Tracker</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Vehicle Management</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Vendor Operations</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Keyboard Navigation Hint */}
      <div className="fixed bottom-4 right-4 hidden lg:block">
        <div className="bg-card border border-border rounded-lg p-3 shadow-elevation-2">
          <p className="text-xs text-muted-foreground flex items-center space-x-2">
            <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">Tab</kbd>
            <span>to navigate</span>
            <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">Enter</kbd>
            <span>to submit</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationPortal;