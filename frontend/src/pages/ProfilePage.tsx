import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { changePasswordRequest } from '@/api/client';
import PasswordField from '@/components/PasswordField';
import { useAuth } from '@/auth/AuthContext';
import { extractApiError } from '@/utils/errors';
import { checkPassword, isPasswordValid } from '@/utils/password';

export default function ProfilePage() {
  const { user } = useAuth();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checks = useMemo(() => checkPassword(newPw), [newPw]);
  const pwValid = isPasswordValid(checks);
  const passwordsMatch = newPw === confirm;
  const showMismatch = confirm.length > 0 && !passwordsMatch;
  const formValid = currentPw.length > 0 && pwValid && passwordsMatch && newPw !== currentPw;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!pwValid) {
      setError('Новый пароль не соответствует требованиям');
      return;
    }
    if (!passwordsMatch) {
      setError('Пароли не совпадают');
      return;
    }
    if (newPw === currentPw) {
      setError('Новый пароль должен отличаться от текущего');
      return;
    }

    setSubmitting(true);
    try {
      await changePasswordRequest({
        current_password: currentPw,
        new_password: newPw,
      });
      setSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirm('');
    } catch (err) {
      setError(extractApiError(err, 'Не удалось сменить пароль'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Профиль</h1>
        <p className="mt-1 text-sm text-slate-500">
          Управление учётной записью.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Учётная запись</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <Field label="Email">{user?.email}</Field>
          <Field label="Имя">{user?.full_name?.trim() || '—'}</Field>
          <Field label="Роль">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
              {user?.role}
            </span>
          </Field>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Смена пароля</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <PasswordField
            label="Текущий пароль"
            required
            autoComplete="current-password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />

          <div className="space-y-2">
            <PasswordField
              label="Новый пароль"
              required
              minLength={10}
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <ul className="space-y-0.5 text-xs">
              <Check ok={checks.length}>не короче 10 символов</Check>
              <Check ok={checks.letter}>хотя бы одна буква</Check>
              <Check ok={checks.digit}>хотя бы одна цифра</Check>
            </ul>
          </div>

          <div className="space-y-1">
            <PasswordField
              label="Повторите новый пароль"
              required
              minLength={10}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {showMismatch && (
              <p className="text-xs text-red-600">Пароли не совпадают</p>
            )}
            {confirm.length > 0 && passwordsMatch && (
              <p className="text-xs text-emerald-600">Пароли совпадают</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Пароль успешно изменён.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !formValid}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Сохраняем…' : 'Сменить пароль'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li
      className={
        ok
          ? 'flex items-center gap-1.5 text-emerald-600'
          : 'flex items-center gap-1.5 text-slate-400'
      }
    >
      <span aria-hidden className="inline-block w-3 text-center">
        {ok ? '✓' : '•'}
      </span>
      {children}
    </li>
  );
}
