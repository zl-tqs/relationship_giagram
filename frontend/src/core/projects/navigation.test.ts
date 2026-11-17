import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '../../types';
import { pickNextProjectAfterDelete } from './navigation';

const projects: ProjectSummary[] = [
  { id: 'p1', name: '一', lastModifiedAt: '2026-01-01' },
  { id: 'p2', name: '二', lastModifiedAt: '2026-01-02' },
];

describe('pickNextProjectAfterDelete', () => {
  it('删除当前项目后返回下一个项目', () => {
    expect(pickNextProjectAfterDelete(projects, 'p1', 'p1')?.id).toBe('p2');
  });

  it('没有剩余项目时返回 null', () => {
    expect(pickNextProjectAfterDelete([projects[0]], 'p1', 'p1')).toBeNull();
  });

  it('删除非当前项目时返回 null', () => {
    expect(pickNextProjectAfterDelete(projects, 'p2', 'p1')).toBeNull();
  });
});
