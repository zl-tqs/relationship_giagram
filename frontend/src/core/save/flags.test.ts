import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_NAME,
  clearManualSaved,
  clearOriginalFileName,
  clearProjectCreatedThisSession,
  discardOutcome,
  exitPrompt,
  getOriginalFileName,
  hasManualSave,
  isManuallySaved,
  isProjectCreatedThisSession,
  manualSavePrompt,
  markManualSaved,
  markProjectCreatedThisSession,
  setOriginalFileName,
} from './flags';

describe('保存标记', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('默认项目名或存在快照时视为已命名保存', () => {
    expect(isManuallySaved({ projectId: 'p1', projectName: DEFAULT_PROJECT_NAME, snapshotCount: 0 })).toBe(false);
    expect(isManuallySaved({ projectId: 'p1', projectName: '我的小说', snapshotCount: 0 })).toBe(true);
    expect(isManuallySaved({ projectId: 'p1', projectName: DEFAULT_PROJECT_NAME, snapshotCount: 1 })).toBe(true);
  });

  it('手动保存标记持久化并可清除', () => {
    expect(hasManualSave('p1')).toBe(false);
    markManualSaved('p1');
    expect(hasManualSave('p1')).toBe(true);
    clearManualSaved('p1');
    expect(hasManualSave('p1')).toBe(false);
  });

  it('本次会话新建标记使用 sessionStorage', () => {
    markProjectCreatedThisSession('p1');
    expect(isProjectCreatedThisSession('p1')).toBe(true);
    clearProjectCreatedThisSession('p1');
    expect(isProjectCreatedThisSession('p1')).toBe(false);
  });

  it('记录并清除导入文件的原文件名', () => {
    setOriginalFileName('p1', '我的小说.rmap');
    expect(getOriginalFileName('p1')).toBe('我的小说.rmap');
    clearOriginalFileName('p1');
    expect(getOriginalFileName('p1')).toBeNull();
  });
});

describe('保存与退出决策', () => {
  it('未命名时手动保存先走命名流程', () => {
    expect(manualSavePrompt(false)).toBe('name-save');
    expect(manualSavePrompt(true)).toBe('save');
  });

  it('首次退出始终命名，之后仅在 dirty 时确认', () => {
    expect(exitPrompt(false, false)).toBe('name-exit');
    expect(exitPrompt(false, true)).toBe('name-exit');
    expect(exitPrompt(true, true)).toBe('dirty-exit');
    expect(exitPrompt(true, false)).toBeNull();
  });

  it('仅本次会话新建且从未手动保存的项目在不保存时删除', () => {
    expect(discardOutcome({ hasManualSave: false, createdThisSession: true })).toBe('delete-project');
    expect(discardOutcome({ hasManualSave: true, createdThisSession: true })).toBe('discard-changes');
    expect(discardOutcome({ hasManualSave: false, createdThisSession: false })).toBe('discard-changes');
  });
});
