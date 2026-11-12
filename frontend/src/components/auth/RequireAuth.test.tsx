import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { me } from '../../api/auth';
import { refreshAccessToken } from '../../api/authRefresh';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  anonymous: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

vi.mock('../../api/authRefresh', () => ({ refreshAccessToken: vi.fn() }));

vi.mock('../../core/save/drafts', () => ({ clearUserDrafts: vi.fn() }));

const meMock = vi.mocked(me);
const refreshMock = vi.mocked(refreshAccessToken);

const token = (subject: string) => {
  const payload = btoa(JSON.stringify({ sub: subject }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
};

const storedUser = (id: string, nickname: string) => {
  localStorage.setItem('authUser', JSON.stringify({ id, nickname, isAnonymous: false }));
};

const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <div>受保护内容</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    meMock.mockReset();
    refreshMock.mockReset();
    useAuthStore.setState({ token: null, user: null });
  });

  it('无任何令牌时重定向到登录页', async () => {
    renderGuard();
    expect(await screen.findByText('登录页')).toBeInTheDocument();
  });

  it('令牌与本地用户一致时直接渲染', () => {
    localStorage.setItem('accessToken', token('u1'));
    storedUser('u1', '作者');
    renderGuard();
    expect(screen.getByText('受保护内容')).toBeInTheDocument();
    expect(meMock).not.toHaveBeenCalled();
  });

  it('令牌有效但缺少本地用户时从服务端恢复身份', async () => {
    localStorage.setItem('accessToken', token('u1'));
    meMock.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      nickname: '作者',
      isAnonymous: false,
    });

    renderGuard();

    expect(await screen.findByText('受保护内容')).toBeInTheDocument();
    expect(meMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', nickname: '作者' });
    expect(JSON.parse(localStorage.getItem('authUser') ?? '{}')).toMatchObject({ id: 'u1' });
  });

  it('本地用户与令牌不一致时重新同步', async () => {
    localStorage.setItem('accessToken', token('u1'));
    storedUser('guest', '访客');
    meMock.mockResolvedValue({
      id: 'u1',
      email: null,
      nickname: '作者',
      isAnonymous: false,
    });

    renderGuard();

    expect(await screen.findByText('受保护内容')).toBeInTheDocument();
    expect(meMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', nickname: '作者' });
  });

  it('只有 refreshToken 时先刷新再恢复身份', async () => {
    localStorage.setItem('refreshToken', 'r');
    refreshMock.mockImplementation(async () => {
      localStorage.setItem('accessToken', token('u1'));
      return 'new-access';
    });
    meMock.mockResolvedValue({
      id: 'u1',
      email: null,
      nickname: '作者',
      isAnonymous: false,
    });

    renderGuard();

    expect(await screen.findByText('受保护内容')).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(meMock).toHaveBeenCalledTimes(1);
  });

  it('刷新失败时清理令牌并跳登录页', async () => {
    localStorage.setItem('refreshToken', 'r');
    refreshMock.mockRejectedValue(new Error('failed'));

    renderGuard();

    expect(await screen.findByText('登录页')).toBeInTheDocument();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('authUser')).toBeNull();
  });
});
