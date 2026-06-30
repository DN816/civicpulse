"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReportSubmitted = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const gemini_1 = require("./utils/gemini");
const clustering_1 = require("./utils/clustering");
const trustScore_1 = require("./utils/trustScore");
const gamification_1 = require("./utils/gamification");
function calculateSLAHours(severity, trustScore) {
    if (severity === 'High') {
        if (trustScore >= 80)
            return 24;
        if (trustScore >= 50)
            return 72;
        return 168;
    }
    if (severity === 'Medium') {
        if (trustScore >= 80)
            return 72;
        return 168;
    }
    return 336;
}
function getZoneId(lat, lng) {
    if (lat > 30 && lng > 76)
        return 'A1';
    if (lat > 30 && lng <= 76)
        return 'A2';
    if (lat <= 30 && lng > 76)
        return 'B1';
    return 'B2';
}
exports.onReportSubmitted = (0, firestore_1.onDocumentCreated)({
    document: 'reports/{reportId}',
    region: 'asia-south2',
    database: '(default)',
    memory: '512MiB',
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    try {
        const report = snap.data();
        const db = admin.firestore();
        const serverTimestamp = Date.now();
        const deviceTimestamp = report.device_timestamp;
        if (!deviceTimestamp || typeof deviceTimestamp.toDate !== 'function') {
            throw new Error('Invalid or missing device_timestamp on report');
        }
        const classification = await (0, gemini_1.classifyReportPhoto)(report.photo_url, report.description ?? null);
        if (!classification.is_civic_issue) {
            await snap.ref.update({ status: 'REJECTED', updated_at: admin.firestore.FieldValue.serverTimestamp() });
            return;
        }
        if (classification.needs_clarification && classification.classifier_confidence < 0.7) {
            await snap.ref.update({
                status: 'AWAITING_CLARIFICATION',
                clarification_question: classification.clarification_question,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }
        await snap.ref.update({
            category: classification.category,
            severity: classification.severity,
            classifier_confidence: classification.classifier_confidence,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const match = await (0, clustering_1.findMatchingCluster)(classification.category, report.lat, report.lng, deviceTimestamp.toDate());
        if (match) {
            const clusterRef = db.collection('clusters').doc(match.clusterId);
            const updateResult = await db.runTransaction(async (transaction) => {
                const clusterSnap = await transaction.get(clusterRef);
                if (!clusterSnap.exists)
                    return null;
                const clusterData = clusterSnap.data();
                const existingIds = clusterData.affected_citizen_ids ?? [];
                const existingCount = clusterData.affected_count ?? 0;
                const isNewCitizen = !existingIds.includes(report.citizen_id);
                transaction.update(clusterRef, {
                    affected_citizen_ids: [...existingIds, report.citizen_id],
                    affected_count: isNewCitizen ? existingCount + 1 : existingCount,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                const centroidLat = match.centroid_lat;
                const centroidLng = match.centroid_lng;
                const totalItems = existingCount + (isNewCitizen ? 1 : 0);
                const newCentroidLat = (centroidLat * existingCount + report.lat) / totalItems;
                const newCentroidLng = (centroidLng * existingCount + report.lng) / totalItems;
                transaction.update(clusterRef, {
                    centroid_lat: newCentroidLat,
                    centroid_lng: newCentroidLng,
                });
                return {
                    existingSlaDeadline: clusterData.sla_deadline ?? null,
                    zoneId: clusterData.zone_id || null,
                    affectedCount: isNewCitizen ? existingCount + 1 : existingCount,
                };
            });
            if (!updateResult) {
                await snap.ref.update({
                    status: 'ERROR',
                    error_message: 'Cluster not found during transaction',
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                return;
            }
            const { existingSlaDeadline, zoneId, affectedCount } = updateResult;
            const trust_layer1_cluster = (0, trustScore_1.computeLayer1)({
                classifier_confidence: classification.classifier_confidence,
                geo_accuracy_meters: report.geo_accuracy_meters,
                photo_count: 1,
                device_timestamp: deviceTimestamp.toMillis(),
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
                escalation_sent: false,
                zone_id: zoneId,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            await awardSubmitXp(db, snap.ref, report.citizen_id, snap.id, match.clusterId);
            await sendCitizenFCM(report.citizen_id, affectedCount);
            return;
        }
        const trust_layer1 = (0, trustScore_1.computeLayer1)({
            classifier_confidence: classification.classifier_confidence,
            geo_accuracy_meters: report.geo_accuracy_meters,
            photo_count: 1,
            device_timestamp: deviceTimestamp.toMillis(),
            server_timestamp: serverTimestamp,
            photo_timestamp: report.photo_timestamp ? report.photo_timestamp.toMillis() : null,
        });
        await snap.ref.update({
            trust_layer1,
            trust_score: trust_layer1,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const clusterRef = db.collection('clusters').doc();
        const slaHours = calculateSLAHours(classification.severity, trust_layer1);
        const slaDeadlineMs = serverTimestamp + slaHours * 60 * 60 * 1000;
        const slaDeadline = admin.firestore.Timestamp.fromMillis(slaDeadlineMs);
        const zoneId = getZoneId(report.lat, report.lng);
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
            zone_id: zoneId,
            sla_deadline: slaDeadline,
            escalation_sent: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const duplicateMatch = await (0, clustering_1.findMatchingCluster)(classification.category, report.lat, report.lng, deviceTimestamp.toDate());
        if (duplicateMatch && duplicateMatch.clusterId !== clusterRef.id) {
            const existingClusterRef = db.collection('clusters').doc(duplicateMatch.clusterId);
            const existingClusterSnap = await existingClusterRef.get();
            const existingClusterData = existingClusterSnap.data();
            if (existingClusterData) {
                const existingIds = existingClusterData.affected_citizen_ids ?? [];
                const isNewCitizen = !existingIds.includes(report.citizen_id);
                await existingClusterRef.update({
                    affected_citizen_ids: [...existingIds, report.citizen_id],
                    affected_count: isNewCitizen ? (existingClusterData.affected_count ?? 0) + 1 : (existingClusterData.affected_count ?? 0),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                await clusterRef.delete();
                const existingSlaDeadline = existingClusterData.sla_deadline ?? null;
                const postClusterStatus = trust_layer1 < 20 ? 'IN_REVIEW' : 'ASSIGNED';
                await snap.ref.update({
                    cluster_id: duplicateMatch.clusterId,
                    status: postClusterStatus,
                    sla_deadline: existingSlaDeadline,
                    escalation_sent: false,
                    zone_id: existingClusterData.zone_id || zoneId,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                await awardSubmitXp(db, snap.ref, report.citizen_id, snap.id, duplicateMatch.clusterId);
                await sendCitizenFCM(report.citizen_id, isNewCitizen ? (existingClusterData.affected_count ?? 0) + 1 : (existingClusterData.affected_count ?? 0));
                return;
            }
        }
        const postClassificationStatus = trust_layer1 < 20 ? 'IN_REVIEW' : 'ASSIGNED';
        await snap.ref.update({
            cluster_id: clusterRef.id,
            status: postClassificationStatus,
            sla_deadline: slaDeadline,
            escalation_sent: false,
            zone_id: zoneId,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        await awardSubmitXp(db, snap.ref, report.citizen_id, snap.id, clusterRef.id);
        await sendCitizenFCM(report.citizen_id, 1);
    }
    catch (error) {
        console.error('CF1: Pipeline failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        await snap.ref.update({
            status: 'ERROR',
            error_message: message.slice(0, 500),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
async function awardSubmitXp(db, reportRef, citizenId, reportId, clusterId) {
    const currentSnap = await reportRef.get();
    if (currentSnap.data()?.xp_submit_awarded)
        return;
    await reportRef.update({ xp_submit_awarded: true, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    const statsSnap = await db.collection('citizen_stats').doc(citizenId).get();
    const isFirstReport = (statsSnap.data()?.reports_submitted ?? 0) === 0;
    await (0, gamification_1.awardXp)(db, citizenId, 50, 'Report submitted', {
        report_id: reportId,
        cluster_id: clusterId ?? undefined,
        incrementSubmitted: 1,
    });
    if (isFirstReport) {
        await (0, gamification_1.awardXp)(db, citizenId, 100, 'First report bonus', {
            report_id: reportId,
            cluster_id: clusterId ?? undefined,
        });
    }
}
async function sendCitizenFCM(citizenId, affectedCount) {
    try {
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
    catch (fcmError) {
        console.warn(`CF1: FCM failed for citizen ${citizenId}:`, fcmError);
    }
}
//# sourceMappingURL=cf1_onReportSubmitted.js.map