import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { createTestRun, deleteTestRun, listTestRuns } from '@/api/testRuns';
import ConfirmDialog from '@/components/ConfirmDialog';
import TestRunCreateDialog from '@/components/TestRunCreateDialog';
import {
  RUN_STATUS_BADGE,
  RUN_STATUS_LABEL,
} from '@/components/runBadges';
import { Badge } from '@/components/bugBadges';
import { useAuth } from '@/auth/AuthContext';
import { canEditCases, isQaLeadOrHigher } from '@/auth/permissions';
import { extractApiError } from '@/utils/errors';
import type { TestRunCreatePayload, TestRunSummary } from '@/types/testRuns';

export default function ProjectRunsPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = Number(projectIdParam);

  const { user } = useAuth();
  const canCreate = canEditCases(user);
  const canDelete = isQaLeadOrHigher(user);

  const queryClient = useQueryClient();

  const runsQuery = useQuery({
    queryKey: ['test-runs', projectId],
    queryFn: () => listTestRuns(projectId),
    enabled: !Number.isNaN(projectId),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestRunSummary | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: TestRunCreatePayload) => createTestRun(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
      setCreateOpen(false);
    },
    onError: (err) => setCreateError(extractApiError(err, 'Не удалось создать прогон')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTestRun(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
      setDeleteTarget(null);
    },
  });

  if (Number.isNaN(projectId)) {
    return <p className="text-sm text-red-600">Некорректный URL проекта.</p>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Тест-прогоны</h2>
          <p className="mt-1 text-sm text-slate-500">
            Снимок кейсов в момент старта, статусы прохождения, связь с багами.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            + Новый прогон
          </button>
        )}
      </div>

      {runsQuery.isLoading && (
        <p className="text-sm text-slate-500">Загружаем…</p>
      )}

      {!runsQuery.isLoading && (runsQuery.data?.length ?? 0) === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Прогонов пока нет. {canCreate && 'Создайте первый.'}
        </div>
      )}

      <ul className="space-y-2">
        {runsQuery.data?.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            canDelete={canDelete}
            onDelete={() => setDeleteTarget(run)}
          />
        ))}
      </ul>

      <TestRunCreateDialog
        open={createOpen}
        projectId={projectId}
        submitting={createMutation.isPending}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => {
          setCreateError(null);
          createMutation.mutate(payload);
        }}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        title="Удалить прогон?"
        message={
          deleteTarget
            ? `Прогон «${deleteTarget.name}» будет удалён вместе со всеми пунктами и историей прохождений.`
            : ''
        }
        submitting={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </section>
  );
}

interface RunRowProps {
  run: TestRunSummary;
  canDelete: boolean;
  onDelete: () => void;
}

function RunRow({ run, canDelete, onDelete }: RunRowProps) {
  const { stats } = run;
  const done = stats.total - stats.untested;
  const pct = stats.total === 0 ? 0 : Math.round((done * 100) / stats.total);
  const passPct = stats.total === 0 ? 0 : (stats.passed / stats.total) * 100;
  const failPct = stats.total === 0 ? 0 : (stats.failed / stats.total) * 100;
  const blockPct = stats.total === 0 ? 0 : (stats.blocked / stats.total) * 100;
  const skipPct = stats.total === 0 ? 0 : (stats.skipped / stats.total) * 100;

  return (
    <li className="group rounded-xl border border-slate-200 p-4 transition hover:border-brand/40 hover:shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/test-runs/${run.id}`}
              className="text-base font-medium text-slate-900 hover:text-brand"
            >
              {run.name}
            </Link>
            <Badge className={RUN_STATUS_BADGE[run.status]}>
              {RUN_STATUS_LABEL[run.status]}
            </Badge>
            {run.environment && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {run.environment}
              </span>
            )}
          </div>
          {run.description && (
            <p className="mt-1 text-sm text-slate-500">{run.description}</p>
          )}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="flex h-full w-full">
              <span style={{ width: `${passPct}%` }} className="bg-emerald-500" />
              <span style={{ width: `${failPct}%` }} className="bg-red-500" />
              <span style={{ width: `${blockPct}%` }} className="bg-orange-500" />
              <span style={{ width: `${skipPct}%` }} className="bg-slate-400" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              {done}/{stats.total} ({pct}%)
            </span>
            <span className="text-emerald-600">✓ {stats.passed}</span>
            <span className="text-red-600">✗ {stats.failed}</span>
            <span className="text-orange-600">⛔ {stats.blocked}</span>
            <span className="text-slate-500">↷ {stats.skipped}</span>
            <span className="text-slate-400">• {stats.untested} не пройдено</span>
            {run.created_by && (
              <span className="text-slate-400">
                · автор {run.created_by.full_name?.trim() || run.created_by.email}
              </span>
            )}
            <span className="text-slate-400">
              · {new Date(run.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="invisible rounded p-1 text-slate-400 transition group-hover:visible hover:bg-red-50 hover:text-red-600"
            title="Удалить"
          >
            🗑
          </button>
        )}
      </div>
    </li>
  );
}
