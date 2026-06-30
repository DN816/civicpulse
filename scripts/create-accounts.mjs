import { readFileSync, existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function projectIdFromEnv() {
  try {
    const env = readFileSync('.env', 'utf8');
    const m = env.match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  } catch {}
  return 'civicpulse-2e523';
}

const projectId = projectIdFromEnv();

if (!getApps().length) {
  const serviceAccountPath = new URL('../serviceAccount.json', import.meta.url);
  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id || projectId });
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
  }
}

const auth = getAuth();
const db = getFirestore();

const accounts = [
  { email: 'authority@civicpulse.demo', password: 'Demo@123', role: 'authority', zone: 'A1' },
  { email: 'moderator@civicpulse.demo', password: 'Demo@123', role: 'moderator', zone: null },
  { email: 'citizen@civicpulse.demo', password: 'Demo@123', role: 'citizen', zone: null },
];

for (const { email, password, role, zone } of accounts) {
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  Already exists: ${email} (${existing.uid})`);
    uid = existing.uid;
  } catch {
    const user = await auth.createUser({ email, password, displayName: email.split('@')[0] });
    uid = user.uid;
    console.log(`  Created: ${email} (${uid})`);
  }

  await auth.setCustomUserClaims(uid, { role });

  const displayName = email.split('@')[0];
  const docData = {
    id: uid,
    role,
    email,
    display_name: displayName,
    verified_account: true,
    trust_score: 0,
    trust_layer1: 0,
    trust_layer2: 0,
    total_points: 0,
    fcm_token: null,
    zone_id: zone,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(uid).set(docData, { merge: true });
  console.log(`  Firestore doc written: users/${uid}`);

  if (role === 'citizen') {
    const { level, title } = { level: 1, title: 'Newcomer' };
    await db.collection('citizen_stats').doc(uid).set({
      total_xp: 0, level, level_title: title,
      badges: [], reports_submitted: 0, reports_resolved: 0,
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`  citizen_stats doc written: citizen_stats/${uid}`);
  }
}

console.log('\nAll accounts ready. Users must sign out and sign back in for roles to take effect.');
