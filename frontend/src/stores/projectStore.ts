import { create } from 'zustand';
import { listRecent, createProject, updateProject, deleteProject } from '../api/projects';
import type { ProjectSummary } from '../types';

interface ProjectState {
  recent: ProjectSummary[];
  loading: boolean;
  loadRecent: () => Promise<void>;
  create: (name: string) => Promise<ProjectSummary>;
  update: (id: string, name: string) => Promise<ProjectSummary>;
  remove: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
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
    set({ recent: [project, ...get().recent] });
    return project;
  },
  async update(id, name) {
    const project = await updateProject(id, { name });
    set({ recent: get().recent.map((item) => (item.id === id ? project : item)) });
    return project;
  },
  async remove(id) {
    await deleteProject(id);
    set({ recent: get().recent.filter((item) => item.id !== id) });
  },
}));
