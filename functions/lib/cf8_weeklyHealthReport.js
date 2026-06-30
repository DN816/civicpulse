"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyHealthReport = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const genai_1 = require("@google/genai");
exports.weeklyHealthReport = (0, scheduler_1.onSchedule)({
    schedule: 'every monday 08:00',
    region: 'asia-south1',
    timeZone: 'UTC',
}, async () => {
    const db = admin.firestore();
    const now = new Date();
    const weekEnd = now;
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStartTimestamp = admin.firestore.Timestamp.fromDate(weekStart);
    const weekEndTimestamp = admin.firestore.Timestamp.fromDate(weekEnd);
    const newReportsSnap = await db
        .collection('reports')
        .where('created_at', '>=', weekStartTimestamp)
        .where('created_at', '<=', weekEndTimestamp)
        .get();
    const totalNewReports = newReportsSnap.size;
    const updatedReportsSnap = await db
        .collection('reports')
        .where('updated_at', '>=', weekStartTimestamp)
        .where('updated_at', '<=', weekEndTimestamp)
        .get();
    let totalResolved = 0;
    let totalEscalated = 0;
    let totalSLABreaches = 0;
    const zoneResolution = {};
    const uniqueCitizenIds = new Set();
    for (const doc of updatedReportsSnap.docs) {
        const data = doc.data();
        const zoneId = data.zone_id || 'unassigned';
        if (!zoneResolution[zoneId]) {
            zoneResolution[zoneId] = { resolved: 0, total: 0 };
        }
        zoneResolution[zoneId].total++;
        if (data.citizen_id) {
            uniqueCitizenIds.add(data.citizen_id);
        }
        if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
            zoneResolution[zoneId].resolved++;
            totalResolved++;
        }
        if (data.status === 'ESCALATED') {
            totalEscalated++;
        }
        if (data.escalation_sent === true && data.sla_deadline) {
            const slaMs = data.sla_deadline.toMillis();
            if (slaMs >= weekStart.getTime() && slaMs <= weekEnd.getTime()) {
                totalSLABreaches++;
            }
        }
    }
    const zoneResolutionRates = {};
    for (const [zoneId, stats] of Object.entries(zoneResolution)) {
        const rate = stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : '0.0';
        zoneResolutionRates[zoneId] = `${rate}%`;
    }
    const unresolvedClustersSnap = await db
        .collection('clusters')
        .where('status', 'in', ['active', 'assigned', 'in_progress', 'in_review', 'reopened', 'escalated'])
        .orderBy('priority_score', 'desc')
        .limit(5)
        .get();
    const topUnresolvedClusters = unresolvedClustersSnap.docs.map((doc) => {
        const d = doc.data();
        return {
            category: d.category,
            severity: d.severity,
            affected_count: d.affected_count,
            priority_score: d.priority_score,
            zone_id: d.zone_id || 'unassigned',
        };
    });
    const worstZones = Object.entries(zoneResolution)
        .filter(([, stats]) => stats.total > 0)
        .sort((a, b) => a[1].resolved / a[1].total - b[1].resolved / b[1].total)
        .slice(0, 3)
        .map(([zoneId, stats]) => ({
        zone_id: zoneId,
        resolution_rate: `${((stats.resolved / stats.total) * 100).toFixed(1)}%`,
        total_issues: stats.total,
        resolved_issues: stats.resolved,
    }));
    const aggregatedData = {
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        total_new_reports: totalNewReports,
        total_resolved: totalResolved,
        total_escalated: totalEscalated,
        total_sla_breaches: totalSLABreaches,
        resolution_rate_by_zone: zoneResolutionRates,
        top_5_unresolved_clusters: topUnresolvedClusters,
        worst_performing_zones: worstZones,
        total_citizens_affected: uniqueCitizenIds.size,
    };
    const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
You are CivicPulse, an AI-powered civic issue reporting platform.
Write a public-facing Weekly City Health Report based on the following data.
Maximum 600 words. Professional but accessible tone.

Data for the week of ${aggregatedData.week_start} to ${aggregatedData.week_end}:
${JSON.stringify(aggregatedData, null, 2)}

Write the report now. Return only the report text, no JSON wrapping.
`;
    let reportText = 'Weekly health report data is being compiled. Please check back later.';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [prompt],
        });
        reportText = response.text ?? reportText;
    }
    catch (err) {
        console.error('Error generating health report with Gemini:', err);
    }
    await db.collection('health_reports').add({
        generated_at: admin.firestore.FieldValue.serverTimestamp(),
        report_text: reportText,
        week_start: weekStartTimestamp,
        week_end: weekEndTimestamp,
        aggregated_data: aggregatedData,
    });
    console.log(`Weekly health report generated for week ${aggregatedData.week_start} to ${aggregatedData.week_end}`);
});
//# sourceMappingURL=cf8_weeklyHealthReport.js.map