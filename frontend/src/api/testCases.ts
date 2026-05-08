import { api } from './client';
import type {
  TestCase,
  TestCasePriority,
  TestCaseStatus,
  TestCaseSummary,
  TestStep,
} from '@/types/tms';

export interface TestCaseCreatePayload {
  title: string;
  preconditions?: string | null;
  steps: TestStep[];
  priority: TestCasePriority;
  tags: string[];
}

export interface TestCaseUpdatePayload {
  title?: string;
  preconditions?: string | null;
  steps?: TestStep[];
  priority?: TestCasePriority;
  status?: TestCaseStatus;
  tags?: string[];
  section_id?: number;
}

export async function listTestCases(
  sectionId: number,
  options?: { includeArchived?: boolean },
): Promise<TestCaseSummary[]> {
  const { data } = await api.get<TestCaseSummary[]>(
    `/api/v1/sections/${sectionId}/test-cases`,
    { params: { include_archived: options?.includeArchived ? 'true' : undefined } },
  );
  return data;
}

export async function getTestCase(id: number): Promise<TestCase> {
  const { data } = await api.get<TestCase>(`/api/v1/test-cases/${id}`);
  return data;
}

export async function createTestCase(
  sectionId: number,
  payload: TestCaseCreatePayload,
): Promise<TestCase> {
  const { data } = await api.post<TestCase>(
    `/api/v1/sections/${sectionId}/test-cases`,
    payload,
  );
  return data;
}

export async function updateTestCase(
  id: number,
  payload: TestCaseUpdatePayload,
): Promise<TestCase> {
  const { data } = await api.patch<TestCase>(`/api/v1/test-cases/${id}`, payload);
  return data;
}

export async function deleteTestCase(id: number): Promise<void> {
  await api.delete(`/api/v1/test-cases/${id}`);
}
