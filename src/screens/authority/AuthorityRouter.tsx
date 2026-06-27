import React, { useState } from 'react';
import AuthorityDashboardScreen from './AuthorityDashboardScreen';
import IssueDetailScreen from './IssueDetailScreen';
import MarkResolvedScreen from './MarkResolvedScreen';
import ResolutionSubmittedScreen from './ResolutionSubmittedScreen';
import MetricsScreen from './MetricsScreen';

export type AuthorityScreenType =
  | 'dashboard'
  | 'issue-detail'
  | 'mark-resolved'
  | 'resolution-submitted'
  | 'metrics';

interface AuthorityRouterProps {
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function AuthorityRouter({ onNavigateOut }: AuthorityRouterProps) {
  const [currentScreen, setCurrentScreen] = useState<AuthorityScreenType>('dashboard');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);

  const navigateTo = (screen: AuthorityScreenType, clusterId?: string) => {
    if (clusterId !== undefined) {
      setActiveClusterId(clusterId);
    }
    setCurrentScreen(screen);
  };

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
