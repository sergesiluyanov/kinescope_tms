import { useQuery } from '@tanstack/react-query';

import { fetchReadiness } from '@/api/client';

export default function HomePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: fetchReadiness,
    refetchInterval: 10_000,
  });

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Kinescope TMS</h1>
        <p className="mt-2 text-slate-500">
          Корпоративная система управления тестированием. Скелет проекта запущен.
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

      <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Следующие шаги: авторизация по корпоративной почте, разделы и тест-кейсы,
        баг-репорты, интеграция с Kaiten.
      </section>
    </main>
  );
}
