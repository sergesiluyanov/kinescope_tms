import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';

import { listUsers, updateUser, type UserAdminUpdatePayload } from '@/api/users';
import { useAuth } from '@/auth/AuthContext';
import { isAdmin } from '@/auth/permissions';
import { extractApiError } from '@/utils/errors';
import type { User, UserRole } from '@/types/auth';

const ROLES: UserRole[] = ['admin', 'qa_lead', 'qa', 'viewer'];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  qa_lead: 'QA Lead',
  qa: 'QA',
  viewer: 'Viewer',
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers(false),
    enabled: isAdmin(currentUser),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserAdminUpdatePayload }) =>
      updateUser(id, payload),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setError(extractApiError(err, 'Не удалось сохранить изменения')),
  });

  if (!isAdmin(currentUser)) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
        <p className="mt-1 text-sm text-slate-500">
          Управление ролями и активностью аккаунтов.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {usersQuery.isLoading && (
          <p className="p-5 text-sm text-slate-500">Загружаем…</p>
        )}

        {(usersQuery.data?.length ?? 0) > 0 && (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Имя</th>
                <th className="px-5 py-3">Роль</th>
                <th className="px-5 py-3">Активен</th>
                <th className="px-5 py-3">Создан</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersQuery.data!.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUser?.id}
                  busy={updateMutation.isPending}
                  onChangeRole={(role) =>
                    updateMutation.mutate({ id: u.id, payload: { role } })
                  }
                  onChangeActive={(is_active) =>
                    updateMutation.mutate({ id: u.id, payload: { is_active } })
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

interface UserRowProps {
  user: User;
  isSelf: boolean;
  busy: boolean;
  onChangeRole: (role: UserRole) => void;
  onChangeActive: (is_active: boolean) => void;
}

function UserRow({ user, isSelf, busy, onChangeRole, onChangeActive }: UserRowProps) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3 font-medium text-slate-900">
        {user.email}
        {isSelf && (
          <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
            это вы
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-slate-700">{user.full_name?.trim() || '—'}</td>
      <td className="px-5 py-3">
        <select
          value={user.role}
          disabled={busy}
          onChange={(e) => onChangeRole(e.target.value as UserRole)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-5 py-3">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={user.is_active}
            disabled={busy || isSelf}
            onChange={(e) => onChangeActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span className="text-sm text-slate-600">
            {user.is_active ? 'активен' : 'отключён'}
          </span>
        </label>
      </td>
      <td className="px-5 py-3 text-xs text-slate-500">
        {new Date(user.created_at).toLocaleDateString('ru-RU')}
      </td>
    </tr>
  );
}
