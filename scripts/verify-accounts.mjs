import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
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
  const p = new URL('../serviceAccount.json', import.meta.url);
  if (existsSync(p)) {
    const sa = JSON.parse(readFileSync(p, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
  }
}

const auth = getAuth();
const emails = ['citizen@civicpulse.demo', 'authority@civicpulse.demo', 'moderator@civicpulse.demo'];

for (const email of emails) {
  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { emailVerified: true });
  console.log('  Verified: ' + email);
}

console.log('Done');
