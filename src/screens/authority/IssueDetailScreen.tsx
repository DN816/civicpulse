import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, MapPin, CalendarDays, AlertTriangle, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { auth, db, storage } from '../../config/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuthorityScreenType } from './AuthorityRouter';
import { Cluster, Report } from '../../types';
import { normalizeClusterStatus } from '../../utils/clusterStatus';
import Card from '../../components/ui/Card';
import SeverityBadge from '../../components/ui/SeverityBadge';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import Toast, { ToastType } from '../../components/ui/Toast';

interface IssueDetailScreenProps {
  clusterId: string;
  onNavigate: (screen: AuthorityScreenType, clusterId?: string) => void;
}

export default function IssueDetailScreen({ clusterId, onNavigate }: IssueDetailScreenProps) {
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cSnap = await getDoc(doc(db, 'clusters', clusterId));
        if (cSnap.exists()) {
          setCluster({ id: cSnap.id, ...cSnap.data() } as Cluster);
        }

        const rQuery = query(collection(db, 'reports'), where('cluster_id', '==', clusterId));
        const rSnap = await getDocs(rQuery);
        if (!rSnap.empty) {
          setReport({ id: rSnap.docs[0].id, ...rSnap.docs[0].data() } as Report);
        }

        const eventsQuery = query(
          collection(db, 'report_events'),
          where('cluster_id', '==', clusterId)
        );
        const eventsSnap = await getDocs(eventsQuery);
        const events = eventsSnap.docs
          .map(d => d.data())
          .filter(e => e.event_type === 'work_completed' && e.after_photo_url)
          .sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));
        if (events.length > 0) {
          setAfterPhotoUrl(events[0].after_photo_url);
        } else if (rSnap.docs[0]?.id) {
          const extensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
          for (const ext of extensions) {
            try {
              const storageRef = ref(storage, `reports/${rSnap.docs[0].id}/after.${ext}`);
              const url = await getDownloadURL(storageRef);
              setAfterPhotoUrl(url);
              break;
            } catch {
              continue;
            }
          }
        }
      } catch (err) {
        setToast({ message: 'Could not load issue details.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clusterId]);

  const updateStatus = async (
    clusterStatus: string,
    reportStatus: string,
    eventType: string,
    setAuthority = false
  ) => {
    setActionLoading(true);
    const authorityId = auth.currentUser?.uid ?? null;

    try {
      const clusterUpdate: Record<string, unknown> = {
        status: clusterStatus,
        updated_at: serverTimestamp(),
      };
      if (setAuthority && authorityId) {
        clusterUpdate.authority_id = authorityId;
      }

      await updateDoc(doc(db, 'clusters', clusterId), clusterUpdate);

      const rQuery = query(collection(db, 'reports'), where('cluster_id', '==', clusterId));
      const rSnap = await getDocs(rQuery);

      const reportUpdate: Record<string, unknown> = {
        status: reportStatus,
        updated_at: serverTimestamp(),
      };
      if (setAuthority && authorityId) {
        reportUpdate.authority_id = authorityId;
      }

      const updatePromises = rSnap.docs.map((rDoc) =>
        updateDoc(doc(db, 'reports', rDoc.id), reportUpdate)
      );

      const eventPromise = addDoc(collection(db, 'report_events'), {
        event_type: eventType,
        report_id: report?.id || '',
        cluster_id: clusterId,
        authority_id: authorityId,
        created_at: serverTimestamp(),
      });

      await Promise.all([...updatePromises, eventPromise]);
      setCluster((prev) =>
        prev
          ? {
              ...prev,
              status: clusterStatus as Cluster['status'],
              ...(setAuthority && authorityId ? { authority_id: authorityId } : {}),
            }
          : prev
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to update issue status', err);
      setToast({ message: `Failed to update issue status: ${msg}`, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = () => updateStatus('assigned', 'ASSIGNED', 'acknowledge', true);
  const handleStartWork = () => updateStatus('in_progress', 'IN_PROGRESS', 'work_started', true);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background space-y-3">
        <AlertCircle className="h-12 w-12 text-severity-high" />
        <h2 className="text-section-title text-text-primary">Issue Not Found</h2>
        <Button variant="text" onClick={() => onNavigate('dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  const status = normalizeClusterStatus(cluster.status);
  const severity = cluster.severity || 'Medium';

  const daysOpen = cluster.created_at
    ? Math.floor((Date.now() - cluster.created_at.toMillis()) / (1000 * 60 * 60 * 24))
    : 0;

  let slaText = 'No SLA';
  let slaColor = 'text-text-secondary';
  if (cluster.sla_deadline) {
    const diff = cluster.sla_deadline.toMillis() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 0) {
      slaText = `${Math.abs(hours)}h overdue`;
      slaColor = 'text-severity-high font-bold';
    } else if (hours < 24) {
      slaText = `${hours}h remaining`;
      slaColor = 'text-status-warning font-bold';
    } else {
      slaText = `${Math.floor(hours / 24)}d remaining`;
      slaColor = 'text-text-secondary';
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary font-sans pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-4 shadow-sm sticky top-0 z-10">
        <Button variant="icon" onClick={() => onNavigate('dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-section-title ml-2">{cluster.category || 'Issue Detail'}</span>
      </header>

      <main className="p-4 lg:p-6 max-w-2xl mx-auto w-full space-y-4">
        {report?.photo_url && (
          <section className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-border">
            <div className="relative aspect-video bg-background">
              <img src={report.photo_url} alt="Civic Issue" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                BEFORE
              </div>
            </div>
            {status === 'resolved' && (afterPhotoUrl || cluster?.after_photo_url || report?.after_photo_url) && (
              <div className="relative aspect-video bg-background mt-3">
                <img src={afterPhotoUrl || cluster?.after_photo_url || report?.after_photo_url!} alt="After" className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 bg-status-success text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                  AFTER
                </div>
              </div>
            )}
          </section>
        )}

        {status === 'escalated' && (
          <div className="bg-status-warning/10 border border-status-warning/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-status-warning shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-text-primary">Escalated Issue</h4>
              <p className="text-body-md text-text-secondary mt-1">This issue has missed its SLA deadline and was escalated to higher authorities.</p>
            </div>
          </div>
        )}

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={severity} />
            <StatusBadge status={status} />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-1">Affected</p>
              <div className="flex items-center gap-1.5 font-medium text-text-primary">
                <MapPin className="h-4 w-4 text-text-secondary" />
                {cluster.affected_count} citizens
              </div>
            </div>
            <div>
              <p className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-1">Days Open</p>
              <div className="flex items-center gap-1.5 font-medium text-text-primary">
                <CalendarDays className="h-4 w-4 text-text-secondary" />
                {daysOpen} days
              </div>
            </div>
            <div className="col-span-2">
              <p className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-1">SLA Deadline</p>
              <div className={`flex items-center gap-1.5 font-medium ${slaColor}`}>
                <Clock className="h-4 w-4" />
                {slaText}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between items-center">
            <p className="text-caption text-text-secondary font-mono">PRIORITY_SCORE: {cluster.priority_score}</p>
          </div>
        </Card>

        {status === 'resolved' && report?.resolution_validation && (
          <Card className="space-y-3">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-status-success" />
              Resolved
            </h3>
            <p className="text-body-md text-text-secondary">AI Validation: {report.resolution_validation.reasoning}</p>
          </Card>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-2xl mx-auto flex justify-center w-full">
          {status === 'active' || status === 'in_review' ? (
            <Button onClick={handleAcknowledge} disabled={actionLoading} fullWidth>
              {actionLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Acknowledge'}
            </Button>
          ) : status === 'assigned' ? (
            <Button onClick={handleStartWork} disabled={actionLoading} fullWidth>
              {actionLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Start Work'}
            </Button>
          ) : status === 'in_progress' || status === 'reopened' || status === 'escalated' ? (
            <Button onClick={() => onNavigate('mark-resolved', clusterId)} fullWidth>
              Mark Resolved
            </Button>
          ) : status === 'resolved' ? (
            <div className="w-full text-center py-2 px-4">
              <p className="text-text-secondary font-medium text-body-md">Resolved</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
