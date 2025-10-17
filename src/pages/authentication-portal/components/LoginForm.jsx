import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../../contexts/AuthContext';
import { Button, Input, Checkbox } from '../../../components/ui';

const LoginForm = () => {
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  
  const { signIn } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e?.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

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
      console.error('Login submission error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-800">Sign In</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Email</label>
          <Input 
            type="email"
            name="email"
            value={formData?.email}
            onChange={handleChange}
            placeholder="your.email@example.com"
            required
            label="Email"
            helperText=""
            maxLength={255}
            style={{}}
            id="email"
            aria-label="Email"
            aria-labelledby=""
            aria-describedby=""
            error=""
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Password</label>
          <Input 
            type="password"
            name="password"
            value={formData?.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            label="Password"
            helperText=""
            maxLength={255}
            style={{}}
            id="password"
            aria-label="Password"
            aria-labelledby=""
            aria-describedby=""
            error=""
          />
        </div>
        <div className="flex items-center justify-between">
          <Checkbox 
            label="Remember me"
            name="rememberMe"
            checked={formData?.rememberMe}
            onChange={handleChange}
          />
          <a href="#" className="text-sm text-blue-600 hover:underline">Forgot password?</a>
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
          onClick={handleSubmit}
          aria-label="Sign In"
          aria-labelledby=""
          aria-describedby=""
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}

export default LoginForm;