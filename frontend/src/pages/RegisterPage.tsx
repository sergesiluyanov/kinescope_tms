import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PasswordField from '@/components/PasswordField';
import { useAuth } from '@/auth/AuthContext';
import { extractApiError } from '@/utils/errors';
import { checkPassword, isPasswordValid } from '@/utils/password';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => checkPassword(password), [password]);
  const pwValid = isPasswordValid(checks);
  const passwordsMatch = password === confirm;
  const showMismatch = confirm.length > 0 && !passwordsMatch;

  const formValid = pwValid && passwordsMatch && email.trim().length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!pwValid) {
      setError('Пароль не соответствует требованиям');
      return;
    }
    if (!passwordsMatch) {
      setError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        full_name: fullName.trim() || undefined,
        password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractApiError(err, 'Не удалось зарегистрироваться'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Регистрация</h1>
          <p className="mt-1 text-sm text-slate-500">
            Используйте корпоративную почту @kinescope.io.
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@kinescope.io"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Имя <span className="font-normal text-slate-400">(необязательно)</span>
          </span>
          <input
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Иван Иванов"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <div className="space-y-2">
          <PasswordField
            label="Пароль"
            required
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ul className="space-y-0.5 text-xs">
            <Check ok={checks.length}>не короче 10 символов</Check>
            <Check ok={checks.letter}>хотя бы одна буква</Check>
            <Check ok={checks.digit}>хотя бы одна цифра</Check>
          </ul>
        </div>

        <div className="space-y-1">
          <PasswordField
            label="Повторите пароль"
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

        <button
          type="submit"
          disabled={submitting || !formValid}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Создаём…' : 'Создать аккаунт'}
        </button>

        <p className="text-center text-sm text-slate-500">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Войти
          </Link>
        </p>
      </form>
    </main>
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
