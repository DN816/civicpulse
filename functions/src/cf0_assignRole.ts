import { auth } from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const assignDefaultRole = auth.user().onCreate(async (user) => {
  await admin.auth().setCustomUserClaims(user.uid, { role: 'citizen' });

  await admin.firestore().collection('users').doc(user.uid).set({
    id: user.uid,
    role: 'citizen',
    display_name: user.displayName || '',
    email: user.email || '',
    verified_account: false,
    trust_score: 0,
    trust_layer1: 0,
    trust_layer2: 0,
    total_points: 0,
    fcm_token: null,
    zone_id: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
});