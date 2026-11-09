import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client';
import { refreshAccessToken } from './authRefresh';

vi.mock('./authRefresh', () => ({ refreshAccessToken: vi.fn() }));

const refreshMock = vi.mocked(refreshAccessToken);
const originalAdapter = api.defaults.adapter;

describe('api auth interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    refreshMock.mockReset();
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('401 时刷新令牌并带新令牌重试原请求', async () => {
    localStorage.setItem('accessToken', 'old');
    localStorage.setItem('refreshToken', 'r1');
    refreshMock.mockResolvedValue('new');

    let calls = 0;
    let retriedAuthorization = '';
    api.defaults.adapter = async (config) => {
      calls += 1;
      if (calls === 1) {
        throw { response: { status: 401, data: { code: 'BAD_TOKEN' } }, config };
      }
      retriedAuthorization = String(config.headers?.Authorization ?? '');
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };

    const res = await api.get('/projects/recent');

    expect(res.data).toEqual({ ok: true });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
    expect(retriedAuthorization).toBe('Bearer new');
  });

  it('登录等鉴权接口的 401 不触发刷新', async () => {
    api.defaults.adapter = async (config) => {
      throw { response: { status: 401, data: { code: 'BAD_CREDENTIALS' } }, config };
    };

    await expect(api.post('/auth/login', {})).rejects.toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
