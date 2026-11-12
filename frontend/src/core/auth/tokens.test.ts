import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getTokenSubject,
  setTokens,
} from './tokens';

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

  it('解析 JWT 中的用户 ID，非法令牌返回 null', () => {
    const payload = btoa(JSON.stringify({ sub: 'u1' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(getTokenSubject(`header.${payload}.signature`)).toBe('u1');
    expect(getTokenSubject('not-a-jwt')).toBeNull();
    expect(getTokenSubject('a.%%%.c')).toBeNull();
  });
});
