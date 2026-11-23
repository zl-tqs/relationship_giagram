import {
  ACTION_PATTERN, BOUNDARY_AFTER_CHARS, COLLECTIVE_PATTERN, COMMON_SURNAMES,
  COMPOUND_SURNAMES, CONJUNCTION_PATTERN, HARD_PLACE_SUFFIXES, INVALID_END_CHARS,
  INVALID_START_CHARS, NAME_BLOCKED_INTERNAL, NAME_START_EXCEPTIONS, OBJECT_PATTERN,
  OBJECT_WORDS, PHRASE_PREFIX_CHARS, PREPOSITION_PATTERN, ROLE_WORDS,
  SCAN_GIVEN_END_CHARS, SHORT_PREFIX_SUFFIXES, SHORTEST_PREFIX_SUFFIXES,
  SINGLE_SURNAMES, SOFT_PLACE_SUFFIXES, SPECIAL_PREFIX_BLACKLIST,
  SPECIAL_PREFIX_STOP_CHARS, SPECIAL_SUFFIXES, SPEAKER_PATTERN, STOP_WORDS,
  TRANSLITERATION_CHARS, WEAK_SURNAMES,
} from './lexicon';
import { isPhraseCandidate, isTransliterationLike } from './candidateRules';
import type { CandidateConfidence, CharacterCandidate, Cooccurrence } from './types';

export const DEFAULT_CANDIDATE_LIMIT = 120;

type Source =
  | 'chapter' | 'speaker' | 'action' | 'object' | 'preposition' | 'conjunction'
  | 'special' | 'scan' | 'transliteration';

interface CandidateInfo {
  name: string;
  sources: Set<Source>;
  aliases: Set<string>;
}

const SOURCE_SCORE: Record<Source, number> = {
  chapter: 5,
  speaker: 6,
  action: 2,
  object: 2,
  preposition: 2,
  conjunction: 1,
  special: 3,
  scan: 1,
  transliteration: 5,
};

const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 } as const;
const NAME_FUNCTION_CHARS = /[的了着著过和与跟同这那其我你他她它谁某几]/;

function isChinese(value: string) {
  return /^[\u4e00-\u9fa5]+$/.test(value);
}

function surnameWeight(name: string) {
  const firstTwo = name.slice(0, 2);
  if (COMPOUND_SURNAMES.includes(firstTwo)) return 0.9;
  const first = name[0];
  if (WEAK_SURNAMES.has(first)) return 0.1;
  if (COMMON_SURNAMES.has(first)) return 1;
  if (SINGLE_SURNAMES.has(first)) return 0.6;
  return 0;
}

function matchingRoleSuffix(name: string) {
  return SPECIAL_SUFFIXES.find((suffix) => name.length > suffix.length && name.endsWith(suffix)) ?? null;
}

function hasInvalidRoleShape(name: string) {
  const suffix = matchingRoleSuffix(name);
  if (!suffix) return false;
  const prefixLength = name.length - suffix.length;
  return SHORT_PREFIX_SUFFIXES.has(suffix) ? prefixLength < 1 : prefixLength < 2;
}

function isNonPersonWord(name: string) {
  return STOP_WORDS.has(name)
    || ROLE_WORDS.has(name)
    || OBJECT_WORDS.has(name)
    || SPECIAL_SUFFIXES.includes(name)
    || COLLECTIVE_PATTERN.test(name);
}

function hasPlaceSuffix(name: string, suffixes: Set<string>) {
  return [...suffixes].some((suffix) => name.length > suffix.length && name.endsWith(suffix));
}

function isValidNameShape(name: string) {
  const special = Boolean(matchingRoleSuffix(name));
  const compound = COMPOUND_SURNAMES.some((surname) => name.startsWith(surname));
  const transliterated = isTransliterationLike(name);
  const maxLength = special || transliterated ? 7 : compound ? 4 : 3;
  if (name.length < 2 || name.length > maxLength) return false;
  if (!isChinese(name)) return false;
  if (special) {
    if (SPECIAL_PREFIX_BLACKLIST.has(name[0])) return false;
  } else if (INVALID_START_CHARS.has(name[0]) && !NAME_START_EXCEPTIONS.has(name)) {
    return false;
  }
  const last = name[name.length - 1];
  const transliterationEnd = last === '来' && isTransliterationLike(name);
  if (!special && INVALID_END_CHARS.has(last) && !transliterationEnd) return false;
  if (NAME_FUNCTION_CHARS.test(name) || NAME_BLOCKED_INTERNAL.test(name)) return false;
  return !isNonPersonWord(name) && !hasInvalidRoleShape(name);
}

