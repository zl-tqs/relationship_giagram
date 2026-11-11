import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { refreshAccessToken } from '../../api/authRefresh';

vi.mock('../../api/authRefresh', () => ({ refreshAccessToken: vi.fn() }));

const refreshMock = vi.mocked(refreshAccessToken);

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
    refreshMock.mockReset();
  });

  it('无任何令牌时重定向到登录页', async () => {
    renderGuard();
    expect(await screen.findByText('登录页')).toBeInTheDocument();
  });

  it('有 accessToken 时渲染子内容', () => {
    localStorage.setItem('accessToken', 't');
    renderGuard();
    expect(screen.getByText('受保护内容')).toBeInTheDocument();
  });

  it('只有 refreshToken 时先刷新再渲染', async () => {
    localStorage.setItem('refreshToken', 'r');
    refreshMock.mockResolvedValue('new-access');
    renderGuard();
    expect(await screen.findByText('受保护内容')).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('刷新失败时清理令牌并跳登录页', async () => {
    localStorage.setItem('refreshToken', 'r');
    refreshMock.mockRejectedValue(new Error('failed'));
    renderGuard();
    expect(await screen.findByText('登录页')).toBeInTheDocument();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
