import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = 'civicpulse-2e523';

if (!getApps().length) {
  const serviceAccountPath = 'D:\\CivicPulse\\serviceAccount.json';
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id || projectId });
}

const db = getFirestore();

async function main() {
  // 1. Find the citizen user
  const usersSnap = await db.collection('users').where('email', '==', 'citizen@civicpulse.demo').get();
  if (usersSnap.empty) {
    console.log('Citizen user not found');
    return;
  }
  const citizenDoc = usersSnap.docs[0];
  const citizenId = citizenDoc.id;
  console.log(`Citizen: ${citizenDoc.data().email} (${citizenId})\n`);

  // 2. Check citizen_stats
  const statsSnap = await db.collection('citizen_stats').doc(citizenId).get();
  if (statsSnap.exists) {
    console.log('citizen_stats:', JSON.stringify(statsSnap.data(), null, 2));
  } else {
    console.log('citizen_stats: NOT FOUND');
  }
  console.log();

  // 3. Check reports by this citizen
  const reportsSnap = await db.collection('reports').where('citizen_id', '==', citizenId).get();
  console.log(`Reports by citizen: ${reportsSnap.size}`);
  for (const doc of reportsSnap.docs) {
    const data = doc.data();
    console.log(`  ${doc.id}: status=${data.status}, cluster_id=${data.cluster_id || 'NONE'}, category=${data.category}, severity=${data.severity}`);
  }
  console.log();

  // 4. Check report_events
  const eventsSnap = await db.collection('report_events').get();
  console.log(`Report events: ${eventsSnap.size}`);
  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    console.log(`  ${doc.id}: event_type=${data.event_type}, report_id=${data.report_id}, cluster_id=${data.cluster_id}, has_after_photo=${!!data.after_photo_url}`);
  }
  console.log();

  // 5. Check clusters that contain this citizen's reports
  for (const report of reportsSnap.docs) {
    const clusterId = report.data().cluster_id;
    if (clusterId) {
      const clusterSnap = await db.collection('clusters').doc(clusterId).get();
      if (clusterSnap.exists) {
        const clusterData = clusterSnap.data();
        console.log(`Cluster ${clusterId}:`);
        console.log(`  status=${clusterData.status}`);
        console.log(`  affected_citizen_ids=${JSON.stringify(clusterData.affected_citizen_ids)}`);
        console.log(`  xp_resolve_awarded_citizens=${JSON.stringify(clusterData.xp_resolve_awarded_citizens)}`);
        console.log(`  report_count=${clusterData.report_count}`);
        console.log(`  category=${clusterData.category}`);
        console.log(`  centroid_lat=${clusterData.centroid_lat}, centroid_lng=${clusterData.centroid_lng}`);
        console.log(`  has after_photo_url=${!!clusterData.after_photo_url}`);
      } else {
        console.log(`Cluster ${clusterId}: NOT FOUND`);
      }
    }
  }
  console.log();

  // 6. Check xp_history
  const xpHistorySnap = await db.collection('citizen_stats').doc(citizenId).collection('xp_history').get();
  console.log(`XP history entries: ${xpHistorySnap.size}`);
  for (const doc of xpHistorySnap.docs) {
    const data = doc.data();
    console.log(`  ${doc.id}: amount=${data.amount}, reason=${data.reason}, created_at=${data.created_at?.toDate?.() || data.created_at}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
