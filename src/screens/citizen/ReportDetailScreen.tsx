import React, { useEffect, useState } from 'react';
import { MapPin, Users, Clock, Loader2 } from 'lucide-react';
import { db, auth, storage } from '../../config/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';
import { FirestoreReport, FirestoreCluster, ReportStatus } from '../../types';
import { normalizeClusterStatus } from '../../utils/clusterStatus';
import { reverseGeocode } from '../../utils/nominatim';
import { getOsmStaticMapUrl } from '../../utils/osmMap';
import CitizenHeader from '../../components/citizen/CitizenHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import SeverityBadge from '../../components/ui/SeverityBadge';
import Toast, { ToastType } from '../../components/ui/Toast';

interface ReportDetailScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType) => void;
}

export default function ReportDetailScreen({ reportId, onNavigate }: ReportDetailScreenProps) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FirestoreReport | null>(null);
  const [cluster, setCluster] = useState<FirestoreCluster | null>(null);
  const [clusterId, setClusterId] = useState<string | null>(null);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<string>('Loading address...');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const currentUser = auth.currentUser;

  const fetchAfterPhotoFromStorage = async (repId: string) => {
    const extensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    for (const ext of extensions) {
      try {
        const storageRef = ref(storage, `reports/${repId}/after.${ext}`);
        const url = await getDownloadURL(storageRef);
        return url;
      } catch {
        continue;
      }
    }
    return null;
  };

  const fetchAfterPhoto = async (repClusterId: string, repId: string) => {
    try {
      const eventsQuery = query(
        collection(db, 'report_events'),
        where('cluster_id', '==', repClusterId)
      );
      const eventsSnap = await getDocs(eventsQuery);
      const events = eventsSnap.docs
        .map(d => d.data())
        .filter(e => e.event_type === 'work_completed' && e.after_photo_url)
        .sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));
      if (events.length > 0) {
        setAfterPhotoUrl(events[0].after_photo_url);
        return;
      }
    } catch {
      // report_events query is best-effort
    }
    const storageUrl = await fetchAfterPhotoFromStorage(repId);
    if (storageUrl) setAfterPhotoUrl(storageUrl);
  };

  useEffect(() => {
    if (!currentUser) return;

    const reportRef = doc(db, 'reports', reportId);

    const unsubscribeReport = onSnapshot(reportRef, (snap) => {
      if (snap.exists()) {
        const repData = snap.data() as FirestoreReport;
        setReport(repData);

        if (repData.lat && repData.lng) {
          reverseGeocode(repData.lat, repData.lng)
            .then(setAddress)
            .catch(() => setAddress(`${repData.lat!.toFixed(5)}, ${repData.lng!.toFixed(5)}`));
        }

        if (repData.cluster_id) {
          setClusterId(repData.cluster_id);
          fetchAfterPhoto(repData.cluster_id, reportId);
        } else {
          setClusterId(null);
          setCluster(null);
          setLoading(false);
        }
      } else {
        setClusterId(null);
        setCluster(null);
        setLoading(false);
      }
    }, (error) => {
      setToast({ message: 'Could not load report details.', type: 'error' });
      setLoading(false);
    });

    return () => unsubscribeReport();
  }, [reportId, currentUser]);

  useEffect(() => {
    if (!clusterId) return;

    const clusterRef = doc(db, 'clusters', clusterId);
    const unsubscribeCluster = onSnapshot(clusterRef, (cSnap) => {
      if (cSnap.exists()) {
        setCluster(cSnap.data() as FirestoreCluster);
      } else {
        setCluster(null);
      }
      setLoading(false);
    }, (error) => {
      setToast({ message: 'Could not load cluster details.', type: 'error' });
      setLoading(false);
    });

    return () => unsubscribeCluster();
  }, [clusterId]);

  if (loading) {
    return (
      <>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!report) {
    return (
      <>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        <div className="flex flex-col h-screen bg-background p-6 items-center justify-center">
          <p className="text-text-secondary mb-4">Report not found.</p>
          <Button onClick={() => onNavigate('home')} variant="text">Back to Home</Button>
        </div>
      </>
    );
  }

  const clusterStatus = cluster?.status ? normalizeClusterStatus(cluster.status) : null;
  const reportStatus = report.status as ReportStatus | undefined;
  const effectiveStatus = clusterStatus ?? reportStatus ?? 'NEW';
  const severity = cluster?.severity || report.severity;
  const category = cluster?.category || report.category;

  const resolvedAfterPhotoUrl = afterPhotoUrl || cluster?.after_photo_url || report.after_photo_url;
  const showAfterPhoto = !!resolvedAfterPhotoUrl;

  const calculateDaysOpen = () => {
    if (!report.created_at) return 0;
    const now = new Date();
    const created = report.created_at.toDate();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysOpen = calculateDaysOpen();

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary font-sans pb-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <CitizenHeader showBack onBack={() => onNavigate('home')} title="Report Details" />

      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-4 pb-8">
        <section className="gamified-card overflow-hidden bg-surface-container-lowest">
          <div className="relative aspect-video bg-background">
            {report.photo_url ? (
              <img src={report.photo_url} alt="Before" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-text-secondary">No Photo</div>
            )}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
              BEFORE
            </div>
          </div>

          {showAfterPhoto && (
            <div className="relative aspect-video bg-background mt-3">
              <img src={resolvedAfterPhotoUrl!} alt="After" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-status-success text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                AFTER
              </div>
            </div>
          )}
        </section>

        <Card className="gamified-card gamified-shadow space-y-4 bg-surface-container-lowest">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-body-lg font-bold text-text-primary leading-tight">{category || 'Unknown Issue'}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <SeverityBadge severity={severity} />
                <StatusBadge status={effectiveStatus} />
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border" />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Affected</p>
                <p className="font-semibold text-text-primary leading-tight">
                  {cluster?.affected_count || 1} Citizen{(cluster?.affected_count || 1) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-status-warning/10 rounded-lg text-status-warning">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Days Open</p>
                <p className="font-semibold text-text-primary leading-tight">{daysOpen} Day{daysOpen !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-background p-3 rounded-xl border border-border">
            <MapPin className="h-5 w-5 text-text-secondary shrink-0 mt-0.5" />
            <p className="text-body-md font-medium text-text-primary">{address}</p>
          </div>

          {report.lat != null && report.lng != null && (
            <div className="w-full h-32 bg-background rounded-xl overflow-hidden relative flex items-center justify-center border border-border">
              <MapPin className="h-8 w-8 text-text-secondary absolute z-10 drop-shadow-md" />
              <img
                src={getOsmStaticMapUrl(report.lat, report.lng)}
                alt="Map"
                className="w-full h-full object-cover opacity-80"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
