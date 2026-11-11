import { describe, it, expect, beforeEach } from 'vitest';
import { clearStoredUser, getStoredUser, setStoredUser } from './user';

const user = { id: 'u1', nickname: '张三', isAnonymous: false };

describe('auth user storage', () => {
  beforeEach(() => localStorage.clear());

  it('保存并读取当前用户', () => {
    setStoredUser(user);
    expect(getStoredUser()).toEqual(user);
  });

  it('清除当前用户', () => {
    setStoredUser(user);
    clearStoredUser();
    expect(getStoredUser()).toBeNull();
  });

  it('非法 JSON 时返回 null', () => {
    localStorage.setItem('authUser', '{bad json');
    expect(getStoredUser()).toBeNull();
  });
});
