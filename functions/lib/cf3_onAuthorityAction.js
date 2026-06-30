"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAuthorityAction = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const geminiCompare_1 = require("./utils/geminiCompare");
const clusterStatus_1 = require("./utils/clusterStatus");
const gamification_1 = require("./utils/gamification");
exports.onAuthorityAction = (0, firestore_1.onDocumentCreated)({
    document: 'report_events/{eventId}',
    region: 'asia-south2',
    database: '(default)',
    memory: '512MiB',
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const eventData = snap.data();
    if (eventData.event_type !== 'work_completed')
        return;
    const db = admin.firestore();
    const reportId = eventData.report_id;
    const afterPhotoUrl = eventData.after_photo_url;
    const eventAuthorityId = eventData.authority_id;
    if (!reportId || !afterPhotoUrl) {
        console.error('CF3: Missing report_id or after_photo_url on event document');
        return;
    }
    const reportRef = db.collection('reports').doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
        console.error(`CF3: Report ${reportId} not found`);
        return;
    }
    const report = reportSnap.data();
    if (report.authority_id && eventAuthorityId && report.authority_id !== eventAuthorityId) {
        console.warn(`CF3: authority_id mismatch for report ${reportId}. Event: ${eventAuthorityId}, Report: ${report.authority_id}`);
        return;
    }
    const beforePhotoUrl = report.photo_url;
    if (!beforePhotoUrl) {
        console.error(`CF3: Report ${reportId} has no photo_url`);
        return;
    }
    let validationResult;
    try {
        validationResult = await (0, geminiCompare_1.compareBeforeAfterPhotos)(beforePhotoUrl, afterPhotoUrl);
    }
    catch (error) {
        console.error('CF3: Gemini before/after comparison failed:', error);
        validationResult = {
            fix_appears_genuine: false,
            confidence: 0,
            reasoning: 'AI comparison failed — manual review recommended.',
        };
    }
    const currentAttempt = (report.resolution_attempt || 0) + 1;
    await reportRef.update({
        status: 'RESOLVED',
        resolution_validation: validationResult,
        after_photo_url: afterPhotoUrl,
        resolution_attempt: currentAttempt,
        authority_id: eventAuthorityId || report.authority_id || null,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (report.cluster_id) {
        await db.collection('clusters').doc(report.cluster_id).update({
            status: (0, clusterStatus_1.reportStatusToClusterStatus)('RESOLVED'),
            after_photo_url: afterPhotoUrl,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    const clusterId = report.cluster_id;
    if (!clusterId) {
        console.warn('CF3: No cluster_id on report — skipping FCM');
        return;
    }
    const clusterSnap = await db.collection('clusters').doc(clusterId).get();
    if (!clusterSnap.exists) {
        console.warn(`CF3: Cluster ${clusterId} not found — skipping FCM`);
        return;
    }
    const affectedCitizenIds = clusterSnap.data()?.affected_citizen_ids || [];
    /* ─── Award resolve XP per-citizen with idempotent tracking ─── */
    /* Uses an array per cluster so each citizen is paid at most once,
       even if the cluster contains reports from multiple citizens or
       if CF3 fires concurrently for reports in the same cluster. */
    const paidCitizens = clusterSnap.data()?.xp_resolve_awarded_citizens ?? [];
    const unpaid = affectedCitizenIds.filter(id => !paidCitizens.includes(id));
    for (const citizenId of unpaid) {
        try {
            await (0, gamification_1.awardXp)(db, citizenId, 375, 'Report resolved', {
                report_id: reportId,
                cluster_id: clusterId,
                incrementResolved: 1,
            });
        }
        catch (xpErr) {
            console.error(`CF3: XP award failed for citizen ${citizenId}:`, xpErr);
        }
    }
    if (unpaid.length > 0) {
        await db.collection('clusters').doc(clusterId).update({
            xp_resolve_awarded_citizens: admin.firestore.FieldValue.arrayUnion(...unpaid),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    for (const citizenId of affectedCitizenIds) {
        try {
            const userSnap = await db.collection('users').doc(citizenId).get();
            const fcmToken = userSnap.data()?.fcm_token;
            if (!fcmToken)
                continue;
            await admin.messaging().send({
                token: fcmToken,
                notification: {
                    title: 'CivicPulse',
                    body: 'Your reported issue has been resolved. Check the after-photo in the app.',
                },
                data: {
                    type: 'status_update',
                    report_id: reportId,
                },
            });
        }
        catch (fcmError) {
            console.warn(`CF3: FCM failed for citizen ${citizenId}:`, fcmError);
        }
    }
    console.log(`CF3: Report ${reportId} marked as resolved`);
});
//# sourceMappingURL=cf3_onAuthorityAction.js.map