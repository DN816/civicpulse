import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ModeratorScreenType } from './ModeratorRouter';
import Button from '../../components/ui/Button';

interface ActionConfirmedScreenProps {
  onNavigate: (screen: ModeratorScreenType) => void;
}

export default function ActionConfirmedScreen({ onNavigate }: ActionConfirmedScreenProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary font-sans p-6 justify-center items-center text-center">
      <CheckCircle2 className="h-16 w-16 text-status-success mb-6" />
      
      <h1 className="text-screen-title mb-2">
        Action recorded.
      </h1>
      
      <p className="text-body-md text-text-secondary max-w-sm mb-10">
        The issue has been updated successfully.
      </p>

      <Button onClick={() => onNavigate('queue')} fullWidth className="max-w-xs">
        Back to Queue
      </Button>
    </div>
  );
}
