import React from 'react';
import { XCircle, RefreshCw, Home } from 'lucide-react';
import { CitizenScreenType } from './CitizenRouter';

interface RejectionScreenProps {
  onNavigate: (screen: CitizenScreenType) => void;
}

export default function RejectionScreen({ onNavigate }: RejectionScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-6 border border-zinc-100 flex flex-col items-center">
        <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-2">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
          Issue Not Detected
        </h2>
        
        <p className="text-zinc-500 text-sm leading-relaxed">
          We couldn't identify a civic issue in this photo — try again with a clearer shot.
        </p>
        
        <div className="w-full space-y-3 pt-4">
          <button
            onClick={() => onNavigate('report')}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-sm"
          >
            <RefreshCw className="h-5 w-5" />
            Try Again
          </button>
          
          <button
            onClick={() => onNavigate('home')}
            className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-700 py-4 rounded-xl font-bold hover:bg-zinc-200 transition"
          >
            <Home className="h-5 w-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
