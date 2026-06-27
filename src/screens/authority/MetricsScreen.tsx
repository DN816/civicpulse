import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Activity, CheckCircle2, Clock, CalendarDays } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { AuthorityScreenType } from './AuthorityRouter';

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

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Fetch Zone ID
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const zoneId = userDoc.data()?.zone_id || null;
        setZoneName(zoneId ? `Zone ${zoneId}` : 'All Zones (Testing)');

        // Fetch clusters for this zone to calculate stats
        const clustersRef = collection(db, 'clusters');
        const q = zoneId 
          ? query(clustersRef, where('zone_id', '==', zoneId))
          : query(clustersRef);
          
        const snapshot = await getDocs(q);
        
        let totalAssigned = 0;
        let totalResolved = 0;
        let slaMet = 0;
        let totalResolutionTime = 0;
        
        snapshot.forEach(docSnap => {
          const c = docSnap.data();
          totalAssigned++;
          
          if (c.status === 'resolved' || c.status === 'RESOLVED' || c.status === 'closed' || c.status === 'CLOSED') {
            totalResolved++;
            
            // SLA Compliance check
            if (c.sla_deadline && c.updated_at) {
              if (c.updated_at.toMillis() <= c.sla_deadline.toMillis()) {
                slaMet++;
              }
            } else if (!c.escalation_sent) {
              slaMet++; // Assume met if not escalated and resolved
            }

            // Resolution Time
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

      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9] text-zinc-900 font-sans pb-8">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => onNavigate('dashboard')} 
          className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 transition"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="ml-2 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight">Metrics</h1>
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider ml-2 bg-zinc-100 px-2 py-0.5 rounded-full">
            {zoneName}
          </span>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Total Assigned</span>
                <span className="text-3xl font-bold font-mono text-zinc-900">{stats.totalAssigned}</span>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Resolved</span>
                <span className="text-3xl font-bold font-mono text-emerald-600">{stats.totalResolved}</span>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> SLA Compliance</span>
                <span className="text-3xl font-bold font-mono text-blue-600">{stats.slaCompliance}%</span>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Avg Time</span>
                <span className="text-3xl font-bold font-mono text-amber-600">{stats.avgResolutionDays}d</span>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <h3 className="font-semibold text-zinc-900">City Health Report</h3>
              <p className="text-sm text-zinc-500 max-w-sm">
                View the weekly public report generated by CivicPulse AI detailing city-wide performance and top unresolved issues.
              </p>
              <button 
                onClick={() => alert("Health Report screen will be implemented in a future phase.")}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1.5 underline decoration-blue-200 underline-offset-4"
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
