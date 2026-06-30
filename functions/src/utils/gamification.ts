import * as admin from 'firebase-admin';

/* ─── Level definitions ─── */

const LEVELS = [
  { level: 1, title: 'Newcomer', xpRequired: 0 },
  { level: 2, title: 'Active Citizen', xpRequired: 500 },
  { level: 3, title: 'Neighborhood Watch', xpRequired: 1500 },
  { level: 4, title: 'Civic Contributor', xpRequired: 3500 },
  { level: 5, title: 'Community Pillar', xpRequired: 7500 },
  { level: 6, title: 'Civic Champion', xpRequired: 15000 },
] as const;

export function calculateLevel(totalXp: number): { level: number; title: string } {
  let result: { level: number; title: string } = { level: LEVELS[0].level, title: LEVELS[0].title };
  for (const l of LEVELS) {
    if (totalXp >= l.xpRequired) {
      result = { level: l.level, title: l.title };
    }
  }
  return result;
}

export function getNextLevelProgress(totalXp: number): { currentXp: number; nextXp: number; progress: number } {
  let current: { level: number; title: string; xpRequired: number } = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXp >= l.xpRequired) current = l;
  }
  const currentIndex = LEVELS.findIndex(l => l.level === current.level);
  if (currentIndex === LEVELS.length - 1) {
    return { currentXp: totalXp, nextXp: totalXp, progress: 1 };
  }
  const next = LEVELS[currentIndex + 1];
  const prev = current.xpRequired;
  return {
    currentXp: totalXp - prev,
    nextXp: next.xpRequired - prev,
    progress: Math.min((totalXp - prev) / (next.xpRequired - prev), 1),
  };
}

/* ─── Badge definitions ─── */

export interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  unlockHint: string;
}

export const BADGE_DEFINITIONS: BadgeInfo[] = [
  { id: 'first_steps', name: 'First Steps', description: 'Submitted your first report', unlockHint: 'Submit your first report' },
  { id: 'problem_solver', name: 'Problem Solver', description: '5 of your reports have been resolved', unlockHint: 'Get 5 reports resolved' },
  { id: 'eagle_eye', name: 'Eagle Eye', description: '10 of your reports have been resolved', unlockHint: 'Get 10 reports resolved' },
  { id: 'streaker', name: 'Streaker', description: 'Submitted reports in 3 different weeks within the last 30 days', unlockHint: 'Submit reports in 3 different weeks within 30 days' },
  { id: 'zone_hero', name: 'Zone Hero', description: '5 resolved reports within the same zone', unlockHint: 'Get 5 reports resolved in the same zone' },
];

/* ─── Internal stats shape ─── */

interface CitizenStats {
  total_xp: number;
  level: number;
  level_title: string;
  reports_submitted: number;
  reports_resolved: number;
  badges: string[];
}

/* ─── Badge check functions ─── */

async function badgeFirstSteps(_db: admin.firestore.Firestore, _userId: string, stats: CitizenStats): Promise<boolean> {
  return stats.reports_submitted >= 1;
}

async function badgeProblemSolver(_db: admin.firestore.Firestore, _userId: string, stats: CitizenStats): Promise<boolean> {
  return stats.reports_resolved >= 5;
}

async function badgeEagleEye(_db: admin.firestore.Firestore, _userId: string, stats: CitizenStats): Promise<boolean> {
  return stats.reports_resolved >= 10;
}

async function badgeStreaker(db: admin.firestore.Firestore, userId: string, _stats: CitizenStats): Promise<boolean> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const snap = await db.collection('reports')
    .where('citizen_id', '==', userId)
    .where('created_at', '>=', thirtyDaysAgo)
    .get();

  const weeks = new Set<string>();
  snap.forEach(doc => {
    const ts = doc.data().created_at;
    if (ts?.toDate) weeks.add(getYearWeek(ts.toDate()));
  });

  return weeks.size >= 3;
}

async function badgeZoneHero(db: admin.firestore.Firestore, userId: string, _stats: CitizenStats): Promise<boolean> {
  const snap = await db.collection('reports')
    .where('citizen_id', '==', userId)
    .where('status', '==', 'RESOLVED')
    .get();

  const zoneCount: Record<string, number> = {};
  snap.forEach(doc => {
    const zoneId = doc.data().zone_id;
    if (zoneId) zoneCount[zoneId] = (zoneCount[zoneId] || 0) + 1;
  });

  return Object.values(zoneCount).some(count => count >= 5);
}

function getYearWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const BADGE_CHECKS: Record<string, (db: admin.firestore.Firestore, userId: string, stats: CitizenStats) => Promise<boolean>> = {
  first_steps: badgeFirstSteps,
  problem_solver: badgeProblemSolver,
  eagle_eye: badgeEagleEye,
  streaker: badgeStreaker,
  zone_hero: badgeZoneHero,
};

/* ─── Award result ─── */

export interface AwardResult {
  newTotalXp: number;
  newLevel: number;
  newLevelTitle: string;
  newlyUnlockedBadges: string[];
}

/* ─── Award XP with optional counter increments ─── */

export async function awardXp(
  db: admin.firestore.Firestore,
  userId: string,
  amount: number,
  reason: string,
  options?: {
    report_id?: string;
    cluster_id?: string;
    incrementSubmitted?: number;
    incrementResolved?: number;
  }
): Promise<AwardResult> {
  const statsRef = db.collection('citizen_stats').doc(userId);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(statsRef);
    const existing = snap.data() as CitizenStats | undefined;

    const newSubmitted = (existing?.reports_submitted ?? 0) + (options?.incrementSubmitted ?? 0);
    const newResolved = (existing?.reports_resolved ?? 0) + (options?.incrementResolved ?? 0);
    const newXp = (existing?.total_xp ?? 0) + amount;
    const prevBadges = existing?.badges ?? [];

    const { level: newLevel, title: newLevelTitle } = calculateLevel(newXp);

    txn.set(statsRef, {
      total_xp: newXp,
      level: newLevel,
      level_title: newLevelTitle,
      badges: prevBadges,
      reports_submitted: newSubmitted,
      reports_resolved: newResolved,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const historyRef = db.collection('citizen_stats').doc(userId).collection('xp_history').doc();
    txn.set(historyRef, {
      amount,
      reason,
      report_id: options?.report_id ?? null,
      cluster_id: options?.cluster_id ?? null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  /* ─── Re-read and check badges (outside txn to allow queries) ─── */

  const freshSnap = await statsRef.get();
  const freshStats = freshSnap.data() as CitizenStats | undefined;
  if (!freshStats) {
    return { newTotalXp: 0, newLevel: 1, newLevelTitle: LEVELS[0].title, newlyUnlockedBadges: [] };
  }

  const newlyUnlocked: string[] = [];
  for (const [id, checkFn] of Object.entries(BADGE_CHECKS)) {
    if (freshStats.badges.includes(id)) continue;
    try {
      if (await checkFn(db, userId, freshStats)) {
        await statsRef.update({
          badges: admin.firestore.FieldValue.arrayUnion(id),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        newlyUnlocked.push(id);
      }
    } catch (err) {
      console.error(`gamification: badge check "${id}" failed for user ${userId}:`, err);
    }
  }

  return {
    newTotalXp: freshStats.total_xp,
    newLevel: freshStats.level,
    newLevelTitle: freshStats.level_title,
    newlyUnlockedBadges: newlyUnlocked,
  };
}

