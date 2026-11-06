import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

describe('RequireAuth', () => {
  beforeEach(() => localStorage.clear());

  it('无 token 时重定向到登录页', () => {
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
    expect(screen.getByText('登录页')).toBeInTheDocument();
  });

  it('有 token 时渲染子内容', () => {
    localStorage.setItem('accessToken', 't');
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
    expect(screen.getByText('受保护内容')).toBeInTheDocument();
  });
});
