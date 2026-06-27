import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, MapPin, CalendarDays, AlertTriangle, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuthorityScreenType } from './AuthorityRouter';

interface IssueDetailScreenProps {
  clusterId: string;
  onNavigate: (screen: AuthorityScreenType, clusterId?: string) => void;
}

export default function IssueDetailScreen({ clusterId, onNavigate }: IssueDetailScreenProps) {
  const [cluster, setCluster] = useState<any>(null);
  const [report, setReport] = useState<any>(null); // To get the photo
  const [disputeCount, setDisputeCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Cluster
        const cSnap = await getDoc(doc(db, 'clusters', clusterId));
        if (cSnap.exists()) {
          setCluster({ id: cSnap.id, ...cSnap.data() });
        }

        // 2. Fetch first Report to get photo
        const rQuery = query(collection(db, 'reports'), where('cluster_id', '==', clusterId));
        const rSnap = await getDocs(rQuery);
        if (!rSnap.empty) {
          setReport({ id: rSnap.docs[0].id, ...rSnap.docs[0].data() });
        }

        // 3. Fetch dispute count if AWAITING_CONFIRMATION
        const currentStatus = cSnap.data()?.status?.toUpperCase();
        if (currentStatus === 'AWAITING_CONFIRMATION') {
          // In CF3, we open dispute window. We need the current resolution_attempt from the report
          const attempt = rSnap.empty ? 1 : (rSnap.docs[0].data().resolution_attempt || 1);
          const reportIdForVotes = rSnap.empty ? '' : rSnap.docs[0].id;
          
          if (reportIdForVotes) {
            const votesQuery = query(
              collection(db, 'dispute_votes'),
              where('report_id', '==', reportIdForVotes),
              where('resolution_attempt', '==', attempt)
            );
            const votesSnap = await getDocs(votesQuery);
            setDisputeCount(votesSnap.size);
          }
        }
      } catch (err) {
        console.error("Error fetching detail data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clusterId]);

  const updateStatus = async (newStatus: string, eventType: string) => {
    setActionLoading(true);
    try {

      
      // Update cluster status
      await updateDoc(doc(db, 'clusters', clusterId), { status: newStatus });
      
      // Update ALL linked reports status
      const rQuery = query(collection(db, 'reports'), where('cluster_id', '==', clusterId));
      const rSnap = await getDocs(rQuery);
      
      const updatePromises = rSnap.docs.map(rDoc => 
        updateDoc(doc(db, 'reports', rDoc.id), { status: newStatus })
      );
      
      // Add report event
      const eventPromise = addDoc(collection(db, 'report_events'), {
        event_type: eventType,
        report_id: report?.id || '',
        cluster_id: clusterId,
        authority_id: auth.currentUser?.uid,
        created_at: serverTimestamp()
      });

      await Promise.all([...updatePromises, eventPromise]);
      
      // Refresh local state
      setCluster(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error("Error updating status", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = () => updateStatus('ASSIGNED', 'acknowledge');
  const handleStartWork = () => updateStatus('IN_PROGRESS', 'work_started');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#F4F6F9]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F4F6F9]">
        <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
        <h2 className="text-xl font-bold">Issue Not Found</h2>
        <button onClick={() => onNavigate('dashboard')} className="mt-4 text-blue-600">Back to Dashboard</button>
      </div>
    );
  }

  const status = cluster.status?.toUpperCase() || 'NEW';
  const severity = cluster.severity || 'Medium';

  const getSeverityBadge = () => {
    switch (severity) {
      case 'High': return 'bg-red-50 text-red-600 border-red-100';
      case 'Medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Low': return 'bg-green-50 text-green-600 border-green-100';
      default: return 'bg-zinc-50 text-zinc-600 border-zinc-100';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'NEW':
      case 'ACTIVE':
        return 'bg-zinc-100 text-zinc-600';
      case 'ASSIGNED':
      case 'IN_PROGRESS':
      case 'APPROVED':
        return 'bg-blue-100 text-blue-700';
      case 'AWAITING_CONFIRMATION':
      case 'ESCALATED':
        return 'bg-amber-100 text-amber-700';
      case 'RESOLVED':
        return 'bg-green-100 text-green-700';
      case 'REOPENED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-zinc-100 text-zinc-600';
    }
  };

  const daysOpen = cluster.created_at ? Math.floor((Date.now() - cluster.created_at.toMillis()) / (1000 * 60 * 60 * 24)) : 0;
  
  let slaText = 'No SLA';
  let slaColor = 'text-zinc-400';
  if (cluster.sla_deadline) {
    const diff = cluster.sla_deadline.toMillis() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 0) {
      slaText = `${Math.abs(hours)}h overdue`;
      slaColor = 'text-red-600 font-bold';
    } else if (hours < 24) {
      slaText = `${hours}h remaining`;
      slaColor = 'text-amber-600 font-bold';
    } else {
      slaText = `${Math.floor(hours / 24)}d remaining`;
      slaColor = 'text-zinc-500';
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9] text-zinc-900 font-sans pb-24">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 shadow-sm sticky top-0 z-10">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold tracking-tight text-lg ml-2">{cluster.category || 'Issue Detail'}</span>
      </header>

      {/* Before Photo */}
      {report?.photo_url && (
        <div className="w-full h-[220px] bg-zinc-200 relative">
          <img src={report.photo_url} alt="Civic Issue" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 lg:p-6 max-w-2xl mx-auto w-full space-y-4">
        
        {/* Escalation History */}
        {status === 'ESCALATED' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900">Escalated Issue</h4>
              <p className="text-sm text-amber-700 mt-1">This issue has missed its SLA deadline and was escalated to higher authorities.</p>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border ${getSeverityBadge()}`}>
              {severity} SEVERITY
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${getStatusBadge()}`}>
              {status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Affected</p>
              <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                <MapPin className="h-4 w-4 text-zinc-400" />
                {cluster.affected_count} citizens
              </div>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Days Open</p>
              <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                <CalendarDays className="h-4 w-4 text-zinc-400" />
                {daysOpen} days
              </div>
            </div>
            <div className="col-span-2">
              <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">SLA Deadline</p>
              <div className={`flex items-center gap-1.5 font-medium ${slaColor}`}>
                <Clock className="h-4 w-4" />
                {slaText}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
            <p className="text-[12px] text-zinc-500 font-mono">PRIORITY_SCORE: {cluster.priority_score}</p>
          </div>
        </div>

        {/* Status Timeline / Resolved info */}
        {status === 'RESOLVED' && report?.resolution_validation && (
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Resolved
            </h3>
            <p className="text-sm text-zinc-600">AI Validation: {report.resolution_validation.reasoning}</p>
          </div>
        )}
      </main>

      {/* Action Bar (Pinned Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-2xl mx-auto flex justify-center w-full">
          {status === 'NEW' || status === 'APPROVED' || status === 'ACTIVE' ? (
            <button
              onClick={handleAcknowledge}
              disabled={actionLoading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg flex justify-center items-center gap-2"
            >
              {actionLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Acknowledge'}
            </button>
          ) : status === 'ASSIGNED' ? (
            <button
              onClick={handleStartWork}
              disabled={actionLoading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg flex justify-center items-center gap-2"
            >
              {actionLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Start Work'}
            </button>
          ) : status === 'IN_PROGRESS' || status === 'REOPENED' || status === 'ESCALATED' ? (
            <button
              onClick={() => onNavigate('mark-resolved', clusterId)}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg flex justify-center items-center gap-2"
            >
              Mark Resolved
            </button>
          ) : status === 'AWAITING_CONFIRMATION' ? (
            <div className="w-full text-center py-2 px-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-amber-800 font-medium text-sm">
                {disputeCount} {disputeCount === 1 ? 'citizen' : 'citizens'} disputed — awaiting window close
              </p>
            </div>
          ) : status === 'RESOLVED' ? (
            <div className="w-full text-center py-2 px-4">
              <p className="text-zinc-500 font-medium text-sm">Resolved</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
