import React from 'react';
import { Bell, ArrowLeft } from 'lucide-react';
import CivicPulseLogo from '../ui/CivicPulseLogo';

interface CitizenHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}

export default function CitizenHeader({ showBack, onBack, title, subtitle }: CitizenHeaderProps) {
  if (showBack) {
    return (
      <header className="sticky top-0 z-50 flex h-20 w-full shrink-0 items-center border-b-4 border-border bg-background px-4 shadow-[4px_4px_0_0_var(--cp-border)]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-surface-container transition-transform hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1"
          aria-label="Go back"
        >
          <ArrowLeft className="h-6 w-6 text-primary" />
        </button>
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-2">
          <CivicPulseLogo size="sm" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold uppercase tracking-tight text-primary">{title}</h1>
            {subtitle && <p className="truncate text-sm text-on-surface-variant">{subtitle}</p>}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 flex h-20 w-full shrink-0 items-center justify-between border-b-4 border-border bg-background px-4 shadow-[4px_4px_0_0_var(--cp-border)]">
      <CivicPulseLogo size="md" showWordmark wordmarkClassName="text-xl sm:text-2xl uppercase tracking-tighter" />
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-surface-container transition-transform hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1"
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6 text-text-primary" />
      </button>
    </header>
  );
}
