import React from 'react';

type BadgeStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'closed'
  | string;

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const normStatus = status?.toLowerCase() || '';

  let bgColors = 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // default

  if (normStatus === 'critical') {
    bgColors = 'bg-red-500/10 text-red-400 border-red-500/20';
  } else if (normStatus === 'high') {
    bgColors = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  } else if (normStatus === 'medium') {
    bgColors = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  } else if (normStatus === 'low' || normStatus === 'resolved') {
    bgColors = 'bg-green-500/10 text-green-400 border-green-500/20';
  } else if (normStatus === 'reported' || normStatus === 'assigned' || normStatus === 'in_progress') {
    bgColors = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }

  const label = status?.replace('_', ' ').toUpperCase() || 'UNKNOWN';

  return (
    <span
      className={`font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full border ${bgColors} ${className}`}
    >
      {label}
    </span>
  );
};
