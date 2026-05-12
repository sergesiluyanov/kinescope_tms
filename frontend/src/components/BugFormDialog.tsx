import { useEffect, useState, type FormEvent } from 'react';

import Modal from './Modal';
import {
  ALL_PRIORITIES,
  ALL_SEVERITIES,
  ALL_STATUSES,
  PRIORITY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
} from './bugBadges';
import type { User } from '@/types/auth';
import type {
  Bug,
  BugCreatePayload,
  BugPriority,
  BugSeverity,
  BugStatus,
} from '@/types/bugs';

export interface BugFormValues {
  title: string;
  description: string;
  steps_to_reproduce: string;
  actual_result: string;
  expected_result: string;
  environment: string;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  tags: string[];
  assignee_id: number | null;
  test_case_id: number | null;
}

interface BugFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: Partial<Bug> | null;
  users: User[];
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: BugCreatePayload) => void;
}

function defaults(initial: Partial<Bug> | null | undefined): BugFormValues {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    steps_to_reproduce: initial?.steps_to_reproduce ?? '',
    actual_result: initial?.actual_result ?? '',
    expected_result: initial?.expected_result ?? '',
    environment: initial?.environment ?? '',
    severity: initial?.severity ?? 'major',
    priority: initial?.priority ?? 'medium',
    status: initial?.status ?? 'new',
    tags: initial?.tags ?? [],
    assignee_id: initial?.assignee?.id ?? null,
    test_case_id: initial?.test_case_id ?? null,
  };
}

export default function BugFormDialog({
  open,
  mode,
  initial,
  users,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: BugFormDialogProps) {
  const [values, setValues] = useState<BugFormValues>(() => defaults(initial));
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (open) {
      setValues(defaults(initial));
      setTagInput('');
    }
  }, [open, initial]);

  function commitTag() {
    const tag = tagInput.trim();
    if (!tag) return;
    if (values.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    setValues((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput('');
  }

  function removeTag(tag: string) {
    setValues((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: BugCreatePayload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      steps_to_reproduce: values.steps_to_reproduce.trim() || null,
      actual_result: values.actual_result.trim() || null,
      expected_result: values.expected_result.trim() || null,
      environment: values.environment.trim() || null,
      severity: values.severity,
      priority: values.priority,
      status: values.status,
      tags: values.tags,
      assignee_id: values.assignee_id,
      test_case_id: values.test_case_id,
    };
    onSubmit(payload);
  }

  const isValid = values.title.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Новый баг' : 'Редактирование бага'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Заголовок</span>
          <input
            type="text"
            required
            autoFocus
            value={values.title}
            onChange={(e) => setValues((p) => ({ ...p, title: e.target.value }))}
            placeholder="Кратко: что сломано"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Severity</span>
            <select
              value={values.severity}
              onChange={(e) =>
                setValues((p) => ({ ...p, severity: e.target.value as BugSeverity }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {ALL_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Priority</span>
            <select
              value={values.priority}
              onChange={(e) =>
                setValues((p) => ({ ...p, priority: e.target.value as BugPriority }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Статус</span>
            <select
              value={values.status}
              onChange={(e) =>
                setValues((p) => ({ ...p, status: e.target.value as BugStatus }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Исполнитель</span>
            <select
              value={values.assignee_id ?? ''}
              onChange={(e) =>
                setValues((p) => ({
                  ...p,
                  assignee_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">— не назначен —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name?.trim() || u.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Описание</span>
          <textarea
            rows={3}
            value={values.description}
            onChange={(e) =>
              setValues((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Что происходит, контекст, что чинить."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Шаги воспроизведения
            </span>
            <textarea
              rows={4}
              value={values.steps_to_reproduce}
              onChange={(e) =>
                setValues((p) => ({ ...p, steps_to_reproduce: e.target.value }))
              }
              placeholder={'1. Открыть страницу X\n2. Нажать кнопку Y\n3. …'}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Окружение</span>
            <input
              type="text"
              value={values.environment}
              onChange={(e) =>
                setValues((p) => ({ ...p, environment: e.target.value }))
              }
              placeholder="Chrome 130 / macOS 14, web-prod"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <span className="mt-3 block text-sm font-medium text-slate-700">
              ID связанного тест-кейса{' '}
              <span className="font-normal text-slate-400">(опционально)</span>
            </span>
            <input
              type="number"
              min={1}
              value={values.test_case_id ?? ''}
              onChange={(e) =>
                setValues((p) => ({
                  ...p,
                  test_case_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="123"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Фактический результат
            </span>
            <textarea
              rows={3}
              value={values.actual_result}
              onChange={(e) =>
                setValues((p) => ({ ...p, actual_result: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Ожидаемый результат
            </span>
            <textarea
              rows={3}
              value={values.expected_result}
              onChange={(e) =>
                setValues((p) => ({ ...p, expected_result: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700">Теги</span>
          <div className="mt-1 flex flex-wrap items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 shadow-sm">
            {values.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Удалить ${tag}`}
                  className="text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  commitTag();
                } else if (
                  e.key === 'Backspace' &&
                  !tagInput &&
                  values.tags.length > 0
                ) {
                  removeTag(values.tags[values.tags.length - 1]);
                }
              }}
              onBlur={commitTag}
              placeholder="frontend, регресс…"
              className="min-w-[100px] flex-1 border-none p-1 text-sm focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting || !isValid}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
