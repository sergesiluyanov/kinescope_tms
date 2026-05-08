import { api } from './client';
import type { Project } from '@/types/tms';

export interface ProjectCreatePayload {
  name: string;
  description?: string | null;
}

export interface ProjectUpdatePayload {
  name?: string;
  description?: string | null;
}

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/api/v1/projects');
  return data;
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await api.get<Project>(`/api/v1/projects/${id}`);
  return data;
}

export async function createProject(payload: ProjectCreatePayload): Promise<Project> {
  const { data } = await api.post<Project>('/api/v1/projects', payload);
  return data;
}

export async function updateProject(
  id: number,
  payload: ProjectUpdatePayload,
): Promise<Project> {
  const { data } = await api.patch<Project>(`/api/v1/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/api/v1/projects/${id}`);
}
