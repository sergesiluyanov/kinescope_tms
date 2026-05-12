import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createBug } from '@/api/bugs';
import { getTestRun, updateTestRun, updateTestRunItem } from '@/api/testRuns';
import { listUsers } from '@/api/users';
import BugFormDialog from '@/components/BugFormDialog';
import { Badge } from '@/components/bugBadges';
import {
  ITEM_STATUS_BADGE,
  ITEM_STATUS_DOT,
  ITEM_STATUS_LABEL,
  RUN_STATUS_BADGE,
  RUN_STATUS_LABEL,
} from '@/components/runBadges';
import { useAuth } from '@/auth/AuthContext';
import { canEditCases } from '@/auth/permissions';
import { extractApiError } from '@/utils/errors';
import type { BugCreatePayload } from '@/types/bugs';
import type {
  TestRunItem,
  TestRunItemStatus,
  TestRunStatus,
} from '@/types/testRuns';

const STATUS_ACTIONS: { status: TestRunItemStatus; label: string; cls: string }[] = [
  {
    status: 'passed',
    label: 'Pass',
    cls: 'bg-emerald-600 hover:bg-emerald-700',
  },
  { status: 'failed', label: 'Fail', cls: 'bg-red-600 hover:bg-red-700' },
  {
    status: 'blocked',
    label: 'Block',
    cls: 'bg-orange-500 hover:bg-orange-600',
  },
  {
    status: 'skipped',
    label: 'Skip',
    cls: 'bg-slate-500 hover:bg-slate-600',
  },
];

const FINAL_STATUSES: TestRunStatus[] = ['completed', 'aborted'];

