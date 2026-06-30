"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignDefaultRole = void 0;
const v1_1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
const gamification_1 = require("./utils/gamification");
exports.assignDefaultRole = v1_1.auth.user().onCreate(async (user) => {
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
    const { level, title } = (0, gamification_1.calculateLevel)(0);
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
//# sourceMappingURL=cf0_assignRole.js.map