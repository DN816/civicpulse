import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Home, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Toast, { ToastType } from '../../components/ui/Toast';
import { FirestoreReport } from '../../types';
import { reverseGeocode } from '../../utils/nominatim';

interface NewReportConfirmationScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function NewReportConfirmationScreen({ reportId, onNavigate }: NewReportConfirmationScreenProps) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<FirestoreReport | null>(null);
  const [address, setAddress] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (snap.exists()) {
          const data = snap.data();
          setReportData(data);
          
          if (data.lat && data.lng) {
            setAddress(await reverseGeocode(data.lat, data.lng));
          }
        }
      } catch (e) {
        setToast({ message: 'Could not load report confirmation details.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const severityColor = 
    reportData?.severity === 'High' ? 'text-severity-high bg-severity-high-bg border-severity-high/20' :
    reportData?.severity === 'Medium' ? 'text-status-warning bg-status-warning/10 border-status-warning/20' :
    'text-status-success bg-severity-low-bg border-status-success/20';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Card variant="elevated" className="gamified-card gamified-shadow max-w-sm w-full space-y-6 flex flex-col items-center p-8 bg-surface-container-lowest">
        
        <div className="h-20 w-20 bg-severity-low-bg rounded-full flex items-center justify-center mb-2">
          <CheckCircle2 className="h-10 w-10 text-status-success" />
        </div>
        
        <h2 className="font-display text-3xl font-bold text-text-primary">
          Report Received
        </h2>
        
        <p className="text-body-md text-text-secondary leading-relaxed">
          Your report has been received. We'll notify you when it's resolved.
        </p>

        {reportData && (
          <div className="w-full bg-surface rounded-2xl p-4 border border-border text-left space-y-3">
            <div>
              <p className="text-caption text-text-secondary uppercase tracking-wider">Category</p>
              <p className="font-medium text-text-primary">{reportData.category}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption text-text-secondary uppercase tracking-wider">Severity</p>
                <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${severityColor}`}>
                  <AlertTriangle className="h-3 w-3" />
                  {reportData.severity}
                </div>
              </div>
            </div>

            <div>
              <p className="text-caption text-text-secondary uppercase tracking-wider">Location</p>
              <div className="flex items-start gap-2 mt-1">
                <MapPin className="h-4 w-4 text-text-secondary shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-text-primary line-clamp-2">{address}</p>
              </div>
            </div>
          </div>
        )}
        
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
