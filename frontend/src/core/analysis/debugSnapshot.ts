import type { CharacterCandidate, Cooccurrence } from './types';

export interface LocalAnalysisSnapshotInput {
  fileName: string;
  fileSize: number;
  encoding: string;
  chapterCount: number;
  textLength: number;
  candidates: CharacterCandidate[];
  cooccurrences: Cooccurrence[];
  excerptPreview?: string;
}

export interface LocalAnalysisSnapshot {
  generatedAt: string;
  source: 'browser-preprocess';
  fileName: string;
  fileSize: number;
  encoding: string;
  chapters: number;
  textLength: number;
  candidateCount: number;
  candidates: CharacterCandidate[];
  cooccurrences: Cooccurrence[];
  excerptPreview: string;
}

export function buildLocalAnalysisSnapshot(
  input: LocalAnalysisSnapshotInput,
  generatedAt = new Date(),
): LocalAnalysisSnapshot {
  return {
    generatedAt: generatedAt.toISOString(),
    source: 'browser-preprocess',
    fileName: input.fileName,
    fileSize: input.fileSize,
    encoding: input.encoding,
    chapters: input.chapterCount,
    textLength: input.textLength,
    candidateCount: input.candidates.length,
    candidates: input.candidates,
    cooccurrences: input.cooccurrences,
    excerptPreview: (input.excerptPreview ?? '').slice(0, 3000),
  };
}
