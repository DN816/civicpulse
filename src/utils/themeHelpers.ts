export const getSeverityColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case 'high':
      return { bg: 'bg-severity-high-bg', text: 'text-severity-high', border: 'border-severity-high/20' };
    case 'medium':
      return { bg: 'bg-severity-medium-bg', text: 'text-severity-medium', border: 'border-severity-medium/20' };
    case 'low':
      return { bg: 'bg-severity-low-bg', text: 'text-severity-low', border: 'border-severity-low/20' };
    default:
      return { bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
  }
};

export const getStatusColor = (status: string) => {
  const normalized = status?.toLowerCase().replace(/ /g, '_') ?? '';
  switch (normalized) {
    case 'new':
    case 'awaiting_clarification':
      return { bg: 'bg-tertiary-container/30', text: 'text-tertiary' };
    case 'assigned':
    case 'in_progress':
    case 'approved':
    case 'in_review':
    case 'active':
      return { bg: 'bg-secondary-container', text: 'text-secondary' };
    case 'escalated':
      return { bg: 'bg-secondary-container', text: 'text-secondary' };
    case 'resolved':
    case 'closed':
      return { bg: 'bg-primary', text: 'text-text-inverse' };
    case 'reopened':
    case 'rejected':
      return { bg: 'bg-severity-high-bg', text: 'text-severity-high' };
    default:
      return { bg: 'bg-surface-container', text: 'text-on-surface-variant' };
  }
};

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    IN_REVIEW: 'In Review',
    in_review: 'In Review',
    IN_PROGRESS: 'In Progress',
    in_progress: 'In Progress',
    AWAITING_CLARIFICATION: 'Needs Clarification',
    awaiting_clarification: 'Needs Clarification',
  };

  if (labels[status]) return labels[status];

  if (!status) return 'UNKNOWN';

  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
