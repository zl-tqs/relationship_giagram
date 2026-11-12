import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore } from './projectStore';
import { createProject, deleteProject, updateProject } from '../api/projects';
import { isProjectCreatedThisSession } from '../core/save/flags';

vi.mock('../api/projects', () => ({
  listRecent: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

const updateMock = vi.mocked(updateProject);
const deleteMock = vi.mocked(deleteProject);
const createMock = vi.mocked(createProject);

const project = (id: string, name: string) => ({
  id,
  name,
  lastModifiedAt: '2026-11-11T00:00:00.000Z',
});

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({ recent: [project('p1', '旧名'), project('p2', '另一个')], loading: false });
    updateMock.mockReset();
    deleteMock.mockReset();
    createMock.mockReset();
    sessionStorage.clear();
  });

  it('create 标记本次会话新建', async () => {
    createMock.mockResolvedValue(project('p3', '新项目'));
    await useProjectStore.getState().create('新项目');
    expect(isProjectCreatedThisSession('p3')).toBe(true);
  });

  it('update 重命名并同步最近列表', async () => {
    updateMock.mockResolvedValue(project('p1', '新名'));
    await useProjectStore.getState().update('p1', '新名');

    expect(updateMock).toHaveBeenCalledWith('p1', { name: '新名' });
    expect(useProjectStore.getState().recent[0].name).toBe('新名');
  });

  it('remove 删除并从最近列表移除', async () => {
    deleteMock.mockResolvedValue(undefined);
    await useProjectStore.getState().remove('p1');

    expect(deleteMock).toHaveBeenCalledWith('p1');
    expect(useProjectStore.getState().recent.map((p) => p.id)).toEqual(['p2']);
  });
});
