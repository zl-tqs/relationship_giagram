import { create } from 'zustand';
import { listRecent, createProject } from '../api/projects';
import type { ProjectSummary } from '../types';

interface ProjectState {
  recent: ProjectSummary[];
  loading: boolean;
  loadRecent: () => Promise<void>;
  create: (name: string) => Promise<ProjectSummary>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  recent: [],
  loading: false,
  async loadRecent() {
    set({ loading: true });
    try {
      set({ recent: await listRecent() });
    } finally {
      set({ loading: false });
    }
  },
  async create(name) {
    const project = await createProject(name);
    set({ recent: [project, ...useProjectStore.getState().recent] });
    return project;
  },
}));
