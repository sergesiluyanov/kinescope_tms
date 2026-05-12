import { api } from './client';
import type { User } from '@/types/auth';

export async function listUsers(activeOnly = true): Promise<User[]> {
  const { data } = await api.get<User[]>('/api/v1/users', {
    params: { active_only: activeOnly },
  });
  return data;
}