function isStrongName(name: string) {
  return isValidNameShape(name) && !isPhraseCandidate(name);
}

function isScannedName(name: string) {
  if (/[一二三四五六七八九十]$/.test(name) && name.length > 2) return false;
  const last = name[name.length - 1];
  const endAllowed = SCAN_GIVEN_END_CHARS.has(last)
    || (last === '来' && isTransliterationLike(name));
  return isValidNameShape(name)
    && surnameWeight(name) >= 0.5
    && endAllowed;
}

function isSpecialName(name: string) {
  if (!matchingRoleSuffix(name)) return false;
  if (name.length < 3 || name.length > 7 || !isChinese(name)) return false;
  if (SPECIAL_PREFIX_BLACKLIST.has(name[0])) return false;
  if (NAME_FUNCTION_CHARS.test(name) || NAME_BLOCKED_INTERNAL.test(name)) return false;
  return !isNonPersonWord(name) && !hasInvalidRoleShape(name);
}

function isBoundaryAfter(text: string, endIndex: number) {
  if (endIndex >= text.length) return true;
  const next = text[endIndex];
  return !isChinese(next) || BOUNDARY_AFTER_CHARS.has(next);
}

function pickLongestValidSuffix(raw: string, validator: (name: string) => boolean, maxLength = 6) {
  let shortTitle: string | null = null;
  for (let length = Math.min(maxLength, raw.length); length >= 2; length -= 1) {
    const name = raw.slice(raw.length - length);
    if (!validator(name)) continue;
    const suffix = matchingRoleSuffix(name);
    if (suffix && SHORTEST_PREFIX_SUFFIXES.has(suffix)) {
      shortTitle = name;
      continue;
    }
    return name;
  }
  return shortTitle;
}

function pickNameAfter(
  raw: string,
  text: string,
  startIndex: number,
  knownNames: string[],
) {
  for (const known of [...knownNames].sort((left, right) => right.length - left.length)) {
    if (raw.startsWith(known) && isBoundaryAfter(text, startIndex + known.length)) return known;
  }
  for (let offset = 0; offset <= 1 && offset <= raw.length - 2; offset += 1) {
    for (let length = 2; length <= Math.min(6, raw.length - offset); length += 1) {
      const name = raw.slice(offset, offset + length);
      if (isStrongName(name) && isBoundaryAfter(text, startIndex + offset + length)) return name;
    }
  }
  return null;
}

function stripQuotedText(text: string) {
  return text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g, (value) => ' '.repeat(value.length));
}

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

function extractSpeakers(text: string, candidates: Map<string, CandidateInfo>) {
  SPEAKER_PATTERN.lastIndex = 0;
  let match = SPEAKER_PATTERN.exec(text);
  while (match) {
    const name = pickLongestValidSuffix(match[1], isStrongName);
    if (name) addCandidate(candidates, name, 'speaker');
    match = SPEAKER_PATTERN.exec(text);
  }
}

function extractBeforeVerbs(text: string, candidates: Map<string, CandidateInfo>) {
  const narration = stripQuotedText(text);
  ACTION_PATTERN.lastIndex = 0;
  let match = ACTION_PATTERN.exec(narration);
  while (match) {
    const before = narration.slice(Math.max(0, match.index - 6), match.index);
    const name = pickLongestValidSuffix(before, isStrongName);
    if (name) addCandidate(candidates, name, 'action');
    match = ACTION_PATTERN.exec(narration);
  }
}

function extractAfterVerbs(
  text: string,
  candidates: Map<string, CandidateInfo>,
  pattern: RegExp,
  source: Source,
) {
  const narration = stripQuotedText(text);
  const knownNames = [...candidates.keys()];
  pattern.lastIndex = 0;
  let match = pattern.exec(narration);
  while (match) {
    const start = match.index + match[0].length;
    const raw = narration.slice(start, start + 6);
    const name = pickNameAfter(raw, narration, start, knownNames);
    if (name) addCandidate(candidates, name, source);
    match = pattern.exec(narration);
  }
}

