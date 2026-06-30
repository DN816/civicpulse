import { auth } from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

import { calculateLevel } from './utils/gamification';

export const assignDefaultRole = auth.user().onCreate(async (user) => {
  await admin.auth().setCustomUserClaims(user.uid, { role: 'citizen' });

  const db = admin.firestore();

  await db.collection('users').doc(user.uid).set({
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

  const { level, title } = calculateLevel(0);
  await db.collection('citizen_stats').doc(user.uid).set({
    total_xp: 0,
    level,
    level_title: title,
    badges: [],
    reports_submitted: 0,
    reports_resolved: 0,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });
});