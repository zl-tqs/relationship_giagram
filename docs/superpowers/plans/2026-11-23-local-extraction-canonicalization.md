# 本地人物提取候选规范化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复《红楼梦》等文本中“动作短语吞并真名、计数虚高、共现污染”的本地候选问题，并只增量引入经回归验证的过滤层。

**Architecture:** 先把候选生成和别名合并解耦：候选只记录来源，最终 `count` 使用原文实际出现次数；在吸收短名前先剔除结构上明显是短语的长候选。随后补传统字、全名/角色后缀、泛称/地名/别名规则；最后只加入弱来源候选的保守上下文门禁。保持浏览器本地零模型依赖和 120 候选上限。

**Tech Stack:** React 18 / TypeScript / Vitest / Vite；核心文件在 `frontend/src/core/analysis`。

**Spec:** `小说人物关系图工具-技术设计文档.md` §5.21.4、§5.21.9；用户五层过滤方案（附件 `AI人物提取.txt`）。

## Global Constraints

- 不引入 CRF、BiLSTM 或任何模型依赖；继续使用浏览器本地规则。
- 默认候选上限保持 120，不为了凑数 padding。
- 不修改 backend、PC/Tauri 代码；不访问 `.env`；不提交 `resources` 内容。
- 每项任务结束必须跑对应 Vitest 文件和既有 `extract.test.ts` / `extract.improved.test.ts`。
- 最后必须跑 `cd frontend && npm test` 和 `npm run build`。
- 提交信息使用中文，保持现有 `feat:` / `fix:` / `docs:` 风格。
- 不改变确认页、API 请求体和后端结果的现有结构；只增加前端候选质量。

---

### Task 1: 修复候选计数与动作短语吞并

**Files:**
- Create: `frontend/src/core/analysis/candidateRules.ts`
- Create: `frontend/src/core/analysis/extract.regression.test.ts`
- Modify: `frontend/src/core/analysis/extract.ts`

**Interfaces:**
- Consumes: `extractCharacterCandidates(text, limit)` 现有导出。
- Produces: `isPhraseCandidate(name: string): boolean`，供 `extract.ts` 剔除动作短语；`CharacterCandidate.count` 语义改为原文实际出现次数。

- [ ] **Step 1: 写失败回归测试**

创建 `frontend/src/core/analysis/extract.regression.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { extractCharacterCandidates } from './extract';

describe('候选规范化回归', () => {
  it('动作短语不吞并真实短名，count 使用原文实际次数', () => {
    const text = [
      '宝玉说道：“一。”',
      '宝玉笑道：“二。”',
      '贾母从被窝里伸出手来拉著宝玉道：“我的儿。”',
      '凤姐便拉平儿笑道：“你来。”',
      '宝钗推晴雯笑道：“你去。”',
    ].join('\n');

    const candidates = extractCharacterCandidates(text);
    const names = candidates.map((candidate) => candidate.name);

    expect(names).toContain('宝玉');
    expect(names).toContain('平儿');
    expect(names).toContain('晴雯');
    expect(names).not.toContain('手来拉著宝玉');
    expect(names).not.toContain('拉平儿');
    expect(names).not.toContain('推晴雯');
    expect(candidates.find((candidate) => candidate.name === '宝玉')?.count).toBe(3);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts
```

Expected: FAIL，至少出现 `手来拉著宝玉` 或 `宝玉` 被并入长名。

- [ ] **Step 3: 新增短语候选规则**

创建 `frontend/src/core/analysis/candidateRules.ts`：

```ts
const PHRASE_PREFIX_CHARS = new Set('着著手拉推瞅赦纨命里上'.split(''));
const PHRASE_END_CHARS = new Set(['着', '著']);

export function isPhraseCandidate(name: string): boolean {
  if (name.includes('·')) return false;
  if (PHRASE_END_CHARS.has(name[name.length - 1])) return true;
  return name.length > 2 && PHRASE_PREFIX_CHARS.has(name[0]);
}
```

- [ ] **Step 4: 把 count 从“证据次数”改为“实际出现次数”**

在 `frontend/src/core/analysis/extract.ts` 中：

1. 把 `CandidateInfo` 改为：

```ts
interface CandidateInfo {
  name: string;
  sources: Set<Source>;
  aliases: Set<string>;
}
```

