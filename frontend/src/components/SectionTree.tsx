import { useMemo, useState } from 'react';

import type { Section } from '@/types/tms';

interface SectionNode extends Section {
  children: SectionNode[];
}

interface SectionTreeProps {
  sections: Section[];
  selectedId: number | null;
  onSelect: (sectionId: number) => void;
  onCreateChild: (parentId: number | null) => void;
  onRename: (section: Section) => void;
  onDelete: (section: Section) => void;
  canEdit: boolean;
}

function buildTree(sections: Section[]): SectionNode[] {
  const byId = new Map<number, SectionNode>();
  sections.forEach((s) => byId.set(s.id, { ...s, children: [] }));
  const roots: SectionNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id != null && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRecursive = (nodes: SectionNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.id - b.id);
    nodes.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);
  return roots;
}

interface NodeViewProps extends Omit<SectionTreeProps, 'sections'> {
  node: SectionNode;
  depth: number;
}

function NodeView({
  node,
  depth,
  selectedId,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
  canEdit,
}: NodeViewProps) {
  const [open, setOpen] = useState(true);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
          isSelected ? 'bg-brand/10 text-brand' : 'text-slate-700 hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`h-5 w-5 shrink-0 text-slate-400 ${
            hasChildren ? '' : 'invisible'
          }`}
          aria-label={open ? 'Свернуть' : 'Развернуть'}
        >
          {open ? '▾' : '▸'}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex-1 truncate text-left"
        >
          {node.name}
        </button>
        {canEdit && (
          <div className="hidden shrink-0 gap-1 group-hover:flex">
            <button
              type="button"
              onClick={() => onCreateChild(node.id)}
              title="Добавить подраздел"
              className="rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onRename(node)}
              title="Переименовать"
              className="rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => onDelete(node)}
              title="Удалить"
              className="rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              🗑
            </button>
          </div>
        )}
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <NodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SectionTree(props: SectionTreeProps) {
  const tree = useMemo(() => buildTree(props.sections), [props.sections]);

  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center justify-between px-2 text-xs uppercase tracking-wide text-slate-400">
        <span>Разделы</span>
        {props.canEdit && (
          <button
            type="button"
            onClick={() => props.onCreateChild(null)}
            className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Новый раздел в корне"
          >
            + новый
          </button>
        )}
      </div>
      {tree.length === 0 ? (
        <p className="px-2 text-slate-400">Пока нет разделов.</p>
      ) : (
        <ul className="space-y-0.5">
          {tree.map((node) => (
            <NodeView
              key={node.id}
              node={node}
              depth={0}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
              onCreateChild={props.onCreateChild}
              onRename={props.onRename}
              onDelete={props.onDelete}
              canEdit={props.canEdit}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
