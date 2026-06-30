import React, { useEffect, useState } from 'react';
import { CheckCircle2, Users, FileText, Home, Loader2 } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

interface ClusteredConfirmationScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function ClusteredConfirmationScreen({ reportId, onNavigate }: ClusteredConfirmationScreenProps) {
  const [loading, setLoading] = useState(true);
  const [affectedCount, setAffectedCount] = useState(2);

  useEffect(() => {
    const fetchClusterData = async () => {
      try {
        const reportSnap = await getDoc(doc(db, 'reports', reportId));
        if (reportSnap.exists() && reportSnap.data().cluster_id) {
          const clusterSnap = await getDoc(doc(db, 'clusters', reportSnap.data().cluster_id));
          if (clusterSnap.exists()) {
            setAffectedCount(clusterSnap.data().affected_count || 1);
          }
        }
      } catch {
        // Fall back to default affected count
      } finally {
        setLoading(false);
      }
    };
    fetchClusterData();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const message = affectedCount === 1 
    ? "Your report has been received. We'll notify you when it's resolved."
    : `You've been added to an existing report. ${affectedCount - 1} other citizen(s) have also reported this.`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center font-sans">
      <Card variant="elevated" className="gamified-card gamified-shadow max-w-sm w-full space-y-6 flex flex-col items-center p-8 bg-surface-container-lowest">
        
        <div className="relative">
          <div className="h-20 w-20 bg-severity-low-bg rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="h-10 w-10 text-status-success" />
          </div>
          {affectedCount > 1 && (
            <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center border-4 border-surface">
              <Users className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
        
        <h2 className="font-display text-3xl font-bold text-text-primary">
          Report Received
        </h2>
        
        <p className="text-body-md text-text-secondary leading-relaxed">
          {message}
        </p>
        
        <div className="w-full space-y-3 pt-4">
          <Button onClick={() => onNavigate('report-detail', reportId)} fullWidth>
            <FileText className="h-5 w-5" />
            View Report
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