export default function TestRunDetailPage() {
  const { runId: runIdParam } = useParams<{ runId: string }>();
  const runId = Number(runIdParam);
  const navigate = useNavigate();

  const { user } = useAuth();
  const canExecute = canEditCases(user);

  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ['test-run', runId],
    queryFn: () => getTestRun(runId),
    enabled: !Number.isNaN(runId),
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers(true),
  });

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [bugDialogError, setBugDialogError] = useState<string | null>(null);

  const items = useMemo(() => runQuery.data?.items ?? [], [runQuery.data]);

  useEffect(() => {
    if (items.length === 0) return;
    if (selectedItemId == null || !items.find((i) => i.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  useEffect(() => {
    setComment(selected?.comment ?? '');
  }, [selected?.id, selected?.comment]);

  const updateItemMutation = useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: number;
      payload: Parameters<typeof updateTestRunItem>[1];
    }) => updateTestRunItem(itemId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-run', runId] });
    },
    onError: (err) => setError(extractApiError(err, 'Не удалось сохранить статус')),
  });

  const updateRunMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateTestRun>[1]) =>
      updateTestRun(runId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-run', runId] });
      await queryClient.invalidateQueries({
        queryKey: ['test-runs', runQuery.data?.project_id],
      });
    },
    onError: (err) => setError(extractApiError(err, 'Не удалось обновить прогон')),
  });

  const createBugMutation = useMutation({
    mutationFn: async (payload: BugCreatePayload) => {
      const projectId = runQuery.data!.project_id;
      const bug = await createBug(projectId, payload);
      if (selected) {
        await updateTestRunItem(selected.id, { linked_bug_id: bug.id });
      }
      return bug;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-run', runId] });
      setBugDialogOpen(false);
    },
    onError: (err) =>
      setBugDialogError(extractApiError(err, 'Не удалось создать баг')),
  });

  if (Number.isNaN(runId)) {
    return <p className="p-10 text-sm text-red-600">Некорректный URL прогона.</p>;
  }

  if (runQuery.isLoading) {
    return <p className="p-10 text-sm text-slate-500">Загружаем прогон…</p>;
  }
  if (!runQuery.data) {
    return <p className="p-10 text-sm text-red-600">Прогон не найден.</p>;
  }

  const run = runQuery.data;
  const isFinished = FINAL_STATUSES.includes(run.status);

  function applyStatus(status: TestRunItemStatus) {
    if (!selected) return;
    setError(null);
    updateItemMutation.mutate({
      itemId: selected.id,
      payload: { status, comment: comment.trim() || null },
    });
  }

  function applyComment() {
    if (!selected) return;
    if ((selected.comment ?? '') === comment) return;
    setError(null);
    updateItemMutation.mutate({
      itemId: selected.id,
      payload: { comment: comment.trim() || null },
    });
  }

  function applyRunStatus(status: TestRunStatus) {
    setError(null);
    updateRunMutation.mutate({ status });
  }

  function openBugDialog() {
    if (!selected) return;
    setBugDialogError(null);
    setBugDialogOpen(true);
  }

  const { stats } = run;
  const done = stats.total - stats.untested;
  const pct = stats.total === 0 ? 0 : Math.round((done * 100) / stats.total);

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => navigate(`/projects/${run.project_id}/runs`)}
          className="hover:underline"
        >
          ← К прогонам
        </button>
        <span>·</span>
        <Link
          to={`/projects/${run.project_id}/cases`}
          className="hover:underline"
        >
          К проекту
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{run.name}</h1>
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
        </div>
        <div className="flex items-center gap-2">
          {run.status === 'draft' && canExecute && (
            <button
              type="button"
              onClick={() => applyRunStatus('in_progress')}
              disabled={updateRunMutation.isPending}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
            >
              Начать прогон
            </button>
          )}
          {run.status === 'in_progress' && canExecute && (
            <>
              <button
                type="button"
                onClick={() => applyRunStatus('completed')}
                disabled={updateRunMutation.isPending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                Завершить
              </button>
              <button
                type="button"
                onClick={() => applyRunStatus('aborted')}
                disabled={updateRunMutation.isPending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Прервать
              </button>
            </>
          )}
          {isFinished && canExecute && (
            <button
              type="button"
              onClick={() => applyRunStatus('in_progress')}
              disabled={updateRunMutation.isPending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Переоткрыть
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-full w-full">
            <span
              style={{ width: `${(stats.passed * 100) / Math.max(stats.total, 1)}%` }}
              className="bg-emerald-500"
            />
            <span
              style={{ width: `${(stats.failed * 100) / Math.max(stats.total, 1)}%` }}
              className="bg-red-500"
            />
            <span
              style={{ width: `${(stats.blocked * 100) / Math.max(stats.total, 1)}%` }}
              className="bg-orange-500"
            />
            <span
              style={{ width: `${(stats.skipped * 100) / Math.max(stats.total, 1)}%` }}
              className="bg-slate-400"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            {done}/{stats.total} ({pct}%)
          </span>
          <span className="text-emerald-600">✓ passed {stats.passed}</span>
          <span className="text-red-600">✗ failed {stats.failed}</span>
          <span className="text-orange-600">⛔ blocked {stats.blocked}</span>
          <span className="text-slate-500">↷ skipped {stats.skipped}</span>
          <span className="text-slate-400">• untested {stats.untested}</span>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-80 shrink-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <ul className="max-h-[70vh] overflow-y-auto">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                active={item.id === selectedItemId}
                onClick={() => setSelectedItemId(item.id)}
              />
            ))}
            {items.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-500">Пунктов нет.</p>
            )}
          </ul>
        </aside>

        <section className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected && (
            <p className="text-sm text-slate-500">Выберите кейс слева.</p>
          )}
          {selected && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono">
                    TR-{String(run.id).padStart(4, '0')}/#{selected.position + 1}
                  </span>
                  {selected.test_case_id && (
                    <span className="font-mono">
                      TC-{String(selected.test_case_id).padStart(4, '0')}
                    </span>
                  )}
                  <Badge className={ITEM_STATUS_BADGE[selected.status]}>
                    {ITEM_STATUS_LABEL[selected.status]}
                  </Badge>
                  {selected.linked_bug_id && (
                    <Link
                      to={`/projects/${run.project_id}/bugs`}
                      className="text-xs text-red-600 hover:underline"
                    >
                      связан с BUG-{String(selected.linked_bug_id).padStart(4, '0')}
                    </Link>
                  )}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {selected.title}
                </h2>
                {selected.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {selected.preconditions && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700">
                    Предусловия
                  </h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                    {selected.preconditions}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-slate-700">Шаги</h3>
                {selected.steps.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">Шаги не заданы.</p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {selected.steps.map((step, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="text-xs font-medium text-slate-500">
                          Шаг {idx + 1}
                        </div>
                        <div className="mt-1 grid gap-2 md:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-slate-400">
                              Действие
                            </div>
                            <p className="whitespace-pre-line text-sm text-slate-700">
                              {step.action}
                            </p>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wider text-slate-400">
                              Ожидаемое
                            </div>
                            <p className="whitespace-pre-line text-sm text-slate-700">
                              {step.expected}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Комментарий к прохождению
                  </span>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onBlur={applyComment}
                    placeholder="Что заметили, что отвалилось, ссылки…"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </label>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {canExecute && (
                <div className="flex flex-wrap items-center gap-2">
                  {STATUS_ACTIONS.map((a) => (
                    <button
                      key={a.status}
                      type="button"
                      disabled={updateItemMutation.isPending}
                      onClick={() => applyStatus(a.status)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 ${a.cls}`}
                    >
                      {a.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={updateItemMutation.isPending}
                    onClick={() =>
                      applyStatus('untested')
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Сбросить
                  </button>
                  <button
                    type="button"
                    onClick={openBugDialog}
                    className="ml-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    + Завести баг из проваленного кейса
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <BugFormDialog
          open={bugDialogOpen}
          mode="create"
          users={usersQuery.data ?? []}
          submitting={createBugMutation.isPending}
          error={bugDialogError}
          initial={{
            title: `[${run.name}] ${selected.title}`,
            description: selected.preconditions
              ? `Предусловия:\n${selected.preconditions}`
              : null,
            steps_to_reproduce: selected.steps.length
              ? selected.steps
                  .map((s, i) => `${i + 1}. ${s.action}`)
                  .join('\n')
              : null,
            actual_result: comment.trim() || null,
            expected_result: selected.steps.length
              ? selected.steps.map((s) => s.expected).join('\n')
              : null,
            environment: run.environment ?? null,
            severity: 'major',
            priority: 'medium',
            status: 'new',
            tags: selected.tags,
            test_case_id: selected.test_case_id,
          }}
          onClose={() => setBugDialogOpen(false)}
          onSubmit={(payload) => {
            setBugDialogError(null);
            createBugMutation.mutate(payload);
          }}
        />
      )}
    </main>
  );
}

interface ItemRowProps {
  item: TestRunItem;
  active: boolean;
  onClick: () => void;
}

function ItemRow({ item, active, onClick }: ItemRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition ${
          active ? 'bg-brand/10 text-slate-900' : 'hover:bg-slate-50'
        }`}
      >
        <span
          className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${ITEM_STATUS_DOT[item.status]}`}
        />
        <span className="flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">
            {item.position + 1}. {item.title}
          </span>
          <span className="text-xs text-slate-400">
            {ITEM_STATUS_LABEL[item.status]}
            {item.linked_bug_id ? ' · BUG' : ''}
          </span>
        </span>
      </button>
    </li>
  );
}
