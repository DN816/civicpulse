/**
 * Inspect test account setup in Firestore (uses Firebase CLI credentials).
 * Run: node scripts/inspect-test-accounts.mjs
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const TEST_ACCOUNTS = {
  citizen: { email: 'dhruvn0801@gmail.com', expectedRole: 'citizen' },
  authority: { email: 'sudhirgupta001@gmail.com', expectedRole: 'authority' },
};

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: 'civicpulse-2e523',
  });
}

const db = getFirestore();
const auth = getAuth();

console.log('\n=== Test account inspection ===\n');

for (const [label, { email, expectedRole }] of Object.entries(TEST_ACCOUNTS)) {
  console.log(`--- ${label.toUpperCase()}: ${email} ---`);
  try {
    const user = await auth.getUserByEmail(email);
    const claims = user.customClaims || {};
    const roleOk = claims.role === expectedRole;
    console.log(`  UID: ${user.uid}`);
    console.log(`  Email verified: ${user.emailVerified}`);
    console.log(`  Custom claim role: ${claims.role ?? '(none)'} ${roleOk ? '✓' : '✗ expected ' + expectedRole}`);
    console.log(`  Providers: ${user.providerData.map((p) => p.providerId).join(', ') || 'password'}`);

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      console.log(`  Firestore users/{uid}: role=${data.role}, zone_id=${data.zone_id ?? '(none)'}`);
      if (expectedRole === 'authority' && !data.zone_id) {
        console.log('  ⚠ Authority has no zone_id — dashboard may show all clusters with warning');
      }
    } else {
      console.log('  ✗ Missing users/{uid} document');
    }

    if (expectedRole === 'citizen') {
      const reports = await db.collection('reports').where('citizen_id', '==', user.uid).limit(5).get();
      console.log(`  Reports (sample): ${reports.size}`);
      reports.forEach((d) => {
        const r = d.data();
        console.log(`    - ${d.id}: status=${r.status}, category=${r.category || '(pending)'}`);
      });
    }

    if (expectedRole === 'authority') {
      const zoneId = userDoc.data()?.zone_id;
      const clusters = await db.collection('clusters').limit(20).get();
      let visible = 0;
      clusters.forEach((d) => {
        const c = d.data();
        const terminal = ['resolved', 'closed'].includes((c.status || '').toLowerCase());
        if (terminal) return;
        if (!zoneId || !c.zone_id || c.zone_id === zoneId) visible++;
      });
      console.log(`  Non-terminal clusters visible (approx): ${visible}`);
    }
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  }
  console.log('');
}

console.log('Done.\n');
