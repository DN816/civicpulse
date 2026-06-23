import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';

interface SubmissionPendingScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function SubmissionPendingScreen({ reportId, onNavigate }: SubmissionPendingScreenProps) {
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    // Edge Case E3 - 90s timeout
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
      } else if (status === 'AWAITING_CLARIFICATION') {
        onNavigate('clarification', reportId);
      } else if (status === 'ASSIGNED' || status === 'IN_REVIEW') {
        // Backend changes status to ASSIGNED/IN_REVIEW instead of leaving it as NEW
        // Fetch cluster to check affected_count
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
              // Fallback
              onNavigate('new-report-confirmation', reportId);
            }
          } catch (e) {
            console.error("Failed to fetch cluster", e);
            onNavigate('new-report-confirmation', reportId);
          }
        } else {
          // Should not happen based on CF1
          onNavigate('new-report-confirmation', reportId);
        }
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [reportId, onNavigate]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 text-white font-sans gap-6 p-6 text-center">
      <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
      
      {!timeoutReached ? (
        <h2 className="text-xl font-medium tracking-tight animate-pulse">
          Analysing your photo...
        </h2>
      ) : (
        <div className="space-y-4 max-w-sm">
          <h2 className="text-xl font-medium tracking-tight text-amber-400">
            Analysis is taking longer than expected.
          </h2>
          <p className="text-zinc-400 text-sm">
            We'll notify you when it's ready. You can safely leave this screen.
          </p>
          <button 
            onClick={() => onNavigate('home')}
            className="mt-4 text-blue-400 underline font-medium hover:text-blue-300"
          >
            Back to Home
          </button>
        </div>
      )}
    </div>
  );
}
