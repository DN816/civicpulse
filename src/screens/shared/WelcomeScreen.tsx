import React from 'react';
import Button from '../../components/ui/Button';
import CivicPulseLogo from '../../components/ui/CivicPulseLogo';

interface WelcomeScreenProps {
  onNavigate: (screen: 'signin' | 'create-account') => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-12 text-text-primary font-sans">
      <div className="flex flex-1 flex-col items-center justify-center space-y-8 text-center max-w-md mx-auto w-full">
        <div className="space-y-4">
          <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-2xl border-4 border-border bg-surface-container-lowest shadow-[6px_6px_0_0_var(--cp-border)]">
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

      <footer className="text-center text-caption text-text-secondary">
        By continuing, you agree to connect with your local community.
      </footer>
    </div>
  );
}
