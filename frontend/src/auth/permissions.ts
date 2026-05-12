import type { User, UserRole } from '@/types/auth';

const QA_OR_HIGHER: UserRole[] = ['qa', 'qa_lead', 'admin'];
const QA_LEAD_OR_HIGHER: UserRole[] = ['qa_lead', 'admin'];

export function canEditCases(user: User | null): boolean {
  return !!user && QA_OR_HIGHER.includes(user.role);
}

export function canManageSections(user: User | null): boolean {
  return !!user && QA_OR_HIGHER.includes(user.role);
}

export function canManageProjects(user: User | null): boolean {
  return !!user && QA_OR_HIGHER.includes(user.role);
}

export function canDeleteProject(user: User | null): boolean {
  return user?.role === 'admin';
}

export function isQaLeadOrHigher(user: User | null): boolean {
  return !!user && QA_LEAD_OR_HIGHER.includes(user.role);
}

export function canEditBugs(user: User | null): boolean {
  return !!user && QA_OR_HIGHER.includes(user.role);
}

export function canDeleteBugs(user: User | null): boolean {
  return !!user && QA_LEAD_OR_HIGHER.includes(user.role);
}
