import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Clock, AlertTriangle, Users, X } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ModeratorScreenType } from './ModeratorRouter';
import { Report, ReportStatus } from '../../types';
import { reportStatusToClusterStatus } from '../../utils/clusterStatus';
import Card from '../../components/ui/Card';
import SeverityBadge from '../../components/ui/SeverityBadge';
import Button from '../../components/ui/Button';
import FormInput from '../../components/ui/FormInput';
import Toast, { ToastType } from '../../components/ui/Toast';

interface ModeratorReviewScreenProps {
  reportId: string;
  onNavigate: (screen: ModeratorScreenType, reportId?: string) => void;
}

type ActionType = 'confirm_resolved' | 'reopen' | 'request_info' | 'redact_photo' | 'clear_pii' | 'approve_report' | 'confirm_rejection' | null;

export default function ModeratorReviewScreen({ reportId, onNavigate }: ModeratorReviewScreenProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [lockExpired, setLockExpired] = useState(false);
  
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (snap.exists()) {
          const data = snap.data();
          setReport({ id: snap.id, ...data } as Report);

          if (data.locked_until) {
            const msLeft = data.locked_until.toMillis() - Date.now();
            if (msLeft <= 0) {
              setLockExpired(true);
            } else {
              setTimeLeft(Math.floor(msLeft / 1000));
            }
          }

        }
      } catch (err) {
        setToast({ message: 'Could not load report for review.', type: 'error' });
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
    if (!report || !selectedAction || reason.length < 10) return;
    if (lockExpired) {
      setToast({ message: 'Your session expired before this action could be saved.', type: 'error' });
      return;
    }

    const now = Date.now();
    if (report.locked_until && report.locked_until.toMillis() < now) {
      setToast({ message: 'Your session expired before this action could be saved.', type: 'error' });
      setLockExpired(true);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const user = auth.currentUser;
      
      const reportRef = doc(db, 'reports', reportId);
      const clusterRef = report.cluster_id ? doc(db, 'clusters', report.cluster_id) : null;
      
      let newStatus: ReportStatus = report.status;
      const updates: Record<string, unknown> = {
        locked_until: null,
        moderator_id: null,
      };

      if (selectedAction === 'confirm_resolved') {
        newStatus = 'RESOLVED';
      } else if (selectedAction === 'reopen') {
        newStatus = 'REOPENED';
      } else if (selectedAction === 'request_info') {
        newStatus = 'IN_REVIEW';
      } else if (selectedAction === 'redact_photo') {
        updates.pii_handled = true;
        updates.photo_url = '';
      } else if (selectedAction === 'clear_pii') {
        updates.pii_flag = false;
        newStatus = 'NEW';
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
        await updateDoc(clusterRef, {
          status: reportStatusToClusterStatus(newStatus),
          updated_at: serverTimestamp(),
        });
      }

      // 3. Create audit log
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
      setToast({ message: 'Failed to submit action. Please try again.', type: 'error' });
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-status-warning" />
      </div>
    );
  }

  if (!report) {
    return <div className="p-6 text-center text-text-secondary">Report not found</div>;
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isPII = report.pii_flag;
  const isAppeal = report.trust_layer1 !== undefined && report.trust_layer1 < 20 && !isPII;

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary font-sans pb-40">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      
      {/* Lock Expiry Modal */}
      {lockExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card variant="elevated" className="w-full max-w-sm space-y-4 text-center p-6">
            <Clock className="h-10 w-10 text-status-warning mx-auto" />
            <h3 className="text-section-title text-text-primary">Session Expired</h3>
            <p className="text-body-md text-text-secondary">Your review session has expired. Another moderator may now claim this case.</p>
            <Button onClick={() => onNavigate('queue')} fullWidth>
              Back to Queue
            </Button>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <Button variant="icon" onClick={() => onNavigate('queue')} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-section-title ml-1">Review Case</span>
        </div>
        <div className="flex items-center gap-1.5 bg-status-warning/10 text-status-warning px-3 py-1.5 rounded-lg border border-status-warning/20 font-mono text-sm font-semibold">
          <Clock className="h-4 w-4" />
          {timeLeft !== null ? formatTime(timeLeft) : '0:00'}
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 max-w-2xl mx-auto w-full space-y-4">
        
        {/* Photos side by side or single */}
        <div className="flex gap-2">
          {report.photo_url && (
            <div className="flex-1 relative aspect-[4/3] rounded-xl overflow-hidden bg-background border border-border shadow-sm">
              <img src={report.photo_url} alt="Before" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-black/60 text-text-inverse text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur">
                BEFORE
              </div>
            </div>
          )}
          {report.after_photo_url && (
            <div className="flex-1 relative aspect-[4/3] rounded-xl overflow-hidden bg-background border border-border shadow-sm">
              <img src={report.after_photo_url} alt="After" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-primary/80 text-text-inverse text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur">
                AFTER
              </div>
            </div>
          )}
        </div>

        {/* Case Info */}
        <Card className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-1">Category</p>
              <h3 className="text-section-title text-text-primary">{report.category}</h3>
            </div>
            <SeverityBadge severity={report.severity} />
          </div>
          
          <div className="h-px bg-border my-2" />
          
          <div className="grid grid-cols-2 gap-4 text-body-md">
            <div>
              <p className="text-text-secondary mb-1">Affected</p>
              <p className="font-medium flex items-center gap-1.5"><Users className="h-4 w-4 text-text-secondary"/> {report.affected_citizen_ids?.length || 1} citizens</p>
            </div>
          </div>
        </Card>

        {/* AI Validation */}
        {report.resolution_validation && (
          <div className="bg-status-warning/10 border border-status-warning/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-status-warning shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-text-primary mb-1">AI Assessment</h4>
                <p className="text-body-md text-text-secondary leading-relaxed">{report.resolution_validation.reasoning}</p>
                <div className="mt-2 text-caption font-mono text-status-warning bg-status-warning/10 inline-block px-2 py-0.5 rounded">
                  fix_appears_genuine: {report.resolution_validation.fix_appears_genuine ? 'true' : 'false'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Action Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-20">
        <div className="max-w-2xl mx-auto space-y-4">
          
          {!selectedAction ? (
            <div className="grid grid-cols-2 gap-3">
              {isPII && (
                <>
                  <Button onClick={() => handleActionClick('redact_photo')} variant="destructive">
                    Redact Photo
                  </Button>
                  <Button onClick={() => handleActionClick('clear_pii')} variant="secondary">
                    Clear PII Flag
                  </Button>
                </>
              )}

              {isAppeal && (
                <>
                  <Button onClick={() => handleActionClick('approve_report')} variant="secondary" className="!border-status-success !text-status-success !bg-status-success/5 hover:!bg-status-success/10">
                    Approve Report
                  </Button>
                  <Button onClick={() => handleActionClick('confirm_rejection')} variant="destructive">
                    Confirm Rejection
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-label text-text-primary">
                  Reason for {selectedAction.replace(/_/g, ' ')}:
                </span>
                <Button variant="icon" onClick={() => setSelectedAction(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <FormInput
                isTextArea
                autoFocus
                placeholder="Enter a descriptive reason (min 10 characters)..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <Button
                onClick={handleConfirmAction}
                disabled={reason.length < 10 || isSubmitting}
                fullWidth
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Action'}
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
