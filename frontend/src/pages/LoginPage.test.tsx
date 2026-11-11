import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ login: vi.fn(), register: vi.fn(), anonymous: vi.fn() }),
}));

describe('LoginPage', () => {
  it('渲染登录与注册标签', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('tab', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '注册' })).toBeInTheDocument();
  });

  it('空表单提交显示中文校验提示', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /登\s*录/ }));
    expect(await screen.findByText('请输入邮箱')).toBeInTheDocument();
    expect(await screen.findByText('请输入密码')).toBeInTheDocument();
  });
});
