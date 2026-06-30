import React, { useState, useCallback, useEffect } from 'react';
import ModeratorQueueScreen from './ModeratorQueueScreen';
import ModeratorReviewScreen from './ModeratorReviewScreen';
import ActionConfirmedScreen from './ActionConfirmedScreen';
import Toast, { ToastType } from '../../components/ui/Toast';

export type ModeratorScreenType = 'queue' | 'review' | 'action-confirmed';

interface ModeratorRouterProps {
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function ModeratorRouter({ onNavigateOut }: ModeratorRouterProps) {
  const [currentScreen, setCurrentScreen] = useState<ModeratorScreenType>('queue');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const navigateTo = useCallback((screen: ModeratorScreenType, reportId?: string) => {
    if (reportId !== undefined) {
      setActiveReportId(reportId);
    }
    setCurrentScreen(screen);
  }, []);

  useEffect(() => {
    if (currentScreen === 'review' && !activeReportId) {
      setToast({ message: 'Report not found. Returning to queue.', type: 'error' });
      setCurrentScreen('queue');
    }
  }, [currentScreen, activeReportId]);

  if (currentScreen === 'review' && !activeReportId) {
    return (
      <>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    );
  }

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
