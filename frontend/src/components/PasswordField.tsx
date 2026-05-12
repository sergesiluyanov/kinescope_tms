import { useState, type InputHTMLAttributes } from 'react';

interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export default function PasswordField({
  label,
  hint,
  className,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative mt-1">
        <input
          {...inputProps}
          type={visible ? 'text' : 'password'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-12 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-slate-400 hover:text-slate-700"
        >
          {visible ? 'Скрыть' : 'Показать'}
        </button>
      </div>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
