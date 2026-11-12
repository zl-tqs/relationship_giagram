export const DEFAULT_PROJECT_NAME = '未命名项目';

const manualKey = (projectId: string) => `rmap.manualSaved.${projectId}`;
const sessionKey = (projectId: string) => `rmap.createdThisSession.${projectId}`;
const originalNameKey = (projectId: string) => `rmap.originalName.${projectId}`;

export function hasManualSave(projectId: string) {
  try {
    return localStorage.getItem(manualKey(projectId)) === '1';
  } catch {
    return false;
  }
}

export function markManualSaved(projectId: string) {
  try {
    localStorage.setItem(manualKey(projectId), '1');
  } catch {
    // 存储不可用时仅影响跨刷新提示，不阻断保存
  }
}

export function clearManualSaved(projectId: string) {
  try {
    localStorage.removeItem(manualKey(projectId));
  } catch {
    // ignore
  }
}

export function isManuallySaved(input: {
  projectId: string;
  projectName: string;
  snapshotCount: number;
}) {
  if (hasManualSave(input.projectId)) return true;
  if (input.projectName.trim() !== DEFAULT_PROJECT_NAME) return true;
  return input.snapshotCount > 0;
}

export function markProjectCreatedThisSession(projectId: string) {
  try {
    sessionStorage.setItem(sessionKey(projectId), '1');
  } catch {
    // ignore
  }
}

export function isProjectCreatedThisSession(projectId: string) {
  try {
    return sessionStorage.getItem(sessionKey(projectId)) === '1';
  } catch {
    return false;
  }
}

export function clearProjectCreatedThisSession(projectId: string) {
  try {
    sessionStorage.removeItem(sessionKey(projectId));
  } catch {
    // ignore
  }
}

export function setOriginalFileName(projectId: string, fileName: string) {
  try {
    localStorage.setItem(originalNameKey(projectId), fileName);
  } catch {
    // ignore
  }
}

export function getOriginalFileName(projectId: string) {
  try {
    return localStorage.getItem(originalNameKey(projectId));
  } catch {
    return null;
  }
}

export function clearOriginalFileName(projectId: string) {
  try {
    localStorage.removeItem(originalNameKey(projectId));
  } catch {
    // ignore
  }
}

export type ManualSavePrompt = 'name-save' | 'save';
export type ExitPrompt = 'name-exit' | 'dirty-exit' | null;

export function manualSavePrompt(hasManualSaved: boolean): ManualSavePrompt {
  return hasManualSaved ? 'save' : 'name-save';
}

export function exitPrompt(hasManualSaved: boolean, dirty: boolean): ExitPrompt {
  if (!hasManualSaved) return 'name-exit';
  return dirty ? 'dirty-exit' : null;
}

export function discardOutcome(input: {
  hasManualSave: boolean;
  createdThisSession: boolean;
}): 'delete-project' | 'discard-changes' {
  return !input.hasManualSave && input.createdThisSession ? 'delete-project' : 'discard-changes';
}
