import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Activity, CheckCircle2, Clock, CalendarDays } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { AuthorityScreenType } from './AuthorityRouter';
import { isClusterTerminal, normalizeClusterStatus } from '../../utils/clusterStatus';
import Toast, { ToastType } from '../../components/ui/Toast';

interface MetricsScreenProps {
  onNavigate: (screen: AuthorityScreenType) => void;
}

export default function MetricsScreen({ onNavigate }: MetricsScreenProps) {
  const [zoneName, setZoneName] = useState<string>('Loading...');
  const [stats, setStats] = useState({
    totalAssigned: 0,
    totalResolved: 0,
    slaCompliance: 0,
    avgResolutionDays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const zoneId = userDoc.data()?.zone_id || null;
        setZoneName(zoneId ? `Zone ${zoneId}` : 'No zone assigned');

        const clustersRef = collection(db, 'clusters');
        const q = zoneId
          ? query(clustersRef, where('zone_id', '==', zoneId))
          : query(clustersRef);

        const snapshot = await getDocs(q);

        let totalAssigned = 0;
        let totalResolved = 0;
        let slaMet = 0;
        let totalResolutionTime = 0;

        snapshot.forEach((docSnap) => {
          const c = docSnap.data();
          totalAssigned++;

          const status = normalizeClusterStatus(c.status);
          if (isClusterTerminal(status)) {
            totalResolved++;

            if (c.sla_deadline && c.updated_at) {
              if (c.updated_at.toMillis() <= c.sla_deadline.toMillis()) {
                slaMet++;
              }
            } else if (!c.escalation_sent) {
              slaMet++;
            }

            if (c.created_at && c.updated_at) {
              const ms = c.updated_at.toMillis() - c.created_at.toMillis();
              totalResolutionTime += ms;
            }
          }
        });

        const slaCompliance = totalResolved > 0 ? Math.round((slaMet / totalResolved) * 100) : 100;
        const avgDays = totalResolved > 0 ? Math.round((totalResolutionTime / totalResolved) / (1000 * 60 * 60 * 24)) : 0;

        setStats({
          totalAssigned,
          totalResolved,
          slaCompliance,
          avgResolutionDays: avgDays,
        });
      } catch {
        setToast({ message: 'Could not load metrics. Please try again.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary font-sans pb-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-4 sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => onNavigate('dashboard')}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="ml-2 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Metrics</h1>
          <span className="text-[10px] text-text-secondary font-medium uppercase tracking-wider ml-2 bg-background px-2 py-0.5 rounded-full border border-border">
            {zoneName}
          </span>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 max-w-4xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Total Assigned</span>
                <span className="text-3xl font-bold font-mono text-text-primary">{stats.totalAssigned}</span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                </span>
                <span className="text-3xl font-bold font-mono text-status-success">{stats.totalResolved}</span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> SLA Compliance
                </span>
                <span className="text-3xl font-bold font-mono text-primary">{stats.slaCompliance}%</span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Avg Time
                </span>
                <span className="text-3xl font-bold font-mono text-status-warning">{stats.avgResolutionDays}d</span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <h3 className="font-semibold text-text-primary">City Health Report</h3>
              <p className="text-sm text-text-secondary max-w-sm">
                View the weekly public report generated by CivicPulse AI detailing city-wide performance and top unresolved issues.
              </p>
              <button
                onClick={() => setToast({ message: 'Health Report screen will be implemented in a future phase.', type: 'info' })}
                className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1.5 underline decoration-primary/30 underline-offset-4"
              >
                View City Health Report
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
