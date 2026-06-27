import React, { useEffect, useState } from 'react';
import { LogOut, Shield, Clock, AlertTriangle, AlertCircle, SearchX } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ModeratorScreenType } from './ModeratorRouter';

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
  [key: string]: any;
}

export default function ModeratorQueueScreen({ onNavigate, onNavigateOut }: ModeratorQueueScreenProps) {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
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
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigateOut('welcome');
  };

  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case 'High': return 'bg-red-50 text-red-600 border-red-100';
      case 'Medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Low': return 'bg-green-50 text-green-600 border-green-100';
      default: return 'bg-zinc-50 text-zinc-600 border-zinc-100';
    }
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
      alert("This case is being reviewed by another moderator. Try again later.");
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
    } catch (err) {
      console.error("Failed to claim report:", err);
      alert("Error claiming report. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F9] text-zinc-900 font-sans pb-8">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-amber-500" />
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-lg leading-tight">Review Queue</span>
            {!loading && reports.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {reports.length}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6 max-w-4xl mx-auto w-full space-y-4">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-amber-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center shadow-sm mt-8">
            <SearchX className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900">Queue Empty</h3>
            <p className="text-zinc-500 mt-1">There are no reports currently needing moderation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const now = Date.now();
              const isLocked = report.locked_until && report.locked_until.toMillis() > now;
              const isLockedByOther = isLocked && report.moderator_id !== currentUser?.uid;
              
              const daysOpen = report.created_at ? Math.floor((now - report.created_at.toMillis()) / (1000 * 60 * 60 * 24)) : 0;
              const reasonTag = getReasonTag(report);
              const affectedCount = report.affected_citizen_ids?.length || 1;

              return (
                <div 
                  key={report.id}
                  onClick={() => handleClaim(report)}
                  className={`bg-white border border-zinc-200 rounded-xl p-4 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group relative overflow-hidden ${
                    isLockedByOther ? 'opacity-50' : ''
                  }`}
                >
                  {isLockedByOther && (
                    <div className="absolute top-2 right-2 bg-zinc-800 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider z-10 shadow-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Claimed
                    </div>
                  )}

                  {/* Row 1: Category & Severity */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-100 group-hover:bg-amber-50 transition-colors">
                        <AlertCircle className="h-5 w-5 text-zinc-600 group-hover:text-amber-600" />
                      </div>
                      <h4 className="font-semibold text-[16px] text-zinc-900">{report.category || 'Unknown Issue'}</h4>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border ${getSeverityColors(report.severity)}`}>
                      {report.severity || 'Medium'}
                    </span>
                  </div>

                  {/* Row 2: Reason Tag */}
                  <div className="mb-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-semibold ${reasonTag.color}`}>
                      {reasonTag.label}
                    </span>
                  </div>

                  {/* Row 3: Days Open */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100 text-[12px] text-zinc-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {daysOpen} {daysOpen === 1 ? 'day' : 'days'} open
                    </div>
                    <div>
                      {affectedCount} {affectedCount === 1 ? 'citizen' : 'citizens'} affected
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
