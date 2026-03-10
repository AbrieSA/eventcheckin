import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const AuthenticationLogin = () => {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const appVersion = '0.1.0';

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/home-dashboard');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSignIn = async (e) => {
    e?.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError(signInError?.message || 'Failed to sign in. Please check your credentials.');
      } else {
        // Successful login - redirect handled by useEffect
        navigate('/home-dashboard');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (role) => {
    if (role === 'super_admin') {
      setEmail('superadmin@eventcheckin.com');
      setPassword('admin123');
    } else if (role === 'admin') {
      setEmail('admin@eventcheckin.com');
      setPassword('admin123');
    } else if (role === 'regular_user') {
      setEmail('user@eventcheckin.com');
      setPassword('user123');
    }
    setError('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-lg mx-auto mb-4">
            <Icon name="LogIn" size={32} color="var(--color-primary)" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            EventMe
          </h1>
          <p className="text-xs text-muted-foreground">v{appVersion}</p>
        </div>

        {/* Login Form */}
        <div className="bg-card border border-border rounded-2xl shadow-lg p-8 pb-8">
          <form onSubmit={handleSignIn} className="space-y-6 pb-0">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e?.target?.value)}
                placeholder="Enter your email"
                disabled={loading}
                className="w-full pb-3"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e?.target?.value)}
                placeholder="Enter your password"
                disabled={loading}
                className="w-full"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-primary/30 py-3 mt-8"
            >
              {loading ? 'Signing In...' : 'Carpe Diem'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationLogin;