import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AuthorityScreenType } from './AuthorityRouter';

interface ResolutionSubmittedScreenProps {
  onNavigate: (screen: AuthorityScreenType) => void;
}

export default function ResolutionSubmittedScreen({ onNavigate }: ResolutionSubmittedScreenProps) {
  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 font-sans p-6 justify-center items-center text-center">
      <CheckCircle2 className="h-16 w-16 text-[#0E9F6E] mb-6" />
      
      <h1 className="text-2xl font-bold tracking-tight mb-3">
        Resolution Submitted
      </h1>
      
      <p className="text-zinc-500 max-w-sm mb-10 text-[16px]">
        Citizens have 48 hours to confirm. You'll be notified of the outcome.
      </p>

      <button
        onClick={() => onNavigate('dashboard')}
        className="w-full max-w-xs h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg flex justify-center items-center"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
