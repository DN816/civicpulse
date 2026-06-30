import React, { useState, useCallback, useEffect } from 'react';
import AuthorityDashboardScreen from './AuthorityDashboardScreen';
import IssueDetailScreen from './IssueDetailScreen';
import MarkResolvedScreen from './MarkResolvedScreen';
import ResolutionSubmittedScreen from './ResolutionSubmittedScreen';
import MetricsScreen from './MetricsScreen';
import Toast, { ToastType } from '../../components/ui/Toast';

export type AuthorityScreenType =
  | 'dashboard'
  | 'issue-detail'
  | 'mark-resolved'
  | 'resolution-submitted'
  | 'metrics';

const SCREENS_REQUIRING_CLUSTER_ID: AuthorityScreenType[] = [
  'issue-detail',
  'mark-resolved',
];

interface AuthorityRouterProps {
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function AuthorityRouter({ onNavigateOut }: AuthorityRouterProps) {
  const [currentScreen, setCurrentScreen] = useState<AuthorityScreenType>('dashboard');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const navigateTo = useCallback((screen: AuthorityScreenType, clusterId?: string) => {
    if (clusterId !== undefined) {
      setActiveClusterId(clusterId);
    }
    setCurrentScreen(screen);
  }, []);

  useEffect(() => {
    if (SCREENS_REQUIRING_CLUSTER_ID.includes(currentScreen) && !activeClusterId) {
      setToast({ message: 'Issue not found. Returning to dashboard.', type: 'error' });
      setCurrentScreen('dashboard');
    }
  }, [currentScreen, activeClusterId]);

  if (SCREENS_REQUIRING_CLUSTER_ID.includes(currentScreen) && !activeClusterId) {
    return (
      <>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    );
  }

  switch (currentScreen) {
    case 'dashboard':
      return <AuthorityDashboardScreen onNavigate={navigateTo} onNavigateOut={onNavigateOut} />;
    case 'issue-detail':
      return <IssueDetailScreen clusterId={activeClusterId!} onNavigate={navigateTo} />;
    case 'mark-resolved':
      return <MarkResolvedScreen clusterId={activeClusterId!} onNavigate={navigateTo} />;
    case 'resolution-submitted':
      return <ResolutionSubmittedScreen onNavigate={navigateTo} />;
    case 'metrics':
      return <MetricsScreen onNavigate={navigateTo} />;
    default:
      return <AuthorityDashboardScreen onNavigate={navigateTo} onNavigateOut={onNavigateOut} />;
  }
}
