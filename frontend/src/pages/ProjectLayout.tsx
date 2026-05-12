import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';

import { getProject } from '@/api/projects';

export default function ProjectLayout() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = Number(projectIdParam);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: !Number.isNaN(projectId),
  });

  if (Number.isNaN(projectId)) {
    return <p className="p-10 text-red-600">Некорректный URL проекта.</p>;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex flex-col gap-1">
        <Link to="/projects" className="text-xs text-slate-400 hover:underline">
          ← Все проекты
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">
          {projectQuery.data?.name ?? '…'}
        </h1>
        {projectQuery.data?.description && (
          <p className="text-sm text-slate-500">{projectQuery.data.description}</p>
        )}
      </div>

      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        <TabLink to={`/projects/${projectId}/cases`}>Тест-кейсы</TabLink>
        <TabLink to={`/projects/${projectId}/runs`}>Прогоны</TabLink>
        <TabLink to={`/projects/${projectId}/bugs`}>Баги</TabLink>
      </nav>

      <Outlet />
    </div>
  );
}

function TabLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition',
          isActive
            ? 'border-brand text-brand'
            : 'border-transparent text-slate-500 hover:text-slate-700',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
