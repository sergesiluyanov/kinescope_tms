import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { getTestCaseLocator } from '@/api/testCases';
import { extractApiError } from '@/utils/errors';

/**
 * Резолвер коротких ссылок вида `/c/:caseId`.
 *
 * Используется автотестами и любым кодом, у которого есть только id
 * тест-кейса: страница идёт на бэк за locator (project_id + section_id)
 * и редиректит на каноничный URL `/projects/:projectId/cases/:caseId`.
 *
 * Так автотест может просто склеить `BASE_URL + '/c/' + caseId` без
 * необходимости знать к какому проекту/разделу принадлежит кейс.
 */
export default function CaseShortLink() {
  const { caseId: caseIdParam } = useParams<{ caseId: string }>();
  const caseId = Number(caseIdParam);

  const [redirect, setRedirect] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(caseId)) {
      setError('Некорректный идентификатор тест-кейса');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const loc = await getTestCaseLocator(caseId);
        if (cancelled) return;
        setRedirect(`/projects/${loc.project_id}/cases/${loc.case_id}`);
      } catch (err) {
        if (!cancelled) {
          setError(extractApiError(err, 'Тест-кейс не найден'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        <div className="mb-2 text-base font-medium">Не удалось открыть кейс</div>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm text-center text-sm text-slate-500">
      Открываем тест-кейс…
    </div>
  );
}
