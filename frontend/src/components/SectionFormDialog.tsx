import { useEffect, useState, type FormEvent } from 'react';

import Modal from './Modal';

interface SectionFormDialogProps {
  open: boolean;
  title: string;
  initialName?: string;
  initialDescription?: string | null;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string | null }) => void;
}

export default function SectionFormDialog({
  open,
  title,
  initialName = '',
  initialDescription = null,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: SectionFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription ?? '');
    }
  }, [open, initialName, initialDescription]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
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

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Описание <span className="font-normal text-slate-400">(необязательно)</span>
          </span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

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
            disabled={submitting || !name.trim()}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