2. 修改 `addCandidate`，不再维护 `count`：

```ts
function addCandidate(
  candidates: Map<string, CandidateInfo>,
  name: string,
  source: Source,
) {
  const existing = candidates.get(name);
  if (existing) {
    existing.sources.add(source);
    return;
  }
  candidates.set(name, { name, sources: new Set([source]), aliases: new Set() });
}
```

3. 新增并调用短语清理：

```ts
import { isPhraseCandidate } from './candidateRules';

function dropPhraseCandidates(candidates: Map<string, CandidateInfo>) {
  for (const name of [...candidates.keys()]) {
    if (isPhraseCandidate(name)) candidates.delete(name);
  }
}
```

在 `extractCharacterCandidates` 中按以下顺序调用：

```ts
scanSurnames(text, candidates, [...candidates.keys()]);
applyChapterBoost(text, candidates);
const actualCounts = new Map<string, number>();
for (const name of candidates.keys()) actualCounts.set(name, countOccurrences(text, name));
dropPhraseCandidates(candidates);
dropKnownNamePhrases(candidates);
absorbShorterNames(text, candidates, actualCounts);
```

4. 修改 `absorbShorterNames` 签名并删除计数继承：

```ts
function absorbShorterNames(
  text: string,
  candidates: Map<string, CandidateInfo>,
  actualCounts: Map<string, number>,
) {
  // ...
  const longerActual = actualCounts.get(longer.name) ?? 0;
  const shorterActual = actualCounts.get(shorter.name) ?? 0;
  const longerTrusted = longer.sources.has('speaker')
    || longer.sources.has('special')
    || longer.sources.has('chapter')
    || longer.sources.has('transliteration')
    || longerActual >= shorterActual;
  // ...
  // 删除这一行：longer.count = Math.max(longer.count, shorter.count);
}
```

5. 修改 `scoreOf`，显式接收实际次数：

```ts
function scoreOf(
  info: CandidateInfo,
  actualCount: number,
  partners: Set<string> | undefined,
) {
  let score = 0;
  for (const source of info.sources) score += SOURCE_SCORE[source];
  if (actualCount >= 10) score += 3;
  else if (actualCount >= 5) score += 2;
  else if (actualCount >= 3) score += 1;
  // 其余逻辑不变
}
```

6. 最终评分改为：

```ts
const scored = names.map((name) => {
  const info = candidates.get(name)!;
  const actualCount = countOccurrences(text, name);
  return {
    name,
    count: actualCount,
    confidence: confidenceOf(scoreOf(info, actualCount, partners.get(name))),
    aliases: [...info.aliases].sort((left, right) => right.length - left.length),
  };
});
```

- [ ] **Step 5: 运行回归与既有测试**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts src/core/analysis/extract.test.ts src/core/analysis/extract.improved.test.ts
```

Expected: PASS。`宝玉` 的 `count` 为 3；不再出现 `手来拉著宝玉`、`拉平儿`、`推晴雯`。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/core/analysis/candidateRules.ts frontend/src/core/analysis/extract.regression.test.ts frontend/src/core/analysis/extract.ts
git commit -m "fix: 修复候选计数与动作短语吞并"
```

---

### Task 2: 补全传统字与完整姓名/角色后缀

**Files:**
- Modify: `frontend/src/core/analysis/lexicon.ts`
- Modify: `frontend/src/core/analysis/extract.ts`
- Modify: `frontend/src/core/analysis/extract.regression.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `dropPhraseCandidates`、实际计数和 `dropKnownNamePhrases`。
- Produces: `dropKnownNamePhrases(text, candidates)` 支持“合法全名扩展”判断；`SPECIAL_SUFFIXES` 增加 `夫人`。

- [ ] **Step 1: 写失败测试**

在 `extract.regression.test.ts` 追加：

```ts
it('保留完整姓名和角色称呼，不把传统字当作姓名', () => {
  const text = [
    '史湘云道：“二哥哥来了。”',
    '王熙凤笑道：“我来迟了。”',
    '王夫人说道：“宝玉，你过来。”',
    '尤二姐说道：“妹妹来了。”',
    '贾宝玉说道：“我来了。”',
    '说著贾母又笑道：“好。”',
    '应著说道：“是。”',
    '孔明云：“此计可行。”',
  ].join('\n');

  const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

  for (const expected of ['史湘云', '王熙凤', '王夫人', '尤二姐', '贾宝玉', '贾母', '孔明']) {
    expect(names).toContain(expected);
  }
  for (const noise of ['史湘', '王熙', '尤二', '著贾母', '应著', '孔明云']) {
    expect(names).not.toContain(noise);
  }
});
```

- [ ] **Step 2: 运行确认失败**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts
```

