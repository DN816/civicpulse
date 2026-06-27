import React, { useState } from 'react';
import ModeratorQueueScreen from './ModeratorQueueScreen';
import ModeratorReviewScreen from './ModeratorReviewScreen';
import ActionConfirmedScreen from './ActionConfirmedScreen';

export type ModeratorScreenType = 'queue' | 'review' | 'action-confirmed';

interface ModeratorRouterProps {
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function ModeratorRouter({ onNavigateOut }: ModeratorRouterProps) {
  const [currentScreen, setCurrentScreen] = useState<ModeratorScreenType>('queue');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const navigateTo = (screen: ModeratorScreenType, reportId?: string) => {
    if (reportId !== undefined) {
      setActiveReportId(reportId);
    }
    setCurrentScreen(screen);
  };

  switch (currentScreen) {
    case 'queue':
      return <ModeratorQueueScreen onNavigate={navigateTo} onNavigateOut={onNavigateOut} />;
    case 'review':
      return <ModeratorReviewScreen reportId={activeReportId!} onNavigate={navigateTo} />;
    case 'action-confirmed':
      return <ActionConfirmedScreen onNavigate={navigateTo} />;
    default:
      return <ModeratorQueueScreen onNavigate={navigateTo} onNavigateOut={onNavigateOut} />;
  }
}
