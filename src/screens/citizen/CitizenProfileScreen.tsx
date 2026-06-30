import React, { useEffect, useState } from 'react';
import { auth, db } from '../../config/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { LogOut, Medal, Trophy, Star, Target, Sparkles, TrendingUp, CalendarDays, CheckCircle2, Eye, Layers, MapPin, Lock } from 'lucide-react';
import CitizenHeader from '../../components/citizen/CitizenHeader';
import { BADGE_DEFINITIONS } from '../../types';
import type { CitizenStats, XpHistoryEntry } from '../../types';

interface CitizenProfileScreenProps {
  onNavigateOut: (screen: 'welcome' | 'signin' | 'create-account' | 'router') => void;
}

const LEVELS = [
  { level: 1, title: 'Newcomer', xpRequired: 0 },
  { level: 2, title: 'Active Citizen', xpRequired: 500 },
  { level: 3, title: 'Neighborhood Watch', xpRequired: 1500 },
  { level: 4, title: 'Civic Contributor', xpRequired: 3500 },
  { level: 5, title: 'Community Pillar', xpRequired: 7500 },
  { level: 6, title: 'Civic Champion', xpRequired: 15000 },
];

const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_steps: Star,
  problem_solver: CheckCircle2,
  eagle_eye: Eye,
  streaker: CalendarDays,
  zone_hero: MapPin,
};

function getLevelProgress(totalXp: number): { currentXp: number; nextXp: number; progress: number; level: number; title: string } {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXp >= l.xpRequired) current = l;
  }
  const currentIndex = LEVELS.findIndex(l => l.level === current.level);
  if (currentIndex === LEVELS.length - 1) {
    return { currentXp: totalXp, nextXp: totalXp, progress: 1, level: current.level, title: current.title };
  }
  const next = LEVELS[currentIndex + 1];
  const prev = current.xpRequired;
  return {
    currentXp: totalXp - prev,
    nextXp: next.xpRequired - prev,
    progress: Math.min((totalXp - prev) / (next.xpRequired - prev), 1),
    level: current.level,
    title: current.title,
  };
}

