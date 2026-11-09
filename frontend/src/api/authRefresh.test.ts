import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { setTokens } from '../core/auth/tokens';
import { refreshAccessToken, resetRefreshForTest } from './authRefresh';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

const post = vi.mocked(axios.post);

describe('refreshAccessToken', () => {
  beforeEach(() => {
    localStorage.clear();
    post.mockReset();
    resetRefreshForTest();
  });

  it('没有刷新令牌时不发起请求', async () => {
    await expect(refreshAccessToken()).rejects.toThrow('NO_REFRESH_TOKEN');
    expect(post).not.toHaveBeenCalled();
  });

  it('刷新成功后保存双令牌并返回新的访问令牌', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'r1' });
    post.mockResolvedValue({
      data: {
        accessToken: 'new',
        refreshToken: 'r2',
        user: { id: 'u1', email: null, nickname: 'A', isAnonymous: false },
      },
    });

    await expect(refreshAccessToken()).resolves.toBe('new');
    expect(post).toHaveBeenCalledWith('/api/v1/auth/refresh', { refreshToken: 'r1' });
    expect(localStorage.getItem('accessToken')).toBe('new');
    expect(localStorage.getItem('refreshToken')).toBe('r2');
  });

  it('并发刷新共享同一次请求', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'r1' });
    let resolvePost!: (value: unknown) => void;
    post.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    const first = refreshAccessToken();
    const second = refreshAccessToken();
    resolvePost({ data: { accessToken: 'new', refreshToken: 'r2' } });

    await expect(Promise.all([first, second])).resolves.toEqual(['new', 'new']);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
