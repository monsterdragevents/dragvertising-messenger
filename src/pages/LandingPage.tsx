/**
 * Landing Page for Dragvertising Messenger
 * 
 * Matches the design of the main DragvertisingApp login page.
 * After successful authentication, users are redirected to the messenger.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/lib/design-system';
import { Sparkles, Eye, EyeOff, Loader2, AlertCircle, Chrome, Crown, Users, Calendar, DollarSign, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/shared/use-toast';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, session } = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Mode state
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check for existing session on mount (including cross-domain)
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Force a session check - this will work across subdomains since they share the same Supabase instance
        // The cross-domain storage adapter ensures cookies are shared
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession && existingSession.user) {
          // Session found - user is already authenticated
          // Refresh the session to ensure it's valid
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          
          if (refreshedSession) {
            // Valid session - AuthContext will update and redirect will happen
            console.log('[LandingPage] Found existing session for:', refreshedSession.user.email);
            return;
          }
        }
      } catch (err) {
        console.error('[LandingPage] Error checking session:', err);
      } finally {
        setCheckingAuth(false);
      }
    };

    // Always check for session, even if AuthContext is still loading
    // This ensures we catch sessions from the main site immediately
    checkExistingSession();
  }, []); // Only run on mount

  // Redirect if already logged in (either from AuthContext or direct session check)
  useEffect(() => {
    if (!authLoading && !checkingAuth && (user || (session && session.user))) {
      navigate('/', { replace: true });
    }
  }, [user, session, authLoading, checkingAuth, navigate]);

  // Handle "Continue as [user]" - use existing session
  const handleContinueAsUser = async () => {
    if (!session || !session.user) return;
    
    setIsSubmitting(true);
    try {
      // Refresh session to ensure it's valid and trigger AuthContext update
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) throw refreshError;
      
      if (refreshedSession && refreshedSession.user) {
        toast.success(`Welcome back, ${refreshedSession.user.email || 'User'}!`);
        // Small delay to allow AuthContext to update
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
      } else {
        throw new Error('No valid session found');
      }
    } catch (err: any) {
      console.error('[LandingPage] Error refreshing session:', err);
      setError('Session expired. Please sign in again.');
      toast.error('Session expired. Please sign in again.');
      setIsSubmitting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Check your email for the confirmation link!');
        setIsSignUp(false);
        setPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Welcome back!');
        // Navigation will happen automatically via useEffect
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      toast.error(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`
      });
      
      if (error) throw error;
      
      setResetEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google OAuth login
  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      toast.error(err.message || 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  // Handle Facebook OAuth login
  const handleFacebookLogin = async () => {
    if (isSubmitting) return;
    
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Facebook');
      toast.error(err.message || 'Failed to sign in with Facebook');
      setIsSubmitting(false);
    }
  };

  // Password reset view
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-background">
        {/* Left Side - Reset Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
          <div className="w-full max-w-md space-y-8">
            {/* Logo */}
            <div className="flex justify-center lg:justify-start">
              <Link to="/" className="hover:opacity-80 transition-opacity" aria-label="Dragvertising Home">
                <Sparkles className="h-8 w-8 text-primary" />
              </Link>
            </div>

            {/* Header */}
            <div className="text-center lg:text-left space-y-2">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                Reset Password
              </h1>
              <p className="text-lg text-muted-foreground">
                Enter your email and we'll send you a reset link
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {resetEmailSent ? (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm">
                    We've sent a password reset link to <strong>{email}</strong>. 
                    Check your email and click the link to reset your password.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="h-12"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    variant="gradient"
                    size="lg"
                    className="w-full h-12 font-semibold text-base" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending...</span>
                      </div>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                </>
              )}

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmailSent(false);
                    setError(null);
                  }}
                >
                  Back to {isSignUp ? 'Sign Up' : 'Login'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side - Illustration */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-purple-600 via-[#FD0290] to-[#FFA726] p-12 relative overflow-hidden">
          {/* Abstract Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
          </div>

          {/* Illustration Content */}
          <div className="relative z-10 max-w-lg space-y-8 text-center">
            <div className="space-y-6">
              {/* Stylized Interface Representation */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-2xl">
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                        <Crown className="h-6 w-6 text-white" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-24 bg-white/30 rounded" />
                        <div className="h-2 w-16 bg-white/20 rounded" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Content Rows */}
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20" />
                        <div className="flex-1 space-y-2">
                          <div className="h-2 bg-white/30 rounded w-3/4" />
                          <div className="h-2 bg-white/20 rounded w-1/2" />
                        </div>
                        <div className="w-16 h-6 bg-white/20 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <Users className="h-6 w-6 text-white mb-2 mx-auto" />
                  <p className="text-sm text-white/90 font-medium">Connect Talent</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <Calendar className="h-6 w-6 text-white mb-2 mx-auto" />
                  <p className="text-sm text-white/90 font-medium">Book Shows</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <DollarSign className="h-6 w-6 text-white mb-2 mx-auto" />
                  <p className="text-sm text-white/90 font-medium">Get Paid</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <Music className="h-6 w-6 text-white mb-2 mx-auto" />
                  <p className="text-sm text-white/90 font-medium">Manage Events</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">
                The Operating System for Drag Entertainment
              </h2>
              <p className="text-white/80 text-lg">
                One platform connecting every role in the industry
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while checking auth
  if (checkingAuth || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show "Continue as [user]" option if we have a session
  // This handles cases where session exists but AuthContext hasn't fully updated yet
  const showContinueOption = session && session.user && !user;

  // Main login/signup view
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex justify-center lg:justify-start">
            <Link to="/" className="hover:opacity-80 transition-opacity" aria-label="Dragvertising Home">
              <Sparkles className="h-8 w-8 text-primary" />
            </Link>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
              {isSignUp ? 'Welcome to Dragvertising' : 'Welcome Back'}
            </h1>
            <p className="text-lg text-muted-foreground">
              {isSignUp ? "Get started - it's free. No credit card needed." : "Sign in to your account"}
            </p>
          </div>

          {/* Continue as [user] option - like Facebook Messenger */}
          {showContinueOption && session?.user && (
            <div className="space-y-3">
              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                <p className="text-sm font-medium text-foreground mb-2">
                  Continue as {session.user.email || 'User'}?
                </p>
                <Button
                  type="button"
                  variant="gradient"
                  size="lg"
                  className="w-full h-12 font-semibold text-base"
                  onClick={handleContinueAsUser}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Continuing...</span>
                    </div>
                  ) : (
                    `Continue as ${session.user.email?.split('@')[0] || 'User'}`
                  )}
                </Button>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-2 text-muted-foreground">Or sign in with a different account</span>
                </div>
              </div>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-12"
              />
            </div>

            <div className="space-y-1">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isSignUp ? 'Password (min 8 characters)' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="h-12 pr-10"
                  minLength={isSignUp ? 8 : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForgotPassword(true)}
                  className="h-auto p-0 text-xs text-foreground/80 hover:text-foreground"
                  disabled={isSubmitting}
                >
                  Forgot password?
                </Button>
              </div>
            )}

            <Button 
              type="submit" 
              variant="gradient"
              size="lg"
              className="w-full h-12 font-semibold text-base" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Continue'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium shadow-sm hover:shadow transition-all"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <>
                  <Chrome className="mr-3 h-5 w-5" />
                  Continue with Google
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium shadow-sm hover:shadow transition-all"
              onClick={handleFacebookLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <>
                  <svg className="mr-3 h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                  Continue with Facebook
                </>
              )}
            </Button>
          </div>

          {/* Sign up/Sign in Link */}
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <Button variant="link" className="p-0 h-auto font-semibold text-primary hover:text-primary/80" onClick={() => setIsSignUp(false)}>
                  Log in
                </Button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <Button variant="link" className="p-0 h-auto font-semibold text-primary hover:text-primary/80" onClick={() => setIsSignUp(true)}>
                  Sign up
                </Button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right Side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-purple-600 via-[#FD0290] to-[#FFA726] p-12 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
        </div>

        {/* Illustration Content */}
        <div className="relative z-10 max-w-lg space-y-8 text-center">
          <div className="space-y-6">
            {/* Stylized Interface Representation */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-2xl">
              <div className="space-y-4">
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-24 bg-white/30 rounded" />
                      <div className="h-2 w-16 bg-white/20 rounded" />
                    </div>
                  </div>
                </div>
                
                {/* Content Rows */}
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/20" />
                      <div className="flex-1 space-y-2">
                        <div className="h-2 bg-white/30 rounded w-3/4" />
                        <div className="h-2 bg-white/20 rounded w-1/2" />
                      </div>
                      <div className="w-16 h-6 bg-white/20 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <Users className="h-6 w-6 text-white mb-2 mx-auto" />
                <p className="text-sm text-white/90 font-medium">Connect Talent</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <Calendar className="h-6 w-6 text-white mb-2 mx-auto" />
                <p className="text-sm text-white/90 font-medium">Book Shows</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <DollarSign className="h-6 w-6 text-white mb-2 mx-auto" />
                <p className="text-sm text-white/90 font-medium">Get Paid</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <Music className="h-6 w-6 text-white mb-2 mx-auto" />
                <p className="text-sm text-white/90 font-medium">Manage Events</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">
              The Operating System for Drag Entertainment
            </h2>
            <p className="text-white/80 text-lg">
              One platform connecting every role in the industry
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