Expected: FAIL，`史湘云`、`王熙凤`、`王夫人`、`尤二姐`、`贾宝玉` 至少有一项缺失，或 `著贾母`/`应著` 仍存在。

- [ ] **Step 3: 更新词表**

在 `frontend/src/core/analysis/lexicon.ts`：

1. `INVALID_START_CHARS` 末尾加入 `著`。
2. `INVALID_END_CHARS` 中删除 `云`，把 `著` 加入该集合。
3. `PHRASE_PREFIX_CHARS` 加入 `著`。
4. `SCAN_GIVEN_END_CHARS` 加入 `凤`、`玉`。
5. `SPECIAL_SUFFIXES` 加入 `'夫人'`。
6. `SHORT_PREFIX_SUFFIXES` 加入 `'夫人'`。

- [ ] **Step 4: 增加合法全名扩展判断**

在 `extract.ts` 的 `NAME_FUNCTION_CHARS` 中加入 `著`：

```ts
const NAME_FUNCTION_CHARS = /[的了着著过和与跟同这那其我你他她它谁某几]/;
```

在 `dropKnownNamePhrases` 前增加：

```ts
const NAME_EXTENSION_SUFFIXES = new Set([
  '夫人', '姑娘', '奶奶', '姐姐', '妹妹', '姐', '姨', '氏', '娘',
]);

function isAllowedNameExtension(text: string, name: string, known: string) {
  const extra = name.slice(known.length);
  if (extra === '云') {
    return ['道', '说道', '笑道', '问道', '答道'].some((suffix) => text.includes(name + suffix));
  }
  return NAME_EXTENSION_SUFFIXES.has(extra)
    || [...extra].every((char) => SCAN_GIVEN_END_CHARS.has(char));
}
```

把签名改为 `dropKnownNamePhrases(text: string, candidates: Map<string, CandidateInfo>)`，并在“更长候选以强名开头”的分支里使用：

```ts
if (strongNames.some((known) => known.length < name.length && name.startsWith(known))) {
  const known = strongNames.find((item) => item.length < name.length && name.startsWith(item))!;
  if (!isAllowedNameExtension(text, name, known)) {
    candidates.delete(name);
    continue;
  }
}
```

保留现有 `extendedByRole` 分支，确保 `燃灯道人`、`准提道人` 不被删除。

- [ ] **Step 5: 运行回归与既有测试**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts src/core/analysis/extract.test.ts src/core/analysis/extract.improved.test.ts
```

Expected: PASS；`王夫人` 通过 `夫人` 特殊后缀进入候选，`史湘云` 不再截成 `史湘`，`孔明云` 被强名扩展规则剔除。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/core/analysis/lexicon.ts frontend/src/core/analysis/extract.ts frontend/src/core/analysis/extract.regression.test.ts
git commit -m "fix: 补全传统字与完整角色名规则"
```

---

### Task 3: 扩充泛称、地名和别名质量规则

**Files:**
- Modify: `frontend/src/core/analysis/lexicon.ts`
- Modify: `frontend/src/core/analysis/extract.ts`
- Modify: `frontend/src/core/analysis/preprocess.ts`
- Modify: `frontend/src/core/analysis/extract.regression.test.ts`

**Interfaces:**
- Consumes: Task 1/2 的候选清理和完整姓名规则。
- Produces: `GENERIC_TITLES`、`GENERIC_ALIAS_WORDS` 导出；`expandSuffixAliases` 不再生成泛称别名。

- [ ] **Step 1: 写失败测试**

追加：

