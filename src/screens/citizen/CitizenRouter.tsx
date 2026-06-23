import React, { useState } from 'react';
import CitizenHomeScreen from './CitizenHomeScreen';
import ReportScreen from './ReportScreen';
import SubmissionPendingScreen from './SubmissionPendingScreen';
import RejectionScreen from './RejectionScreen';
import ClarificationScreen from './ClarificationScreen';
import ClusteredConfirmationScreen from './ClusteredConfirmationScreen';
import NewReportConfirmationScreen from './NewReportConfirmationScreen';
import ReportDetailScreen from './ReportDetailScreen';

export type CitizenScreenType = 
  | 'home' 
  | 'map' 
  | 'report' 
  | 'profile' 
  | 'submission-pending'
  | 'rejection'
  | 'clarification'
  | 'clustered-confirmation'
  | 'new-report-confirmation'
  | 'report-detail';

interface CitizenRouterProps {
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router') => void;
}

export default function CitizenRouter({ onNavigateOut }: CitizenRouterProps) {
  const [currentScreen, setCurrentScreen] = useState<CitizenScreenType>('home');
  // State for passing data between screens
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const navigateTo = (screen: CitizenScreenType, reportId?: string) => {
    if (reportId !== undefined) {
      setActiveReportId(reportId);
    }
    setCurrentScreen(screen);
  };

  switch (currentScreen) {
    case 'home':
      return <CitizenHomeScreen onNavigate={navigateTo} onNavigateOut={onNavigateOut} />;
    case 'map':
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-800">
          <h2 className="text-2xl font-semibold mb-4">Map — Phase 9</h2>
          <button onClick={() => navigateTo('home')} className="text-blue-600 underline">Back to Home</button>
        </div>
      );
    case 'report':
      return <ReportScreen onNavigate={navigateTo} />;
    case 'profile':
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-800">
          <h2 className="text-2xl font-semibold mb-4">Profile — Phase 9</h2>
          <button onClick={() => navigateTo('home')} className="text-blue-600 underline">Back to Home</button>
        </div>
      );
    case 'submission-pending':
      return <SubmissionPendingScreen reportId={activeReportId!} onNavigate={navigateTo} />;
    case 'rejection':
      return <RejectionScreen onNavigate={navigateTo} />;
    case 'clarification':
      return <ClarificationScreen reportId={activeReportId!} onNavigate={navigateTo} />;
    case 'clustered-confirmation':
      return <ClusteredConfirmationScreen reportId={activeReportId!} onNavigate={navigateTo} />;
    case 'new-report-confirmation':
      return <NewReportConfirmationScreen reportId={activeReportId!} onNavigate={navigateTo} />;
    case 'report-detail':
      return <ReportDetailScreen reportId={activeReportId!} onNavigate={navigateTo} />;
    default:
      return <CitizenHomeScreen onNavigate={navigateTo} onNavigateOut={onNavigateOut} />;
  }
}
