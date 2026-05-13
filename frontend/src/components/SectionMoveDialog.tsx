import { useMemo, useState } from 'react';

import Modal from './Modal';
import type { Section } from '@/types/tms';

interface SectionMoveDialogProps {
  open: boolean;
  section: Section | null;
  sections: Section[];
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (newParentId: number | null) => void;
}

interface MoveNode extends Section {
  children: MoveNode[];
}

function buildTree(sections: Section[]): MoveNode[] {
  const byId = new Map<number, MoveNode>();
  sections.forEach((s) => byId.set(s.id, { ...s, children: [] }));
  const roots: MoveNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id != null && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (nodes: MoveNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.id - b.id);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function collectDescendants(sections: Section[], rootId: number): Set<number> {
  const children = new Map<number, number[]>();
  sections.forEach((s) => {
    if (s.parent_id != null) {
      const list = children.get(s.parent_id) ?? [];
      list.push(s.id);
      children.set(s.parent_id, list);
    }
  });
  const result = new Set<number>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    (children.get(id) ?? []).forEach((c) => {
      if (!result.has(c)) {
        result.add(c);
        stack.push(c);
      }
    });
  }
  return result;
}

export default function SectionMoveDialog({
  open,
  section,
  sections,
  submitting,
  error,
  onClose,
  onSubmit,
}: SectionMoveDialogProps) {
  const tree = useMemo(() => buildTree(sections), [sections]);
  const forbidden = useMemo(
    () => (section ? collectDescendants(sections, section.id) : new Set<number>()),
    [sections, section],
  );

  // Текущий выбор: undefined = ничего не выбрано, null = «в корень», number = id раздела.
  const [target, setTarget] = useState<number | null | undefined>(undefined);

  if (!section) return null;

  const handleClose = () => {
    setTarget(undefined);
    onClose();
  };

  const isSameAsCurrent =
    target !== undefined &&
    ((target === null && section.parent_id === null) || target === section.parent_id);

  const canSubmit = target !== undefined && !isSameAsCurrent;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Переместить «${section.name}»`}
      size="md"
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Выберите новый родительский раздел или «В корень». Сам раздел и его
          подразделы недоступны.
        </p>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-2 text-sm">
          <TargetOption
            label="📁 В корень проекта"
            value={null}
            disabled={section.parent_id === null}
            disabledReason={
              section.parent_id === null ? 'Раздел уже в корне' : undefined
            }
            target={target}
            onChange={setTarget}
          />

          {tree.length === 0 && (
            <p className="px-2 py-1 text-slate-400">Других разделов нет.</p>
          )}

          <ul>
            {tree.map((node) => (
              <MoveNodeView
                key={node.id}
                node={node}
                depth={0}
                section={section}
                forbidden={forbidden}
                target={target}
                onChange={setTarget}
              />
            ))}
          </ul>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => target !== undefined && onSubmit(target)}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Переносим…' : 'Перенести'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface MoveNodeViewProps {
  node: MoveNode;
  depth: number;
  section: Section;
  forbidden: Set<number>;
  target: number | null | undefined;
  onChange: (id: number | null) => void;
}

function MoveNodeView({
  node,
  depth,
  section,
  forbidden,
  target,
  onChange,
}: MoveNodeViewProps) {
  const isSelf = node.id === section.id;
  const isDescendant = forbidden.has(node.id) && !isSelf;
  const disabled = isSelf || isDescendant;
  const disabledReason = isSelf
    ? 'Это сам перемещаемый раздел'
    : isDescendant
      ? 'Это подраздел перемещаемого'
      : section.parent_id === node.id
        ? 'Раздел уже здесь'
        : undefined;
  const isCurrent = section.parent_id === node.id;

  return (
    <li>
      <TargetOption
        label={`📂 ${node.name}`}
        value={node.id}
        disabled={disabled || isCurrent}
        disabledReason={disabledReason}
        depth={depth}
        target={target}
        onChange={onChange}
      />
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <MoveNodeView
              key={c.id}
              node={c}
              depth={depth + 1}
              section={section}
              forbidden={forbidden}
              target={target}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface TargetOptionProps {
  label: string;
  value: number | null;
  disabled: boolean;
  disabledReason?: string;
  depth?: number;
  target: number | null | undefined;
  onChange: (v: number | null) => void;
}

function TargetOption({
  label,
  value,
  disabled,
  disabledReason,
  depth = 0,
  target,
  onChange,
}: TargetOptionProps) {
  const isSelected = target === value;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(value)}
      style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition ${
        isSelected
          ? 'bg-brand/10 text-brand'
          : disabled
            ? 'cursor-not-allowed text-slate-300'
            : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span className="truncate">{label}</span>
      {disabledReason && (
        <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-slate-300">
          {disabledReason}
        </span>
      )}
    </button>
  );
}
