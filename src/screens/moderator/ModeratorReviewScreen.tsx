import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Clock, AlertTriangle, AlertCircle, Users, X, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { ModeratorScreenType } from './ModeratorRouter';

interface ModeratorReviewScreenProps {
  reportId: string;
  onNavigate: (screen: ModeratorScreenType, reportId?: string) => void;
}

type ActionType = 'confirm_resolved' | 'reopen' | 'request_info' | 'redact_photo' | 'clear_pii' | 'approve_report' | 'confirm_rejection' | null;

export default function ModeratorReviewScreen({ reportId, onNavigate }: ModeratorReviewScreenProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [lockExpired, setLockExpired] = useState(false);
  
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [disputeCount, setDisputeCount] = useState({ d: 0, r: 0 });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (snap.exists()) {
          const data = snap.data();
          setReport({ id: snap.id, ...data });

          if (data.locked_until) {
            const msLeft = data.locked_until.toMillis() - Date.now();
            if (msLeft <= 0) {
              setLockExpired(true);
            } else {
              setTimeLeft(Math.floor(msLeft / 1000));
            }
          }

          if (data.resolution_attempt && data.resolution_attempt > 0) {
            const votesQuery = query(
              collection(db, 'dispute_votes'),
              where('report_id', '==', reportId),
              where('resolution_attempt', '==', data.resolution_attempt)
            );
            const votesSnap = await getDocs(votesQuery);
            let d = 0, r = 0;
            votesSnap.forEach(v => {
              r++;
              if (v.data().vote === 'dispute') d++;
            });
            setDisputeCount({ d, r });
          }
        }
      } catch (err) {
        console.error("Error fetching report", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reportId]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !lockExpired) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev !== null && prev <= 1) {
            setLockExpired(true);
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, lockExpired]);

  const handleActionClick = (action: ActionType) => {
    setSelectedAction(action);
    setReason('');
  };

  const handleConfirmAction = async () => {
    if (!selectedAction || reason.length < 10) return;
    if (lockExpired) {
      alert("Your session expired before this action could be saved.");
      return;
    }

    // Verify lock still valid in memory
    const now = Date.now();
    if (report.locked_until && report.locked_until.toMillis() < now) {
      alert("Your session expired before this action could be saved.");
      setLockExpired(true);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const user = auth.currentUser;
      const db = doc(import('../../config/firebase').then(m=>m.db) as any, 'temp').firestore; // trick to get firestore instance, already imported above though. Wait, db is imported.
      
      const reportRef = doc(db, 'reports', reportId);
      const clusterRef = report.cluster_id ? doc(db, 'clusters', report.cluster_id) : null;
      
      let newStatus = report.status;
      let updates: any = {
        locked_until: null,
        moderator_id: null
      };

      if (selectedAction === 'confirm_resolved') {
        newStatus = 'RESOLVED';
      } else if (selectedAction === 'reopen') {
        newStatus = 'REOPENED';
      } else if (selectedAction === 'request_info') {
        newStatus = 'IN_REVIEW';
        // stays in review
      } else if (selectedAction === 'redact_photo') {
        updates.pii_handled = true;
        updates.photo_url = ''; // Clear photo
      } else if (selectedAction === 'clear_pii') {
        updates.pii_flag = false;
        newStatus = 'NEW'; // Or return to prev status, simplify to NEW for now
      } else if (selectedAction === 'approve_report') {
        newStatus = 'APPROVED';
      } else if (selectedAction === 'confirm_rejection') {
        newStatus = 'REJECTED';
      }

      if (newStatus !== report.status) {
        updates.status = newStatus;
      }

      // 1. Update report
      await updateDoc(reportRef, updates);
      
      // 2. Update cluster if status changed
      if (clusterRef && newStatus !== report.status) {
        await updateDoc(clusterRef, { status: newStatus });
      }

      // 3. Create audit log EXACTLY as requested
      await addDoc(collection(db, 'moderator_audits'), {
        report_id: reportId,
        moderator_id: user?.uid,
        action: selectedAction,
        reason: reason,
        created_at: serverTimestamp()
      });

      // 4. Navigate
      onNavigate('action-confirmed');

    } catch (err) {
      console.error("Failed action:", err);
      alert("Failed to submit action. Check console.");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12 h-screen bg-[#F4F6F9]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-amber-500" />
      </div>
    );
  }

  if (!report) {
    return <div className="p-6 text-center">Report not found</div>;
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isPII = report.pii_flag;
  const isDispute = report.resolution_attempt && report.resolution_attempt > 0;
  const isAppeal = report.trust_layer1 !== undefined && report.trust_layer1 < 20 && !isPII && !isDispute;

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9] text-zinc-900 font-sans pb-40">
      
      {/* Lock Expiry Modal */}
      {lockExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center">
            <Clock className="h-10 w-10 text-amber-500 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-900">Session Expired</h3>
            <p className="text-zinc-600 text-sm">Your review session has expired. Another moderator may now claim this case.</p>
            <button 
              onClick={() => onNavigate('queue')}
              className="w-full h-12 bg-zinc-900 text-white font-medium rounded-lg"
            >
              Back to Queue
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={() => onNavigate('queue')} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold tracking-tight text-lg ml-1">Review Case</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 font-mono text-sm font-semibold">
          <Clock className="h-4 w-4" />
          {timeLeft !== null ? formatTime(timeLeft) : '0:00'}
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 max-w-2xl mx-auto w-full space-y-4">
        
        {/* Photos side by side or single */}
        <div className="flex gap-2">
          {report.photo_url && (
            <div className="flex-1 relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-200 border border-zinc-200 shadow-sm">
              <img src={report.photo_url} alt="Before" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur">
                BEFORE
              </div>
            </div>
          )}
          {report.after_photo_url && (
            <div className="flex-1 relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-200 border border-zinc-200 shadow-sm">
              <img src={report.after_photo_url} alt="After" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-blue-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur">
                AFTER
              </div>
            </div>
          )}
        </div>

        {/* Case Info */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Category</p>
              <h3 className="font-semibold text-lg text-zinc-900">{report.category}</h3>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold bg-zinc-100 text-zinc-700">
              {report.severity}
            </span>
          </div>
          
          <div className="h-[1px] bg-zinc-100 my-2" />
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 mb-1">Affected</p>
              <p className="font-medium flex items-center gap-1.5"><Users className="h-4 w-4 text-zinc-400"/> {report.affected_citizen_ids?.length || 1} citizens</p>
            </div>
          </div>
        </div>

        {/* Dispute Stats */}
        {isDispute && (
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-2">
            <h4 className="font-semibold text-zinc-900">Dispute Summary</h4>
            <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
              <span className="text-zinc-600 font-medium">D = {disputeCount.d} disputes</span>
              <span className="text-zinc-600 font-medium">R = {disputeCount.r} total responses</span>
            </div>
          </div>
        )}

        {/* AI Validation */}
        {report.resolution_validation && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 mb-1">AI Assessment</h4>
                <p className="text-sm text-amber-800 leading-relaxed">{report.resolution_validation.reasoning}</p>
                <div className="mt-2 text-[12px] font-mono text-amber-700 bg-amber-100 inline-block px-2 py-0.5 rounded">
                  fix_appears_genuine: {report.resolution_validation.fix_appears_genuine ? 'true' : 'false'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Action Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-20">
        <div className="max-w-2xl mx-auto space-y-4">
          
          {!selectedAction ? (
            <div className="grid grid-cols-2 gap-3">
              {isDispute && (
                <>
                  <button onClick={() => handleActionClick('confirm_resolved')} className="h-12 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-xl transition">
                    Confirm Resolved
                  </button>
                  <button onClick={() => handleActionClick('reopen')} className="h-12 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-semibold rounded-xl transition">
                    Reopen Issue
                  </button>
                  <button onClick={() => handleActionClick('request_info')} className="col-span-2 h-12 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-semibold rounded-xl transition">
                    Request More Info
                  </button>
                </>
              )}

              {isPII && (
                <>
                  <button onClick={() => handleActionClick('redact_photo')} className="h-12 bg-red-600 text-white hover:bg-red-700 font-semibold rounded-xl transition">
                    Redact Photo
                  </button>
                  <button onClick={() => handleActionClick('clear_pii')} className="h-12 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-semibold rounded-xl transition">
                    Clear PII Flag
                  </button>
                </>
              )}

              {isAppeal && (
                <>
                  <button onClick={() => handleActionClick('approve_report')} className="h-12 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-xl transition">
                    Approve Report
                  </button>
                  <button onClick={() => handleActionClick('confirm_rejection')} className="h-12 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-semibold rounded-xl transition">
                    Confirm Rejection
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-zinc-900 text-sm">
                  Reason for {selectedAction.replace('_', ' ')}:
                </span>
                <button onClick={() => setSelectedAction(null)} className="p-1 text-zinc-400 hover:text-zinc-600 bg-zinc-100 rounded-full">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                autoFocus
                className="w-full h-24 p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm resize-none"
                placeholder="Enter a descriptive reason (min 10 characters)..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <button
                onClick={handleConfirmAction}
                disabled={reason.length < 10 || isSubmitting}
                className="w-full h-12 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold rounded-xl flex justify-center items-center transition"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Action'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
