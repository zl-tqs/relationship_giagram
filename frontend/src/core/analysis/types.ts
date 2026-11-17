export type CandidateConfidence = 'high' | 'medium' | 'low';

export interface CharacterCandidate {
  name: string;
  count: number;
  confidence: CandidateConfidence;
  aliases?: string[];
}

export interface Cooccurrence {
  a: string;
  b: string;
  count: number;
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
  confidence?: CandidateConfidence;
}

export interface AnalysisResult {
  characters: AnalysisCharacter[];
  relations: AnalysisRelation[];
  model?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface StructuredAnalysisInput {
  candidates: CharacterCandidate[];
  cooccurrences: Cooccurrence[];
  excerpt: string;
  chapterCount: number;
}