export default function CitizenProfileScreen({ onNavigateOut }: CitizenProfileScreenProps) {
  const user = auth.currentUser;
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Community Hero';
  const [stats, setStats] = useState<CitizenStats | null>(null);
  const [xpHistory, setXpHistory] = useState<XpHistoryEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubStats = onSnapshot(doc(db, 'citizen_stats', user.uid), (snap) => {
      if (snap.exists()) setStats(snap.data() as CitizenStats);
    });
    const historyQuery = query(
      collection(db, 'citizen_stats', user.uid, 'xp_history'),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      const entries: XpHistoryEntry[] = [];
      snap.forEach((d) => entries.push({ id: d.id, ...d.data() } as XpHistoryEntry));
      setXpHistory(entries);
    });
    return () => { unsubStats(); unsubHistory(); };
  }, [user]);

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigateOut('welcome');
  };

  const totalXp = stats?.total_xp ?? 0;
  const reportsSubmitted = stats?.reports_submitted ?? 0;
  const reportsResolved = stats?.reports_resolved ?? 0;
  const earnedBadges = stats?.badges ?? [];

  const progress = getLevelProgress(totalXp);
  const nextLevel = LEVELS.find(l => l.level === progress.level + 1);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-36 font-sans">
      <CitizenHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6">
        {/* Avatar & Level */}
        <section className="flex flex-col items-center">
          <div className="relative">
            <div className="rounded-full border-4 border-border bg-gradient-to-br from-secondary-container to-secondary p-2 shadow-[0_4px_0_0_rgba(0,0,0,0.2)]">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-border bg-surface-container-highest">
                <span className="font-display text-4xl font-bold text-primary">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border-2 border-border bg-secondary-container px-4 py-1.5 text-xs font-bold text-secondary shadow-[0_4px_0_0_#6f5900]">
              <Medal className="h-4 w-4" />
              Level {progress.level} &mdash; {progress.title}
            </div>
          </div>

          <div className="mt-8 text-center">
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-text-primary">{displayName}</h2>
            <p className="mt-1 text-base font-bold text-on-surface-variant">{totalXp.toLocaleString()} Total XP</p>
          </div>
        </section>

        {/* XP Progress Bar */}
        <section className="rounded-xl border-4 border-border bg-surface-container-lowest p-4 shadow-[4px_4px_0_0_var(--cp-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-on-surface-variant">
              {nextLevel ? `Next: ${nextLevel.title}` : 'Max Level'}
            </span>
            <span className="text-xs font-bold text-on-surface-variant">
              {progress.currentXp.toLocaleString()} / {progress.nextXp.toLocaleString()} XP
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border-2 border-border bg-background">
            <div
              className="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-all duration-500"
              style={{ width: `${Math.min(progress.progress * 100, 100)}%` }}
            />
          </div>
        </section>

        {/* Stats Cards */}
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border-4 border-border bg-surface-container-lowest p-4 shadow-[4px_4px_0_0_var(--cp-border)]">
            <Trophy className="h-5 w-5 text-primary mb-2" />
            <p className="font-display text-2xl font-semibold">{totalXp.toLocaleString()}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total XP</p>
          </div>
          <div className="rounded-xl border-4 border-border bg-surface-container-lowest p-4 shadow-[4px_4px_0_0_var(--cp-border)]">
            <CheckCircle2 className="h-5 w-5 text-secondary mb-2" />
            <p className="font-display text-2xl font-semibold">{reportsSubmitted}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Submitted</p>
          </div>
          <div className="rounded-xl border-4 border-border bg-surface-container-lowest p-4 shadow-[4px_4px_0_0_var(--cp-border)]">
            <Target className="h-5 w-5 text-primary-container mb-2" />
            <p className="font-display text-2xl font-semibold">{reportsResolved}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Resolved</p>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            Badges
            <span className="text-xs font-normal text-on-surface-variant lowercase">
              ({earnedBadges.length}/{BADGE_DEFINITIONS.length})
            </span>
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {BADGE_DEFINITIONS.map((badge) => {
              const earned = earnedBadges.includes(badge.id);
              const Icon = BADGE_ICONS[badge.id] || Star;
              return (
                <div
                  key={badge.id}
                  className={`rounded-xl border-4 border-border p-3 text-center transition-all ${
                    earned
                      ? 'bg-surface-container-lowest shadow-[4px_4px_0_0_var(--cp-border)]'
                      : 'bg-background opacity-50'
                  }`}
                >
                  <div className={`mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-lg border-2 border-border ${
                    earned ? 'bg-primary-container' : 'bg-background'
                  }`}>
                    <Icon className={`h-5 w-5 ${earned ? 'text-primary-dark' : 'text-on-surface-variant'}`} />
                  </div>
                  <p className="text-[9px] font-bold leading-tight text-text-primary">{badge.name}</p>
                  {!earned && (
                    <p className="text-[7px] text-on-surface-variant mt-0.5 leading-tight">{badge.unlockHint}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* XP History */}
        <section>
          <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-secondary" />
            Recent XP
          </h3>
          <div className="flex flex-col gap-2">
            {xpHistory.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-4">No XP earned yet. Submit a report to get started!</p>
            )}
            {xpHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border-2 border-border bg-surface-container-lowest px-4 py-3 shadow-[2px_2px_0_0_var(--cp-border)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-border ${
                    entry.amount > 0 ? 'bg-primary-container' : 'bg-background'
                  }`}>
                    <Sparkles className={`h-4 w-4 ${entry.amount > 0 ? 'text-primary-dark' : 'text-on-surface-variant'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{entry.reason}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {entry.created_at?.toDate().toLocaleDateString() || '—'}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 font-bold text-sm ${
                  entry.amount > 0 ? 'text-status-success' : 'text-on-surface-variant'
                }`}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount} XP
                </span>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={handleSignOut}
          className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-4 border-border bg-surface-container-lowest font-bold text-text-primary shadow-[4px_4px_0_0_var(--cp-border)]"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </main>
    </div>
  );
}
