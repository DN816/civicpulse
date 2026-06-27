import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ModeratorScreenType } from './ModeratorRouter';

interface ActionConfirmedScreenProps {
  onNavigate: (screen: ModeratorScreenType) => void;
}

export default function ActionConfirmedScreen({ onNavigate }: ActionConfirmedScreenProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9] text-zinc-900 font-sans p-6 justify-center items-center text-center">
      <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-6" />
      
      <h1 className="text-2xl font-bold tracking-tight mb-2">
        Action recorded.
      </h1>
      
      <p className="text-zinc-500 max-w-sm mb-10 text-sm">
        The issue has been updated successfully.
      </p>

      <button
        onClick={() => onNavigate('queue')}
        className="w-full max-w-xs h-12 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium rounded-lg flex justify-center items-center"
      >
        Back to Queue
      </button>
    </div>
  );
}
