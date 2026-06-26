import React, { useState } from 'react';
import { MailCheck, RefreshCw, LogOut } from 'lucide-react';
import { auth } from '../../config/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';

interface EmailVerificationScreenProps {
  onNavigate: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function EmailVerificationScreen({ onNavigate }: EmailVerificationScreenProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userEmail = auth.currentUser?.email || 'your email';

  const handleCheckVerification = async () => {
    setIsChecking(true);
    setError(null);
    setSuccess(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        onNavigate('welcome');
        return;
      }

      await user.reload();
      await user.getIdToken(true);

      if (user.emailVerified) {
        onNavigate('router');
      } else {
        setError('Email not verified yet. Please check your inbox.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to check verification status.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    setError(null);
    setSuccess(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        onNavigate('welcome');
        return;
      }

      await sendEmailVerification(user);
      setSuccess('Verification email sent! Please check your inbox.');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setError(err.message || 'Failed to resend verification email.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onNavigate('welcome');
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-center px-4 border-b border-zinc-900 bg-zinc-900/50">
        <span className="font-semibold text-zinc-300">Verify Your Email</span>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20">
            <MailCheck className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Check your inbox
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We sent a verification email to{' '}
            <span className="text-blue-400 font-medium">{userEmail}</span>.
            Please check your inbox and click the link to continue.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-xs text-red-500 bg-red-950/20 border border-red-900/30 rounded-lg p-3 text-center">
            {error}
          </p>
        )}

        {/* Success Message */}
        {success && (
          <p className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3 text-center">
            {success}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleCheckVerification}
            disabled={isChecking}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg transition duration-200 shadow-lg shadow-blue-500/10 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "I've verified my email"
            )}
          </button>

          <button
            onClick={handleResendEmail}
            disabled={isResending}
            className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 border border-zinc-800 text-zinc-200 font-medium rounded-lg transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isResending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MailCheck className="h-4 w-4" />
                Resend email
              </>
            )}
          </button>

          <button
            onClick={handleSignOut}
            className="w-full h-12 bg-transparent hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
