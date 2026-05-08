import { useEffect, useState, type FormEvent } from 'react';

import Modal from './Modal';
import type { TestCase, TestCasePriority, TestStep } from '@/types/tms';

const PRIORITIES: { value: TestCasePriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export interface TestCaseFormValues {
  title: string;
  preconditions: string | null;
  steps: TestStep[];
  priority: TestCasePriority;
  tags: string[];
}

interface TestCaseFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: TestCase | null;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: TestCaseFormValues) => void;
}

const EMPTY_STEP: TestStep = { action: '', expected: '' };

function defaults(initial: TestCase | null | undefined): TestCaseFormValues {
  return {
    title: initial?.title ?? '',
    preconditions: initial?.preconditions ?? '',
    steps: initial?.steps?.length ? initial.steps : [{ ...EMPTY_STEP }],
    priority: initial?.priority ?? 'medium',
    tags: initial?.tags ?? [],
  };
}

export default function TestCaseFormDialog({
  open,
  mode,
  initial,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: TestCaseFormDialogProps) {
  const [values, setValues] = useState<TestCaseFormValues>(() => defaults(initial));
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (open) {
      setValues(defaults(initial));
      setTagInput('');
    }
  }, [open, initial]);

  function updateStep(index: number, patch: Partial<TestStep>) {
    setValues((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addStep() {
    setValues((prev) => ({ ...prev, steps: [...prev.steps, { ...EMPTY_STEP }] }));
  }

  function removeStep(index: number) {
    setValues((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

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
    const cleaned: TestCaseFormValues = {
      title: values.title.trim(),
      preconditions: values.preconditions?.trim() ? values.preconditions.trim() : null,
      steps: values.steps
        .map((s) => ({ action: s.action.trim(), expected: s.expected.trim() }))
        .filter((s) => s.action || s.expected),
      priority: values.priority,
      tags: values.tags,
    };
    onSubmit(cleaned);
  }

  const isValid = values.title.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Новый тест-кейс' : 'Редактирование тест-кейса'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Название</span>
          <input
            type="text"
            required
            autoFocus
            value={values.title}
            onChange={(e) => setValues((p) => ({ ...p, title: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Приоритет</span>
            <select
              value={values.priority}
              onChange={(e) =>
                setValues((p) => ({ ...p, priority: e.target.value as TestCasePriority }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

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
                  } else if (e.key === 'Backspace' && !tagInput && values.tags.length > 0) {
                    removeTag(values.tags[values.tags.length - 1]);
                  }
                }}
                onBlur={commitTag}
                placeholder="смок, регресс…"
                className="min-w-[80px] flex-1 border-none p-1 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Предусловия <span className="font-normal text-slate-400">(необязательно)</span>
          </span>
          <textarea
            rows={2}
            value={values.preconditions ?? ''}
            onChange={(e) =>
              setValues((p) => ({ ...p, preconditions: e.target.value }))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Шаги</span>
            <button
              type="button"
              onClick={addStep}
              className="text-xs font-medium text-brand hover:underline"
            >
              + добавить шаг
            </button>
          </div>
          <ol className="mt-2 space-y-3">
            {values.steps.map((step, index) => (
              <li key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Шаг {index + 1}</span>
                  {values.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      Удалить
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <textarea
                    rows={2}
                    value={step.action}
                    onChange={(e) => updateStep(index, { action: e.target.value })}
                    placeholder="Действие"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <textarea
                    rows={2}
                    value={step.expected}
                    onChange={(e) => updateStep(index, { expected: e.target.value })}
                    placeholder="Ожидаемый результат"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              </li>
            ))}
          </ol>
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
