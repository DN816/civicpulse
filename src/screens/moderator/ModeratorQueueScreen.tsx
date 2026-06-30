import React, { useEffect, useState } from 'react';
import { LogOut, Clock, AlertTriangle, AlertCircle, SearchX } from 'lucide-react';
import CivicPulseLogo from '../../components/ui/CivicPulseLogo';
import { auth, db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ModeratorScreenType } from './ModeratorRouter';
import Card from '../../components/ui/Card';
import SeverityBadge from '../../components/ui/SeverityBadge';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Button from '../../components/ui/Button';
import Toast, { ToastType } from '../../components/ui/Toast';

interface ModeratorQueueScreenProps {
  onNavigate: (screen: ModeratorScreenType, reportId?: string) => void;
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

interface ReportData {
  id: string;
  category: string;
  severity: 'High' | 'Medium' | 'Low';
  status: string;
  created_at: Timestamp;
  affected_citizen_ids?: string[];
  pii_flag?: boolean;
  trust_layer1?: number;
  locked_until?: Timestamp;
  moderator_id?: string;
  resolution_attempt?: number;
}

export default function ModeratorQueueScreen({ onNavigate, onNavigateOut }: ModeratorQueueScreenProps) {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'IN_REVIEW')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data: ReportData[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as ReportData);
      });

      // Client-side sort by created_at ascending (oldest first = highest days open)
      data.sort((a, b) => {
        const tA = a.created_at?.toMillis() || 0;
        const tB = b.created_at?.toMillis() || 0;
        return tA - tB;
      });

      setReports(data);
      setLoading(false);
    }, (error) => {
      setToast({ message: 'Could not load the review queue.', type: 'error' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigateOut('welcome');
  };



  const getReasonTag = (report: ReportData) => {
    if (report.pii_flag) return { label: 'PII Flag', color: 'bg-red-100 text-red-700' };
    if (report.resolution_attempt && report.resolution_attempt > 0) return { label: 'Dispute', color: 'bg-amber-100 text-amber-700' };
    if (report.trust_layer1 !== undefined && report.trust_layer1 < 20) return { label: 'Low Confidence', color: 'bg-zinc-100 text-zinc-700' };
    return { label: 'Manual Review', color: 'bg-blue-100 text-blue-700' };
  };

  const handleClaim = async (report: ReportData) => {
    if (!currentUser) return;
    const now = Date.now();
    const isLocked = report.locked_until && report.locked_until.toMillis() > now;
    const isLockedByOther = isLocked && report.moderator_id !== currentUser.uid;

    if (isLockedByOther) {
      setToast({ message: 'This case is being reviewed by another moderator. Try again later.', type: 'info' });
      return;
    }

    try {
      // Lock for 15 minutes
      const lockUntilDate = new Date(now + 15 * 60 * 1000);
      await updateDoc(doc(db, 'reports', report.id), {
        moderator_id: currentUser.uid,
        locked_until: Timestamp.fromDate(lockUntilDate)
      });
      onNavigate('review', report.id);
    } catch {
      setToast({ message: 'Error claiming report. Please try again.', type: 'error' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary font-sans pb-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <CivicPulseLogo size="sm" />
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-lg leading-tight">Review Queue</span>
            {!loading && reports.length > 0 && (
              <span className="bg-status-warning/10 text-status-warning text-[10px] font-bold px-2 py-0.5 rounded-full">
                {reports.length}
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={handleSignOut}
          variant="text"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6 w-full max-w-7xl mx-auto space-y-4">
        {loading ? (
          <SkeletonLoader />
        ) : reports.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-sm mt-8">
            <SearchX className="h-12 w-12 text-text-secondary mx-auto mb-4" />
            <h3 className="text-section-title text-text-primary">Queue Empty</h3>
            <p className="text-body-md text-text-secondary mt-1">There are no reports currently needing moderation.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => {
              const now = Date.now();
              const isLocked = report.locked_until && report.locked_until.toMillis() > now;
              const isLockedByOther = isLocked && report.moderator_id !== currentUser?.uid;
              
              const daysOpen = report.created_at ? Math.floor((now - report.created_at.toMillis()) / (1000 * 60 * 60 * 24)) : 0;
              const reasonTag = getReasonTag(report);
              const affectedCount = report.affected_citizen_ids?.length || 1;

              return (
                <Card 
                  key={report.id}
                  onClick={() => handleClaim(report)}
                  className={`cursor-pointer hover:border-status-warning/50 transition-all group relative overflow-hidden ${
                    isLockedByOther ? 'opacity-50' : ''
                  }`}
                >
                  {isLockedByOther && (
                    <div className="absolute top-2 right-2 bg-text-primary text-text-inverse text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider z-10 shadow-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Claimed
                    </div>
                  )}

                  {/* Row 1: Category & Severity */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-background rounded-lg border border-border group-hover:bg-status-warning/10 transition-colors">
                        <AlertCircle className="h-5 w-5 text-text-secondary group-hover:text-status-warning" />
                      </div>
                      <h4 className="text-body-lg font-semibold text-text-primary">{report.category || 'Unknown Issue'}</h4>
                    </div>
                    <SeverityBadge severity={report.severity || 'Medium'} />
                  </div>

                  {/* Row 2: Reason Tag */}
                  <div className="mb-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-caption font-semibold ${reasonTag.color}`}>
                      {reasonTag.label}
                    </span>
                  </div>

                  {/* Row 3: Days Open */}
                  <div className="flex items-center justify-between pt-3 border-t border-border text-caption text-text-secondary font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {daysOpen} {daysOpen === 1 ? 'day' : 'days'} open
                    </div>
                    <div>
                      {affectedCount} {affectedCount === 1 ? 'citizen' : 'citizens'} affected
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
