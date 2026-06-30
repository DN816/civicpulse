import React, { useState } from 'react';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { auth } from '../../config/firebase';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import Button from '../../components/ui/Button';
import FormInput from '../../components/ui/FormInput';
import CivicPulseLogo from '../../components/ui/CivicPulseLogo';
import { getAuthErrorCode, getAuthErrorMessage, getEmailPasswordSignInErrorMessage, getGoogleSignInErrorMessage, INVALID_EMAIL_PASSWORD_MESSAGE } from '../../utils/authErrors';
import { needsEmailVerification, trimEmail } from '../../utils/authHelpers';

interface SignInScreenProps {
  onNavigate: (screen: 'welcome' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function SignInScreen({ onNavigate }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const normalizedEmail = trimEmail(email);
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await credential.user.reload();
      await credential.user.getIdToken(true);

      if (needsEmailVerification(credential.user)) {
        onNavigate('verify-email');
      } else {
        onNavigate('router');
      }
    } catch (err: unknown) {
      setError(getEmailPasswordSignInErrorMessage(getAuthErrorCode(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onNavigate('router');
    } catch (err: unknown) {
      setError(getGoogleSignInErrorMessage(getAuthErrorCode(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email to reset your password.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    try {
      await sendPasswordResetEmail(auth, trimEmail(email));
      setSuccessMessage('Password reset email sent! Please check your inbox.');
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'Failed to send password reset email.'));
    }
  };

  const passwordError =
    error &&
    (error === 'Please fill in all fields.' ||
      error === INVALID_EMAIL_PASSWORD_MESSAGE ||
      error.toLowerCase().includes('password'))
      ? error
      : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-between px-4 border-b border-border bg-surface">
        <Button variant="icon" onClick={() => onNavigate('welcome')}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-label text-text-primary">Sign In</span>
        <div className="w-10" />
      </header>

      {/* Form Container */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border-2 border-border bg-surface-container-lowest shadow-[3px_3px_0_0_var(--cp-border)]">
            <CivicPulseLogo size="md" />
          </div>
          <h2 className="text-screen-title text-text-primary">
            Welcome Back
          </h2>
          <p className="text-body-md text-text-secondary">
            Sign in to access your civic dashboard
          </p>
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex w-full h-12 items-center justify-center gap-3 bg-surface hover:bg-background border-[1.5px] border-border rounded-lg text-text-primary font-medium transition duration-200 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.85 3C6.26 7.54 8.92 5.04 12 5.04z" />
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57l3.77 2.92c2.2-2.03 3.68-5.02 3.68-8.73z" />
            <path fill="#FBBC05" d="M5.35 14.5c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3L1.5 6.9C.54 8.82 0 10.97 0 13.2s.54 4.38 1.5 6.3l3.85-3z" />
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.77-2.92c-1.11.75-2.53 1.19-4.19 1.19-3.08 0-5.74-2.5-6.65-5.46L1.5 15.9C3.4 19.75 7.35 23 12 23z" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 text-text-secondary">
          <div className="h-px flex-1 bg-border" />
          <span className="text-caption font-medium uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <FormInput
            label="Email Address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-label font-medium text-text-primary">
                Password
              </label>
              <Button variant="text" type="button" onClick={handleForgotPassword} className="text-caption !text-primary">
                Forgot password?
              </Button>
            </div>
            <div className="relative">
              <FormInput
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                error={passwordError}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && !passwordError && (
            <p className="text-caption text-severity-high bg-severity-high-bg border border-severity-high/20 rounded-lg p-3">
              {error}
            </p>
          )}

          {successMessage && (
            <p className="text-caption text-status-success bg-severity-low-bg border border-status-success/20 rounded-lg p-3">
              {successMessage}
            </p>
          )}

          <Button type="submit" disabled={isLoading} fullWidth>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center text-body-md text-text-secondary">
          Don't have an account?{' '}
          <Button variant="text" onClick={() => onNavigate('create-account')}>
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );
}
