import React from 'react';

export default function PlaceholderScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white font-sans p-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          CivicPulse
        </h1>
        <p className="text-zinc-400 font-mono text-sm bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 shadow-sm">
          Phase 0 Complete
        </p>
        <p className="text-xs text-zinc-500 font-sans leading-relaxed">
          The scaffolding and Firebase initialization are successfully completed.
        </p>
      </div>
    </div>
  );
}
