import React, { useEffect, useState, useCallback } from 'react';
import { LogOut, Filter, MapPin, AlertTriangle, AlertCircle, Clock, CalendarDays, Activity, CheckCircle2, ImageIcon } from 'lucide-react';
import CivicPulseLogo from '../../components/ui/CivicPulseLogo';
import { auth, db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { AuthorityScreenType } from './AuthorityRouter';
import { isClusterTerminal, normalizeClusterStatus } from '../../utils/clusterStatus';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import SeverityBadge from '../../components/ui/SeverityBadge';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Button from '../../components/ui/Button';
import Toast, { ToastType } from '../../components/ui/Toast';

type Tab = 'active' | 'resolved';

interface AuthorityDashboardScreenProps {
  onNavigate: (screen: AuthorityScreenType, clusterId?: string) => void;
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

interface ClusterData {
  id: string;
  category: string;
  severity: 'High' | 'Medium' | 'Low';
  affected_count: number;
  status: string;
  created_at: Timestamp;
  updated_at?: Timestamp;
  sla_deadline: Timestamp | null;
  priority_score: number;
  zone_id: string | null;
  centroid_lat?: number;
  centroid_lng?: number;
  after_photo_url?: string | null;
}

interface ReportThumbnail {
  photo_url: string;
  after_photo_url: string | null;
}

export default function AuthorityDashboardScreen({ onNavigate, onNavigateOut }: AuthorityDashboardScreenProps) {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneName, setZoneName] = useState<string>('Loading zone...');
  const [noZone, setNoZone] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [reportMap, setReportMap] = useState<Record<string, ReportThumbnail>>({});
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const fetchClusters = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const zoneId = userDoc.data()?.zone_id ?? null;
      if (!zoneId) {
        setNoZone(true);
        setZoneName('No zone assigned');
      } else {
        setZoneName(`Zone ${zoneId}`);
      }

      const clustersRef = collection(db, 'clusters');
      const q = query(clustersRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data: ClusterData[] = [];
        snapshot.forEach((docSnap) => {
          const c = { id: docSnap.id, ...docSnap.data() } as ClusterData;
          if (zoneId && c.zone_id && c.zone_id !== zoneId) return;
          data.push(c);
        });
        data.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
        setClusters(data);
        setLoading(false);
      }, () => {
        setToast({ message: 'Could not load issue queue.', type: 'error' });
        setLoading(false);
      });

      return unsubscribe;
    };

    const unsubPromise = fetchClusters();
    return () => {
      unsubPromise.then(unsub => {
        if (unsub) unsub();
      });
    };
  }, []);

  const fetchReportsForResolved = useCallback(async (resolvedList: ClusterData[]) => {
    const entries = await Promise.all(
      resolvedList.map(async (c) => {
        try {
          const rQuery = query(collection(db, 'reports'), where('cluster_id', '==', c.id));
          const rSnap = await getDocs(rQuery);
          if (!rSnap.empty) {
            const d = rSnap.docs[0].data();
            return [c.id, { photo_url: d.photo_url, after_photo_url: d.after_photo_url ?? null }] as const;
          }
        } catch { /* skip */ }
        return [c.id, { photo_url: '', after_photo_url: null }] as const;
      })
    );
    setReportMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  useEffect(() => {
    if (activeTab === 'resolved') {
      const resolved = clusters.filter(c => isClusterTerminal(c.status));
      fetchReportsForResolved(resolved);
    }
  }, [activeTab, clusters, fetchReportsForResolved]);

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigateOut('welcome');
  };

  const getDaysOpen = (createdAt: Timestamp) => {
    if (!createdAt) return 0;
    return Math.floor((Date.now() - createdAt.toMillis()) / (1000 * 60 * 60 * 24));
  };

  const getDaysToResolve = (createdAt: Timestamp, updatedAt?: Timestamp) => {
    if (!createdAt) return 0;
    const end = updatedAt?.toMillis() ?? Date.now();
    return Math.max(0, Math.floor((end - createdAt.toMillis()) / (1000 * 60 * 60 * 24)));
  };

  function getTilePixelPosition(lat: number, lng: number, zoom: number) {
    const n = Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    return {
      tileX: Math.floor(x),
      tileY: Math.floor(y),
      pctX: ((x - Math.floor(x))) * 100,
      pctY: ((y - Math.floor(y))) * 100,
    };
  }

  const getSLAText = (deadline: Timestamp | null) => {
    if (!deadline) return { text: 'No SLA', color: 'text-zinc-400' };
    const diff = deadline.toMillis() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 0) return { text: `${Math.abs(hours)}h overdue`, color: 'text-red-600 font-bold' };
    if (hours < 24) return { text: `${hours}h remaining`, color: 'text-amber-600 font-bold' };
    const days = Math.floor(hours / 24);
    return { text: `${days}d remaining`, color: 'text-zinc-500' };
  };

  const activeClusters = clusters.filter(c => !isClusterTerminal(c.status));
  const resolvedClusters = clusters.filter(c => isClusterTerminal(c.status));

  const filteredActive = activeClusters.filter((c) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'High Severity') return c.severity === 'High';
    if (activeFilter === 'Escalated') return normalizeClusterStatus(c.status) === 'escalated';
    return true;
  });

  const filteredResolved = resolvedClusters.filter((c) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'High Severity') return c.severity === 'High';
    return true;
  });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: activeClusters.length },
    { key: 'resolved', label: 'Resolved', count: resolvedClusters.length },
  ];

  const tabFilterOptions = activeTab === 'active'
    ? ['All', 'High Severity', 'Escalated']
    : ['All', 'High Severity'];

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CivicPulseLogo size="sm" />
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-lg leading-tight">Dashboard</span>
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{zoneName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => onNavigate('metrics')}
            variant="text"
            className="hidden md:flex"
          >
            <Activity className="h-4 w-4" />
            Metrics
          </Button>
          <div className="w-px h-4 bg-border hidden md:block" />
          <Button onClick={handleSignOut} variant="text">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex border-b border-border bg-surface px-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setActiveFilter('All'); }}
            className={`relative px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
              activeTab === tab.key
                ? 'bg-primary/10 text-primary'
                : 'bg-background text-text-secondary'
            }`}>
              {tab.count}
            </span>
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 w-full max-w-7xl mx-auto space-y-6">
        {/* Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className="h-4 w-4 text-zinc-400 mr-1 shrink-0" />
          {tabFilterOptions.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeFilter === filter
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-surface text-text-secondary border-border hover:bg-background'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Zone setup prompt */}
        {noZone && (
          <div className="bg-status-warning/10 border border-status-warning/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-status-warning shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-text-primary">Zone not configured</h4>
              <p className="text-body-md text-text-secondary mt-1">
                Your account has no zone assigned. Contact an administrator to set up your authority zone.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonLoader />
        ) : activeTab === 'active' ? (
          /* ─── ACTIVE TAB ─── */
          filteredActive.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-sm">
              <CheckCircle2 className="h-12 w-12 text-status-success mx-auto mb-4" />
              <h3 className="text-section-title text-text-primary">All clear!</h3>
              <p className="text-body-md text-text-secondary mt-1">No issues assigned to your zone.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredActive.map((cluster) => {
                const sla = getSLAText(cluster.sla_deadline);
                const daysOpen = getDaysOpen(cluster.created_at);
                return (
                  <Card
                    key={cluster.id}
                    onClick={() => onNavigate('issue-detail', cluster.id)}
                    className="cursor-pointer hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-background rounded-lg border border-border group-hover:bg-primary-light transition-colors">
                          <AlertCircle className="h-5 w-5 text-text-secondary group-hover:text-primary" />
                        </div>
                        <h4 className="text-body-lg font-semibold text-text-primary">{cluster.category || 'Unknown Issue'}</h4>
                      </div>
                      <SeverityBadge severity={cluster.severity} />
                    </div>
                    <div className="flex items-center justify-between text-body-md mb-3">
                      <div className="flex items-center gap-1.5 text-text-secondary font-medium">
                        <MapPin className="h-4 w-4 text-text-secondary" />
                        {cluster.affected_count} {cluster.affected_count === 1 ? 'citizen' : 'citizens'} affected
                      </div>
                      <div className={`flex items-center gap-1.5 ${sla.color}`}>
                        <Clock className="h-4 w-4" />
                        {sla.text}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <StatusBadge status={normalizeClusterStatus(cluster.status)} />
                      <div className="flex items-center gap-1.5 text-caption text-text-secondary">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {daysOpen} {daysOpen === 1 ? 'day' : 'days'} open
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          /* ─── RESOLVED TAB ─── */
          filteredResolved.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-sm">
              <CheckCircle2 className="h-12 w-12 text-status-success mx-auto mb-4" />
              <h3 className="text-section-title text-text-primary">No resolved issues</h3>
              <p className="text-body-md text-text-secondary mt-1">Resolved issues will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResolved.map((cluster) => {
                const reportThumb = reportMap[cluster.id];
                const daysOpen = getDaysOpen(cluster.created_at);
                const daysToResolve = getDaysToResolve(cluster.created_at, cluster.updated_at);
                const hasLocation = cluster.centroid_lat != null && cluster.centroid_lng != null;
                const mapPos = hasLocation
                  ? getTilePixelPosition(cluster.centroid_lat!, cluster.centroid_lng!, 15)
                  : null;
                return (
                  <Card
                    key={cluster.id}
                    onClick={() => onNavigate('issue-detail', cluster.id)}
                    className="cursor-pointer hover:border-primary/30 transition-all group overflow-hidden"
                  >
                    {/* Photo strip */}
                    <div className="flex gap-1 mb-3 -mx-4 -mt-4 bg-background">
                      <div className="flex-1 aspect-[4/3] bg-background overflow-hidden relative">
                        {reportThumb?.photo_url ? (
                          <img src={reportThumb.photo_url} alt="Before" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-secondary">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1 bg-black/60 text-[10px] text-white px-1.5 py-0.5 rounded font-bold tracking-wide">
                          BEFORE
                        </div>
                      </div>
                      <div className="flex-1 aspect-[4/3] bg-background overflow-hidden relative">
                        {(reportThumb?.after_photo_url || cluster.after_photo_url) ? (
                          <img src={reportThumb?.after_photo_url || cluster.after_photo_url!} alt="After" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-secondary">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute top-1 right-1 bg-status-success/80 text-[10px] text-white px-1.5 py-0.5 rounded font-bold tracking-wide">
                          AFTER
                        </div>
                      </div>
                    </div>

                    {mapPos && (
                      <div className="relative w-full aspect-[4/3] bg-zinc-100 rounded-lg overflow-hidden mb-3 border border-border">
                        <img
                          src={`https://tile.openstreetmap.org/15/${mapPos.tileX}/${mapPos.tileY}.png`}
                          alt="Location"
                          className="w-full h-full object-cover"
                        />
                        <div
                          className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md"
                          style={{ left: `${mapPos.pctX}%`, top: `${mapPos.pctY}%`, transform: 'translate(-50%, -50%)' }}
                        />
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-body-lg font-semibold text-text-primary leading-tight">{cluster.category || 'Unknown Issue'}</h4>
                      <SeverityBadge severity={cluster.severity} />
                    </div>

                    <div className="text-body-md text-text-secondary space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {cluster.zone_id ? `Zone ${cluster.zone_id}` : 'No zone'} &middot; {cluster.affected_count} {cluster.affected_count === 1 ? 'citizen' : 'citizens'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Resolved in {daysToResolve} {daysToResolve === 1 ? 'day' : 'days'}
                        {daysOpen > daysToResolve && ` (${daysOpen}d total)`}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                      <StatusBadge status="resolved" />
                      <span className="text-caption text-text-secondary">
                        {cluster.updated_at?.toDate().toLocaleDateString() || '—'}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}

