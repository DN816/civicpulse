"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateDisputeWindow = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
exports.evaluateDisputeWindow = (0, scheduler_1.onSchedule)({
    schedule: 'every 15 minutes',
    region: 'asia-south1',
    timeZone: 'UTC',
}, async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    // STEP 1 — Query for all reports where dispute window has closed
    const expiredReports = await db.collection('reports')
        .where('status', '==', 'AWAITING_CONFIRMATION')
        .where('dispute_window_closes_at', '<=', now)
        .get();
    if (expiredReports.empty) {
        console.log('CF5: No expired dispute windows found.');
        return;
    }
    console.log(`CF5: Found ${expiredReports.size} expired dispute windows to evaluate.`);
    // STEP 2 — Evaluate each expired report
    for (const reportDoc of expiredReports.docs) {
        const report = reportDoc.data();
        const reportId = reportDoc.id;
        const attempt = report.resolution_attempt || 1;
        try {
            // Count No votes (D)
            const noVotesSnap = await db.collection('dispute_votes')
                .where('report_id', '==', reportId)
                .where('resolution_attempt', '==', attempt)
                .where('vote', '==', 'no')
                .get();
            const D = noVotesSnap.size;
            // Count total responses R (Yes + No)
            const allVotesSnap = await db.collection('dispute_votes')
                .where('report_id', '==', reportId)
                .where('resolution_attempt', '==', attempt)
                .get();
            const R = allVotesSnap.size;
            let newStatus;
            let fcmMessage;
            // Apply PRD F5 logic in exact order
            if (D >= 3) {
                newStatus = 'REOPENED';
                fcmMessage = 'This issue has been reopened after citizen disputes.';
            }
            else if (D >= R && R > 0) {
                newStatus = 'REOPENED';
                fcmMessage = 'This issue has been reopened after citizen disputes.';
            }
            else if (D > 0) {
                newStatus = 'IN_REVIEW';
                fcmMessage = 'This issue has been sent to a moderator for review.';
            }
            else {
                // D === 0
                newStatus = 'RESOLVED';
                fcmMessage = 'Your reported issue has been confirmed as resolved.';
            }
            // Update report status
            await reportDoc.ref.update({ status: newStatus });
            console.log(`CF5: Report ${reportId} — D=${D}, R=${R} → status=${newStatus}`);
            // STEP 3 — Send FCM to all affected citizens
            const clusterId = report.cluster_id;
            if (clusterId) {
                const clusterSnap = await db.collection('clusters').doc(clusterId).get();
                if (clusterSnap.exists) {
                    const affectedCitizenIds = clusterSnap.data()?.affected_citizen_ids || [];
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
                                    body: fcmMessage,
                                },
                                data: {
                                    type: 'dispute_result',
                                    report_id: reportId,
                                    new_status: newStatus,
                                },
                            });
                        }
                        catch (fcmError) {
                            console.warn(`CF5: FCM failed for citizen ${citizenId}:`, fcmError);
                        }
                    }
                }
            }
            // Also notify the authority about the outcome
            if (newStatus === 'REOPENED') {
                // Authority notification
                console.log(`CF5: Report ${reportId} reopened — authority should be notified`);
            }
            else if (newStatus === 'IN_REVIEW') {
                console.log(`CF5: Report ${reportId} sent to moderator review`);
            }
            else if (newStatus === 'RESOLVED') {
                console.log(`CF5: Report ${reportId} confirmed resolved — no disputes`);
            }
        }
        catch (error) {
            console.error(`CF5: Error evaluating report ${reportId}:`, error);
            // Continue processing other reports even if one fails
        }
    }
});
//# sourceMappingURL=cf5_evaluateDisputeWindow.js.map