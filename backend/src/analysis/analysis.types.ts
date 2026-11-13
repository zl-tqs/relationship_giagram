export type AnalysisStatus =
  | 'pending'
  | 'preprocessing'
  | 'awaiting_confirm'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'deleted';

export type Confidence = 'high' | 'medium' | 'low';

export interface CharacterCandidate {
  name: string;
  count: number;
  confidence: Confidence;
}

export interface Cooccurrence {
  a: string;
  b: string;
  count: number;
}

export interface StructuredAnalysisData {
  candidates: CharacterCandidate[];
  cooccurrences: Cooccurrence[];
  excerpt: string;
  chapterCount?: number;
}

export interface AnalysisCharacter {
  name: string;
  gender?: string;
  description?: string;
  aliases?: string[];
}

export interface AnalysisRelation {
  from: string;
  to: string;
  type: string;
  description?: string;
  confidence?: Confidence;
}

export interface AnalysisResultData {
  characters: AnalysisCharacter[];
  relations: AnalysisRelation[];
  model: string;
  tokenUsage: Record<string, number>;
}
