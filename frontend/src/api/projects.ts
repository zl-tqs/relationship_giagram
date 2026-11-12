import { api } from './client.js';
import type { ProjectSummary } from '../types.js';

export async function listRecent() {
  const { data } = await api.get<ProjectSummary[]>('/projects/recent');
  return data;
}

export async function getProject(id: string) {
  const { data } = await api.get<ProjectSummary>(`/projects/${id}`);
  return data;
}

export async function createProject(name: string) {
  const { data } = await api.post<ProjectSummary>('/projects', { name });
  return data;
}

export async function updateProject(id: string, payload: { name?: string; description?: string }) {
  const { data } = await api.patch<ProjectSummary>(`/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`);
}
