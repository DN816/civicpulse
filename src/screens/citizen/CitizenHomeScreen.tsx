import React, { useEffect, useMemo, useState } from 'react';
import { LogOut, MapPin, Plus, ShieldCheck, Wrench, PartyPopper, ArrowRight, Star, Camera } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';
import CitizenHeader from '../../components/citizen/CitizenHeader';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Toast, { ToastType } from '../../components/ui/Toast';

interface CitizenHomeScreenProps {
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router') => void;
}

interface ReportActivity {
  id: string;
  status: string;
  category?: string;
  description?: string;
  photo_url?: string;
  after_photo_url?: string;
  created_at?: Timestamp;
}

type FilterType = 'all' | 'active' | 'resolved';

function getProgressPercent(status: string): number {
  const s = status?.toUpperCase();
  if (s === 'RESOLVED') return 100;
  if (['IN_REVIEW'].includes(s)) return 75;
  if (['ASSIGNED', 'APPROVED', 'IN_PROGRESS'].includes(s)) return 50;
  return 25;
}

function getStatusChip(status: string): { label: string; className: string } {
  const s = status?.toUpperCase();
  if (s === 'RESOLVED') {
    return { label: 'Resolved', className: 'bg-primary text-text-inverse border-border' };
  }
  if (['ASSIGNED', 'IN_REVIEW', 'IN_PROGRESS', 'APPROVED'].includes(s)) {
    return { label: 'In Progress', className: 'bg-secondary-container text-secondary border-border' };
  }
  if (['NEW', 'AWAITING_CLARIFICATION'].includes(s)) {
    return { label: 'Scheduled', className: 'bg-tertiary-container text-tertiary border-border' };
  }
  return { label: 'Pending', className: 'bg-surface-container text-on-surface-variant border-border' };
}

const STEPS = [
  { label: 'Reported', icon: Plus },
  { label: 'Verified', icon: ShieldCheck },
  { label: 'Dispatched', icon: Wrench },
  { label: 'Resolved', icon: PartyPopper },
];

