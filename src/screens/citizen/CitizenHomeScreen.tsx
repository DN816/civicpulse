import React, { useEffect, useState } from 'react';
import { LogOut, Shield, PlusCircle, Map as MapIcon, User as UserIcon, Home, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { CitizenScreenType } from './CitizenRouter';

interface CitizenHomeScreenProps {
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router') => void;
}

interface ReportActivity {
  id: string;
  status: string;
  category?: string;
  created_at?: Timestamp;
}

export default function CitizenHomeScreen({ onNavigate, onNavigateOut }: CitizenHomeScreenProps) {
  const [activities, setActivities] = useState<ReportActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    // Listen to reports created by this citizen
    const q = query(
      collection(db, 'reports'),
      where('citizen_id', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ReportActivity[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as ReportActivity);
      });
      // Sort by created_at descending client-side if index not ready
      data.sort((a, b) => {
        const tA = a.created_at?.toMillis() || 0;
        const tB = b.created_at?.toMillis() || 0;
        return tB - tA;
      });
      setActivities(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigateOut('welcome');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'NEW':
      case 'IN_REVIEW':
      case 'AWAITING_CLARIFICATION':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'ASSIGNED':
      case 'IN_PROGRESS':
        return <AlertTriangle className="h-5 w-5 text-blue-500" />;
      case 'RESOLVED':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-zinc-500" />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 text-zinc-900 font-sans pb-16">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <span className="font-bold tracking-tight text-lg">CivicPulse</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-6">
        <div className="flex flex-col items-center p-6 bg-blue-600 text-white rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold mb-2">See a civic issue?</h2>
          <p className="text-blue-100 mb-6 text-center text-sm">
            Help improve your city by reporting potholes, leaks, and more.
          </p>
          <button
            onClick={() => onNavigate('report')}
            className="flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition shadow-sm"
          >
            <PlusCircle className="h-5 w-5" />
            Report a Problem
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
          
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
            </div>
          ) : activities.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-500 shadow-sm">
              You haven't reported any issues yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div 
                  key={activity.id}
                  onClick={() => {
                    if (activity.status === 'REJECTED') {
                      onNavigate('rejection');
                    } else if (activity.status === 'AWAITING_CLARIFICATION') {
                      onNavigate('clarification', activity.id);
                    } else if (activity.status === 'NEW') {
                      onNavigate('submission-pending', activity.id);
                    } else {
                      onNavigate('report-detail', activity.id);
                    }
                  }}
                  className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                      {getStatusIcon(activity.status)}
                    </div>
                    <div>
                      <h4 className="font-semibold">{activity.category || 'Unknown Issue'}</h4>
                      <p className="text-xs text-zinc-500 font-medium mt-1">Status: {activity.status.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {activity.created_at ? new Date(activity.created_at.toMillis()).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-zinc-200 flex items-center justify-around px-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button onClick={() => onNavigate('home')} className="flex flex-col items-center gap-1 text-blue-600 w-16">
          <Home className="h-6 w-6" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => onNavigate('map')} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-900 transition w-16">
          <MapIcon className="h-6 w-6" />
          <span className="text-[10px] font-medium">Map</span>
        </button>
        <button onClick={() => onNavigate('report')} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-900 transition w-16">
          <PlusCircle className="h-6 w-6" />
          <span className="text-[10px] font-medium">Report</span>
        </button>
        <button onClick={() => onNavigate('profile')} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-900 transition w-16">
          <UserIcon className="h-6 w-6" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  );
}
