const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const email = process.argv[2];
const role = process.argv[3];
const zoneId = process.argv[4] || 'A1';

if (!email || !role) {
  console.log('Usage: node setRole.js <email> <role> [zoneId]');
  process.exit(1);
}

async function setRole() {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role });
    
    // Update Firestore as well
    const db = admin.firestore();
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

setRole();
