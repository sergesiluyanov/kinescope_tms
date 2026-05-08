import { useQuery } from '@tanstack/react-query';

import { fetchReadiness } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: fetchReadiness,
    refetchInterval: 30_000,
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Привет, {user?.full_name ?? user?.email.split('@')[0]} 👋
        </h1>
        <p className="mt-2 text-slate-500">
          Корпоративная система управления тестированием. Тестовая документация,
          баг-репорты и интеграция с Kaiten — впереди.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Состояние API</h2>
        <div className="mt-4 text-sm">
          {isLoading && <span className="text-slate-500">Проверяем доступность…</span>}
          {isError && (
            <span className="text-red-600">
              API недоступно: {(error as Error).message}
            </span>
          )}
          {data && (
            <ul className="space-y-1">
              <li>
                <span className="text-slate-500">Статус:</span>{' '}
                <span className="font-medium text-emerald-600">{data.status}</span>
              </li>
              <li>
                <span className="text-slate-500">База данных:</span>{' '}
                <span className="font-medium text-emerald-600">{data.db}</span>
              </li>
              <li>
                <span className="text-slate-500">Версия:</span>{' '}
                <span className="font-medium">{data.version}</span>
              </li>
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Что дальше</h2>
        <p className="mt-2 text-sm text-slate-500">
          Заведи проект и начни складывать в него разделы и тест-кейсы.
        </p>
        <a
          href="/projects"
          className="mt-4 inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
        >
          Перейти к проектам →
        </a>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Скоро: баг-репорты и интеграция с Kaiten.
      </section>
    </main>
  );
}
