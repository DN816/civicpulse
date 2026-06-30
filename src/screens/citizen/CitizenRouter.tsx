import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Map, SquarePlus, BarChart3, User, Medal } from 'lucide-react';
import CitizenHomeScreen from './CitizenHomeScreen';
import CitizenProfileScreen from './CitizenProfileScreen';
import CommunityMapScreen from './CommunityMapScreen';
import ReportScreen from './ReportScreen';
import SubmissionPendingScreen from './SubmissionPendingScreen';
import RejectionScreen from './RejectionScreen';
import ClarificationScreen from './ClarificationScreen';
import ClusteredConfirmationScreen from './ClusteredConfirmationScreen';
import NewReportConfirmationScreen from './NewReportConfirmationScreen';
import ReportDetailScreen from './ReportDetailScreen';
import CitizenBottomNav from '../../components/citizen/CitizenBottomNav';
import CivicPulseLogo from '../../components/ui/CivicPulseLogo';
import Toast, { ToastType } from '../../components/ui/Toast';
import { auth, db } from '../../config/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { BADGE_DEFINITIONS } from '../../types';

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

const SCREENS_REQUIRING_REPORT_ID: CitizenScreenType[] = [
  'submission-pending',
  'clarification',
  'clustered-confirmation',
  'new-report-confirmation',
  'report-detail',
  'rejection',
];

interface CitizenRouterProps {
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router') => void;
}

function SideNavButton({
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
        isActive
          ? 'border-border bg-secondary-container font-bold text-secondary shadow-[3px_3px_0_0_var(--cp-border)]'
          : 'border-transparent text-on-surface-variant hover:border-border hover:bg-surface-container-low'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-base">{label}</span>
    </button>
  );
}

export default function CitizenRouter({ onNavigateOut }: CitizenRouterProps) {
  const [currentScreen, setCurrentScreen] = useState<CitizenScreenType>('home');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const navigateTo = useCallback((screen: CitizenScreenType, reportId?: string) => {
    if (reportId !== undefined) {
      setActiveReportId(reportId);
    }
    setCurrentScreen(screen);
  }, []);

  /* ─── Celebratory popup listeners ─── */
  const lastXpEntryId = useRef<string | null>(null);
  const initialXpSnapshotDone = useRef(false);
  const lastBadgesJson = useRef<string>('[]');
  const initialBadgeSnapshotDone = useRef(false);
  const [badgeToast, setBadgeToast] = useState<{ badgeId: string } | null>(null);

  useEffect(() => {
    if (badgeToast) {
      const t = setTimeout(() => setBadgeToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [badgeToast]);

  useEffect(() => {
    if (SCREENS_REQUIRING_REPORT_ID.includes(currentScreen) && !activeReportId) {
      setToast({ message: 'Report not found. Returning to home.', type: 'error' });
      setCurrentScreen('home');
    }
  }, [currentScreen, activeReportId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubHistory = onSnapshot(
      query(collection(db, 'citizen_stats', uid, 'xp_history'), orderBy('created_at', 'desc'), limit(1)),
      (snap) => {
        if (snap.empty) return;
        const doc_ = snap.docs[0];
        /* Skip the initial snapshot to avoid replaying old entries as toasts */
        if (!initialXpSnapshotDone.current) {
          initialXpSnapshotDone.current = true;
          lastXpEntryId.current = doc_.id;
          return;
        }
        if (doc_.id === lastXpEntryId.current) return;
        lastXpEntryId.current = doc_.id;
        const data = doc_.data();
        const amount: number = data.amount ?? 0;
        if (amount > 0) {
          setToast({ message: `+${amount} XP — ${data.reason}`, type: 'success' });
        }
      }
    );

    const unsubStats = onSnapshot(doc(db, 'citizen_stats', uid), (snap) => {
      if (!snap.exists()) return;
      const badges: string[] = snap.data().badges ?? [];
      const badgesJson = JSON.stringify([...badges].sort());
      /* Skip the initial snapshot to avoid replaying old badge unlocks as popups */
      if (!initialBadgeSnapshotDone.current) {
        initialBadgeSnapshotDone.current = true;
        lastBadgesJson.current = badgesJson;
        return;
      }
      if (badgesJson === lastBadgesJson.current) return;
      const prevBadges: string[] = JSON.parse(lastBadgesJson.current);
      lastBadgesJson.current = badgesJson;
      const newBadges = badges.filter(id => !prevBadges.includes(id));
      const newBadgeDefs = newBadges.map(id => BADGE_DEFINITIONS.find(b => b.id === id)).filter(Boolean);
      for (const b of newBadgeDefs) {
        setBadgeToast({ badgeId: b!.id });
      }
    });

    return () => { unsubHistory(); unsubStats(); };
  }, []);

  const renderScreen = () => {
    if (SCREENS_REQUIRING_REPORT_ID.includes(currentScreen) && !activeReportId) {
      return null;
    }

    switch (currentScreen) {
      case 'home':
        return <CitizenHomeScreen onNavigate={navigateTo} onNavigateOut={onNavigateOut} />;
      case 'map':
        return <CommunityMapScreen />;
      case 'report':
        return <ReportScreen onNavigate={navigateTo} />;
      case 'profile':
        return <CitizenProfileScreen onNavigateOut={onNavigateOut} />;
      case 'submission-pending':
        return <SubmissionPendingScreen reportId={activeReportId!} onNavigate={navigateTo} />;
      case 'rejection':
        return <RejectionScreen reportId={activeReportId!} onNavigate={navigateTo} />;
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
  };

  const showNav = ['home', 'map', 'profile'].includes(currentScreen);

  return (
    <div className="flex min-h-screen w-full justify-center bg-background md:justify-start">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {badgeToast && (() => {
        const badgeDef = BADGE_DEFINITIONS.find(b => b.id === badgeToast.badgeId);
        if (!badgeDef) return null;
        return (
          <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 w-80 animate-bounce">
            <div className="rounded-xl border-4 border-primary bg-surface-container-lowest p-4 shadow-[6px_6px_0_0_var(--cp-border)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-primary-container">
                  <Medal className="h-5 w-5 text-primary-dark" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-primary">Badge Unlocked!</p>
                  <p className="text-sm font-bold text-text-primary">{badgeDef.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{badgeDef.description}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showNav && (
        <aside className="hidden min-h-screen w-56 shrink-0 flex-col gap-2 border-r-4 border-border bg-surface px-3 py-6 md:flex">
          <div className="mb-6 px-4">
            <CivicPulseLogo size="sm" showWordmark wordmarkClassName="text-lg uppercase tracking-tight" />
          </div>
          <SideNavButton label="Map" icon={Map} isActive={currentScreen === 'map'} onClick={() => navigateTo('map')} />
          <SideNavButton label="Report" icon={SquarePlus} isActive={false} onClick={() => navigateTo('report')} />
          <SideNavButton label="Tracking" icon={BarChart3} isActive={currentScreen === 'home'} onClick={() => navigateTo('home')} />
          <SideNavButton label="Profile" icon={User} isActive={currentScreen === 'profile'} onClick={() => navigateTo('profile')} />
        </aside>
      )}

      <div className="relative flex min-h-screen w-full max-w-[480px] flex-col overflow-x-hidden bg-background md:max-w-none md:flex-1">
        <div className="flex-1 overflow-y-auto">{renderScreen()}</div>
        {showNav && <CitizenBottomNav currentScreen={currentScreen} onNavigate={navigateTo} />}
      </div>
    </div>
  );
}
