import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Home, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';

interface NewReportConfirmationScreenProps {
  reportId: string;
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function NewReportConfirmationScreen({ reportId, onNavigate }: NewReportConfirmationScreenProps) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', reportId));
        if (snap.exists()) {
          const data = snap.data();
          setReportData(data);
          
          if (data.lat && data.lng) {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}`);
            if (res.ok) {
              const geodata = await res.json();
              const displayAddress = geodata.address?.road 
                ? `${geodata.address.road}, ${geodata.address.city || geodata.address.town || geodata.address.suburb || ''}`
                : geodata.display_name;
              setAddress(displayAddress || `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch report data for confirmation", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const severityColor = 
    reportData?.severity === 'High' ? 'text-red-600 bg-red-100 border-red-200' :
    reportData?.severity === 'Medium' ? 'text-amber-600 bg-amber-100 border-amber-200' :
    'text-emerald-600 bg-emerald-100 border-emerald-200';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-6 border border-zinc-100 flex flex-col items-center">
        
        <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
          Report Received
        </h2>
        
        <p className="text-zinc-600 font-medium leading-relaxed">
          Your report has been received. We'll notify you when it's resolved.
        </p>

        {reportData && (
          <div className="w-full bg-zinc-50 rounded-2xl p-4 border border-zinc-200 text-left space-y-3">
            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Category</p>
              <p className="font-medium text-zinc-900">{reportData.category}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Severity</p>
                <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${severityColor}`}>
                  <AlertTriangle className="h-3 w-3" />
                  {reportData.severity}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Location</p>
              <div className="flex items-start gap-2 mt-1">
                <MapPin className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-zinc-800 line-clamp-2">{address}</p>
              </div>
            </div>
          </div>
        )}
        
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
