import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, AlertTriangle, Users, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { doc, onSnapshot, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';

interface ReportDetailScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType) => void;
}

export default function ReportDetailScreen({ reportId, onNavigate }: ReportDetailScreenProps) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [cluster, setCluster] = useState<any>(null);
  const [address, setAddress] = useState<string>('Loading address...');
  const [voting, setVoting] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const reportRef = doc(db, 'reports', reportId);
    
    const unsubscribeReport = onSnapshot(reportRef, async (snap) => {
      if (snap.exists()) {
        const repData = snap.data();
        setReport(repData);
        
        // Fetch address if not already fetched
        if (repData.lat && repData.lng) {
          fetchAddress(repData.lat, repData.lng);
        }

        // Subscribe to cluster if exists
        if (repData.cluster_id) {
          const clusterRef = doc(db, 'clusters', repData.cluster_id);
          const unsubCluster = onSnapshot(clusterRef, (cSnap) => {
            if (cSnap.exists()) {
              setCluster(cSnap.data());
            }
            setLoading(false);
          });
          return () => unsubCluster();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeReport();
  }, [reportId]);

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (res.ok) {
        const data = await res.json();
        const displayAddress = data.address?.road 
          ? `${data.address.road}, ${data.address.city || data.address.town || data.address.suburb || ''}`
          : data.display_name;
        setAddress(displayAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (e) {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  const handleVote = async (isFixed: boolean) => {
    if (!cluster || !report || !currentUser) return;
    setVoting(true);
    try {
      // In a real implementation this would write to a subcollection or trigger CF5
      // For MVP UI simulation:
      alert(`You voted: ${isFixed ? 'Yes, fixed' : 'No, not fixed'}`);
      // Simulated: set current user as having voted to hide buttons
      await updateDoc(doc(db, 'clusters', report.cluster_id), {
        voted_users: arrayUnion(currentUser.uid)
      });
    } catch (e) {
      console.error(e);
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col h-screen bg-zinc-50 p-6 items-center justify-center">
        <p className="text-zinc-500 mb-4">Report not found.</p>
        <button onClick={() => onNavigate('home')} className="text-blue-600 font-medium">Back to Home</button>
      </div>
    );
  }

  const effectiveStatus = cluster?.status || report.status;
  const severity = cluster?.severity || report.severity;
  const category = cluster?.category || report.category;
  
  const severityColor = 
    severity === 'High' ? 'text-red-600 bg-red-100 border-red-200' :
    severity === 'Medium' ? 'text-amber-600 bg-amber-100 border-amber-200' :
    'text-emerald-600 bg-emerald-100 border-emerald-200';

  const calculateDaysOpen = () => {
    if (!report.created_at) return 0;
    const now = new Date();
    const created = report.created_at.toDate();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysOpen = calculateDaysOpen();
  
  const hasVoted = cluster?.voted_users?.includes(currentUser?.uid);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-8">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 sticky top-0 z-10 shadow-sm">
        <button onClick={() => onNavigate('home')} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 transition">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight ml-2">Report Details</h1>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6">
        
        {/* Photos */}
        <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-zinc-200">
          <div className="relative aspect-video bg-zinc-100">
            {report.photo_url ? (
              <img src={report.photo_url} alt="Before" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-400">No Photo</div>
            )}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
              BEFORE
            </div>
          </div>
          
          {effectiveStatus === 'RESOLVED' && cluster?.after_photo_url && (
            <div className="relative aspect-video bg-zinc-100 border-t border-zinc-200">
              <img src={cluster.after_photo_url} alt="After" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                AFTER (RESOLVED)
              </div>
            </div>
          )}
        </section>

        {/* Core Details */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">{category || 'Unknown Issue'}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-bold ${severityColor}`}>
                  <AlertTriangle className="h-3 w-3" />
                  {severity}
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border bg-zinc-100 text-zinc-600 border-zinc-200 text-xs font-bold">
                  {effectiveStatus.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-zinc-100" />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Affected</p>
                <p className="font-semibold text-zinc-800 leading-tight">{cluster?.affected_count || 1} Citizen{(cluster?.affected_count || 1) !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Days Open</p>
                <p className="font-semibold text-zinc-800 leading-tight">{daysOpen} Day{daysOpen !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
            <MapPin className="h-5 w-5 text-zinc-400 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-zinc-700">{address}</p>
          </div>
          
          {/* Small static map placeholder (using OSM static map could be nice, but simple gray box is safer for no-key MVP) */}
          <div className="w-full h-32 bg-zinc-200 rounded-xl overflow-hidden relative flex items-center justify-center border border-zinc-300">
            <MapPin className="h-8 w-8 text-zinc-400 absolute z-10 drop-shadow-md" />
            <img 
              src={`https://static-maps.yandex.ru/1.x/?ll=${report.lng},${report.lat}&size=400,150&z=15&l=map&pt=${report.lng},${report.lat},pm2rdm`}
              alt="Map"
              className="w-full h-full object-cover opacity-80"
              onError={(e) => {
                // Fallback if yandex is blocked
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </section>

        {/* Dispute Actions */}
        {effectiveStatus === 'AWAITING_CONFIRMATION' && cluster?.affected_citizen_ids?.includes(currentUser?.uid) && !hasVoted && (
          <section className="bg-blue-50 rounded-2xl p-5 border border-blue-100 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-blue-600 shrink-0" />
              <div>
                <h3 className="font-bold text-blue-900">Is this issue actually fixed?</h3>
                <p className="text-sm text-blue-700 mt-1">
                  The authority marked this resolved. Please confirm.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => handleVote(true)}
                disabled={voting}
                className="flex-1 bg-white border-2 border-emerald-500 text-emerald-600 font-bold py-3 rounded-xl hover:bg-emerald-50 transition"
              >
                Yes, fixed
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={voting}
                className="flex-1 bg-white border-2 border-red-500 text-red-600 font-bold py-3 rounded-xl hover:bg-red-50 transition"
              >
                No, not fixed
              </button>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
