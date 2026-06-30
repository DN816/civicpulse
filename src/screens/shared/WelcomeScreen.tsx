import React from 'react';
import Button from '../../components/ui/Button';
import CivicPulseLogo from '../../components/ui/CivicPulseLogo';
import AuthLayout from '../../components/shared/AuthLayout';

interface WelcomeScreenProps {
  onNavigate: (screen: 'signin' | 'create-account') => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="space-y-4">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-border bg-surface-container-lowest shadow-[6px_6px_0_0_var(--cp-border)]">
              <CivicPulseLogo size="xl" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-text-primary">
                CivicPulse
              </h1>
              <p className="text-text-secondary text-body-lg">
                Report local problems. Track them to resolution.
              </p>
            </div>
          </div>

          <div className="w-full space-y-3 pt-8">
            <Button onClick={() => onNavigate('signin')} fullWidth>
              Sign In
            </Button>

            <Button onClick={() => onNavigate('create-account')} variant="secondary" fullWidth>
              Create Account
            </Button>
          </div>
        </div>

        <footer className="text-center text-caption text-text-secondary mt-auto pb-4">
          By continuing, you agree to connect with your local community.
        </footer>
      </div>
    </AuthLayout>
  );
}
