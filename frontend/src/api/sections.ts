import { api } from './client';
import type { Section } from '@/types/tms';

export interface SectionCreatePayload {
  name: string;
  description?: string | null;
  parent_id?: number | null;
}

export interface SectionUpdatePayload {
  name?: string;
  description?: string | null;
  parent_id?: number | null;
  position?: number;
}

export async function listSections(projectId: number): Promise<Section[]> {
  const { data } = await api.get<Section[]>(`/api/v1/projects/${projectId}/sections`);
  return data;
}

export async function createSection(
  projectId: number,
  payload: SectionCreatePayload,
): Promise<Section> {
  const { data } = await api.post<Section>(
    `/api/v1/projects/${projectId}/sections`,
    payload,
  );
  return data;
}

export async function updateSection(
  id: number,
  payload: SectionUpdatePayload,
): Promise<Section> {
  const { data } = await api.patch<Section>(`/api/v1/sections/${id}`, payload);
  return data;
}

export async function deleteSection(id: number): Promise<void> {
  await api.delete(`/api/v1/sections/${id}`);
}
