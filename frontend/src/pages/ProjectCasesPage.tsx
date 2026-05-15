import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import {
  createSection,
  deleteSection as deleteSectionApi,
  listSections,
  updateSection,
} from '@/api/sections';
import {
  createTestCase,
  deleteTestCase as deleteTestCaseApi,
  getTestCase,
  listTestCases,
  updateTestCase,
} from '@/api/testCases';
import ConfirmDialog from '@/components/ConfirmDialog';
import ImportXlsxDialog from '@/components/ImportXlsxDialog';
import SectionFormDialog from '@/components/SectionFormDialog';
import SectionMoveDialog from '@/components/SectionMoveDialog';
import SectionTree from '@/components/SectionTree';
import TestCaseFormDialog, {
  type TestCaseFormValues,
} from '@/components/TestCaseFormDialog';
import { useAuth } from '@/auth/AuthContext';
import { canEditCases, canManageSections } from '@/auth/permissions';
import { extractApiError } from '@/utils/errors';
import type {
  Section,
  TestCase,
  TestCasePriority,
  TestCaseSummary,
} from '@/types/tms';

interface SectionDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  parentId?: number | null;
  target?: Section;
}

interface CaseDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: TestCase | null;
}

interface DeleteState {
  kind: 'section' | 'case';
  id: number;
  label: string;
}

const PRIORITY_BADGE: Record<TestCasePriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

