import React from 'react';
import { getStatusColor, getStatusLabel } from '../../utils/themeHelpers';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colors = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className={`rounded-lg border-2 border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text} ${className}`}
    >
      {label}
    </span>
  );
}
