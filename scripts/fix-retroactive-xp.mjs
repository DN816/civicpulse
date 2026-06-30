import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = 'civicpulse-2e523';
if (!getApps().length) {
  const sa = JSON.parse(readFileSync('D:\\CivicPulse\\serviceAccount.json', 'utf8'));
  initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
}
const db = getFirestore();

async function main() {
  const clusterId = 'uMGFsnKn40FEIcJTjXov';
  const reportId = 'lPgFh8eDwCalVhSxddhx';

  const clusterSnap = await db.collection('clusters').doc(clusterId).get();
  const cluster = clusterSnap.data();
  const affectedCitizenIds = cluster?.affected_citizen_ids ?? [];
  const alreadyPaid = cluster?.xp_resolve_awarded_citizens ?? [];

  console.log(`Cluster ${clusterId}: affected=${JSON.stringify(affectedCitizenIds)}, paid=${JSON.stringify(alreadyPaid)}`);

  const unpaid = affectedCitizenIds.filter(id => !alreadyPaid.includes(id));
  console.log(`Unpaid citizens: ${JSON.stringify(unpaid)}`);

  for (const citizenId of unpaid) {
    const statsRef = db.collection('citizen_stats').doc(citizenId);
    await db.runTransaction(async (txn) => {
      const snap = await txn.get(statsRef);
      const existing = snap.data();
      const newXp = (existing?.total_xp ?? 0) + 375;
      const newResolved = (existing?.reports_resolved ?? 0) + 1;
      const newSubmitted = existing?.reports_submitted ?? 0;
      const prevBadges = existing?.badges ?? [];

      const LEVELS = [
        { level: 1, title: 'Newcomer', xpRequired: 0 },
        { level: 2, title: 'Active Citizen', xpRequired: 500 },
        { level: 3, title: 'Neighborhood Watch', xpRequired: 1500 },
        { level: 4, title: 'Civic Contributor', xpRequired: 3500 },
        { level: 5, title: 'Community Pillar', xpRequired: 7500 },
        { level: 6, title: 'Civic Champion', xpRequired: 15000 },
      ];
      let newLevel = LEVELS[0];
      for (const l of LEVELS) {
        if (newXp >= l.xpRequired) newLevel = l;
      }

      txn.set(statsRef, {
        total_xp: newXp,
        level: newLevel.level,
        level_title: newLevel.title,
        badges: prevBadges,
        reports_submitted: newSubmitted,
        reports_resolved: newResolved,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });

      const historyRef = db.collection('citizen_stats').doc(citizenId).collection('xp_history').doc();
      txn.set(historyRef, {
        amount: 375,
        reason: 'Report resolved (retroactive fix)',
        report_id: reportId,
        cluster_id: clusterId,
        created_at: FieldValue.serverTimestamp(),
      });

      console.log(`Awarded 375 XP + resolved+1 to ${citizenId}`);
    });
  }

  // Mark cluster as paid
  if (unpaid.length > 0) {
    await db.collection('clusters').doc(clusterId).update({
      xp_resolve_awarded_citizens: FieldValue.arrayUnion(...unpaid),
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`Marked cluster ${clusterId} as paid`);
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
