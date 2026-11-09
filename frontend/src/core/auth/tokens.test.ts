import { describe, it, expect, beforeEach } from 'vitest';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens';

describe('auth token storage', () => {
  beforeEach(() => localStorage.clear());

  it('保存并读取访问令牌与刷新令牌', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
  });

  it('清除全部令牌', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r' });
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('仅存在旧的访问令牌时刷新令牌为空', () => {
    localStorage.setItem('accessToken', 'legacy');
    expect(getRefreshToken()).toBeNull();
  });
});
