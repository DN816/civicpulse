"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyHealthReport = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const genai_1 = require("@google/genai");
exports.weeklyHealthReport = (0, scheduler_1.onSchedule)({
    schedule: 'every monday 08:00',
    region: 'asia-south1',
    timeZone: 'UTC'
}, async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const weekEnd = now;
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStartTimestamp = admin.firestore.Timestamp.fromDate(weekStart);
    const weekEndTimestamp = admin.firestore.Timestamp.fromDate(weekEnd);
    // --- 1. Aggregate Firestore data for the past 7 days ---
    // Total new reports created
    const newReportsSnap = await db.collection('reports')
        .where('created_at', '>=', weekStartTimestamp)
        .where('created_at', '<=', weekEndTimestamp)
        .get();
    const totalNewReports = newReportsSnap.size;
    // Total reports resolved
    let totalResolved = 0;
    let totalEscalated = 0;
    let totalSLABreaches = 0;
    // Count resolved, escalated, SLA breaches from reports created in the window
    // Also check all reports that were updated in this period
    const allReportsSnap = await db.collection('reports').get();
    const zoneResolution = {};
    for (const doc of allReportsSnap.docs) {
        const data = doc.data();
        const zoneId = data.zone_id || 'unassigned';
        // Initialize zone tracking
        if (!zoneResolution[zoneId]) {
            zoneResolution[zoneId] = { resolved: 0, total: 0 };
        }
        zoneResolution[zoneId].total++;
        if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
            zoneResolution[zoneId].resolved++;
            // Count recently resolved
            if (data.updated_at && data.updated_at.toMillis() >= weekStart.getTime()) {
                totalResolved++;
            }
        }
        if (data.status === 'ESCALATED') {
            if (data.updated_at && data.updated_at.toMillis() >= weekStart.getTime()) {
                totalEscalated++;
            }
        }
        if (data.escalation_sent === true) {
            if (data.sla_deadline && data.sla_deadline.toMillis() >= weekStart.getTime()) {
                totalSLABreaches++;
            }
        }
    }
    // Resolution rate per zone
    const zoneResolutionRates = {};
    for (const [zoneId, stats] of Object.entries(zoneResolution)) {
        const rate = stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : '0.0';
        zoneResolutionRates[zoneId] = `${rate}%`;
    }
    // Top 5 unresolved clusters by priority score
    const unresolvedClustersSnap = await db.collection('clusters')
        .where('status', '==', 'active')
        .orderBy('priority_score', 'desc')
        .limit(5)
        .get();
    const topUnresolvedClusters = unresolvedClustersSnap.docs.map(doc => {
        const d = doc.data();
        return {
            category: d.category,
            severity: d.severity,
            affected_count: d.affected_count,
            priority_score: d.priority_score,
            zone_id: d.zone_id || 'unassigned'
        };
    });
    // Worst-performing zones by resolution rate
    const worstZones = Object.entries(zoneResolution)
        .filter(([_, stats]) => stats.total > 0)
        .sort((a, b) => {
        const rateA = a[1].resolved / a[1].total;
        const rateB = b[1].resolved / b[1].total;
        return rateA - rateB;
    })
        .slice(0, 3)
        .map(([zoneId, stats]) => ({
        zone_id: zoneId,
        resolution_rate: `${((stats.resolved / stats.total) * 100).toFixed(1)}%`,
        total_issues: stats.total,
        resolved_issues: stats.resolved
    }));
    // --- 2. Pass aggregated data to Gemini 1.5 Flash ---
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
        total_citizens_affected: allReportsSnap.size
    };
    const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
You are CivicPulse, an AI-powered civic issue reporting platform.
Write a public-facing Weekly City Health Report based on the following data.

The report should be:
- Written as readable prose narrative, NOT a list of numbers
- Suitable for citizens, journalists, and city officials to read
- Maximum 600 words
- Include: top unresolved problems, worst-performing zones, total affected citizens, SLA deadline misses, and resolution rate per zone
- Professional but accessible tone

Data for the week of ${aggregatedData.week_start} to ${aggregatedData.week_end}:

New reports this week: ${aggregatedData.total_new_reports}
Reports resolved this week: ${aggregatedData.total_resolved}
Reports escalated this week: ${aggregatedData.total_escalated}
SLA breaches this week: ${aggregatedData.total_sla_breaches}
Total citizens affected (all time): ${aggregatedData.total_citizens_affected}

Resolution rate by zone:
${JSON.stringify(aggregatedData.resolution_rate_by_zone, null, 2)}

Top 5 unresolved clusters (by priority score):
${JSON.stringify(aggregatedData.top_5_unresolved_clusters, null, 2)}

Worst-performing zones:
${JSON.stringify(aggregatedData.worst_performing_zones, null, 2)}

Write the report now. Return only the report text, no JSON wrapping.
`;
    let reportText = 'Weekly health report data is being compiled. Please check back later.';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [prompt]
        });
        reportText = response.text ?? reportText;
    }
    catch (err) {
        console.error('Error generating health report with Gemini:', err);
    }
    // --- 3. Write to health_reports collection ---
    await db.collection('health_reports').add({
        generated_at: admin.firestore.FieldValue.serverTimestamp(),
        report_text: reportText,
        week_start: weekStartTimestamp,
        week_end: weekEndTimestamp,
        aggregated_data: aggregatedData
    });
    console.log(`Weekly health report generated for week ${aggregatedData.week_start} to ${aggregatedData.week_end}`);
});
//# sourceMappingURL=cf8_weeklyHealthReport.js.map