import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearUserDrafts: vi.fn(),
  logoutApi: vi.fn(),
  meApi: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  anonymous: vi.fn(),
  logout: mocks.logoutApi,
  me: mocks.meApi,
}));

vi.mock('../api/authRefresh', () => ({
  refreshAccessToken: mocks.refresh,
}));

vi.mock('../core/save/drafts', () => ({
  clearUserDrafts: mocks.clearUserDrafts,
}));

import { useAuthStore } from './authStore';

describe('authStore.logout', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.clearUserDrafts.mockClear();
    mocks.meApi.mockReset();
    mocks.refresh.mockReset();
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

  it('restore 使用服务端资料恢复用户身份', async () => {
    localStorage.setItem('accessToken', 'token');
    mocks.meApi.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      nickname: '作者',
      isAnonymous: false,
    });

    await useAuthStore.getState().restore();

    expect(mocks.meApi).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', nickname: '作者' });
    expect(JSON.parse(localStorage.getItem('authUser') ?? '{}')).toMatchObject({ id: 'u1' });
  });

  it('restore 没有 accessToken 时先刷新令牌', async () => {
    localStorage.setItem('refreshToken', 'refresh');
    mocks.refresh.mockImplementation(async () => {
      localStorage.setItem('accessToken', 'new-access');
      return 'new-access';
    });
    mocks.meApi.mockResolvedValue({
      id: 'u1',
      email: null,
      nickname: '访客',
      isAnonymous: true,
    });

    await useAuthStore.getState().restore();

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', nickname: '访客' });
  });

  it('restore 没有任何令牌时拒绝恢复', async () => {
    await expect(useAuthStore.getState().restore()).rejects.toThrow();
    expect(mocks.meApi).not.toHaveBeenCalled();
  });
});
