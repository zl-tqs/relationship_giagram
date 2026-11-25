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

  it('在线查询只发送标题/作者/模式并解析知识库结果', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      responseWith(JSON.stringify({
        confidence: 'high',
        characters: [{ name: '贾宝玉', aliases: ['宝玉'], description: '主角' }],
        relations: [{ from: '贾宝玉', to: '林黛玉', type: '恋人', confidence: 'medium' }],
        sources: ['AI 知识库'],
      })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.lookupOnline({
      title: '红楼梦',
      author: '曹雪芹',
      mode: 'always',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.messages[1].content).toContain('红楼梦');
    expect(body.messages[1].content).toContain('曹雪芹');
    expect(body.messages[1].content).not.toContain('小说片段');
    expect(result.confidence).toBe('high');
    expect(result.characters[0]).toMatchObject({ name: '贾宝玉', aliases: ['宝玉'] });
    expect(result.relations[0]).toMatchObject({ from: '贾宝玉', to: '林黛玉', type: '恋人' });
  });

  it('在线查询返回未知作品时保留 low 和空列表', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      responseWith(JSON.stringify({
        confidence: 'low', characters: [], relations: [], sources: [],
      })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.lookupOnline({ title: '不存在的作品', mode: 'auto' });
    expect(result).toMatchObject({ confidence: 'low', characters: [], relations: [], sources: [] });
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
