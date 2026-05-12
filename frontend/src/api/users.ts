import { api } from './client';
import type { User, UserRole } from '@/types/auth';

export async function listUsers(activeOnly = true): Promise<User[]> {
  const { data } = await api.get<User[]>('/api/v1/users', {
    params: { active_only: activeOnly },
  });
  return data;
}

export interface UserAdminUpdatePayload {
  role?: UserRole;
  is_active?: boolean;
}

export async function updateUser(
  id: number,
  payload: UserAdminUpdatePayload,
): Promise<User> {
  const { data } = await api.patch<User>(`/api/v1/users/${id}`, payload);
  return data;
}
