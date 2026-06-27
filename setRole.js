import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

const email = process.argv[2];
const role = process.argv[3];
const zoneId = process.argv[4] || 'A1';

if (!email || !role) {
  console.log('Usage: node setRole.js <email> <role> [zoneId]');
  process.exit(1);
}

async function run() {
  const serviceAccount = JSON.parse(await readFile(new URL('./serviceAccount.json', import.meta.url)));

  initializeApp({
    credential: cert(serviceAccount)
  });

  try {
    const auth = getAuth();
    const user = await auth.getUserByEmail(email);
    
    await auth.setCustomUserClaims(user.uid, { role });
    
    const db = getFirestore();
    const updateData = { role };
    if (role === 'authority') {
      updateData.zone_id = zoneId;
    }
    
    await db.collection('users').doc(user.uid).update(updateData);
    
    console.log(`Successfully set role for ${email} to ${role}`);
    process.exit(0);
  } catch (err) {
    console.error('Error setting role:', err);
    process.exit(1);
  }
}

run();
