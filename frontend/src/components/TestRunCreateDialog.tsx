import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listSections } from '@/api/sections';
import Modal from './Modal';
import type { Section } from '@/types/tms';
import type { TestRunCreatePayload } from '@/types/testRuns';

interface TestRunCreateDialogProps {
  open: boolean;
  projectId: number;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: TestRunCreatePayload) => void;
}

interface SectionNode {
  section: Section;
  children: SectionNode[];
}

function buildTree(sections: Section[]): SectionNode[] {
  const map = new Map<number, SectionNode>();
  sections.forEach((s) =>
    map.set(s.id, { section: s, children: [] }),
  );
  const roots: SectionNode[] = [];
  sections.forEach((s) => {
    const node = map.get(s.id)!;
    if (s.parent_id == null) {
      roots.push(node);
    } else {
      const parent = map.get(s.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });
  return roots;
}

export default function TestRunCreateDialog({
  open,
  projectId,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: TestRunCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('');
  const [includeSubsections, setIncludeSubsections] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const sectionsQuery = useQuery({
    queryKey: ['sections', projectId],
    queryFn: () => listSections(projectId),
    enabled: open && !Number.isNaN(projectId),
  });

  const tree = useMemo(
    () => buildTree(sectionsQuery.data ?? []),
    [sectionsQuery.data],
  );

  useEffect(() => {
    if (open) {
      const defaultName = `Прогон ${new Date().toLocaleDateString('ru-RU')}`;
      setName(defaultName);
      setDescription('');
      setEnvironment('');
      setIncludeSubsections(true);
      setSelectedIds(new Set());
    }
  }, [open]);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      environment: environment.trim() || null,
      section_ids: Array.from(selectedIds),
      include_subsections: includeSubsections,
    });
  }

  const canSubmit = name.trim().length > 0 && selectedIds.size > 0;

  return (
    <Modal open={open} onClose={onClose} title="Новый прогон" size="lg">
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

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Окружение</span>
            <input
              type="text"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              placeholder="staging, prod, iOS 17.5…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Описание <span className="font-normal text-slate-400">(опционально)</span>
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Включить разделы ({selectedIds.size})
            </span>
            <label className="inline-flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={includeSubsections}
                onChange={(e) => setIncludeSubsections(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand"
              />
              включая вложенные
            </label>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
            {sectionsQuery.isLoading && (
              <p className="px-2 py-1 text-sm text-slate-500">Загружаем разделы…</p>
            )}
            {!sectionsQuery.isLoading && tree.length === 0 && (
              <p className="px-2 py-1 text-sm text-slate-500">
                В проекте пока нет разделов.
              </p>
            )}
            <ul>
              {tree.map((node) => (
                <SectionRow
                  key={node.section.id}
                  node={node}
                  depth={0}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                />
              ))}
            </ul>
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
            disabled={submitting || !canSubmit}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Создаём…' : 'Создать прогон'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface SectionRowProps {
  node: SectionNode;
  depth: number;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
}

function SectionRow({ node, depth, selectedIds, onToggle }: SectionRowProps) {
  const checked = selectedIds.has(node.section.id);
  return (
    <li>
      <label
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(node.section.id)}
          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        <span className="text-sm text-slate-700">{node.section.name}</span>
      </label>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <SectionRow
              key={child.section.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
