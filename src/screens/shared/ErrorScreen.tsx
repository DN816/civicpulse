import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { auth } from '../../config/firebase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

interface ErrorScreenProps {
  message: string;
  onSignOut?: () => void;
}

export default function ErrorScreen({ message, onSignOut }: ErrorScreenProps) {
  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await auth.signOut();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-text-primary font-sans">
      <Card variant="elevated" className="w-full max-w-md text-center space-y-6 flex flex-col items-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-severity-high-bg border border-severity-high/20">
          <ShieldAlert className="h-8 w-8 text-severity-high" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-screen-title text-text-primary">
            System Error
          </h1>
          <p className="text-body-md text-text-secondary">
            {message}
          </p>
        </div>

        <Button onClick={handleSignOut} fullWidth className="bg-severity-high hover:bg-severity-high/90 text-white">
          Sign Out & Return Home
        </Button>
      </Card>
    </div>
  );
}
