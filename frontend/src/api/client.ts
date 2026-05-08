import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import type {
  LoginPayload,
  RegisterPayload,
  TokenResponse,
  User,
} from '@/types/auth';

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// --- Управление access-токеном (хранится в памяти + localStorage для перезагрузок) ---
const ACCESS_TOKEN_KEY = 'tms_access_token';

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  const stored = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (stored) accessToken = stored;
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// --- Интерсепторы ---

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

interface RetryConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<TokenResponse>(
        `${baseURL}/api/v1/auth/refresh`,
        null,
        { withCredentials: true },
      );
      setAccessToken(data.access_token);
      return data.access_token;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

api.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (!original || error.response?.status !== 401 || original._retry) {
      throw error;
    }

    // Не пытаемся рефрешиться на самих эндпоинтах auth — иначе зациклимся.
    const url = original.url ?? '';
    if (url.includes('/api/v1/auth/login') || url.includes('/api/v1/auth/refresh')) {
      throw error;
    }

    original._retry = true;
    const newToken = await refreshAccessToken();
    if (!newToken) {
      onUnauthorized?.();
      throw error;
    }
    original.headers = {
      ...(original.headers ?? {}),
      Authorization: `Bearer ${newToken}`,
    };
    return api.request(original);
  },
);

// --- API-функции ---

export interface HealthResponse {
  status: string;
  version: string;
  db?: string;
}

export async function fetchReadiness(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/v1/health/ready');
  return data;
}

export async function loginRequest(payload: LoginPayload): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/api/v1/auth/login', payload);
  setAccessToken(data.access_token);
  return data;
}

export async function registerRequest(payload: RegisterPayload): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/api/v1/auth/register', payload);
  setAccessToken(data.access_token);
  return data;
}

export async function logoutRequest(): Promise<void> {
  try {
    await api.post('/api/v1/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/api/v1/auth/me');
  return data;
}

export async function tryRestoreSession(): Promise<User | null> {
  // Если access живёт в localStorage — попробуем сразу /me. Иначе — refresh.
  if (getAccessToken()) {
    try {
      return await fetchMe();
    } catch {
      // токен мог протухнуть — упадём в refresh ниже
    }
  }
  const newToken = await refreshAccessToken();
  if (!newToken) return null;
  try {
    return await fetchMe();
  } catch {
    setAccessToken(null);
    return null;
  }
}
