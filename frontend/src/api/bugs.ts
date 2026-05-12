import { api } from './client';
import type {
  Bug,
  BugCreatePayload,
  BugListFilters,
  BugSummary,
  BugUpdatePayload,
} from '@/types/bugs';

export async function listBugs(
  projectId: number,
  filters: BugListFilters = {},
): Promise<BugSummary[]> {
  const params: Record<string, string | number> = {};
  if (filters.status) params.status = filters.status;
  if (filters.severity) params.severity = filters.severity;
  if (filters.priority) params.priority = filters.priority;
  if (filters.assignee_id != null) params.assignee_id = filters.assignee_id;
  if (filters.reporter_id != null) params.reporter_id = filters.reporter_id;
  if (filters.search) params.search = filters.search;

  const { data } = await api.get<BugSummary[]>(
    `/api/v1/projects/${projectId}/bugs`,
    { params },
  );
  return data;
}

export async function getBug(id: number): Promise<Bug> {
  const { data } = await api.get<Bug>(`/api/v1/bugs/${id}`);
  return data;
}

export async function createBug(
  projectId: number,
  payload: BugCreatePayload,
): Promise<Bug> {
  const { data } = await api.post<Bug>(
    `/api/v1/projects/${projectId}/bugs`,
    payload,
  );
  return data;
}

export async function updateBug(
  id: number,
  payload: BugUpdatePayload,
): Promise<Bug> {
  const { data } = await api.patch<Bug>(`/api/v1/bugs/${id}`, payload);
  return data;
}

export async function deleteBug(id: number): Promise<void> {
  await api.delete(`/api/v1/bugs/${id}`);
}
