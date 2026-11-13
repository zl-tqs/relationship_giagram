import { splitChapters } from './chapters';
import { decodeNovelFile, type NovelEncoding } from './decode';
import { buildCooccurrences, extractCharacterCandidates } from './extract';
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
  return {
    text: decoded.text,
    encoding: decoded.encoding,
    chapterCount: chapters.length,
    candidates,
    cooccurrences: buildCooccurrences(decoded.text, candidates.map((item) => item.name)),
  };
}
