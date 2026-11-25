import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface OnlineLookupPromptInput {
  title: string;
  author?: string;
  mode: string;
}

const DEFAULT_PROMPT_PATH = fileURLToPath(
  new URL('./prompts/online-lookup.txt', import.meta.url),
);

export function renderOnlineLookupPrompt(template: string, input: OnlineLookupPromptInput) {
  return template
    .split('{{title}}').join(input.title)
    .split('{{author}}').join(input.author?.trim() || '未知')
    .split('{{mode}}').join(input.mode);
}

export function loadOnlineLookupPrompt() {
  return readFileSync(DEFAULT_PROMPT_PATH, 'utf8');
}
