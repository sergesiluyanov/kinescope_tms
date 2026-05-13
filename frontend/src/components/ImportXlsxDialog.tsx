import { useState, type DragEvent } from 'react';

import Modal from './Modal';
import {
  commitXlsxImport,
  previewXlsxImport,
  type ImportCommitResponse,
  type ImportPreviewResponse,
} from '@/api/imports';
import { extractApiError } from '@/utils/errors';

interface ImportXlsxDialogProps {
  open: boolean;
  projectId: number;
  onClose: () => void;
  onCompleted: () => void;
}

type Stage = 'pick' | 'preview' | 'done';

export default function ImportXlsxDialog({
  open,
  projectId,
  onClose,
  onCompleted,
}: ImportXlsxDialogProps) {
  const [stage, setStage] = useState<Stage>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [dropRoot, setDropRoot] = useState(true);
  const [splitInlineSteps, setSplitInlineSteps] = useState(true);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportCommitResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function reset() {
    setStage('pick');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(false);
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 300);
  }

  async function loadPreview(
    target: File,
    options: { dropRoot: boolean; splitInlineSteps: boolean },
  ) {
    setBusy(true);
    setError(null);
    try {
      const data = await previewXlsxImport(projectId, target, options);
      setPreview(data);
      setStage('preview');
    } catch (err) {
      setError(extractApiError(err, 'Не удалось разобрать файл'));
    } finally {
      setBusy(false);
    }
  }

  function handlePick(target: File) {
    setFile(target);
    void loadPreview(target, { dropRoot, splitInlineSteps });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handlePick(f);
  }

  async function handleCommit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data = await commitXlsxImport(projectId, file, {
        dropRoot,
        splitInlineSteps,
      });
      setResult(data);
      setStage('done');
      onCompleted();
    } catch (err) {
      setError(extractApiError(err, 'Не удалось импортировать'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Импорт тест-кейсов из XLSX"
      size="lg"
    >
      {stage === 'pick' && (
        <div className="space-y-4">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm transition ${
              isDragging
                ? 'border-brand bg-brand/5 text-brand'
                : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-brand/40 hover:text-slate-700'
            }`}
          >
            <span className="text-base font-medium">
              Перетащите xlsx-файл сюда
            </span>
            <span className="text-xs">или нажмите, чтобы выбрать</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePick(f);
              }}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dropRoot}
              onChange={(e) => setDropRoot(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Отбросить первый уровень разделов (например, «Kinescope»)
          </label>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={splitInlineSteps}
              onChange={(e) => setSplitInlineSteps(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span>
              Разбивать слитные шаги в одной ячейке
              <span className="ml-1 text-xs text-slate-400">
                (пункты вида «1. … 2. …» становятся отдельными шагами)
              </span>
            </span>
          </label>

          {busy && (
            <p className="text-sm text-slate-500">Анализируем файл…</p>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Поддерживается формат Test IT (колонки ID, Расположение, Шаги,
            Ожидаемый результат, Приоритет, Тег). Заголовки кейсов, если они
            отсутствуют в файле, будут собраны из общего ожидаемого результата
            или из ID кейса.
          </p>
        </div>
      )}

      {stage === 'preview' && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <Stat label="Кейсов" value={preview.total_cases} />
            <Stat
              label="Разделов в файле"
              value={preview.section_paths.length}
            />
            <Stat label="Файл" value={file?.name ?? '—'} />
          </div>

          {preview.issues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong>Замечания:</strong>
              <ul className="ml-4 list-disc">
                {preview.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Дерево разделов ({preview.section_paths.length})
            </summary>
            <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-slate-600">
              {preview.section_paths.slice(0, 200).map((p) => (
                <li key={p.join(' / ')}>{p.join(' / ')}</li>
              ))}
              {preview.section_paths.length > 200 && (
                <li className="text-slate-400">
                  …и ещё {preview.section_paths.length - 200}
                </li>
              )}
            </ul>
          </details>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              Первые {preview.sample.length} кейсов
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Раздел</th>
                    <th className="px-3 py-2">Заголовок</th>
                    <th className="px-3 py-2">Шаги</th>
                    <th className="px-3 py-2">Приоритет</th>
                    <th className="px-3 py-2">Теги</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.sample.map((c) => (
                    <tr key={`${c.external_id}-${c.title}`}>
                      <td className="px-3 py-1.5 font-mono text-slate-400">
                        {c.external_id ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {c.section_path.join(' / ')}
                      </td>
                      <td className="px-3 py-1.5 text-slate-800">{c.title}</td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {c.steps_count}
                      </td>
                      <td className="px-3 py-1.5">{c.priority}</td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {c.tags.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setStage('pick');
                setPreview(null);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Назад
            </button>
            <button
              type="button"
              disabled={busy || preview.total_cases === 0}
              onClick={handleCommit}
              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Импортируем…' : `Импортировать ${preview.total_cases} кейсов`}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="space-y-4 text-center">
          <div className="text-4xl">✓</div>
          <div className="text-sm text-slate-700">
            Создано <strong>{result.cases_created}</strong> тест-кейсов
            {' и '}
            <strong>{result.sections_created}</strong> новых разделов.
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            Готово
          </button>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}
