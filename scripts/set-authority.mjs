/**
 * Promote a Firebase Auth user to authority (custom claim + Firestore users doc).
 * Run: node scripts/set-authority.mjs [email] [zone_id]
 * Requires: serviceAccount.json in project root OR gcloud auth application-default login
 */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function projectIdFromEnv() {
  try {
    const env = readFileSync('.env', 'utf8');
    const m = env.match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  } catch {
    // fall through
  }
  return 'civicpulse-2e523';
}

const email = process.argv[2] || 'sudhirgupta001@gmail.com';
const zoneId = process.argv[3] || 'A1';
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

const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, { role: 'authority' });

const displayName =
  user.displayName || user.email?.split('@')[0] || 'Authority User';

await db.collection('users').doc(user.uid).set(
  {
    id: user.uid,
    role: 'authority',
    email: user.email || email,
    display_name: displayName,
    zone_id: zoneId,
    verified_account: true,
    trust_score: 0,
    trust_layer1: 0,
    trust_layer2: 0,
    total_points: 0,
    fcm_token: null,
    updated_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
  },
  { merge: true }
);

console.log('Authority setup complete:');
console.log(`  Email:    ${email}`);
console.log(`  UID:      ${user.uid}`);
console.log(`  Role:     authority (custom claim + Firestore)`);
console.log(`  Zone:     ${zoneId}`);
console.log('\nUser must sign out and sign back in for the new role to take effect.');