```ts
it('过滤泛称、动作词和地名，不生成泛称别名', () => {
  const text = [
    '林黛玉说道：“林妹妹来了。”',
    '林妹妹笑道：“姐姐好。”',
    '奶奶说道：“父母来了。”',
    '他收拾了扇子，并不理会。',
    '荣国府里，怡红院、潇湘馆、大观园都安静。',
  ].join('\n');

  const candidates = extractCharacterCandidates(text);
  const names = candidates.map((candidate) => candidate.name);

  for (const noise of [
    '奶奶', '父母', '收拾', '并不', '扇子',
    '荣国府', '怡红院', '潇湘馆', '大观园',
  ]) {
    expect(names).not.toContain(noise);
  }

  const sister = candidates.find((candidate) => candidate.name === '林妹妹');
  expect(sister?.aliases ?? []).not.toContain('妹妹');
});
```

- [ ] **Step 2: 运行确认失败**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts
```

Expected: FAIL，至少出现 `奶奶`、`父母`、`收拾`、`并不`、`荣国府`、`怡红院`、`潇湘馆`、`大观园` 之一，或 `林妹妹` 带 `妹妹` 别名。

- [ ] **Step 3: 扩充停用词与地名后缀**

在 `lexicon.ts` 中：

1. `STOP_WORDS` 追加：

```ts
'父母', '嫂子', '老婆子', '丫头子', '姑子', '孙子', '母女', '儿媳妇',
'大奶奶', '老嬷嬷', '王爷', '门子', '小儿', '点子',
'收拾', '不理', '吃饭', '吃茶', '倒茶', '上学', '上夜', '点头儿',
'呆呆', '好生', '未免', '俗语', '亲友', '富贵', '昨夜', '第二',
'明儿', '并不', '应著', '睡著', '陪著', '家子', '扇子', '邢王',
'荣国府', '宁国府', '荣府', '宁府', '贾府', '王府',
```

2. `HARD_PLACE_SUFFIXES` 追加：

```ts
'院', '馆', '园', '楼', '阁', '寺', '庙', '庵', '观',
'堂', '斋', '轩', '榭', '亭', '台',
```

3. 新增并导出：

```ts
export const GENERIC_TITLES = new Set([
  '奶奶', '嬷嬷', '老嬷嬷', '婆子', '老婆子', '丫头', '丫头子',
  '姑子', '媳妇', '儿媳妇', '嫂子', '孙子', '孙女', '父母',
  '母女', '父子', '夫妻', '王爷', '门子', '小儿', '点子',
  '妹妹', '姐姐', '姑娘', '夫人', '太太', '老爷', '老太太',
  '老夫人', '公子', '小姐',
]);

export const GENERIC_ALIAS_WORDS = new Set([
  '妹妹', '姐姐', '婆子', '头子', '姨妈', '姥姥', '嬷嬷',
  '姑娘', '夫人', '太太', '奶奶', '嫂子', '媳妇',
]);
```

- [ ] **Step 4: 把泛称纳入非人名判断并阻止泛称别名**

在 `extract.ts` 中导入 `GENERIC_TITLES`，修改：

```ts
function isNonPersonWord(name: string) {
  return STOP_WORDS.has(name)
    || ROLE_WORDS.has(name)
    || OBJECT_WORDS.has(name)
    || GENERIC_TITLES.has(name)
    || SPECIAL_SUFFIXES.includes(name)
    || COLLECTIVE_PATTERN.test(name);
}
```

在 `expandSuffixAliases` 添加别名前增加：

```ts
import { GENERIC_ALIAS_WORDS } from './lexicon';
// ...
if (GENERIC_ALIAS_WORDS.has(suffix) || isNonPersonWord(suffix)) {
  continue;
}
```

在 `preprocess.ts` 构建 `aliasMap` 时跳过泛称别名：

```ts
import { GENERIC_ALIAS_WORDS } from './lexicon';
// ...
for (const alias of candidate.aliases ?? []) {
  if (alias === candidate.name || GENERIC_ALIAS_WORDS.has(alias)) continue;
  aliasMap[alias] = candidate.name;
  allNames.push(alias);
}
```

- [ ] **Step 5: 运行回归与既有测试**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts src/core/analysis/extract.test.ts src/core/analysis/extract.improved.test.ts src/core/analysis/preprocess.test.ts
```

