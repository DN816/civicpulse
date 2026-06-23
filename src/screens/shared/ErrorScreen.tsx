import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { auth } from '../../config/firebase';

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-white font-sans">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-950/50 border border-red-800">
          <ShieldAlert className="h-8 w-8 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            System Error
          </h1>
          <p className="text-zinc-400 text-sm">
            {message}
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full h-12 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-lg transition duration-200"
        >
          Sign Out & Return Home
        </button>
      </div>
    </div>
  );
}
