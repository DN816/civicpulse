import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
  const p = new URL('../serviceAccount.json', import.meta.url);
  if (existsSync(p)) {
    const sa = JSON.parse(readFileSync(p, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
  }
}

const auth = getAuth();
const db = getFirestore();
const email = 'authority@civicpulse.demo';

const user = await auth.getUserByEmail(email);
const uid = user.uid;
console.log('User:', email, uid);
console.log('Claims before:', JSON.stringify(user.customClaims));

// Force-set the role
await auth.setCustomUserClaims(uid, { role: 'authority' });
console.log('Custom claim set: role = authority');

// Update Firestore doc
await db.collection('users').doc(uid).set({
  id: uid,
  role: 'authority',
  email: email,
  display_name: 'authority',
  zone_id: 'A1',
  verified_account: true,
  trust_score: 0,
  trust_layer1: 0,
  trust_layer2: 0,
  total_points: 0,
  fcm_token: null,
  updated_at: FieldValue.serverTimestamp(),
  created_at: FieldValue.serverTimestamp(),
}, { merge: true });
console.log('Firestore doc updated');

// Verify
const updated = await auth.getUser(uid);
console.log('Claims after:', JSON.stringify(updated.customClaims));
console.log('Done');
