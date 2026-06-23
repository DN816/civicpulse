import React from 'react';
import { LogOut, Shield } from 'lucide-react';
import { auth } from '../../config/firebase';

export default function AuthorityDashboardScreen() {
  const handleSignOut = async () => {
    await auth.signOut();
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 lg:px-16">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-emerald-500" />
          <span className="font-bold tracking-tight text-lg">CivicPulse</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center space-y-6 max-w-lg mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl space-y-4 w-full">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Authority Dashboard
          </h1>
          <p className="text-zinc-400 text-sm">
            Phase 7 screen placeholder. You have logged in successfully as an <span className="font-semibold text-emerald-400">Authority</span>.
          </p>
          <div className="h-[1px] bg-zinc-800 my-4" />
          <p className="text-xs text-zinc-500 font-mono">
            UID: {auth.currentUser?.uid}
          </p>
        </div>
      </main>
    </div>
  );
}
