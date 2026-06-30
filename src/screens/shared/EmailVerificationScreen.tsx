import React, { useState, useEffect } from 'react';
import { MailCheck, RefreshCw, LogOut } from 'lucide-react';
import { auth } from '../../config/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import Button from '../../components/ui/Button';
import AuthLayout from '../../components/shared/AuthLayout';
import { getAuthErrorCode, getAuthErrorMessage } from '../../utils/authErrors';

interface EmailVerificationScreenProps {
  onNavigate: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function EmailVerificationScreen({ onNavigate }: EmailVerificationScreenProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userEmail = auth.currentUser?.email || 'your email';

  useEffect(() => {
    const pollVerification = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        await user.reload();
        if (user.emailVerified) {
          onNavigate('router');
        }
      } catch {
        // Silent poll failure — user can tap "I've verified my email"
      }
    };

    const interval = setInterval(pollVerification, 5000);
    pollVerification();

    return () => clearInterval(interval);
  }, [onNavigate]);

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
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'Failed to check verification status.'));
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
    } catch (err: unknown) {
      const code = getAuthErrorCode(err);
      if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setError(getAuthErrorMessage(err, 'Failed to resend verification email.'));
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
    <AuthLayout>
      <div className="flex min-h-screen flex-col bg-background text-text-primary font-sans">
        {/* Header */}
        <header className="flex h-16 items-center justify-center px-4 border-b border-border bg-surface shrink-0">
          <span className="text-label text-text-primary">Verify Your Email</span>
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full space-y-6 overflow-y-auto">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-screen-title text-text-primary">
              Check your inbox
            </h2>
            <p className="text-body-md text-text-secondary leading-relaxed">
              We sent a verification email to{' '}
              <span className="text-primary font-medium">{userEmail}</span>.
              Please check your inbox and click the link to continue.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-caption text-severity-high bg-severity-high-bg border border-severity-high/20 rounded-lg p-3 text-center">
              {error}
            </p>
          )}

          {/* Success Message */}
          {success && (
            <p className="text-caption text-status-success bg-severity-low-bg border border-status-success/20 rounded-lg p-3 text-center">
              {success}
            </p>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleCheckVerification}
              disabled={isChecking}
              fullWidth
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "I've verified my email"
              )}
            </Button>

            <Button
              onClick={handleResendEmail}
              disabled={isResending}
              variant="secondary"
              fullWidth
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
            </Button>

            <Button
              onClick={handleSignOut}
              variant="text"
              fullWidth
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
