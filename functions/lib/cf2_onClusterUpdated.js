"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClusterUpdated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const clusterStatus_1 = require("./utils/clusterStatus");
exports.onClusterUpdated = (0, firestore_1.onDocumentUpdated)({
    document: 'clusters/{clusterId}',
    region: 'asia-south2',
    database: '(default)',
}, async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    if (!beforeData || !afterData)
        return;
    const db = admin.firestore();
    const clusterId = event.params.clusterId;
    const severityMap = {
        Low: 1,
        Medium: 2,
        High: 3,
    };
    const severityValue = severityMap[afterData.severity] ?? 1;
    const affectedCount = afterData.affected_count ?? 1;
    const createdAt = afterData.created_at;
    let daysOpen = 1;
    if (createdAt && typeof createdAt.toMillis === 'function') {
        const createdMs = createdAt.toMillis();
        daysOpen = Math.max(1, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)));
    }
    const trustScore = afterData.trust_score ?? 50;
    const trustFactor = 0.5 + 0.5 * (trustScore / 100);
    const priorityScore = Math.round(severityValue * Math.log(affectedCount + 1) * daysOpen * trustFactor * 100) / 100;
    const updatePayload = {};
    if (afterData.priority_score !== priorityScore) {
        updatePayload.priority_score = priorityScore;
    }
    const reportsSnap = await db.collection('reports').where('cluster_id', '==', clusterId).get();
    if (!reportsSnap.empty) {
        const reportStatuses = reportsSnap.docs.map((doc) => doc.data().status);
        if (reportStatuses.length > 0) {
            const allResolved = reportStatuses.every((s) => s === 'RESOLVED');
            const allClosed = reportStatuses.every((s) => s === 'CLOSED');
            let derivedStatus;
            if (allResolved) {
                derivedStatus = 'resolved';
            }
            else if (allClosed) {
                derivedStatus = 'closed';
            }
            else if (reportStatuses.includes('REOPENED')) {
                derivedStatus = 'reopened';
            }
            else if (reportStatuses.includes('ESCALATED')) {
                derivedStatus = 'escalated';
            }
            else if (reportStatuses.includes('IN_PROGRESS')) {
                derivedStatus = 'in_progress';
            }
            else if (reportStatuses.includes('ASSIGNED')) {
                derivedStatus = 'assigned';
            }
            else if (reportStatuses.includes('IN_REVIEW')) {
                derivedStatus = 'in_review';
            }
            else {
                derivedStatus = (0, clusterStatus_1.reportStatusToClusterStatus)(reportStatuses[0]) || afterData.status || 'active';
            }
            if (afterData.status !== derivedStatus) {
                updatePayload.status = derivedStatus;
            }
        }
    }
    if (Object.keys(updatePayload).length === 0) {
        return;
    }
    await db.collection('clusters').doc(clusterId).update(updatePayload);
});
//# sourceMappingURL=cf2_onClusterUpdated.js.map