import { describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import { canvasFingerprint } from '../canvas/fingerprint';
import {
  SaveCoordinator,
  type CanvasSnapshotState,
  type SavePayload,
} from './coordinator';

const node = (id: string, name = '甲'): Node => ({
  id,
  type: 'character',
  position: { x: 0, y: 0 },
  data: { name, shape: 'circle', gender: '未知' },
});

const emptyState = (): CanvasSnapshotState => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
});

const conflictError = () => Object.assign(new Error('conflict'), { code: 'VERSION_CONFLICT' });

function makeDeps(state: CanvasSnapshotState) {
  return {
    getState: () => state,
    save: vi.fn(async (_payload: SavePayload) => ({ version: 2 })),
    fetchServer: vi.fn(async () => ({ ...emptyState(), version: 1 })),
    isBlocked: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    isOnline: vi.fn(() => true),
    isWriter: vi.fn(() => true),
    now: () => new Date('2026-11-12T10:00:00Z'),
    onSaved: vi.fn(),
    onAutoSaved: vi.fn(),
    onError: vi.fn(),
    onClearError: vi.fn(),
    onConflict: vi.fn(),
    onConflictResolved: vi.fn(),
  };
}

function makeCoordinator(deps: ReturnType<typeof makeDeps>, state: CanvasSnapshotState) {
  return new SaveCoordinator(deps, {
    revision: 1,
    fingerprint: canvasFingerprint(state.nodes, state.edges),
  });
}

