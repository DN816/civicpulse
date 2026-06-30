import React from 'react';
import CivicPulseLogo from '../ui/CivicPulseLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary font-sans lg:flex-row">
      <div className="hidden lg:flex lg:w-[480px] shrink-0 flex-col items-center justify-center bg-primary p-12 text-text-inverse">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="font-display text-5xl font-extrabold tracking-tight">
            CivicPulse
          </h1>
          <p className="text-lg text-white/80 leading-relaxed max-w-sm">
            Report local problems, track progress, and make your community better — one issue at a time.
          </p>
          <div className="grid grid-cols-3 gap-6 pt-6 w-full max-w-sm">
            <div className="text-center">
              <div className="text-3xl font-bold">1</div>
              <div className="text-xs text-white/70 mt-1 leading-tight">Snap a photo</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">2</div>
              <div className="text-xs text-white/70 mt-1 leading-tight">Describe issue</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">3</div>
              <div className="text-xs text-white/70 mt-1 leading-tight">Track to fix</div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
