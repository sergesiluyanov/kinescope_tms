import { api } from './client';
import type {
  TestRun,
  TestRunCreatePayload,
  TestRunItem,
  TestRunItemUpdatePayload,
  TestRunShare,
  TestRunSummary,
  TestRunUpdatePayload,
} from '@/types/testRuns';

export async function listTestRuns(projectId: number): Promise<TestRunSummary[]> {
  const { data } = await api.get<TestRunSummary[]>(
    `/api/v1/projects/${projectId}/test-runs`,
  );
  return data;
}

export async function getTestRun(id: number): Promise<TestRun> {
  const { data } = await api.get<TestRun>(`/api/v1/test-runs/${id}`);
  return data;
}

export async function createTestRun(
  projectId: number,
  payload: TestRunCreatePayload,
): Promise<TestRun> {
  const { data } = await api.post<TestRun>(
    `/api/v1/projects/${projectId}/test-runs`,
    payload,
  );
  return data;
}

export async function updateTestRun(
  id: number,
  payload: TestRunUpdatePayload,
): Promise<TestRun> {
  const { data } = await api.patch<TestRun>(`/api/v1/test-runs/${id}`, payload);
  return data;
}

export async function deleteTestRun(id: number): Promise<void> {
  await api.delete(`/api/v1/test-runs/${id}`);
}

export async function updateTestRunItem(
  itemId: number,
  payload: TestRunItemUpdatePayload,
): Promise<TestRunItem> {
  const { data } = await api.patch<TestRunItem>(
    `/api/v1/test-run-items/${itemId}`,
    payload,
  );
  return data;
}

/** Скачать HTML-отчёт по прогону. Возвращает Blob для download-триггера. */
export async function fetchTestRunReport(id: number): Promise<Blob> {
  const { data } = await api.get<Blob>(
    `/api/v1/test-runs/${id}/report.html`,
    {
      params: { download: 1 },
      responseType: 'blob',
      headers: { Accept: 'text/html' },
    },
  );
  return data;
}

/**
 * Создать (или получить существующую) публичную share-ссылку на отчёт.
 * Идемпотентно: если токен уже есть — вернёт его без пересоздания,
 * чтобы не сломать уже разосланные ссылки.
 */
export async function createTestRunShareLink(id: number): Promise<TestRunShare> {
  const { data } = await api.post<TestRunShare>(
    `/api/v1/test-runs/${id}/share`,
  );
  return data;
}

/** Отозвать публичную ссылку — прежний токен перестаёт работать. */
export async function revokeTestRunShareLink(id: number): Promise<void> {
  await api.delete(`/api/v1/test-runs/${id}/share`);
}
