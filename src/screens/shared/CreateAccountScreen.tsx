import React, { useState } from 'react';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendEmailVerification,
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import Button from '../../components/ui/Button';
import FormInput from '../../components/ui/FormInput';
import CivicPulseLogo from '../../components/ui/CivicPulseLogo';
import AuthLayout from '../../components/shared/AuthLayout';
import { getAuthErrorCode, getEmailPasswordCreateErrorMessage, getGoogleSignInErrorMessage } from '../../utils/authErrors';

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
      const { uid } = userCredential.user;
      await updateProfile(userCredential.user, { displayName });
      await setDoc(doc(db, 'users', uid), {
        id: uid,
        role: 'citizen',
        email,
        display_name: displayName,
        verified_account: false,
        trust_score: 0,
        trust_layer1: 0,
        trust_layer2: 0,
        total_points: 0,
        created_at: serverTimestamp(),
      });
      await sendEmailVerification(userCredential.user);
      onNavigate('verify-email');
    } catch (err: unknown) {
      setError(getEmailPasswordCreateErrorMessage(getAuthErrorCode(err)));
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
    } catch (err: unknown) {
      setError(getGoogleSignInErrorMessage(getAuthErrorCode(err)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex min-h-screen flex-col bg-background text-text-primary font-sans">
        {/* Header */}
        <header className="flex h-16 items-center justify-between px-4 border-b border-border bg-surface shrink-0">
          <Button variant="icon" onClick={() => onNavigate('welcome')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="text-label text-text-primary">Create Account</span>
          <div className="w-10" />
        </header>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full space-y-6 overflow-y-auto">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border-2 border-border bg-surface-container-lowest shadow-[3px_3px_0_0_var(--cp-border)]">
              <CivicPulseLogo size="md" />
            </div>
            <h2 className="text-screen-title text-text-primary">
              Join CivicPulse
            </h2>
            <p className="text-body-md text-text-secondary">
              Report local problems and track them to resolution
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
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <FormInput
              label="Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
            />

            <FormInput
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />

            <div className="space-y-1.5">
              <label className="text-label font-medium text-text-primary">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 bg-surface border-[1.5px] border-border rounded-lg pl-4 pr-12 text-body-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary focus:border-2 transition"
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

            <FormInput
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />

            {/* Error Message */}
            {error && (
              <p className="text-caption text-severity-high bg-severity-high-bg border border-severity-high/20 rounded-lg p-3">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isLoading} fullWidth>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="text-center text-body-md text-text-secondary">
            Already have an account?{' '}
            <Button variant="text" onClick={() => onNavigate('signin')}>
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
