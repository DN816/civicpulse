import React, { useState } from 'react';
import { ChevronLeft, Eye, EyeOff, Shield } from 'lucide-react';
import { auth } from '../../config/firebase';
import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendEmailVerification,
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';

interface CreateAccountScreenProps {
  onNavigate: (screen: 'welcome' | 'signin' | 'router' | 'verify-email') => void;
}

export default function CreateAccountScreen({ onNavigate }: CreateAccountScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Update profile with display name
      await updateProfile(userCredential.user, { displayName });
      // Send verification email and redirect to verification screen
      await sendEmailVerification(userCredential.user);
      onNavigate('verify-email');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication is not enabled in your Firebase console. Go to Firebase Console -> Authentication -> Sign-in method, and enable Email/Password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered.');
      } else {
        setError(err.message || 'An error occurred during account creation.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onNavigate('router');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in your Firebase console. Go to Firebase Console -> Authentication -> Sign-in method, and enable Google.');
      } else {
        setError(err.message || 'Google account creation failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-between px-4 border-b border-zinc-900 bg-zinc-900/50">
        <button
          onClick={() => onNavigate('welcome')}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <span className="font-semibold text-zinc-300">Create Account</span>
        <div className="w-10" /> {/* Balancer */}
      </header>

      {/* Form Container */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20">
            <Shield className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Join CivicPulse
          </h2>
          <p className="text-zinc-400 text-sm">
            Report local problems and track them to resolution
          </p>
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex w-full h-12 items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 border border-zinc-850 rounded-lg text-zinc-200 font-medium transition duration-200 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.85 3C6.26 7.54 8.92 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57l3.77 2.92c2.2-2.03 3.68-5.02 3.68-8.73z"
            />
            <path
              fill="#FBBC05"
              d="M5.35 14.5c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3L1.5 6.9C.54 8.82 0 10.97 0 13.2s.54 4.38 1.5 6.3l3.85-3z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.77-2.92c-1.11.75-2.53 1.19-4.19 1.19-3.08 0-5.74-2.5-6.65-5.46L1.5 15.9C3.4 19.75 7.35 23 12 23z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 text-zinc-600">
          <div className="h-[1px] flex-1 bg-zinc-900" />
          <span className="text-xs font-medium uppercase tracking-wider">or</span>
          <div className="h-[1px] flex-1 bg-zinc-900" />
        </div>

        {/* Form */}
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition duration-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition duration-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg pl-4 pr-12 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition duration-200"
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-xs text-red-500 bg-red-950/20 border border-red-900/30 rounded-lg p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg transition duration-200 shadow-lg shadow-blue-500/10 disabled:opacity-50"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('signin')}
            className="font-semibold text-blue-500 hover:text-blue-400 transition"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