export default function CitizenHomeScreen({ onNavigate, onNavigateOut }: CitizenHomeScreenProps) {
  const [reports, setReports] = useState<ReportActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'reports'), where('citizen_id', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: ReportActivity[] = [];
        snapshot.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...docSnap.data() } as ReportActivity);
        });
        data.sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));
        setReports(data);
        setLoading(false);
      },
      () => {
        setToast({ message: 'Could not load your reports. Please try again.', type: 'error' });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const filteredReports = useMemo(() => {
    if (filter === 'all') return reports;
    if (filter === 'resolved') return reports.filter((r) => r.status?.toUpperCase() === 'RESOLVED');
    return reports.filter((r) => r.status?.toUpperCase() !== 'RESOLVED');
  }, [reports, filter]);

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigateOut('welcome');
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All Reports' },
    { id: 'active', label: 'In Progress' },
    { id: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-36 font-sans text-text-primary">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <CitizenHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-text-primary">Progress Tracker</h2>
            <p className="mt-1 text-base text-on-surface-variant">
              Level up your community! Track the status of active reports below.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-text-primary sm:flex"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

        <div className="scrollbar-hide mb-8 flex gap-3 overflow-x-auto pb-2">
          {filters.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-xl border-2 border-border px-6 py-2 text-sm font-bold shadow-[3px_3px_0_0_var(--cp-border)] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                filter === id
                  ? 'bg-primary text-text-inverse'
                  : 'bg-surface-container-lowest text-text-primary hover:bg-surface-container-high'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonLoader />
        ) : filteredReports.length === 0 ? (
          <div className="gamified-card gamified-shadow flex flex-col items-center bg-surface-container-lowest p-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-primary-container">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-bold">No Reports Yet</h3>
            <p className="mt-2 text-sm text-on-surface-variant">Start your first quest and earn Hero XP.</p>
            <button
              type="button"
              onClick={() => onNavigate('report')}
              className="neo-3d mt-6 flex h-12 items-center gap-2 rounded-xl border-4 border-border bg-primary px-6 font-bold text-text-inverse"
            >
              <Plus className="h-5 w-5" />
              Report an Issue
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredReports.map((report) => {
              const progress = getProgressPercent(report.status);
              const chip = getStatusChip(report.status);
              const isResolved = report.status?.toUpperCase() === 'RESOLVED';
              const activeStep = Math.min(4, Math.ceil(progress / 25));

              return (
                <article
                  key={report.id}
                  className={`gamified-card gamified-shadow bg-surface-container-lowest p-6 transition-transform hover:-translate-y-1 ${
                    isResolved ? 'opacity-90' : ''
                  }`}
                >
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-xl font-semibold text-text-primary">
                        {report.category || 'Issue Reported'}
                      </h3>
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-on-surface-variant">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">{report.description || 'Community report'}</span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg border-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${chip.className}`}
                    >
                      {chip.label}
                    </span>
                  </div>

                  {report.photo_url && (
                    <div className="mb-4 flex gap-2">
                      <div className="relative w-20 h-16 shrink-0 rounded-lg overflow-hidden border border-border bg-background">
                        <img src={report.photo_url} alt="Before" className="w-full h-full object-cover" />
                        {report.after_photo_url && (
                          <div className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[8px] font-bold px-1 rounded">
                            BEFORE
                          </div>
                        )}
                      </div>
                      {report.after_photo_url && (
                        <div className="relative w-20 h-16 shrink-0 rounded-lg overflow-hidden border border-border bg-background">
                          <img src={report.after_photo_url} alt="After" className="w-full h-full object-cover" />
                          <div className="absolute bottom-0.5 left-0.5 bg-status-success text-white text-[8px] font-bold px-1 rounded">
                            AFTER
                          </div>
                        </div>
                      )}
                      {!report.after_photo_url && (
                        <div className="flex items-center gap-1.5 text-caption text-on-surface-variant">
                          <Camera className="h-3.5 w-3.5" />
                          Issue photo
                        </div>
                      )}
                    </div>
                  )}

                  {isResolved ? (
                    <div className="mb-4 flex items-center gap-4 rounded-xl border-2 border-border bg-primary-container p-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-border bg-primary">
                        <Star className="h-6 w-6 text-text-inverse" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary-dark">Quest Complete!</p>
                        <p className="text-xs text-on-surface-variant">You helped improve the neighborhood.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative mb-8 pt-2">
                      <div className="absolute left-0 top-5 h-2 w-full rounded-full border-2 border-border bg-surface-container" />
                      <div
                        className="absolute left-0 top-5 h-2 rounded-full border-2 border-r-0 border-border bg-primary-container"
                        style={{ width: `${Math.max(progress, 8)}%` }}
                      />
                      <div className="relative flex justify-between">
                        {STEPS.map((step, index) => {
                          const stepNum = index + 1;
                          const isDone = activeStep > stepNum;
                          const isCurrent = activeStep === stepNum;
                          const Icon = step.icon;
                          return (
                            <div key={step.label} className="flex flex-col items-center">
                              <div
                                className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border ${
                                  isDone || isCurrent
                                    ? 'bg-primary text-text-inverse'
                                    : 'bg-surface-container-lowest text-on-surface-variant'
                                } ${isCurrent ? 'animate-pulse bg-primary-container text-primary-dark' : ''}`}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <span
                                className={`mt-2 text-xs font-bold ${
                                  isDone || isCurrent ? 'text-primary' : 'font-medium text-on-surface-variant'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t-2 border-surface-container pt-4">
                    <span className="text-sm font-bold text-text-primary">
                      {report.created_at
                        ? new Date(report.created_at.toMillis()).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('report-detail', report.id)}
                      className="neo-3d flex items-center gap-1 rounded-lg border-2 border-border bg-primary px-4 py-2 text-sm font-bold text-text-inverse"
                    >
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => onNavigate('report')}
        aria-label="Report an issue"
        className="fixed bottom-28 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-border bg-secondary-container text-secondary shadow-[6px_6px_0_0_var(--cp-border)] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none md:hidden"
      >
        <Plus className="h-8 w-8" />
      </button>
    </div>
  );
}
