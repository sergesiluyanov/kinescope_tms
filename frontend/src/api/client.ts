import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

export interface HealthResponse {
  status: string;
  version: string;
  db?: string;
}

export async function fetchLiveness(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/v1/health/live');
  return data;
}

export async function fetchReadiness(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/v1/health/ready');
  return data;
}
