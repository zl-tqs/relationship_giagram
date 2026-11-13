import { ConfigService } from '@nestjs/config';
import { DeepSeekClient } from './deepseek.client.js';

function responseWith(content: string) {
  return {
    ok: true,
    json: async () => ({
      model: 'deepseek-chat',
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
  } as Response;
}

describe('DeepSeekClient', () => {
  const config = { get: vi.fn() };
  const client = new DeepSeekClient(config as unknown as ConfigService);

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'DEEPSEEK_API_WEB') return 'test-key';
      return undefined;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('未配置密钥时返回可识别的错误', async () => {
    config.get.mockReturnValue(undefined);
    await expect(
      client.analyze({
        confirmed: ['张三', '李四'],
        cooccurrences: [],
        excerpt: '张三与李四同行。',
        template: 'default',
      }),
    ).rejects.toMatchObject({ response: { code: 'ANALYSIS_NOT_CONFIGURED' } });
  });

  it('JSON 解析失败时自动重试一次', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWith('不是 JSON'))
      .mockResolvedValueOnce(
        responseWith(
          JSON.stringify({
            characters: [{ name: '张三', gender: '男' }],
            relations: [{ from: '张三', to: '李四', type: '同门' }],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.analyze({
      confirmed: ['张三', '李四'],
      cooccurrences: [{ a: '张三', b: '李四', count: 2 }],
      excerpt: '张三与李四同行。',
      template: 'default',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.characters).toEqual([{ name: '张三', gender: '男' }]);
    expect(result.relations).toEqual([{ from: '张三', to: '李四', type: '同门' }]);
    expect(result.model).toBe('deepseek-chat');
    expect(result.tokenUsage.totalTokens).toBe(15);
  });

  it('连续返回非法结构时抛出 AI_BAD_RESPONSE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(responseWith('{"characters": "bad"}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      client.analyze({
        confirmed: ['张三', '李四'],
        cooccurrences: [],
        excerpt: '张三与李四同行。',
        template: 'default',
      }),
    ).rejects.toMatchObject({ response: { code: 'AI_BAD_RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('请求体中包含已确认人物与结构化片段', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      responseWith(JSON.stringify({ characters: [], relations: [] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await client.analyze({
      confirmed: ['张三', '李四'],
      cooccurrences: [{ a: '张三', b: '李四', count: 2 }],
      excerpt: '张三与李四同行。',
      template: 'wuxia',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.model).toBe('deepseek-chat');
    expect(body.messages[1].content).toContain('张三、李四');
    expect(body.messages[1].content).toContain('张三与李四同行');
    expect(body.messages[1].content).toContain('师徒');
  });
});
