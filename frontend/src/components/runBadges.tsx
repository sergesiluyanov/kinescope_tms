import type { TestRunItemStatus, TestRunStatus } from '@/types/testRuns';

export const RUN_STATUS_LABEL: Record<TestRunStatus, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  completed: 'Завершён',
  aborted: 'Прерван',
};

export const RUN_STATUS_BADGE: Record<TestRunStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  aborted: 'bg-orange-50 text-orange-700 border-orange-200',
};

export const ITEM_STATUS_LABEL: Record<TestRunItemStatus, string> = {
  untested: 'Не пройден',
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
  skipped: 'Skipped',
};

export const ITEM_STATUS_BADGE: Record<TestRunItemStatus, string> = {
  untested: 'bg-slate-100 text-slate-600 border-slate-200',
  passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  blocked: 'bg-orange-50 text-orange-700 border-orange-200',
  skipped: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const ITEM_STATUS_DOT: Record<TestRunItemStatus, string> = {
  untested: 'bg-slate-300',
  passed: 'bg-emerald-500',
  failed: 'bg-red-500',
  blocked: 'bg-orange-500',
  skipped: 'bg-slate-400',
};

export const ALL_ITEM_STATUSES: TestRunItemStatus[] = [
  'passed',
  'failed',
  'blocked',
  'skipped',
];
