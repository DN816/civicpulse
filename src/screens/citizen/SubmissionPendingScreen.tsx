import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';
import Button from '../../components/ui/Button';
import Toast, { ToastType } from '../../components/ui/Toast';

interface SubmissionPendingScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function SubmissionPendingScreen({ reportId, onNavigate }: SubmissionPendingScreenProps) {
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 90000);

    const reportRef = doc(db, 'reports', reportId);

    const unsubscribe = onSnapshot(reportRef, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const status = data.status;

      if (status === 'REJECTED') {
        onNavigate('rejection', reportId);
      } else if (status === 'AWAITING_CLARIFICATION' || status === 'CLARIFICATION_NEEDED') {
        onNavigate('clarification', reportId);
      } else if (status === 'APPROVED') {
        onNavigate('new-report-confirmation', reportId);
      } else if (status === 'RESOLVED') {
        onNavigate('report-detail', reportId);
      } else if (status === 'ERROR') {
        if (data.error_message) {
          onNavigate('rejection', reportId);
        } else {
          setToast({ message: 'An error occurred processing your report. Please try again.', type: 'error' });
        }
      } else if (status === 'ASSIGNED' || status === 'IN_REVIEW') {
        if (data.cluster_id) {
          try {
            const clusterSnap = await getDoc(doc(db, 'clusters', data.cluster_id));
            if (clusterSnap.exists()) {
              const clusterData = clusterSnap.data();
              if (clusterData.affected_count >= 2) {
                onNavigate('clustered-confirmation', reportId);
              } else {
                onNavigate('new-report-confirmation', reportId);
              }
            } else {
              onNavigate('new-report-confirmation', reportId);
            }
          } catch {
            onNavigate('new-report-confirmation', reportId);
          }
        } else {
          onNavigate('new-report-confirmation', reportId);
        }
      }
    }, (error) => {
      setToast({ message: 'Could not load report status. Please try again.', type: 'error' });
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [reportId, onNavigate]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background p-6 text-center font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-border bg-primary-container">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>

      {!timeoutReached ? (
        <div className="game-card max-w-sm rounded-2xl p-8">
          <h2 className="font-display text-2xl font-bold text-primary animate-pulse">Analysing your photo...</h2>
          <p className="mt-2 text-sm text-on-surface-variant">This usually takes a few seconds.</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-sm">
          <h2 className="text-section-title text-status-warning">
            Analysis is taking longer than expected.
          </h2>
          <p className="text-body-md text-text-secondary">
            We'll notify you when it's ready. You can safely leave this screen.
          </p>
          <Button variant="text" onClick={() => onNavigate('home')}>
            Back to Home
          </Button>
        </div>
      )}
    </div>
  );
}
