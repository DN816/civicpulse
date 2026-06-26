"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAuthorityAction = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const geminiCompare_1 = require("./utils/geminiCompare");
exports.onAuthorityAction = (0, firestore_1.onDocumentCreated)({
    document: 'report_events/{eventId}',
    region: 'asia-south2',
    database: '(default)',
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const eventData = snap.data();
    // Only process work_completed events
    if (eventData.event_type !== 'work_completed')
        return;
    const db = admin.firestore();
    const reportId = eventData.report_id;
    const afterPhotoUrl = eventData.after_photo_url;
    if (!reportId || !afterPhotoUrl) {
        console.error('CF3: Missing report_id or after_photo_url on event document');
        return;
    }
    // STEP 1 — Retrieve the before photo from the original report
    const reportRef = db.collection('reports').doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
        console.error(`CF3: Report ${reportId} not found`);
        return;
    }
    const report = reportSnap.data();
    const beforePhotoUrl = report.photo_url;
    if (!beforePhotoUrl) {
        console.error(`CF3: Report ${reportId} has no photo_url`);
        return;
    }
    // STEP 2 & 3 — Call Gemini Vision to compare before/after photos
    let validationResult;
    try {
        validationResult = await (0, geminiCompare_1.compareBeforeAfterPhotos)(beforePhotoUrl, afterPhotoUrl);
    }
    catch (error) {
        console.error('CF3: Gemini before/after comparison failed:', error);
        // Store a fallback validation result so the pipeline isn't blocked
        validationResult = {
            fix_appears_genuine: false,
            confidence: 0,
            reasoning: 'AI comparison failed — manual review recommended.',
        };
    }
    // Store Gemini response on the report document
    await reportRef.update({
        resolution_validation: validationResult,
        after_photo_url: afterPhotoUrl,
    });
    // STEP 4 — Open 48-hour dispute window
    const currentAttempt = (report.resolution_attempt || 0) + 1;
    const now = new Date();
    const disputeWindowCloses = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    await reportRef.update({
        status: 'AWAITING_CONFIRMATION',
        dispute_window_closes_at: admin.firestore.Timestamp.fromDate(disputeWindowCloses),
        resolution_attempt: currentAttempt,
    });
    // STEP 5 — Send FCM to all affected citizens
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
    const clusterData = clusterSnap.data();
    const affectedCitizenIds = clusterData.affected_citizen_ids || [];
    // Send FCM notification to each affected citizen
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
                    body: 'The authority has marked this issue as resolved. Is it actually fixed?',
                },
                data: {
                    type: 'dispute',
                    report_id: reportId,
                    resolution_attempt: String(currentAttempt),
                },
            });
        }
        catch (fcmError) {
            console.warn(`CF3: FCM failed for citizen ${citizenId}:`, fcmError);
        }
    }
    console.log(`CF3: Dispute window opened for report ${reportId}, attempt ${currentAttempt}, closes at ${disputeWindowCloses.toISOString()}`);
});
//# sourceMappingURL=cf3_onAuthorityAction.js.map