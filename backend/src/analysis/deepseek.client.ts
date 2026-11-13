import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnalysisCharacter, AnalysisRelation, Cooccurrence } from './analysis.types.js';

export interface DeepSeekAnalysisInput {
  confirmed: string[];
  cooccurrences: Cooccurrence[];
  excerpt: string;
  template: string;
}

export interface DeepSeekAnalysisOutput {
  characters: AnalysisCharacter[];
  relations: AnalysisRelation[];
  model: string;
  tokenUsage: Record<string, number>;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const TEMPLATE_HINTS: Record<string, string[]> = {
  default: ['朋友', '敌人', '家人', '恋人'],
  xuanhuan: ['师徒', '同门', '敌对', '道侣'],
  wuxia: ['师徒', '仇人', '结拜', '恋人'],
  romance: ['暗恋', '恋人', '前任', '朋友', '情敌'],
};

function buildPrompt(input: DeepSeekAnalysisInput) {
  const hints = TEMPLATE_HINTS[input.template] ?? TEMPLATE_HINTS.default;
  const clues = input.cooccurrences
    .map((item) => `${item.a}—${item.b}（同段出现 ${item.count} 次）`)
    .join('\n');
  return [
    '请分析以下小说片段，提取人物关系。',
    `已知人物（只能输出这些人物）：${input.confirmed.join('、')}`,
    `关系类型参考：${hints.join('、')}`,
    clues ? `人物共现线索：\n${clues}` : '',
    '小说结构化片段：',
    input.excerpt,
    '请只返回 JSON，结构如下：',
    '{"characters":[{"name":"人物名","gender":"男|女|未知","description":"人物简介"}],',
    '"relations":[{"from":"人物名","to":"人物名","type":"关系类型","description":"关系说明","confidence":"high|medium|low"}]}',
    '要求：from/to 必须是已知人物；不要发明新人物；关系方向为 from → to；最多返回 60 条关系。',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parseJson(content: string | undefined) {
  if (!content) throw new Error('AI 未返回内容');
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 未返回 JSON');
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    characters?: unknown;
    relations?: unknown;
  };
  if (!Array.isArray(parsed.characters) || !Array.isArray(parsed.relations)) {
    throw new Error('AI 返回结构缺少 characters 或 relations');
  }
  return {
    characters: parsed.characters as AnalysisCharacter[],
    relations: parsed.relations as AnalysisRelation[],
  };
}

@Injectable()
export class DeepSeekClient {
  constructor(private readonly config: ConfigService) {}

  async analyze(input: DeepSeekAnalysisInput): Promise<DeepSeekAnalysisOutput> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_WEB');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'ANALYSIS_NOT_CONFIGURED',
        message: '服务端未配置 DeepSeek API 密钥，暂时无法进行 AI 分析',
      });
    }

    const baseUrl = (this.config.get<string>('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com').replace(/\/+$/, '');
    const model = this.config.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';
    const body = JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是小说人物关系抽取助手，只输出符合要求的 JSON，不要输出额外解释。',
        },
        { role: 'user', content: buildPrompt(input) },
      ],
    });

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body,
          signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) throw new Error(`DeepSeek 请求失败 (${response.status})`);
        const data = (await response.json()) as ChatCompletionResponse;
        const parsed = parseJson(data.choices?.[0]?.message?.content);
        return {
          ...parsed,
          model: data.model ?? model,
          tokenUsage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          },
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw new BadGatewayException({
      code: 'AI_BAD_RESPONSE',
      message: 'AI 返回内容无法解析，请稍后重试',
      details: { reason: lastError instanceof Error ? lastError.message : 'unknown' },
    });
  }
}
