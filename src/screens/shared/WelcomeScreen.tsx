import React from 'react';
import { Shield } from 'lucide-react';

interface WelcomeScreenProps {
  onNavigate: (screen: 'signin' | 'create-account') => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-6 py-12 text-white font-sans">
      <div className="flex flex-1 flex-col items-center justify-center space-y-8 text-center max-w-md mx-auto w-full">
        {/* Logo and Icon */}
        <div className="space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20 shadow-lg shadow-blue-500/10">
            <Shield className="h-12 w-12 text-blue-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              CivicPulse
            </h1>
            <p className="text-zinc-400 text-base">
              Report local problems. Track them to resolution.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full space-y-4 pt-8">
          <button
            onClick={() => onNavigate('signin')}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg transition duration-200 shadow-lg shadow-blue-500/10"
          >
            Sign In
          </button>
          
          <button
            onClick={() => onNavigate('create-account')}
            className="w-full h-12 bg-transparent hover:bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white font-medium rounded-lg transition duration-200"
          >
            Create Account
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-zinc-600">
        By continuing, you agree to connect with your local community.
      </footer>
    </div>
  );
}
