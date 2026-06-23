import React, { useEffect, useState } from 'react';
import { CheckCircle2, Users, FileText, Home, Loader2 } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';

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
      } catch (e) {
        console.error("Failed to fetch cluster for confirmation", e);
      } finally {
        setLoading(false);
      }
    };
    fetchClusterData();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const message = affectedCount === 1 
    ? "Your report has been received. We'll notify you when it's resolved."
    : `You've been added to an existing report. ${affectedCount - 1} other citizen(s) have also reported this.`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-6 border border-zinc-100 flex flex-col items-center">
        
        <div className="relative">
          <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          {affectedCount > 1 && (
            <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center border-4 border-white">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          )}
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
          Report Received
        </h2>
        
        <p className="text-zinc-600 font-medium leading-relaxed">
          {message}
        </p>
        
        <div className="w-full space-y-3 pt-4">
          <button
            onClick={() => onNavigate('report-detail', reportId)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-sm"
          >
            <FileText className="h-5 w-5" />
            View Report
          </button>
          
          <button
            onClick={() => onNavigate('home')}
            className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-700 py-4 rounded-xl font-bold hover:bg-zinc-200 transition"
          >
            <Home className="h-5 w-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
