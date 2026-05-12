export type BugSeverity =
  | 'blocker'
  | 'critical'
  | 'major'
  | 'minor'
  | 'trivial';

export type BugPriority = 'low' | 'medium' | 'high' | 'critical';

export type BugStatus =
  | 'new'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'wont_fix';

export interface BugUserRef {
  id: number;
  email: string;
  full_name: string | null;
}

export interface BugSummary {
  id: number;
  project_id: number;
  title: string;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  tags: string[];
  reporter: BugUserRef | null;
  assignee: BugUserRef | null;
  test_case_id: number | null;
  updated_at: string;
  created_at: string;
}

export interface Bug {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  steps_to_reproduce: string | null;
  actual_result: string | null;
  expected_result: string | null;
  environment: string | null;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  tags: string[];
  reporter: BugUserRef | null;
  assignee: BugUserRef | null;
  test_case_id: number | null;
  kaiten_card_id: string | null;
  kaiten_card_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BugCreatePayload {
  title: string;
  description?: string | null;
  steps_to_reproduce?: string | null;
  actual_result?: string | null;
  expected_result?: string | null;
  environment?: string | null;
  severity?: BugSeverity;
  priority?: BugPriority;
  status?: BugStatus;
  tags?: string[];
  assignee_id?: number | null;
  test_case_id?: number | null;
}

export type BugUpdatePayload = Partial<BugCreatePayload>;

export interface BugListFilters {
  status?: BugStatus;
  severity?: BugSeverity;
  priority?: BugPriority;
  assignee_id?: number;
  reporter_id?: number;
  search?: string;
}
