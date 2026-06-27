import React, { useEffect, useState } from 'react';
import { LogOut, Shield, Filter, MapPin, AlertTriangle, AlertCircle, Clock, CalendarDays, Activity, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { AuthorityScreenType } from './AuthorityRouter';

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
  sla_deadline: Timestamp | null;
  priority_score: number;
  zone_id: string | null;
}

export default function AuthorityDashboardScreen({ onNavigate, onNavigateOut }: AuthorityDashboardScreenProps) {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneName, setZoneName] = useState<string>('Loading zone...');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  useEffect(() => {
    const fetchClusters = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // 1. Fetch authority's zone_id
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const zoneId = userDoc.data()?.zone_id || null;
      setZoneName(zoneId ? `Zone ${zoneId}` : 'All Zones (Testing)');

      // 2. Query open clusters
      const clustersRef = collection(db, 'clusters');
      
      // We use 'not-in' to get all active states (active, ASSIGNED, IN_PROGRESS, etc)
      // while excluding resolved and closed.
      let q = query(
        clustersRef,
        where('status', 'not-in', ['resolved', 'closed', 'RESOLVED', 'CLOSED', 'REJECTED'])
      );

      if (zoneId) {
        // If zoneId is set, we need a composite index if we combine == and not-in.
        // To avoid composite index requirements for the hackathon, we will filter zoneId client-side
        // OR we can query by zone_id and filter status client-side.
        // Let's query by zone_id and filter status client-side to ensure we don't hit index errors.
        q = query(clustersRef, where('zone_id', '==', zoneId));
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let data: ClusterData[] = [];
        snapshot.forEach((docSnap) => {
          const c = { id: docSnap.id, ...docSnap.data() } as ClusterData;
          
          // Client-side status filter if we had to drop the not-in query
          if (zoneId) {
            const excludedStatuses = ['resolved', 'closed', 'RESOLVED', 'CLOSED', 'REJECTED'];
            if (excludedStatuses.includes(c.status)) return;
          }
          
          data.push(c);
        });

        // 3. Sort by priority_score descending (client-side to avoid composite index requirements)
        data.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
        
        setClusters(data);
        setLoading(false);
      }, (err) => {
        console.error("Error fetching clusters:", err);
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

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigateOut('welcome');
  };

  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case 'High': return 'bg-red-50 text-red-600 border-red-100';
      case 'Medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Low': return 'bg-green-50 text-green-600 border-green-100';
      default: return 'bg-zinc-50 text-zinc-600 border-zinc-100';
    }
  };

  const getStatusColors = (status: string) => {
    switch (status.toUpperCase()) {
      case 'NEW':
      case 'ACTIVE':
      case 'AWAITING_CLARIFICATION':
        return 'bg-zinc-100 text-zinc-600';
      case 'ASSIGNED':
      case 'IN_PROGRESS':
      case 'APPROVED':
        return 'bg-blue-100 text-blue-700';
      case 'AWAITING_CONFIRMATION':
      case 'IN_REVIEW':
      case 'ESCALATED':
        return 'bg-amber-100 text-amber-700';
      case 'RESOLVED':
        return 'bg-green-100 text-green-700';
      case 'REOPENED':
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-zinc-100 text-zinc-600';
    }
  };

  const getDaysOpen = (createdAt: Timestamp) => {
    if (!createdAt) return 0;
    return Math.floor((Date.now() - createdAt.toMillis()) / (1000 * 60 * 60 * 24));
  };

  const getSLAText = (deadline: Timestamp | null) => {
    if (!deadline) return { text: 'No SLA', color: 'text-zinc-400' };
    const diff = deadline.toMillis() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 0) return { text: `${Math.abs(hours)}h overdue`, color: 'text-red-600 font-bold' };
    if (hours < 24) return { text: `${hours}h remaining`, color: 'text-amber-600 font-bold' };
    const days = Math.floor(hours / 24);
    return { text: `${days}d remaining`, color: 'text-zinc-500' };
  };

  // Apply UI Filters
  const filteredClusters = clusters.filter(c => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'High Severity') return c.severity === 'High';
    if (activeFilter === 'Escalated') return c.status === 'ESCALATED';
    return true;
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F9] text-zinc-900 font-sans">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-lg leading-tight">Dashboard</span>
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{zoneName}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('metrics')}
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition text-sm font-medium"
          >
            <Activity className="h-4 w-4" />
            Metrics
          </button>
          <div className="w-px h-4 bg-zinc-300" />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className="h-4 w-4 text-zinc-400 mr-1 shrink-0" />
          {['All', 'High Severity', 'Escalated'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeFilter === filter 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
          </div>
        ) : filteredClusters.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center shadow-sm">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900">All clear!</h3>
            <p className="text-zinc-500 mt-1">No issues assigned to your zone.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClusters.map((cluster) => {
              const sla = getSLAText(cluster.sla_deadline);
              const daysOpen = getDaysOpen(cluster.created_at);
              
              return (
                <div 
                  key={cluster.id}
                  onClick={() => onNavigate('issue-detail', cluster.id)}
                  className="bg-white border border-zinc-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  {/* Row 1: Category & Severity */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-100 group-hover:bg-blue-50 transition-colors">
                        <AlertCircle className="h-5 w-5 text-zinc-600 group-hover:text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-[16px] text-zinc-900">{cluster.category || 'Unknown Issue'}</h4>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border ${getSeverityColors(cluster.severity)}`}>
                      {cluster.severity}
                    </span>
                  </div>

                  {/* Row 2: Affected & SLA */}
                  <div className="flex items-center justify-between text-sm mb-3">
                    <div className="flex items-center gap-1.5 text-zinc-600 font-medium">
                      <MapPin className="h-4 w-4 text-zinc-400" />
                      {cluster.affected_count} {cluster.affected_count === 1 ? 'citizen' : 'citizens'} affected
                    </div>
                    <div className={`flex items-center gap-1.5 ${sla.color}`}>
                      <Clock className="h-4 w-4" />
                      {sla.text}
                    </div>
                  </div>

                  {/* Row 3: Status & Days Open */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                    <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${getStatusColors(cluster.status)}`}>
                      {cluster.status.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {daysOpen} {daysOpen === 1 ? 'day' : 'days'} open
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

