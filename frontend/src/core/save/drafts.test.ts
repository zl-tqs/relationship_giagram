import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { canvasFingerprint } from '../canvas/fingerprint';
import {
  DRAFT_TTL_MS,
  clearDraftsForTest,
  clearUserDrafts,
  decideDraft,
  deleteDraft,
  getDraft,
  putDraft,
  type Draft,
} from './drafts';

const node = (id: string): Node => ({
  id,
  type: 'character',
  position: { x: 0, y: 0 },
  data: { name: id, shape: 'circle', gender: '未知' },
});

const draft = (overrides: Partial<Draft> = {}): Draft => ({
  userId: 'u1',
  projectId: 'p1',
  nodes: [node('a')],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  baseRevision: 3,
  updatedAt: Date.now(),
  schemaVersion: 1,
  ...overrides,
});

describe('本地草稿存储', () => {
  beforeEach(() => {
    clearDraftsForTest();
  });

  it('按用户与项目保存和读取草稿', async () => {
    await putDraft(draft());

    await expect(getDraft('u1', 'p1')).resolves.toMatchObject({
      userId: 'u1',
      projectId: 'p1',
      baseRevision: 3,
    });
    await expect(getDraft('u2', 'p1')).resolves.toBeNull();
  });

  it('过期草稿读取时自动清理', async () => {
    await putDraft(draft({ updatedAt: Date.now() - DRAFT_TTL_MS - 1 }));

    await expect(getDraft('u1', 'p1')).resolves.toBeNull();
    await expect(getDraft('u1', 'p1')).resolves.toBeNull();
  });

  it('删除草稿与按用户清理', async () => {
    await putDraft(draft());
    await deleteDraft('u1', 'p1');
    await expect(getDraft('u1', 'p1')).resolves.toBeNull();

    await putDraft(draft({ projectId: 'p1' }));
    await putDraft(draft({ projectId: 'p2' }));
    await putDraft(draft({ userId: 'u2', projectId: 'p3' }));
    await clearUserDrafts('u1');

    await expect(getDraft('u1', 'p1')).resolves.toBeNull();
    await expect(getDraft('u1', 'p2')).resolves.toBeNull();
    await expect(getDraft('u2', 'p3')).resolves.not.toBeNull();
  });
});

describe('草稿恢复决策', () => {
  it('草稿内容与服务端一致时直接丢弃', () => {
    const current = draft();
    expect(
      decideDraft(current, 3, canvasFingerprint(current.nodes, current.edges)),
    ).toBe('discard');
  });

  it('基于当前 revision 的草稿可恢复', () => {
    const current = draft({ baseRevision: 3 });
    expect(decideDraft(current, 3, 'different')).toBe('apply');
  });

  it('基于旧 revision 的草稿提示为过期', () => {
    const current = draft({ baseRevision: 2 });
    expect(decideDraft(current, 3, 'different')).toBe('stale');
  });
});
