import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AuthorityScreenType } from './AuthorityRouter';
import Button from '../../components/ui/Button';

interface ResolutionSubmittedScreenProps {
  onNavigate: (screen: AuthorityScreenType) => void;
}

export default function ResolutionSubmittedScreen({ onNavigate }: ResolutionSubmittedScreenProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary font-sans p-6 justify-center items-center text-center">
      <CheckCircle2 className="h-16 w-16 text-accent mb-6" />
      
      <h1 className="text-screen-title mb-3">
        Resolution Submitted
      </h1>
      
      <p className="text-body-lg text-text-secondary max-w-sm mb-10">
        Citizens have 48 hours to confirm. You'll be notified of the outcome.
      </p>

      <Button onClick={() => onNavigate('dashboard')} fullWidth className="max-w-xs">
        Back to Dashboard
      </Button>
    </div>
  );
}
