import type { ReactNode } from 'react';

import type { BugPriority, BugSeverity, BugStatus } from '@/types/bugs';

export const SEVERITY_BADGE: Record<BugSeverity, string> = {
  blocker: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  major: 'bg-orange-50 text-orange-700 border-orange-200',
  minor: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  trivial: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const PRIORITY_BADGE: Record<BugPriority, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

export const STATUS_BADGE: Record<BugStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
  reopened: 'bg-orange-50 text-orange-700 border-orange-200',
  wont_fix: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const STATUS_LABEL: Record<BugStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  resolved: 'Исправлен',
  closed: 'Закрыт',
  reopened: 'Переоткрыт',
  wont_fix: 'Won’t fix',
};

export const SEVERITY_LABEL: Record<BugSeverity, string> = {
  blocker: 'Blocker',
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  trivial: 'Trivial',
};

export const PRIORITY_LABEL: Record<BugPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const ALL_STATUSES: BugStatus[] = [
  'new',
  'in_progress',
  'resolved',
  'closed',
  'reopened',
  'wont_fix',
];

export const ALL_SEVERITIES: BugSeverity[] = [
  'blocker',
  'critical',
  'major',
  'minor',
  'trivial',
];

export const ALL_PRIORITIES: BugPriority[] = ['low', 'medium', 'high', 'critical'];

export function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
