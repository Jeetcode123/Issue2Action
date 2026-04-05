import React from 'react';
import { CheckCircle, Clock, AlertCircle, Shield, User, HelpCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IssueStatus } from '@/lib/api';

interface StatusBadgeProps {
  status: IssueStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'reported':
        return {
          label: 'Reported',
          icon: AlertCircle,
          color: 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
        };
      case 'email_sent':
        return {
          label: 'Email Sent',
          icon: Mail,
          color: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
        };
      case 'verified':
        return {
          label: 'Verified',
          icon: Shield,
          color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
        };
      case 'assigned':
        return {
          label: 'Assigned',
          icon: User,
          color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50',
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          icon: Clock,
          color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
        };
      case 'resolved':
        return {
          label: 'Resolved',
          icon: CheckCircle,
          color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50',
        };
      case 'closed':
        return {
          label: 'Closed',
          icon: CheckCircle,
          color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700',
        };
      default:
        return {
          label: status,
          icon: HelpCircle,
          color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700',
        };
    }
  };

  const { label, icon: Icon, color } = getStatusConfig(status);

  return (
    <span className={cn(
      "px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border flex items-center gap-1.5 whitespace-nowrap",
      color,
      className
    )}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};
