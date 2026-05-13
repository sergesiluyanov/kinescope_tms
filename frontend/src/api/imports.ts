import { api } from './client';

export interface ImportCasePreview {
  external_id: string | null;
  section_path: string[];
  title: string;
  steps_count: number;
  has_preconditions: boolean;
  priority: string;
  tags: string[];
}

export interface ImportPreviewResponse {
  total_cases: number;
  section_paths: string[][];
  issues: string[];
  sample: ImportCasePreview[];
}

export interface ImportCommitResponse {
  cases_created: number;
  sections_created: number;
}

export interface ImportOptions {
  dropRoot: boolean;
  splitInlineSteps: boolean;
}

function buildForm(file: File, options: ImportOptions): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('drop_root_section', options.dropRoot ? 'true' : 'false');
  form.append('split_inline_steps', options.splitInlineSteps ? 'true' : 'false');
  return form;
}

export async function previewXlsxImport(
  projectId: number,
  file: File,
  options: ImportOptions,
): Promise<ImportPreviewResponse> {
  const { data } = await api.post<ImportPreviewResponse>(
    `/api/v1/projects/${projectId}/import/xlsx/preview`,
    buildForm(file, options),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function commitXlsxImport(
  projectId: number,
  file: File,
  options: ImportOptions,
): Promise<ImportCommitResponse> {
  const { data } = await api.post<ImportCommitResponse>(
    `/api/v1/projects/${projectId}/import/xlsx`,
    buildForm(file, options),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}
