import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PromptRenderInput {
  characters: string[];
  cooccurrences: { a: string; b: string; count: number }[];
  excerpt: string;
  hints: string[];
}

export interface LoadPromptOptions {
  overridePath?: string;
  defaultPath?: string;
  allowLocalOverride?: boolean;
}

const DEFAULT_PROMPT_PATH = fileURLToPath(
  new URL('./prompts/relationship-analysis.txt', import.meta.url),
);

const LEGACY_CHARACTERS_TOKEN = '${characters.join(\'、\')}';
const TOKENS = ['{{characters}}', '{{cooccurrences}}', '{{hints}}', '{{text}}'] as const;

function localOverrideAllowed() {
  return process.env.NODE_ENV !== 'production' && process.env.VITEST !== 'true';
}

function localOverrideCandidates() {
  return [
    resolve(process.cwd(), 'resources', 'prompt.txt'),
    resolve(process.cwd(), '..', 'resources', 'prompt.txt'),
  ];
}

function readPromptFile(path: string) {
  return readFileSync(path, 'utf8');
}

export function loadRelationshipPrompt(options: LoadPromptOptions = {}) {
  const explicit = options.overridePath?.trim();
  if (explicit && existsSync(explicit)) return readPromptFile(explicit);

  const allowLocal = options.allowLocalOverride ?? localOverrideAllowed();
  if (allowLocal) {
    const local = localOverrideCandidates().find((path) => existsSync(path));
    if (local) return readPromptFile(local);
  }

  return readPromptFile(options.defaultPath ?? DEFAULT_PROMPT_PATH);
}

function fillTemplate(template: string, input: PromptRenderInput) {
  const cooccurrences = input.cooccurrences.length
    ? input.cooccurrences
      .map((item) => `${item.a}—${item.b}（同段出现 ${item.count} 次）`)
      .join('\n')
    : '（无）';
  const hints = input.hints.length ? input.hints.join('、') : '其他';

  return template
    .split('{{characters}}').join(input.characters.join('、'))
    .split('{{cooccurrences}}').join(cooccurrences)
    .split('{{hints}}').join(hints)
    .split('{{text}}').join(input.excerpt)
    .split(LEGACY_CHARACTERS_TOKEN).join(input.characters.join('、'))
    .split('${text}').join(input.excerpt);
}

function appendContext(template: string, input: PromptRenderInput) {
  return [
    template.trim(),
    '',
    '【已知人物列表】',
    input.characters.join('、'),
    '',
    '【人物共现线索】',
    input.cooccurrences.length
      ? input.cooccurrences
        .map((item) => `${item.a}—${item.b}（同段出现 ${item.count} 次）`)
        .join('\n')
      : '（无）',
    '',
    '【关系类型参考】',
    input.hints.length ? input.hints.join('、') : '其他',
    '',
    '【小说片段】',
    input.excerpt,
  ].join('\n');
}

export function renderRelationshipPrompt(template: string, input: PromptRenderInput) {
  const hasToken = TOKENS.some((token) => template.includes(token))
    || template.includes(LEGACY_CHARACTERS_TOKEN)
    || template.includes('${text}');
  const rendered = fillTemplate(template, input);
  return hasToken ? rendered : appendContext(rendered, input);
}

export { DEFAULT_PROMPT_PATH };
