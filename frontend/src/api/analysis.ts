import { api } from './client.js';
import type {
  AnalysisCharacter, AnalysisResult, AnalysisRelation, StructuredAnalysisInput,
} from '../core/analysis/types.js';

export interface AnalysisQuota {
  date: string;
  used: number;
  limit: number;
  remaining: number;
}

export interface AnalysisJob {
  id: string;
  status: string;
  template: string;
  fileName: string;
  fileSize: number;
  charCount: number;
  keepResult: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmAnalysisResponse {
  jobId: string;
  status: string;
  result: AnalysisResult;
}

export async function getAnalysisQuota() {
  const { data } = await api.get<AnalysisQuota>('/analysis/quota');
  return data;
}

export async function createAnalysisJob(payload: {
  fileName: string;
  fileSize: number;
  charCount?: number;
  template?: string;
  keepResult?: boolean;
}) {
  const { data } = await api.post<AnalysisJob>('/analysis/jobs', payload);
  return data;
}

export async function saveAnalysisStructured(jobId: string, structured: StructuredAnalysisInput) {
  await api.put(`/analysis/jobs/${jobId}/structured`, structured);
}

export async function confirmAnalysis(jobId: string, characters: AnalysisCharacter[]) {
  const { data } = await api.post<ConfirmAnalysisResponse>(`/analysis/jobs/${jobId}/confirm`, {
    characters,
  });
  return data;
}

export async function updateAnalysisResult(
  jobId: string,
  payload: {
    characters?: AnalysisCharacter[];
    relations?: AnalysisRelation[];
    corrections?: Record<string, unknown>;
  },
) {
  const { data } = await api.patch(`/analysis/jobs/${jobId}/result`, payload);
  return data;
}

export async function deleteAnalysisJob(jobId: string) {
  await api.delete(`/analysis/jobs/${jobId}`);
}
