import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import {
  createBug,
  deleteBug as deleteBugApi,
  getBug,
  listBugs,
  updateBug,
} from '@/api/bugs';
import { listUsers } from '@/api/users';
import BugFormDialog from '@/components/BugFormDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  ALL_STATUSES,
  Badge,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from '@/components/bugBadges';
import { useAuth } from '@/auth/AuthContext';
import { canDeleteBugs, canEditBugs } from '@/auth/permissions';
import { extractApiError } from '@/utils/errors';
import type {
  Bug,
  BugCreatePayload,
  BugStatus,
  BugSummary,
} from '@/types/bugs';

interface DialogState {
  open: boolean;
  initial: Bug | null;
}

export default function ProjectBugsPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = Number(projectIdParam);

  const { user } = useAuth();
  const canEdit = canEditBugs(user);
  const canDelete = canDeleteBugs(user);

  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<BugStatus | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const bugsQuery = useQuery({
    queryKey: ['bugs', projectId, statusFilter, search],
    queryFn: () =>
      listBugs(projectId, {
        status: statusFilter ?? undefined,
        search: search || undefined,
      }),
    enabled: !Number.isNaN(projectId),
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers(true),
  });

  const [dialog, setDialog] = useState<DialogState>({ open: false, initial: null });
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BugSummary | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: BugCreatePayload) => createBug(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setDialog({ open: false, initial: null });
    },
    onError: (err) =>
      setDialogError(extractApiError(err, 'Не удалось создать баг')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BugCreatePayload }) =>
      updateBug(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setDialog({ open: false, initial: null });
    },
    onError: (err) =>
      setDialogError(extractApiError(err, 'Не удалось сохранить баг')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBugApi(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setDeleteTarget(null);
    },
  });

  const counts = useMemo(() => {
    const acc: Partial<Record<BugStatus, number>> = {};
    (bugsQuery.data ?? []).forEach((b) => {
      acc[b.status] = (acc[b.status] ?? 0) + 1;
    });
    return acc;
  }, [bugsQuery.data]);

  if (Number.isNaN(projectId)) {
    return <p className="text-sm text-red-600">Некорректный URL проекта.</p>;
  }

  async function openEdit(id: number) {
    try {
      const full = await getBug(id);
      setDialogError(null);
      setDialog({ open: true, initial: full });
    } catch (err) {
      setDialogError(extractApiError(err));
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={statusFilter == null}
            label="Все"
            count={bugsQuery.data?.length}
            onClick={() => setStatusFilter(null)}
          />
          {ALL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              label={STATUS_LABEL[s]}
              count={counts[s] ?? 0}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
          >
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по заголовку…"
              className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </form>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setDialogError(null);
                setDialog({ open: true, initial: null });
              }}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
            >
              + Новый баг
            </button>
          )}
        </div>
      </div>

      {bugsQuery.isLoading && (
        <p className="text-sm text-slate-500">Загружаем баги…</p>
      )}

      {!bugsQuery.isLoading && (bugsQuery.data?.length ?? 0) === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          В проекте пока нет багов{statusFilter || search ? ' под выбранные фильтры' : ''}.
        </div>
      )}

      {(bugsQuery.data?.length ?? 0) > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Заголовок</th>
                <th className="py-2 pr-3">Severity</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 pr-3">Исполнитель</th>
                <th className="py-2 pr-3">Обновлён</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bugsQuery.data!.map((bug) => (
                <BugRow
                  key={bug.id}
                  bug={bug}
                  canDelete={canDelete}
                  onOpen={() => openEdit(bug.id)}
                  onDelete={() => setDeleteTarget(bug)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BugFormDialog
        open={dialog.open}
        mode={dialog.initial ? 'edit' : 'create'}
        initial={dialog.initial}
        users={usersQuery.data ?? []}
        submitting={createMutation.isPending || updateMutation.isPending}
        error={dialogError}
        onClose={() => setDialog({ open: false, initial: null })}
        onSubmit={(payload) => {
          setDialogError(null);
          if (dialog.initial) {
            updateMutation.mutate({ id: dialog.initial.id, payload });
          } else {
            createMutation.mutate(payload);
          }
        }}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        title="Удалить баг?"
        message={
          deleteTarget
            ? `Баг «${deleteTarget.title}» будет удалён. Действие необратимо.`
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

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
      ].join(' ')}
    >
      {label}
      {typeof count === 'number' && (
        <span className="ml-1 text-slate-400">{count}</span>
      )}
    </button>
  );
}

interface BugRowProps {
  bug: BugSummary;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function BugRow({ bug, canDelete, onOpen, onDelete }: BugRowProps) {
  const assigneeLabel = bug.assignee
    ? bug.assignee.full_name?.trim() || bug.assignee.email
    : '—';
  return (
    <tr className="group hover:bg-slate-50">
      <td className="py-2 pr-3 font-mono text-xs text-slate-400">
        BUG-{String(bug.id).padStart(4, '0')}
      </td>
      <td className="py-2 pr-3">
        <button
          type="button"
          onClick={onOpen}
          className="text-left text-sm font-medium text-slate-900 hover:text-brand"
        >
          {bug.title}
        </button>
        {bug.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {bug.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="py-2 pr-3">
        <Badge className={SEVERITY_BADGE[bug.severity]}>
          {SEVERITY_LABEL[bug.severity]}
        </Badge>
      </td>
      <td className="py-2 pr-3">
        <Badge className={PRIORITY_BADGE[bug.priority]}>
          {PRIORITY_LABEL[bug.priority]}
        </Badge>
      </td>
      <td className="py-2 pr-3">
        <Badge className={STATUS_BADGE[bug.status]}>
          {STATUS_LABEL[bug.status]}
        </Badge>
      </td>
      <td className="py-2 pr-3 text-sm text-slate-600">{assigneeLabel}</td>
      <td className="py-2 pr-3 text-xs text-slate-500">
        {new Date(bug.updated_at).toLocaleString('ru-RU', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
      </td>
      <td className="py-2 pr-3 text-right">
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
      </td>
    </tr>
  );
}
