import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, RefreshCw, Lock, Mail } from 'lucide-react';
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

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (isLoading) {
      console.log('Already processing login, ignoring...');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setIsRetrying(false);

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
        localStorage.removeItem('lastAuthError');
        setError('');
        
        setTimeout(() => {
          navigate('/deals', { replace: true });
        }, 100);
        
      } else {
        const errorMsg = result?.error || 'Login failed. Please try again.';
        console.error('❌ Login failed:', errorMsg);
        setError(errorMsg);
        
        if (errorMsg?.includes('timeout') || errorMsg?.includes('connection')) {
          setIsRetrying(true);
        }
      }
    } catch (err) {
      console.error('Login form error:', err);
      setError('An unexpected error occurred. Please refresh the page and try again.');
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
  };

  const handleRetry = () => {
    setIsRetrying(false);
    setError('');
    handleSubmit({ preventDefault: () => {} });
  };

  const fillDemoCredentials = (email, password) => {
    setFormData(prev => ({
      ...prev,
      email: email,
      password: password
    }));
    setError('');
  };

  return (
    <>
      {/* Demo Credentials Section */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Demo Credentials</h3>
        <div className="space-y-2 text-xs">
          <button
            type="button"
            onClick={() => fillDemoCredentials('admin@priorityautomotive.com', 'admin123')}
            className="w-full flex justify-between items-center p-2 bg-white rounded border hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-700">Admin:</span>
            <div className="flex space-x-2 text-blue-600">
              <code>admin@priorityautomotive.com</code>
              <span className="text-gray-400">•</span>
              <code>admin123</code>
            </div>
          </button>
          <button
            type="button"
            onClick={() => fillDemoCredentials('manager@priorityautomotive.com', 'manager123')}
            className="w-full flex justify-between items-center p-2 bg-white rounded border hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-700">Manager:</span>
            <div className="flex space-x-2 text-blue-600">
              <code>manager@priorityautomotive.com</code>
              <span className="text-gray-400">•</span>
              <code>manager123</code>
            </div>
          </button>
          <button
            type="button"
            onClick={() => fillDemoCredentials('staff@priorityautomotive.com', 'staff123')}
            className="w-full flex justify-between items-center p-2 bg-white rounded border hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-700">Staff:</span>
            <div className="flex space-x-2 text-blue-600">
              <code>staff@priorityautomotive.com</code>
              <span className="text-gray-400">•</span>
              <code>staff123</code>
            </div>
          </button>
        </div>
        <p className="text-xs text-blue-700 mt-2 italic">
          Click on any credential above to auto-fill the form
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Authentication Failed</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                
                {isRetrying && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry Login</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              id="email"
              type="email"
              value={formData?.email}
              onChange={(e) => handleInputChange('email', e?.target?.value)}
              placeholder="Enter your email address"
              required
              disabled={isLoading}
              className="pl-10"
              label=""
              helperText=""
              maxLength={255}
              style={{}}
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData?.password}
              onChange={(e) => handleInputChange('password', e?.target?.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              className="pl-10 pr-10"
              label=""
              helperText=""
              maxLength={255}
              style={{}}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={formData?.rememberMe}
              onChange={(e) => handleInputChange('rememberMe', e?.target?.checked)}
              disabled={isLoading}
            />
            <label htmlFor="rememberMe" className="text-sm text-foreground cursor-pointer">
              Keep me signed in
            </label>
          </div>
          <button
            type="button"
            className="text-sm text-primary hover:text-primary/80 font-medium"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
          onClick={handleSubmit}
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Signing In...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </>
          )}
        </Button>

        {/* Trust Indicators */}
        <div className="pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-3">
              Trusted by automotive professionals worldwide
            </p>
            <div className="flex justify-center items-center space-x-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>SOC2 Certified</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>GDPR Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default LoginForm;