function extractSpecialNames(text: string, candidates: Map<string, CandidateInfo>) {
  const pattern = new RegExp(`(${SPECIAL_SUFFIXES.join('|')})`, 'g');
  let match = pattern.exec(text);
  while (match) {
    const suffix = match[1];
    const suffixEnd = match.index + suffix.length;
    if (!isBoundaryAfter(text, suffixEnd)) {
      match = pattern.exec(text);
      continue;
    }

    let prefix = '';
    for (let cursor = match.index - 1; cursor >= 0 && prefix.length < 4; cursor -= 1) {
      const char = text[cursor];
      if (!isChinese(char) || SPECIAL_PREFIX_STOP_CHARS.has(char)) break;
      prefix = `${char}${prefix}`;
    }

    const shortest = SHORTEST_PREFIX_SUFFIXES.has(suffix);
    for (let step = 1; step <= prefix.length; step += 1) {
      const length = shortest ? step : prefix.length - step + 1;
      const name = `${prefix.slice(prefix.length - length)}${suffix}`;
      if (isSpecialName(name)) {
        addCandidate(candidates, name, 'special');
        break;
      }
    }
    match = pattern.exec(text);
  }
}

const DOTTED_TRANSLITERATION_PATTERN = /[·•‧]/g;
const TRANSLITERATION_PLACE_PREFIXES = [
  '莫斯科', '基辅', '彼得堡', '彼得格勒', '乌克兰', '俄罗斯', '波兰',
];

function trimPlacePrefix(part: string) {
  const place = TRANSLITERATION_PLACE_PREFIXES.find(
    (item) => part.length > item.length && part.startsWith(item),
  );
  return place ? part.slice(place.length) : part;
}

function extractTransliteratedNames(text: string, candidates: Map<string, CandidateInfo>) {
  DOTTED_TRANSLITERATION_PATTERN.lastIndex = 0;
  let match = DOTTED_TRANSLITERATION_PATTERN.exec(text);
  while (match) {
    const dot = match.index;
    let start = dot;
    while (start > 0 && TRANSLITERATION_CHARS.has(text[start - 1])) start -= 1;
    let end = dot + 1;
    while (end < text.length && TRANSLITERATION_CHARS.has(text[end])) end += 1;
    const before = trimPlacePrefix(text.slice(start, dot));
    const after = text.slice(dot + 1, end);
    if (before && after && before.length + after.length >= 3) {
      const name = `${before}·${after}`;
      addCandidate(candidates, name, 'transliteration');
      const info = candidates.get(name);
      if (info) {
        for (const part of [before, after]) {
          if (part.length >= 2) info.aliases.add(part);
        }
      }
    }
    match = DOTTED_TRANSLITERATION_PATTERN.exec(text);
  }
}

function isInsideKnownName(text: string, index: number, knownNames: string[]) {
  for (const known of knownNames) {
    for (let offset = 1; offset < known.length; offset += 1) {
      if (index - offset >= 0 && text.startsWith(known.slice(offset), index - offset)) return true;
    }
  }
  return false;
}

function scanSurnames(
  text: string,
  candidates: Map<string, CandidateInfo>,
  knownNames: string[],
) {
  for (let index = 0; index < text.length; index += 1) {
    const compound = COMPOUND_SURNAMES.find((surname) => text.startsWith(surname, index));
    const surnameLength = compound ? compound.length : SINGLE_SURNAMES.has(text[index]) ? 1 : 0;
    if (!surnameLength) continue;
    if (isInsideKnownName(text, index, knownNames)) continue;

    const probe = text.slice(index, index + surnameLength + 2);
    if (surnameWeight(probe) < 0.5) continue;

    for (let givenLength = 2; givenLength >= 1; givenLength -= 1) {
      const name = text.slice(index, index + surnameLength + givenLength);
      if (name.length !== surnameLength + givenLength || !isScannedName(name)) continue;
      const next = text[index + name.length] ?? '';
      if (/[一二三四五六七八九十]$/.test(name) && '人行个位名众起路边只次年月日'.includes(next)) {
        continue;
      }
      addCandidate(candidates, name, 'scan');
      index += name.length - 1;
      break;
    }
  }
}

function dropPhraseCandidates(candidates: Map<string, CandidateInfo>) {
  for (const name of [...candidates.keys()]) {
    if (isPhraseCandidate(name)) candidates.delete(name);
  }
}

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

