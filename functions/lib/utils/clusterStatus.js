"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportStatusToClusterStatus = reportStatusToClusterStatus;
exports.normalizeClusterStatus = normalizeClusterStatus;
/** Maps report workflow statuses (UPPERCASE) to cluster statuses (lowercase). */
function reportStatusToClusterStatus(reportStatus) {
    const map = {
        NEW: 'active',
        AWAITING_CLARIFICATION: 'active',
        REJECTED: 'closed',
        IN_REVIEW: 'in_review',
        APPROVED: 'assigned',
        ASSIGNED: 'assigned',
        IN_PROGRESS: 'in_progress',
        RESOLVED: 'resolved',
        REOPENED: 'reopened',
        ESCALATED: 'escalated',
        CLOSED: 'closed',
        APPEAL: 'in_review',
        ERROR: 'active',
    };
    return map[reportStatus] ?? 'active';
}
function normalizeClusterStatus(status) {
    if (!status)
        return 'active';
    const lower = status.toLowerCase();
    const legacyMap = {
        active: 'active',
        assigned: 'assigned',
        in_review: 'in_review',
        in_progress: 'in_progress',
        resolved: 'resolved',
        closed: 'closed',
        reopened: 'reopened',
        escalated: 'escalated',
    };
    if (legacyMap[lower])
        return lower;
    return reportStatusToClusterStatus(status.toUpperCase());
}
//# sourceMappingURL=clusterStatus.js.map