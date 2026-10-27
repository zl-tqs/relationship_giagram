import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('注册')).toBeInTheDocument();
  });
});