function dropKnownNamePhrases(text: string, candidates: Map<string, CandidateInfo>) {
  const strongNames = [...candidates.values()]
    .filter((info) => info.sources.has('speaker')
      || info.sources.has('special')
      || info.sources.has('chapter')
      || info.sources.has('transliteration'))
    .map((info) => info.name)
    .sort((left, right) => right.length - left.length);

  for (const [name] of candidates) {
    if (name.includes('·')) continue;
    const extendedByRole = strongNames.some((known) => (
      known.length < name.length
      && name.startsWith(known)
      && SPECIAL_SUFFIXES.includes(name.slice(known.length))
    ));
    if (extendedByRole) continue;
    if (strongNames.some((known) => known.length < name.length && name.startsWith(known))) {
      const known = strongNames.find((item) => item.length < name.length && name.startsWith(item))!;
      if (!isAllowedNameExtension(text, name, known)) {
        candidates.delete(name);
        continue;
      }
    }
    const prefixedByPhrase = strongNames.some((known) => {
      if (known.length >= name.length || !name.endsWith(known)) return false;
      const prefix = name.slice(0, name.length - known.length);
      return prefix.length <= 3
        && [...prefix].some((char) => (
          INVALID_START_CHARS.has(char) || PHRASE_PREFIX_CHARS.has(char)
        ));
    });
    if (prefixedByPhrase) candidates.delete(name);
  }
}

function absorbShorterNames(
  candidates: Map<string, CandidateInfo>,
  actualCounts: Map<string, number>,
) {
  const entries = [...candidates.values()].sort(
    (left, right) => right.name.length - left.name.length
      || (actualCounts.get(right.name) ?? 0) - (actualCounts.get(left.name) ?? 0),
  );
  const removed = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    const longer = entries[i];
    if (removed.has(longer.name)) continue;
    for (let j = i + 1; j < entries.length; j += 1) {
      const shorter = entries[j];
      if (removed.has(shorter.name) || !longer.name.includes(shorter.name)) continue;
      const longerActual = actualCounts.get(longer.name) ?? 0;
      const shorterActual = actualCounts.get(shorter.name) ?? 0;
      const longerTrusted = longer.sources.has('speaker')
        || longer.sources.has('special')
        || longer.sources.has('chapter')
        || longer.sources.has('transliteration')
        || longerActual >= shorterActual;
      if (!longerTrusted) continue;
      const suffixMatch = longer.name.endsWith(shorter.name);
      const strongShorter = shorter.sources.has('speaker')
        || shorter.sources.has('special')
        || shorter.sources.has('chapter')
        || shorter.sources.has('transliteration');
      const standalone = Math.max(0, shorterActual - longerActual);
      if ((suffixMatch || strongShorter) && (standalone > 0 || strongShorter)) {
        longer.aliases.add(shorter.name);
        for (const alias of shorter.aliases) longer.aliases.add(alias);
      }
      for (const source of shorter.sources) longer.sources.add(source);
      removed.add(shorter.name);
    }
  }

  for (const name of removed) candidates.delete(name);
  for (const candidate of candidates.values()) {
    if (candidate.aliases.has(candidate.name)) candidate.aliases.delete(candidate.name);
  }
}

function expandSuffixAliases(text: string, candidates: Map<string, CandidateInfo>) {
  for (const candidate of candidates.values()) {
    if (candidate.name.length < 3 || candidate.name.includes('·')) continue;
    const trusted = candidate.sources.has('speaker')
      || candidate.sources.has('special')
      || candidate.sources.has('chapter');
    if (!trusted) continue;
    const suffix = candidate.name.slice(-2);
    if (isNonPersonWord(suffix) || INVALID_END_CHARS.has(suffix[1]) || INVALID_START_CHARS.has(suffix[0])) {
      continue;
    }
    const suffixOwners = [...candidates.values()].filter((item) => item.name.endsWith(suffix));
    if (suffixOwners.length > 1) continue;
    const candidateActual = countOccurrences(text, candidate.name);
    const count = Math.max(
      0,
      countOccurrences(text, suffix) - candidateActual,
    );
    const required = candidate.sources.has('speaker')
      ? Math.max(1, Math.ceil(candidateActual * 0.1))
      : 2;
    if (count >= required) {
      candidate.aliases.add(suffix);
    }
  }
}

function applyChapterBoost(text: string, candidates: Map<string, CandidateInfo>) {
  const titles = text.match(/^\s*(?:第[0-9零一二三四五六七八九十百千万两〇]+[章回节卷].*|Chapter\s+\d+.*)\s*$/gim) ?? [];
  if (titles.length === 0) return;
  for (const candidate of candidates.values()) {
    if (titles.some((title) => title.includes(candidate.name))) candidate.sources.add('chapter');
  }
}

