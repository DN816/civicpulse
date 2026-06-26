"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onDisputeVote = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
exports.onDisputeVote = (0, firestore_1.onDocumentCreated)({
    document: 'dispute_votes/{voteId}',
    region: 'asia-south2',
    database: '(default)',
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const voteData = snap.data();
    const reportId = voteData.report_id;
    const citizenId = voteData.citizen_id;
    const attempt = voteData.resolution_attempt;
    const voteValue = voteData.vote; // 'yes' or 'no'
    if (!reportId || !citizenId || !attempt || !voteValue) {
        console.error('CF4: Missing required fields on vote document');
        return;
    }
    const db = admin.firestore();
    const reportRef = db.collection('reports').doc(reportId);
    // STEP 1 — Verify the vote is within the open dispute window
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
        console.error(`CF4: Report ${reportId} not found`);
        return;
    }
    const report = reportSnap.data();
    // Check if window is still open
    const windowCloses = report.dispute_window_closes_at;
    if (windowCloses) {
        const closesAt = windowCloses.toDate ? windowCloses.toDate() : new Date(windowCloses);
        if (new Date() > closesAt) {
            console.log(`CF4: Dispute window closed for report ${reportId}. Vote discarded.`);
            // Delete the vote document since the window is closed
            await snap.ref.delete();
            return;
        }
    }
    // Check if the report status is still AWAITING_CONFIRMATION
    if (report.status !== 'AWAITING_CONFIRMATION') {
        console.log(`CF4: Report ${reportId} status is ${report.status}, not AWAITING_CONFIRMATION. Vote discarded.`);
        await snap.ref.delete();
        return;
    }
    // STEP 2 — Duplicate check via transaction
    // The document was already created by the client using the path convention:
    // dispute_votes/{reportId}_{attempt}_{citizenId}
    // The onCreate trigger fires after the write, so the document exists.
    // We need to check if there's ANOTHER vote from the same citizen for the same (report, attempt).
    // Since the path IS the canonical ID, if the document was created, it's unique by definition.
    // However, we still need to handle the case where the client doesn't use the canonical path.
    // Count existing votes from this citizen for this report+attempt (excluding this one)
    const existingVotes = await db.collection('dispute_votes')
        .where('report_id', '==', reportId)
        .where('resolution_attempt', '==', attempt)
        .where('citizen_id', '==', citizenId)
        .get();
    if (existingVotes.size > 1) {
        // More than one vote from this citizen — delete this duplicate
        console.log(`CF4: Duplicate vote from citizen ${citizenId} for report ${reportId}. Discarding.`);
        await snap.ref.delete();
        return;
    }
    // STEP 3 — Count total No votes for this (report_id, resolution_attempt)
    const noVotes = await db.collection('dispute_votes')
        .where('report_id', '==', reportId)
        .where('resolution_attempt', '==', attempt)
        .where('vote', '==', 'no')
        .get();
    const D = noVotes.size;
    // STEP 4 — If D >= 3, immediately reopen
    if (D >= 3) {
        await reportRef.update({ status: 'REOPENED' });
        console.log(`CF4: Report ${reportId} REOPENED — ${D} No votes reached threshold`);
        // Send FCM to all affected citizens
        const clusterId = report.cluster_id;
        if (clusterId) {
            const clusterSnap = await db.collection('clusters').doc(clusterId).get();
            if (clusterSnap.exists) {
                const affectedCitizenIds = clusterSnap.data()?.affected_citizen_ids || [];
                for (const cId of affectedCitizenIds) {
                    try {
                        const userSnap = await db.collection('users').doc(cId).get();
                        const fcmToken = userSnap.data()?.fcm_token;
                        if (!fcmToken)
                            continue;
                        await admin.messaging().send({
                            token: fcmToken,
                            notification: {
                                title: 'CivicPulse',
                                body: 'This issue has been reopened after citizen disputes.',
                            },
                            data: {
                                type: 'status_update',
                                report_id: reportId,
                            },
                        });
                    }
                    catch (fcmError) {
                        console.warn(`CF4: FCM failed for citizen ${cId}:`, fcmError);
                    }
                }
            }
        }
        return;
    }
    // STEP 5 — D < 3: do nothing further. CF5 handles the rest when the window closes.
    console.log(`CF4: Vote recorded for report ${reportId}. D=${D}, waiting for window close.`);
});
//# sourceMappingURL=cf4_onDisputeVote.js.map