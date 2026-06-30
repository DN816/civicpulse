import { ClusterStatus } from '../types';

const CLUSTER_STATUS_SET = new Set<string>([
  'active',
  'assigned',
  'in_review',
  'in_progress',
  'resolved',
  'closed',
  'reopened',
  'escalated',
]);

export function normalizeClusterStatus(status: string | undefined): ClusterStatus {
  if (!status) return 'active';
  const lower = status.toLowerCase() as ClusterStatus;
  if (CLUSTER_STATUS_SET.has(lower)) return lower;

  const fromReport: Record<string, ClusterStatus> = {
    NEW: 'active',
    IN_REVIEW: 'in_review',
    APPROVED: 'assigned',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    REJECTED: 'closed',
    CLOSED: 'closed',
    REOPENED: 'reopened',
    ESCALATED: 'escalated',
  };
  return fromReport[status.toUpperCase()] ?? 'active';
}

export function isClusterTerminal(status: string | undefined): boolean {
  const normalized = normalizeClusterStatus(status);
  return normalized === 'resolved' || normalized === 'closed';
}

/** Map a report status to the corresponding cluster status (lowercase). */
export function reportStatusToClusterStatus(reportStatus: string): ClusterStatus {
  return normalizeClusterStatus(reportStatus);
}
