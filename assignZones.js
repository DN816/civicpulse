import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

async function run() {
  const serviceAccount = JSON.parse(await readFile(new URL('./serviceAccount.json', import.meta.url)));

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore();
  const clustersSnap = await db.collection('clusters').get();
  
  let count = 0;
  for (const doc of clustersSnap.docs) {
    if (!doc.data().zone_id) {
      await doc.ref.update({ zone_id: 'A1' });
      count++;
    }
  }
  
  console.log(`Updated ${count} clusters to have zone_id = 'A1'`);
}

run().catch(console.error);