function buildSentencePartners(text: string, names: string[]) {
  const partners = new Map<string, Set<string>>();
  const sentences = text
    .replace(/\r\n?/g, '\n')
    .split(/[。！？!?…\n]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const present = names.filter((name) => sentence.includes(name));
    for (let i = 0; i < present.length; i += 1) {
      for (let j = i + 1; j < present.length; j += 1) {
        if (!partners.has(present[i])) partners.set(present[i], new Set());
        if (!partners.has(present[j])) partners.set(present[j], new Set());
        partners.get(present[i])!.add(present[j]);
        partners.get(present[j])!.add(present[i]);
      }
    }
  }
  return partners;
}

function confidenceOf(score: number): CandidateConfidence {
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function countOccurrences(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.match(new RegExp(escaped, 'g'))?.length ?? 0;
}

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
  const weight = surnameWeight(info.name);
  if (weight >= 0.8) score += 2;
  else if (weight >= 0.5) score += 1;
  const partnerCount = partners?.size ?? 0;
  if (partnerCount >= 5) score += 2;
  else if (partnerCount >= 3) score += 1;
  return score;
}

export function extractCharacterCandidates(
  text: string,
  limit = DEFAULT_CANDIDATE_LIMIT,
): CharacterCandidate[] {
  const candidates = new Map<string, CandidateInfo>();
  extractSpeakers(text, candidates);
  extractBeforeVerbs(text, candidates);
  extractAfterVerbs(text, candidates, OBJECT_PATTERN, 'object');
  extractAfterVerbs(text, candidates, PREPOSITION_PATTERN, 'preposition');
  extractAfterVerbs(text, candidates, CONJUNCTION_PATTERN, 'conjunction');
  extractSpecialNames(text, candidates);
  extractTransliteratedNames(text, candidates);

  scanSurnames(text, candidates, [...candidates.keys()]);
  applyChapterBoost(text, candidates);
  const actualCounts = new Map<string, number>();
  for (const name of candidates.keys()) actualCounts.set(name, countOccurrences(text, name));
  dropPhraseCandidates(candidates);
  dropKnownNamePhrases(text, candidates);
  absorbShorterNames(candidates, actualCounts);
  expandSuffixAliases(text, candidates);

  for (const [name, info] of candidates) {
    const transliterated = info.sources.has('transliteration');
    if (!transliterated && (!isValidNameShape(name) || isNonPersonWord(name))) {
      candidates.delete(name);
      continue;
    }
    if (transliterated && isNonPersonWord(name)) {
      candidates.delete(name);
      continue;
    }
    if (COMPOUND_SURNAMES.includes(name)) {
      candidates.delete(name);
      continue;
    }
    const onlyWeakSources = [...info.sources].every(
      (source) => ['scan', 'action', 'object', 'preposition', 'conjunction'].includes(source),
    );
    if (hasPlaceSuffix(name, HARD_PLACE_SUFFIXES)) {
      candidates.delete(name);
      continue;
    }
    if (onlyWeakSources && hasPlaceSuffix(name, SOFT_PLACE_SUFFIXES)) {
      candidates.delete(name);
      continue;
    }
    if (onlyWeakSources && (actualCounts.get(name) ?? 0) < (text.length < 500 ? 1 : 2)) {
      candidates.delete(name);
    }
  }

  const names = [...candidates.keys()];
  const partners = buildSentencePartners(text, names);
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

  return scored
    .sort((left, right) => {
      const byConfidence = CONFIDENCE_ORDER[left.confidence] - CONFIDENCE_ORDER[right.confidence];
      if (byConfidence !== 0) return byConfidence;
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name, 'zh-Hans-CN');
    })
    .slice(0, limit);
}

export function buildCooccurrences(text: string, names: string[], limit = 40): Cooccurrence[] {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length < 2) return [];

  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const counts = new Map<string, number>();
  for (const paragraph of paragraphs) {
    const present: number[] = [];
    unique.forEach((name, index) => {
      if (paragraph.includes(name)) present.push(index);
    });
    for (let i = 0; i < present.length; i += 1) {
      for (let j = i + 1; j < present.length; j += 1) {
        const key = `${present[i]}:${present[j]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split(':').map(Number);
      return { a: unique[a], b: unique[b], count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}