Expected: PASS；`林妹妹` 仍作为候选，但不再带 `妹妹` 别名；地名和泛称不再进入候选。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/core/analysis/lexicon.ts frontend/src/core/analysis/extract.ts frontend/src/core/analysis/preprocess.ts frontend/src/core/analysis/extract.regression.test.ts
git commit -m "fix: 扩充泛称地名与别名清洗规则"
```

---

### Task 4: 只对弱来源候选增加保守上下文门禁

**Files:**
- Modify: `frontend/src/core/analysis/extract.ts`
- Modify: `frontend/src/core/analysis/extract.regression.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `actualCounts`、`CandidateInfo.sources`。
- Produces: `isWeakContextNoise(sources, actualCount, badContexts)` 纯函数，供最终过滤使用。

- [ ] **Step 1: 写失败测试**

追加：

```ts
it('弱来源候选在负面上下文占比过高时被过滤', () => {
  expect(isWeakContextNoise(new Set(['action']), 10, 8)).toBe(true);
  expect(isWeakContextNoise(new Set(['scan']), 1, 1)).toBe(true);
  expect(isWeakContextNoise(new Set(['speaker']), 1, 1)).toBe(false);
  expect(isWeakContextNoise(new Set(['action', 'chapter']), 10, 10)).toBe(false);
});
```

- [ ] **Step 2: 运行确认失败**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts
```

Expected: FAIL，`isWeakContextNoise` 未定义。

- [ ] **Step 3: 实现弱来源上下文门禁**

在 `extract.ts` 中增加：

```ts
export type CandidateSource = Source;

const STRONG_SOURCES = new Set<Source>(['speaker', 'special', 'chapter', 'transliteration']);
const WEAK_SOURCES = new Set<Source>(['scan', 'action', 'object', 'preposition', 'conjunction']);

export function isWeakContextNoise(
  sources: Set<CandidateSource>,
  actualCount: number,
  badContexts: number,
) {
  if ([...sources].some((source) => STRONG_SOURCES.has(source))) return false;
  if (actualCount < 2) return true;
  return badContexts / actualCount >= 0.6;
}

function countBadContexts(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'g');
  let bad = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const before = text.slice(Math.max(0, match.index - 2), match.index);
    if (/[拉推扶抱背牵拽提拖瞅著着和与跟同向从到把被将]$/.test(before)) bad += 1;
  }
  return bad;
}

function dropWeakContextNoise(
  text: string,
  candidates: Map<string, CandidateInfo>,
  actualCounts: Map<string, number>,
) {
  for (const [name, info] of candidates) {
    const actualCount = actualCounts.get(name) ?? 0;
    const badContexts = countBadContexts(text, name);
    if (isWeakContextNoise(info.sources, actualCount, badContexts)) {
      candidates.delete(name);
    }
  }
}
```

在 `embedShorterNames` 之后、生成 `names` 之前调用：

```ts
dropWeakContextNoise(text, candidates, actualCounts);
```

- [ ] **Step 4: 运行回归与既有测试**

Run:

```bash
cd frontend && npm test -- src/core/analysis/extract.regression.test.ts src/core/analysis/extract.test.ts src/core/analysis/extract.improved.test.ts
```

Expected: PASS；有 `speaker`/`chapter` 强来源的候选不会被上下文门禁误删。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/core/analysis/extract.ts frontend/src/core/analysis/extract.regression.test.ts
git commit -m "fix: 增加弱来源候选上下文门禁"
```

---

### Task 5: 增加《红楼梦》全量回归并同步文档

**Files:**
- Create: `frontend/scripts/hongloumeng.regression.test.ts`
- Modify: `frontend/src/core/analysis/extract.regression.test.ts`（仅在需要补断言时）
- Modify: `小说人物关系图工具-技术设计文档.md`

**Interfaces:**
- Consumes: Task 1-4 的最终候选输出。
- Produces: 可重复运行的全量回归门禁；文档中的版本边界与回归记录。

- [ ] **Step 1: 新增全量回归测试**

创建 `frontend/scripts/hongloumeng.regression.test.ts`：

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preprocessNovel } from '../src/core/analysis/preprocess';

const novelPath = resolve(process.cwd(), '../resources/novel/txt/红楼梦.txt');

