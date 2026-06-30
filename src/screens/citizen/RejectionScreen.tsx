import React, { useEffect, useState } from 'react';
import { XCircle, RefreshCw, Home, Loader2 } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

interface RejectionScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType) => void;
}

export default function RejectionScreen({ reportId, onNavigate }: RejectionScreenProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReason = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.error_message) {
            setReason(data.error_message);
          } else if (data.status === 'REJECTED') {
            setReason("We couldn't identify a civic issue in this photo — try again with a clearer shot.");
          } else {
            setReason("We couldn't identify a civic issue in this photo — try again with a clearer shot.");
          }
        } else {
          setReason("We couldn't identify a civic issue in this photo — try again with a clearer shot.");
        }
      } catch {
        setReason("We couldn't identify a civic issue in this photo — try again with a clearer shot.");
      } finally {
        setLoading(false);
      }
    };
    fetchReason();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center font-sans">
      <Card variant="elevated" className="max-w-sm w-full space-y-6 flex flex-col items-center p-8">
        <div className="h-20 w-20 bg-severity-high-bg rounded-full flex items-center justify-center mb-2">
          <XCircle className="h-10 w-10 text-severity-high" />
        </div>

        <h2 className="text-screen-title text-text-primary">
          Issue Not Detected
        </h2>

        <p className="text-body-md text-text-secondary leading-relaxed">
          {reason}
        </p>

        <div className="w-full space-y-3 pt-4">
          <Button onClick={() => onNavigate('report')} fullWidth>
            <RefreshCw className="h-5 w-5" />
            Try Again
          </Button>

          <Button onClick={() => onNavigate('home')} variant="secondary" fullWidth>
            <Home className="h-5 w-5" />
            Go Home
          </Button>
        </div>
      </Card>
    </div>
  );
}
