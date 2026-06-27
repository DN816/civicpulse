"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClusterUpdated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
exports.onClusterUpdated = (0, firestore_1.onDocumentUpdated)({
    document: 'clusters/{clusterId}',
    region: 'asia-south2',
    database: '(default)'
}, async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    if (!beforeData || !afterData)
        return;
    const db = admin.firestore();
    const clusterId = event.params.clusterId;
    // --- 1. Recalculate priority_score ---
    // PriorityScore = Severity × ln(AffectedCount + 1) × DaysOpen × TrustFactor
    // Severity: Low = 1, Medium = 2, High = 3
    const severityMap = {
        'Low': 1,
        'Medium': 2,
        'High': 3,
    };
    const severityValue = severityMap[afterData.severity] ?? 1;
    // AffectedCount
    const affectedCount = afterData.affected_count ?? 1;
    // DaysOpen = (NOW() - cluster.created_at) in fractional days
    const createdAt = afterData.created_at;
    let daysOpen = 1; // default to 1 day minimum to avoid 0 score
    if (createdAt) {
        const createdMs = createdAt.toMillis();
        daysOpen = Math.max(0.01, (Date.now() - createdMs) / (1000 * 60 * 60 * 24));
    }
    // TrustFactor = 0.5 + 0.5 × (trust_score / 100), range [0.5, 1.0]
    const trustScore = afterData.trust_score ?? 50;
    const trustFactor = 0.5 + 0.5 * (trustScore / 100);
    // Final formula
    const priorityScore = severityValue * Math.log(affectedCount + 1) * daysOpen * trustFactor;
    // --- 2. Update cluster.priority_score ---
    const updatePayload = {
        priority_score: Math.round(priorityScore * 100) / 100, // round to 2 decimals
    };
    // --- 3. Update cluster.status based on linked report statuses ---
    // Query all reports linked to this cluster
    const reportsSnap = await db.collection('reports')
        .where('cluster_id', '==', clusterId)
        .get();
    if (!reportsSnap.empty) {
        const reportStatuses = reportsSnap.docs.map(doc => doc.data().status);
        if (reportStatuses.length > 0) {
            const allResolved = reportStatuses.every(s => s === 'RESOLVED');
            const allClosed = reportStatuses.every(s => s === 'CLOSED');
            if (allResolved) {
                updatePayload.status = 'resolved';
            }
            else if (allClosed) {
                updatePayload.status = 'closed';
            }
            else {
                updatePayload.status = 'active';
            }
        }
    }
    // Only write if something actually changed to prevent infinite loops
    const needsUpdate = afterData.priority_score !== updatePayload.priority_score ||
        afterData.status !== updatePayload.status;
    if (needsUpdate) {
        await db.collection('clusters').doc(clusterId).update(updatePayload);
    }
});
//# sourceMappingURL=cf2_onClusterUpdated.js.map