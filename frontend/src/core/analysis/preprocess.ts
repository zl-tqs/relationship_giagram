import { splitChapters } from './chapters';
import { remapCooccurrences } from './cooccurrence';
import { decodeNovelFile, type NovelEncoding } from './decode';
import { buildCooccurrences, extractCharacterCandidates } from './extract';
import { GENERIC_ALIAS_WORDS } from './lexicon';
import type { CharacterCandidate, Cooccurrence } from './types';

export interface PreprocessOutcome {
  text: string;
  encoding: NovelEncoding;
  chapterCount: number;
  candidates: CharacterCandidate[];
  cooccurrences: Cooccurrence[];
}

// 泛称别名（如“妹妹”）在正文里指向不唯一，不能映射到某个具体角色。
// 导出以便单测直接覆盖该门禁：泛称别名既不做映射也不参与共现。
export function buildAliasIndex(candidates: CharacterCandidate[]) {
  const aliasMap: Record<string, string> = {};
  const allNames: string[] = [];
  for (const candidate of candidates) {
    allNames.push(candidate.name);
    for (const alias of candidate.aliases ?? []) {
      if (alias === candidate.name || GENERIC_ALIAS_WORDS.has(alias)) continue;
      aliasMap[alias] = candidate.name;
      allNames.push(alias);
    }
  }
  return { aliasMap, allNames };
}

export function preprocessNovel(data: ArrayBuffer): PreprocessOutcome {
  const decoded = decodeNovelFile(data);
  const chapters = splitChapters(decoded.text);
  const candidates = extractCharacterCandidates(decoded.text);
  const { aliasMap, allNames } = buildAliasIndex(candidates);
  return {
    text: decoded.text,
    encoding: decoded.encoding,
    chapterCount: chapters.length,
    candidates,
    cooccurrences: remapCooccurrences(
      buildCooccurrences(decoded.text, allNames),
      aliasMap,
    ),
  };
}
