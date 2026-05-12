import type { BugUserRef } from './bugs';
import type { TestCasePriority, TestStep } from './tms';

export type TestRunStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'aborted';

export type TestRunItemStatus =
  | 'untested'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'skipped';

export interface TestRunStats {
  total: number;
  untested: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
}

export interface TestRunItem {
  id: number;
  test_run_id: number;
  test_case_id: number | null;
  title: string;
  preconditions: string | null;
  steps: TestStep[];
  priority: TestCasePriority;
  tags: string[];
  status: TestRunItemStatus;
  comment: string | null;
  assignee: BugUserRef | null;
  executed_by: BugUserRef | null;
  executed_at: string | null;
  linked_bug_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TestRunSummary {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  status: TestRunStatus;
  environment: string | null;
  created_by: BugUserRef | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  stats: TestRunStats;
}

export interface TestRun extends TestRunSummary {
  items: TestRunItem[];
}

export interface TestRunCreatePayload {
  name: string;
  description?: string | null;
  environment?: string | null;
  section_ids: number[];
  include_subsections?: boolean;
  case_ids?: number[];
}

export interface TestRunUpdatePayload {
  name?: string;
  description?: string | null;
  environment?: string | null;
  status?: TestRunStatus;
}

export interface TestRunItemUpdatePayload {
  status?: TestRunItemStatus;
  comment?: string | null;
  assignee_id?: number | null;
  linked_bug_id?: number | null;
}
