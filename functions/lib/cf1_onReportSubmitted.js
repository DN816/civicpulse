"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReportSubmitted = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const gemini_1 = require("./utils/gemini");
const clustering_1 = require("./utils/clustering");
const trustScore_1 = require("./utils/trustScore");
function calculateSLAHours(severity, trustScore) {
    if (severity === 'High') {
        if (trustScore >= 80)
            return 24;
        if (trustScore >= 50)
            return 72;
        return 168; // 7 days
    }
    if (severity === 'Medium') {
        if (trustScore >= 80)
            return 72;
        return 168;
    }
    return 336; // 14 days for Low severity
}
exports.onReportSubmitted = (0, firestore_1.onDocumentCreated)({
    document: 'reports/{reportId}',
    region: 'asia-south2',
    database: '(default)'
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const report = snap.data();
    const db = admin.firestore();
    const serverTimestamp = Date.now();
    // STEP 1 — Gemini Vision classification
    const classification = await (0, gemini_1.classifyReportPhoto)(report.photo_url, report.description ?? null);
    if (!classification.is_civic_issue) {
        await snap.ref.update({ status: 'REJECTED' });
        return;
    }
    if (classification.needs_clarification && classification.classifier_confidence < 0.7) {
        await snap.ref.update({
            status: 'AWAITING_CLARIFICATION',
            clarification_question: classification.clarification_question,
        });
        return;
    }
    // Update report with classification results
    await snap.ref.update({
        category: classification.category,
        severity: classification.severity,
        classifier_confidence: classification.classifier_confidence,
    });
    // STEP 2 — Clustering check
    const match = await (0, clustering_1.findMatchingCluster)(classification.category, report.lat, report.lng, report.device_timestamp.toDate());
    if (match) {
        // Add to existing cluster
        const clusterRef = db.collection('clusters').doc(match.clusterId);
        const clusterSnap = await clusterRef.get();
        const clusterData = clusterSnap.data();
        const existingSlaDeadline = clusterData?.sla_deadline ?? null;
        await clusterRef.update({
            affected_citizen_ids: admin.firestore.FieldValue.arrayUnion(report.citizen_id),
            affected_count: admin.firestore.FieldValue.increment(1),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Compute Layer 1 here too so we can determine trust category for status routing
        const trust_layer1_cluster = (0, trustScore_1.computeLayer1)({
            classifier_confidence: classification.classifier_confidence,
            geo_accuracy_meters: report.geo_accuracy_meters,
            photo_count: 1,
            device_timestamp: report.device_timestamp.toMillis(),
            server_timestamp: serverTimestamp,
            photo_timestamp: report.photo_timestamp ? report.photo_timestamp.toMillis() : null,
        });
        const postClusterStatus = trust_layer1_cluster < 20 ? 'IN_REVIEW' : 'ASSIGNED';
        await snap.ref.update({
            cluster_id: match.clusterId,
            status: postClusterStatus,
            trust_layer1: trust_layer1_cluster,
            trust_score: trust_layer1_cluster,
            sla_deadline: existingSlaDeadline,
            escalation_sent: false
        });
        // Get updated affected_count for FCM message
        const affectedCount = clusterData?.affected_count ? clusterData.affected_count + 1 : 1;
        await sendCitizenFCM(report.citizen_id, affectedCount);
        return;
    }
    // STEP 3 — Layer 1 trust score
    const trust_layer1 = (0, trustScore_1.computeLayer1)({
        classifier_confidence: classification.classifier_confidence,
        geo_accuracy_meters: report.geo_accuracy_meters,
        photo_count: 1,
        device_timestamp: report.device_timestamp.toMillis(),
        server_timestamp: serverTimestamp,
        photo_timestamp: report.photo_timestamp ? report.photo_timestamp.toMillis() : null,
    });
    await snap.ref.update({ trust_layer1, trust_score: trust_layer1 });
    // STEP 4 — Create new cluster
    const clusterRef = db.collection('clusters').doc();
    // SLA assignment from F4 Matrix
    const slaHours = calculateSLAHours(classification.severity, trust_layer1);
    const slaDeadlineMs = serverTimestamp + (slaHours * 60 * 60 * 1000);
    const slaDeadline = admin.firestore.Timestamp.fromMillis(slaDeadlineMs);
    await clusterRef.set({
        id: clusterRef.id,
        category: classification.category,
        severity: classification.severity,
        status: 'active',
        centroid_lat: report.lat,
        centroid_lng: report.lng,
        affected_count: 1,
        affected_citizen_ids: [report.citizen_id],
        priority_score: 0,
        trust_score: trust_layer1,
        zone_id: null,
        sla_deadline: slaDeadline,
        escalation_sent: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Determine post-classification status from trust category
    // HighTrust (>=80) and MediumTrust (50-79) and LowTrust (20-49) → ASSIGNED (auto-assign to authority)
    // Untrusted (<20) → IN_REVIEW (requires moderator approval before assignment)
    const postClassificationStatus = trust_layer1 < 20 ? 'IN_REVIEW' : 'ASSIGNED';
    await snap.ref.update({
        cluster_id: clusterRef.id,
        status: postClassificationStatus,
        sla_deadline: slaDeadline,
        escalation_sent: false
    });
    // STEP 5 — FCM
    await sendCitizenFCM(report.citizen_id, 1);
});
async function sendCitizenFCM(citizenId, affectedCount) {
    const userSnap = await admin.firestore().collection('users').doc(citizenId).get();
    const fcmToken = userSnap.data()?.fcm_token;
    if (!fcmToken)
        return;
    const message = affectedCount === 1
        ? "Your report has been received. We'll notify you when it's resolved."
        : `You've been added to an existing report. ${affectedCount - 1} other citizen(s) have also reported this.`;
    await admin.messaging().send({
        token: fcmToken,
        notification: { title: 'CivicPulse', body: message },
    });
}
//# sourceMappingURL=cf1_onReportSubmitted.js.map