export default function ProjectCasesPage() {
  const { projectId: projectIdParam, caseId: caseIdParam } = useParams<{
    projectId: string;
    caseId?: string;
  }>();
  const projectId = Number(projectIdParam);
  const urlCaseId = caseIdParam ? Number(caseIdParam) : null;

  const navigate = useNavigate();

  const { user } = useAuth();
  const canEdit = canEditCases(user);
  const canManage = canManageSections(user);

  const queryClient = useQueryClient();

  const sectionsQuery = useQuery({
    queryKey: ['sections', projectId],
    queryFn: () => listSections(projectId),
    enabled: !Number.isNaN(projectId),
  });

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);

  useEffect(() => {
    if (
      selectedSectionId == null &&
      urlCaseId == null &&
      sectionsQuery.data &&
      sectionsQuery.data.length > 0
    ) {
      setSelectedSectionId(sectionsQuery.data[0].id);
    }
  }, [sectionsQuery.data, selectedSectionId, urlCaseId]);

  const casesQuery = useQuery({
    queryKey: ['cases', selectedSectionId],
    queryFn: () => listTestCases(selectedSectionId as number),
    enabled: selectedSectionId != null,
  });

  const [sectionDialog, setSectionDialog] = useState<SectionDialogState>({
    open: false,
    mode: 'create',
  });
  const [sectionError, setSectionError] = useState<string | null>(null);

  const createSectionMutation = useMutation({
    mutationFn: ({
      parentId,
      values,
    }: {
      parentId: number | null;
      values: { name: string; description: string | null };
    }) =>
      createSection(projectId, {
        name: values.name,
        description: values.description,
        parent_id: parentId,
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['sections', projectId] });
      setSectionDialog({ open: false, mode: 'create' });
      setSelectedSectionId(created.id);
    },
    onError: (err) =>
      setSectionError(extractApiError(err, 'Не удалось создать раздел')),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number;
      values: { name: string; description: string | null };
    }) => updateSection(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sections', projectId] });
      setSectionDialog({ open: false, mode: 'create' });
    },
    onError: (err) =>
      setSectionError(extractApiError(err, 'Не удалось сохранить раздел')),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: deleteSectionApi,
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: ['sections', projectId] });
      if (selectedSectionId === id) setSelectedSectionId(null);
      setDeleteState(null);
    },
  });

  const [caseDialog, setCaseDialog] = useState<CaseDialogState>({
    open: false,
    mode: 'create',
  });
  const [caseError, setCaseError] = useState<string | null>(null);

  // Когда url содержит /cases/:caseId — загружаем кейс, переключаемся
  // на его раздел и открываем диалог. Так deep-link
  // вида /projects/12/cases/3456 сразу показывает нужный кейс.
  useEffect(() => {
    if (urlCaseId == null) {
      // Закрываем модалку, если url вернулся к /cases (например, после
      // нажатия «назад» в браузере или закрытия диалога).
      setCaseDialog((prev) =>
        prev.open && prev.mode === 'edit' ? { open: false, mode: 'create' } : prev,
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const full = await getTestCase(urlCaseId);
        if (cancelled) return;
        setSelectedSectionId(full.section_id);
        setCaseError(null);
        setCaseDialog({
          open: true,
          mode: canEdit ? 'edit' : 'create',
          initial: full,
        });
      } catch (err) {
        if (cancelled) return;
        setCaseError(extractApiError(err, 'Тест-кейс не найден'));
        navigate(`/projects/${projectId}/cases`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlCaseId, projectId, navigate, canEdit]);

  const createCaseMutation = useMutation({
    mutationFn: (values: TestCaseFormValues) =>
      createTestCase(selectedSectionId as number, values),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['cases', selectedSectionId] });
      // После создания открываем созданный кейс по его прямой ссылке —
      // тогда URL сразу становится sharable, в т.ч. при F5.
      navigate(`/projects/${projectId}/cases/${created.id}`, { replace: true });
    },
    onError: (err) =>
      setCaseError(extractApiError(err, 'Не удалось создать тест-кейс')),
  });

  const updateCaseMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: TestCaseFormValues }) =>
      updateTestCase(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cases', selectedSectionId] });
      navigate(`/projects/${projectId}/cases`);
    },
    onError: (err) =>
      setCaseError(extractApiError(err, 'Не удалось сохранить тест-кейс')),
  });

  const deleteCaseMutation = useMutation({
    mutationFn: deleteTestCaseApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cases', selectedSectionId] });
      setDeleteState(null);
    },
  });

  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Section | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const moveSectionMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) =>
      updateSection(id, { parent_id: parentId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sections', projectId] });
      setMoveTarget(null);
      setMoveError(null);
    },
    onError: (err) =>
      setMoveError(extractApiError(err, 'Не удалось перенести раздел')),
  });

  const selectedSection = useMemo(() => {
    if (selectedSectionId == null) return null;
    return sectionsQuery.data?.find((s) => s.id === selectedSectionId) ?? null;
  }, [sectionsQuery.data, selectedSectionId]);

  return (
    <div className="flex gap-6">
      <aside className="w-72 shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {canManage && (
          <div className="mb-2 px-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              ⬆ Импорт XLSX
            </button>
          </div>
        )}
        {sectionsQuery.isLoading ? (
          <p className="px-2 text-sm text-slate-500">Загружаем разделы…</p>
        ) : (
          <SectionTree
            sections={sectionsQuery.data ?? []}
            selectedId={selectedSectionId}
            onSelect={setSelectedSectionId}
            onCreateChild={(parentId) => {
              setSectionError(null);
              setSectionDialog({ open: true, mode: 'create', parentId });
            }}
            onRename={(section) => {
              setSectionError(null);
              setSectionDialog({ open: true, mode: 'edit', target: section });
            }}
            onDelete={(section) =>
              setDeleteState({
                kind: 'section',
                id: section.id,
                label: section.name,
              })
            }
            onMove={(section) => {
              setMoveError(null);
              setMoveTarget(section);
            }}
            canEdit={canManage}
          />
        )}
      </aside>

      <section className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {selectedSection ? selectedSection.name : 'Выберите раздел'}
            </h2>
            {selectedSection?.description && (
              <p className="mt-1 text-sm text-slate-500">
                {selectedSection.description}
              </p>
            )}
          </div>
          {selectedSection && canEdit && (
            <button
              type="button"
              onClick={() => {
                setCaseError(null);
                setCaseDialog({ open: true, mode: 'create', initial: null });
              }}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
            >
              + Новый тест-кейс
            </button>
          )}
        </div>

        {!selectedSection && (
          <p className="text-sm text-slate-500">
            Выберите раздел в дереве слева, чтобы увидеть тест-кейсы.
          </p>
        )}

        {selectedSection && casesQuery.isLoading && (
          <p className="text-sm text-slate-500">Загружаем тест-кейсы…</p>
        )}

        {selectedSection && casesQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            В разделе пока нет тест-кейсов.
          </div>
        )}

        {selectedSection && (casesQuery.data?.length ?? 0) > 0 && (
          <ul className="divide-y divide-slate-100">
            {casesQuery.data!.map((c) => (
              <CaseRow
                key={c.id}
                summary={c}
                canEdit={canEdit}
                projectId={projectId}
                onOpen={() => navigate(`/projects/${projectId}/cases/${c.id}`)}
                onDelete={() =>
                  setDeleteState({
                    kind: 'case',
                    id: c.id,
                    label: c.title,
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      <SectionFormDialog
        open={sectionDialog.open}
        title={
          sectionDialog.mode === 'create' ? 'Новый раздел' : 'Переименовать раздел'
        }
        initialName={sectionDialog.target?.name}
        initialDescription={sectionDialog.target?.description ?? null}
        submitting={
          createSectionMutation.isPending || updateSectionMutation.isPending
        }
        error={sectionError}
        onClose={() => setSectionDialog({ open: false, mode: 'create' })}
        onSubmit={(values) => {
          setSectionError(null);
          if (sectionDialog.mode === 'create') {
            createSectionMutation.mutate({
              parentId: sectionDialog.parentId ?? null,
              values,
            });
          } else if (sectionDialog.target) {
            updateSectionMutation.mutate({
              id: sectionDialog.target.id,
              values,
            });
          }
        }}
      />

      <TestCaseFormDialog
        open={caseDialog.open}
        mode={caseDialog.initial ? 'edit' : 'create'}
        initial={caseDialog.initial}
        projectId={projectId}
        submitting={createCaseMutation.isPending || updateCaseMutation.isPending}
        error={caseError}
        onClose={() => {
          // Если открыт через deep-link, чистим url; для create-режима
          // просто скрываем модалку.
          if (caseDialog.mode === 'edit') {
            navigate(`/projects/${projectId}/cases`);
          } else {
            setCaseDialog({ open: false, mode: 'create' });
          }
        }}
        onSubmit={(values) => {
          setCaseError(null);
          if (caseDialog.initial) {
            updateCaseMutation.mutate({ id: caseDialog.initial.id, values });
          } else {
            createCaseMutation.mutate(values);
          }
        }}
      />

      <ImportXlsxDialog
        open={importOpen}
        projectId={projectId}
        onClose={() => setImportOpen(false)}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ['sections', projectId] });
          if (selectedSectionId != null) {
            queryClient.invalidateQueries({ queryKey: ['cases', selectedSectionId] });
          }
        }}
      />

      <SectionMoveDialog
        open={moveTarget != null}
        section={moveTarget}
        sections={sectionsQuery.data ?? []}
        submitting={moveSectionMutation.isPending}
        error={moveError}
        onClose={() => {
          setMoveTarget(null);
          setMoveError(null);
        }}
        onSubmit={(newParentId) => {
          if (!moveTarget) return;
          moveSectionMutation.mutate({ id: moveTarget.id, parentId: newParentId });
        }}
      />

      <ConfirmDialog
        open={deleteState != null}
        title={
          deleteState?.kind === 'section' ? 'Удалить раздел?' : 'Удалить тест-кейс?'
        }
        message={
          deleteState?.kind === 'section'
            ? `Раздел «${deleteState.label}» будет удалён вместе со всеми вложенными разделами и тест-кейсами. Действие необратимо.`
            : `Тест-кейс «${deleteState?.label}» будет удалён. Действие необратимо.`
        }
        submitting={
          deleteSectionMutation.isPending || deleteCaseMutation.isPending
        }
        onClose={() => setDeleteState(null)}
        onConfirm={() => {
          if (!deleteState) return;
          if (deleteState.kind === 'section') {
            deleteSectionMutation.mutate(deleteState.id);
          } else {
            deleteCaseMutation.mutate(deleteState.id);
          }
        }}
      />
    </div>
  );
}

interface CaseRowProps {
  summary: TestCaseSummary;
  canEdit: boolean;
  projectId: number;
  onOpen: () => void;
  onDelete: () => void;
}

function CaseRow({ summary, canEdit, projectId, onOpen, onDelete }: CaseRowProps) {
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <span className="font-mono text-xs text-slate-400">
          TC-{String(summary.id).padStart(4, '0')}
        </span>
        <span className="flex-1 truncate text-sm text-slate-900">
          {summary.title}
        </span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[summary.priority]}`}
        >
          {summary.priority}
        </span>
        {summary.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
          >
            {t}
          </span>
        ))}
      </button>
      <CopyLinkButton
        href={`/projects/${projectId}/cases/${summary.id}`}
        title="Скопировать прямую ссылку на тест-кейс"
      />
      {canEdit && (
        <button
          type="button"
          onClick={onDelete}
          className="invisible rounded p-1 text-slate-400 transition group-hover:visible hover:bg-red-50 hover:text-red-600"
          title="Удалить"
        >
          🗑
        </button>
      )}
    </li>
  );
}

interface CopyLinkButtonProps {
  href: string;
  title?: string;
  className?: string;
}

function CopyLinkButton({ href, title, className }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const fullUrl = new URL(href, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback на старые браузеры / небезопасные origin (например, http
      // без https) — открываем prompt со ссылкой, чтобы пользователь
      // скопировал её вручную.
      window.prompt('Скопируйте ссылку:', fullUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title ?? 'Скопировать ссылку'}
      className={
        className ??
        'invisible rounded p-1 text-slate-400 transition group-hover:visible hover:bg-slate-100 hover:text-slate-700'
      }
    >
      {copied ? '✓' : '🔗'}
    </button>
  );
}
