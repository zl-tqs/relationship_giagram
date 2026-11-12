import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

describe('workspaceStore 退出拦截', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ guard: null });
  });

  it('没有守卫时直接执行导航', () => {
    const proceed = vi.fn();
    useWorkspaceStore.getState().requestLeave(proceed);
    expect(proceed).toHaveBeenCalledTimes(1);
  });

  it('有守卫时交给守卫决定', () => {
    const proceed = vi.fn();
    const guard = vi.fn();
    useWorkspaceStore.getState().setGuard(guard);

    useWorkspaceStore.getState().requestLeave(proceed);

    expect(guard).toHaveBeenCalledWith(proceed);
    expect(proceed).not.toHaveBeenCalled();
  });
});
