import React from 'react';
import { getSeverityColor } from '../../utils/themeHelpers';

interface SeverityBadgeProps {
  severity: string;
  className?: string;
}

export default function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const colors = getSeverityColor(severity);
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-[12px] font-semibold border ${colors.bg} ${colors.text} ${colors.border} ${className}`}>
      {severity}
    </span>
  );
}
