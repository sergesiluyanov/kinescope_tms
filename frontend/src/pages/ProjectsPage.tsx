import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { createProject, listProjects } from '@/api/projects';
import Modal from '@/components/Modal';
import { useAuth } from '@/auth/AuthContext';
import { canManageProjects } from '@/auth/permissions';
import { extractApiError } from '@/utils/errors';

export default function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = canManageProjects(user);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      setName('');
      setDescription('');
      setError(null);
    },
    onError: (err) => setError(extractApiError(err, 'Не удалось создать проект')),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Проекты</h1>
          <p className="mt-1 text-sm text-slate-500">
            Каждый проект содержит свои разделы и тест-кейсы.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            + Новый проект
          </button>
        )}
      </header>

      {projectsQuery.isLoading && <p className="text-slate-500">Загрузка…</p>}
      {projectsQuery.isError && (
        <p className="text-red-600">
          Не удалось загрузить проекты:{' '}
          {extractApiError(projectsQuery.error)}
        </p>
      )}

      {projectsQuery.data?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          Здесь пока пусто. {canCreate && 'Создайте первый проект.'}
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {projectsQuery.data?.map((p) => (
          <li key={p.id}>
            <Link
              to={`/projects/${p.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow"
            >
              <h3 className="text-base font-medium text-slate-900">{p.name}</h3>
              {p.description && (
                <p
                  className="mt-1 overflow-hidden text-sm text-slate-500"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {p.description}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый проект"
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Название</span>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Описание <span className="font-normal text-slate-400">(необязательно)</span>
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending ? 'Создаём…' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
