import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ clearUserDrafts: vi.fn(), logoutApi: vi.fn() }));

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  anonymous: vi.fn(),
  logout: mocks.logoutApi,
}));

vi.mock('../core/save/drafts', () => ({
  clearUserDrafts: mocks.clearUserDrafts,
}));

import { useAuthStore } from './authStore';

describe('authStore.logout', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.clearUserDrafts.mockClear();
    useAuthStore.setState({
      token: 'token',
      user: { id: 'u1', nickname: '测试', isAnonymous: false },
    });
  });

  it('退出登录清除当前用户的本地草稿与登录态', () => {
    useAuthStore.getState().logout();

    expect(mocks.clearUserDrafts).toHaveBeenCalledWith('u1');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
