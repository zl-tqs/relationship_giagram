import type { ProjectSummary } from '../../types';

export function pickNextProjectAfterDelete(
  projects: ProjectSummary[],
  deletedId: string,
  currentId?: string,
) {
  if (!currentId || deletedId !== currentId) return null;
  return projects.find((project) => project.id !== deletedId) ?? null;
}
