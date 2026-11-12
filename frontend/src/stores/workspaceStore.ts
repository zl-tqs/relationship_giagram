import { create } from 'zustand';

type LeaveGuard = (proceed: () => void) => void;

interface WorkspaceState {
  guard: LeaveGuard | null;
  setGuard: (guard: LeaveGuard | null) => void;
  requestLeave: (proceed: () => void) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  guard: null,
  setGuard: (guard) => set({ guard }),
  requestLeave: (proceed) => {
    const guard = get().guard;
    if (guard) guard(proceed);
    else proceed();
  },
}));
