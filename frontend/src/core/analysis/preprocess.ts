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

export function preprocessNovel(data: ArrayBuffer): PreprocessOutcome {
  const decoded = decodeNovelFile(data);
  const chapters = splitChapters(decoded.text);
  const candidates = extractCharacterCandidates(decoded.text);
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
