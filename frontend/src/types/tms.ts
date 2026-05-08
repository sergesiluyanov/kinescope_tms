export type TestCasePriority = 'low' | 'medium' | 'high' | 'critical';
export type TestCaseStatus = 'active' | 'archived';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: number;
  project_id: number;
  parent_id: number | null;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TestStep {
  action: string;
  expected: string;
}

export interface TestCaseSummary {
  id: number;
  section_id: number;
  title: string;
  priority: TestCasePriority;
  status: TestCaseStatus;
  tags: string[];
  updated_at: string;
}

export interface TestCase {
  id: number;
  section_id: number;
  title: string;
  preconditions: string | null;
  steps: TestStep[];
  priority: TestCasePriority;
  status: TestCaseStatus;
  tags: string[];
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}