describe.skipIf(!existsSync(novelPath))('红楼梦本地提取回归', () => {
  it('不产生动作短语候选并保留主要人物', () => {
    const buffer = readFileSync(novelPath);
    const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const result = preprocessNovel(data as ArrayBuffer);
    const names = result.candidates.map((candidate) => candidate.name);

    expect(result.candidates.length).toBeLessThanOrEqual(120);
    for (const expected of [
      '贾宝玉', '林黛玉', '薛宝钗', '王熙凤', '贾母',
      '王夫人', '史湘云', '平儿', '晴雯', '紫鹃', '尤二姐',
    ]) {
      expect(names).toContain(expected);
    }
    for (const noise of [
      '手来拉著宝玉', '著贾母', '著宝钗', '拉平儿', '推晴雯',
      '推紫鹃', '赦贾政', '纨探春', '命贾蓉', '里贾琏出来',
      '著李纨', '著香菱', '上拉著金桂',
    ]) {
      expect(names).not.toContain(noise);
    }
  });

  it('不把红楼梦地名和泛称作为人物', () => {
    const buffer = readFileSync(novelPath);
    const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const result = preprocessNovel(data as ArrayBuffer);
    const names = result.candidates.map((candidate) => candidate.name);

    for (const noise of [
      '荣国府', '宁府', '荣府', '怡红院', '潇湘馆', '大观园',
      '奶奶', '父母', '嫂子', '老婆子', '丫头子', '并不', '收拾',
    ]) {
      expect(names).not.toContain(noise);
    }
  });
});
```

- [ ] **Step 2: 运行全量回归**

Run:

```bash
cd frontend && npm test -- scripts/hongloumeng.regression.test.ts
```

Expected: PASS。若 `resources` 不存在，测试自动 skip，不影响仓库默认测试。

- [ ] **Step 3: 更新技术设计文档**

在 `小说人物关系图工具-技术设计文档.md` 中：

1. 在 5.21.4 本地候选提取部分补充：
   - `count` 现在表示原文实际出现次数，不再继承别名证据次数。
   - 动作短语先回退真实短名，再删除长候选。
   - `著` 传统字、`云/凤/玉/人` 等姓名末字的上下文例外。
   - `夫人/姐/姨/氏/娘` 角色后缀和 `院/馆/园/府` 地名过滤边界。
   - 别名只自动合并可确认短名，`妹妹/婆子/头子/姨妈/姥姥` 等泛称不进入 `aliasMap`。

2. 在 5.21.9 增加 `v1.1.2（本地候选规范化）`，列出本次修复。

3. 修正 5.21.8 与 5.21.9 的矛盾：把“音译名当前会截断，v2 处理”改为“v1.1.1 已支持基础音译名，v2 继续处理多语言和复杂变体”。

4. 更新回归记录：
   - 写明《红楼梦》当前基线曾出现 `手来拉著宝玉`、`著贾母` 等噪声。
   - 写明修复后的断言：主要人物保留、动作短语消失、地名/泛称消失、候选数不超过 120。
   - 把《三国演义》前 15 的名称说明为“当前规范名/常用称呼”，避免和 `刘玄德/关公` 的实际输出冲突。

- [ ] **Step 4: 运行全量测试和构建**

Run:

```bash
cd frontend && npm test
cd frontend && npm run build
```

Expected: 全量测试 PASS；生产构建 PASS。

- [ ] **Step 5: 提交并推送**

```bash
git add frontend/scripts/hongloumeng.regression.test.ts 小说人物关系图工具-技术设计文档.md
git commit -m "test: 增加红楼梦本地提取回归并同步文档"
git push origin main
```

> 推送前确认工作区只包含本次改动；不添加 `resources` 下的任何文件。

---

## Self-Review

- **Spec coverage:** Task 1 对应“候选规范化/计数”；Task 2 对应“传统字与完整姓名”；Task 3 对应“泛称/地名/别名”；Task 4 对应“五层方案中可安全落地的上下文门禁”；Task 5 对应全量回归和文档边界。
- **Placeholder scan:** 所有代码步骤均给出可执行片段；没有 TBD/TODO。
- **Type consistency:** `CandidateInfo` 在 Task 1 去掉 `count` 后，Task 1 的 `absorbShorterNames`/`scoreOf`/最终评分均改为使用 `actualCounts`；Task 4 的 `isWeakContextNoise` 使用 `Set<CandidateSource>`，与 `Source` 类型一致。
- **Deferred:** 全量五层重写、CRF/BiLSTM、跨行音译修正不在本轮；若 Task 5 回归仍有残余噪声，再单独开 v1.2 评估任务。
