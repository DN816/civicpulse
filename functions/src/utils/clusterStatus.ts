/** Maps report workflow statuses (UPPERCASE) to cluster statuses (lowercase). */
export function reportStatusToClusterStatus(reportStatus: string): string {
  const map: Record<string, string> = {
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

export function normalizeClusterStatus(status: string | undefined): string {
  if (!status) return 'active';
  const lower = status.toLowerCase();
  const legacyMap: Record<string, string> = {
    active: 'active',
    assigned: 'assigned',
    in_review: 'in_review',
    in_progress: 'in_progress',
    resolved: 'resolved',
    closed: 'closed',
    reopened: 'reopened',
    escalated: 'escalated',
  };
  if (legacyMap[lower]) return lower;
  return reportStatusToClusterStatus(status.toUpperCase());
}
