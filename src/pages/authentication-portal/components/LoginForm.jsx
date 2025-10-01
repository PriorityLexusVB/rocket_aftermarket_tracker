import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, RefreshCw, Wifi } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';
import { AuthContext } from '../../../contexts/AuthContext';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  
  const { signIn } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  // Simplified submit handler
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (isLoading) {
      console.log('Already processing login, ignoring...');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setIsRetrying(false);

    // Basic validation
    if (!formData?.email?.trim() || !formData?.password?.trim()) {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    try {
      console.log('=== LOGIN FORM SUBMISSION ===');
      console.log('Email:', formData?.email);
      
      const result = await signIn(formData?.email?.trim(), formData?.password?.trim(), formData?.rememberMe);
      
      console.log('Login result:', { success: result?.success, hasError: !!result?.error });
      
      if (result?.success && result?.data?.user) {
        console.log('✅ Login successful - redirecting...');
        
        // Clear any error states
        localStorage.removeItem('lastAuthError');
        setError('');
        
        // Navigate with a small delay to ensure auth state updates
        setTimeout(() => {
          navigate('/sales-tracker', { replace: true });
        }, 100);
        
      } else {
        const errorMsg = result?.error || 'Login failed. Please try again.';
        console.error('❌ Login failed:', errorMsg);
        
        setError(errorMsg);
        
        // Auto-suggest retry for timeout errors
        if (errorMsg?.includes('timeout') || errorMsg?.includes('connection')) {
          setIsRetrying(true);
        }
      }
    } catch (err) {
      console.error('Login form error:', err);
      setError('An unexpected error occurred. Please refresh the page and try again.');
    } finally {
      // Always clear loading state
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
  };

  // Auto-retry for connection issues
  const handleRetry = () => {
    setIsRetrying(false);
    setError('');
    handleSubmit({ preventDefault: () => {} });
  };

  // Demo credentials
  const fillDemoCredentials = (role) => {
    const credentials = {
      ashley: { email: 'ashley.terminello@priorityautomotive.com', password: 'Rocket123!' },
      rob: { email: 'rob.brasco@priorityautomotive.com', password: 'Rocket123!' }
    };
    
    const cred = credentials?.[role];
    if (cred) {
      setFormData(prev => ({ ...prev, email: cred?.email, password: cred?.password }));
      setError('');
      console.log(`Auto-filled ${role} credentials`);
    }
  };

  return (
    <div className="mt-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Display with Retry Option */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Login Error</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
                
                {isRetrying && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="inline-flex items-center space-x-2 px-3 py-1.5 bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs rounded-md transition-colors duration-200 disabled:opacity-50"
                    >
                      <Wifi className="h-3 w-3" />
                      <span>Retry Connection</span>
                    </button>
                  </div>
                )}
                
                {(error?.includes('timeout') || error?.includes('connection')) && (
                  <div className="mt-3 text-xs text-destructive/70 space-y-1">
                    <p>• Check your internet connection</p>
                    <p>• Try the retry button above</p>
                    <p>• Refresh the page if the issue persists</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground block">
            Email Address
          </label>
          <Input
            id="email"
            type="email"
            value={formData?.email}
            onChange={(e) => handleInputChange('email', e?.target?.value)}
            placeholder="Enter your email address"
            required
            disabled={isLoading}
            className="transition-colors duration-200"
          />
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground block">
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData?.password}
              onChange={(e) => handleInputChange('password', e?.target?.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              className="pr-12 transition-colors duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rememberMe"
            checked={formData?.rememberMe}
            onChange={(e) => handleInputChange('rememberMe', e?.target?.checked)}
            disabled={isLoading}
          />
          <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">
            Remember me for 30 days
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-2 transition-all duration-200"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </>
          )}
        </Button>

        {/* Admin Credentials */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-3">Admin Credentials (Click to Auto-Fill)</h3>
          <div className="space-y-2 text-xs">
            <button
              type="button" 
              onClick={() => fillDemoCredentials('ashley')}
              className="block w-full text-left p-2 bg-blue-100 hover:bg-blue-200 rounded text-blue-700 transition-colors"
            >
              <div><strong>Ashley Terminello:</strong> ashley.terminello@priorityautomotive.com</div>
              <div className="text-blue-600">Password: Rocket123!</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials('rob')} 
              className="block w-full text-left p-2 bg-blue-100 hover:bg-blue-200 rounded text-blue-700 transition-colors"
            >
              <div><strong>Rob Brasco:</strong> rob.brasco@priorityautomotive.com</div>
              <div className="text-blue-600">Password: Rocket123!</div>
            </button>
          </div>
          <div className="mt-3 text-xs text-blue-600">
            <p>• Click any credential above to auto-fill the form</p>
            <p>• Both users have full administrator privileges</p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;