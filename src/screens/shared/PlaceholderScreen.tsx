import React from 'react';
import Card from '../../components/ui/Card';

export default function PlaceholderScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background text-text-primary font-sans p-6">
      <Card className="text-center space-y-4 max-w-md w-full">
        <h1 className="text-screen-title text-text-primary">
          CivicPulse
        </h1>
        <p className="text-body-md font-mono text-text-secondary bg-surface border border-border rounded-lg py-3 px-4 shadow-sm">
          Phase 0 Complete
        </p>
        <p className="text-caption text-text-secondary leading-relaxed">
          The scaffolding and Firebase initialization are successfully completed.
        </p>
      </Card>
    </div>
  );
}