describe('SaveCoordinator', () => {
  it('内容无变化时不发请求也不提示', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    const coordinator = makeCoordinator(deps, state);

    await expect(coordinator.autoSave()).resolves.toEqual({ status: 'unchanged' });
    await expect(coordinator.save('manual')).resolves.toEqual({ status: 'unchanged' });
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.onAutoSaved).not.toHaveBeenCalled();
  });

  it('内容变化时携带 baseRevision 保存并更新指纹', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('a')];

    await expect(coordinator.save('manual')).resolves.toEqual({ status: 'saved', version: 2 });
    expect(deps.save).toHaveBeenCalledWith(expect.objectContaining({ baseRevision: 1 }));
    expect(coordinator.isDirty()).toBe(false);
    expect(coordinator.getRevision()).toBe(2);

    await expect(coordinator.save('manual')).resolves.toEqual({ status: 'unchanged' });
    expect(deps.save).toHaveBeenCalledTimes(1);
  });

  it('自动保存并发时只发一个请求，其余合并到下一轮', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    let resolveSave: (value: { version: number }) => void = () => undefined;
    deps.save.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('a')];

    const first = coordinator.autoSave();
    await Promise.resolve();
    const second = coordinator.autoSave();

    await expect(second).resolves.toEqual({ status: 'queued' });
    expect(deps.save).toHaveBeenCalledTimes(1);

    resolveSave({ version: 2 });
    await expect(first).resolves.toEqual({ status: 'saved', version: 2 });
  });

  it('手动保存等待飞行中的自动保存，并在有新内容时再次提交', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    let resolveFirst: (value: { version: number }) => void = () => undefined;
    deps.save
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({ version: 3 });
    const coordinator = makeCoordinator(deps, state);

    state.nodes = [node('a')];
    const auto = coordinator.autoSave();
    await Promise.resolve();
    state.nodes = [node('b')];
    const manual = coordinator.save('manual');

    await Promise.resolve();
    resolveFirst({ version: 2 });

    await expect(auto).resolves.toEqual({ status: 'saved', version: 2 });
    await expect(manual).resolves.toEqual({ status: 'saved', version: 3 });
    expect(deps.save).toHaveBeenCalledTimes(2);
    expect(deps.save.mock.calls[1][0]).toMatchObject({ baseRevision: 2 });
  });

  it('409 时服务端内容与提交一致则视为成功（假冲突）', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    deps.save.mockRejectedValue(conflictError());
    deps.fetchServer.mockResolvedValue({
      ...state,
      nodes: [node('a')],
      version: 5,
    });
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('a')];

    await expect(coordinator.save('manual')).resolves.toEqual({ status: 'saved', version: 5 });
    expect(deps.onConflict).not.toHaveBeenCalled();
    expect(deps.onConflictResolved).toHaveBeenCalledWith(5);
    expect(coordinator.isDirty()).toBe(false);
  });

  it('409 真冲突时暂停自动保存并通知冲突', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    deps.save.mockRejectedValue(conflictError());
    deps.fetchServer.mockResolvedValue({
      ...emptyState(),
      nodes: [node('server')],
      version: 5,
    });
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('local')];

    await expect(coordinator.save('manual')).resolves.toMatchObject({
      status: 'conflict',
      serverVersion: 5,
    });
    expect(deps.onConflict).toHaveBeenCalledWith(5);
    await expect(coordinator.autoSave()).resolves.toEqual({
      status: 'skipped',
      reason: 'conflict',
    });
    expect(deps.save).toHaveBeenCalledTimes(1);
  });

  it('网络失败首次要求重试，再次失败转为常驻错误', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    deps.save.mockRejectedValue(new Error('offline'));
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('a')];

    await expect(coordinator.save('auto')).resolves.toMatchObject({
      status: 'failed',
      willRetry: true,
    });
    expect(deps.onError).toHaveBeenLastCalledWith('retrying', expect.any(Error));

    await expect(coordinator.save('auto')).resolves.toMatchObject({
      status: 'failed',
      willRetry: false,
    });
    expect(deps.onError).toHaveBeenLastCalledWith('persistent', expect.any(Error));
  });

  it('自动保存遵守弹窗、可见性、离线与写者条件', async () => {
    const cases = [
      ['isBlocked', true, 'blocked'],
      ['isVisible', false, 'hidden'],
      ['isOnline', false, 'offline'],
      ['isWriter', false, 'not-writer'],
    ] as const;

    for (const [flag, value, reason] of cases) {
      const state = emptyState();
      const deps = makeDeps(state);
      deps[flag].mockReturnValue(value);
      const coordinator = makeCoordinator(deps, state);
      state.nodes = [node('a')];

      await expect(coordinator.autoSave()).resolves.toEqual({ status: 'skipped', reason });
      expect(deps.save).not.toHaveBeenCalled();
    }
  });

  it('外部冲突可手动标记并暂停自动保存', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('a')];

    coordinator.markConflict(9);

    expect(coordinator.hasConflict()).toBe(true);
    expect(deps.onConflict).toHaveBeenCalledWith(9);
    await expect(coordinator.autoSave()).resolves.toEqual({
      status: 'skipped',
      reason: 'conflict',
    });
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('外部保存按提交内容标记，保存期间的新编辑仍为 dirty', () => {
    const state = emptyState();
    const deps = makeDeps(state);
    const coordinator = makeCoordinator(deps, state);

    state.nodes = [node('submitted')];
    const submittedFingerprint = canvasFingerprint(state.nodes, state.edges);
    state.nodes = [node('newer')];

    coordinator.markSavedExternally(4, submittedFingerprint);

    expect(coordinator.isDirty()).toBe(true);
  });

  it('外部保存成功后清除 dirty 与冲突', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('a')];

    coordinator.markSavedExternally(7);

    expect(coordinator.getRevision()).toBe(7);
    expect(coordinator.isDirty()).toBe(false);
    expect(coordinator.hasConflict()).toBe(false);
    expect(deps.onClearError).toHaveBeenCalled();
  });

  it('冲突覆盖使用服务端 revision 强制提交', async () => {
    const state = emptyState();
    const deps = makeDeps(state);
    deps.save.mockRejectedValue(conflictError());
    deps.fetchServer.mockResolvedValue({ ...emptyState(), nodes: [node('server')], version: 5 });
    const coordinator = makeCoordinator(deps, state);
    state.nodes = [node('local')];
    await coordinator.save('manual');

    deps.save.mockResolvedValueOnce({ version: 6 });
    await expect(coordinator.overwrite(5)).resolves.toEqual({ status: 'saved', version: 6 });
    expect(deps.save).toHaveBeenLastCalledWith(expect.objectContaining({ baseRevision: 5 }));
    expect(coordinator.hasConflict()).toBe(false);
  });
});
