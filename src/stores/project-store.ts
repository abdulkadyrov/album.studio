import { create } from 'zustand';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

interface ProjectState {
  activeProjectId: string | null;
  saveStatus: SaveStatus;
  setActiveProject: (projectId: string | null) => void;
  setSaveStatus: (saveStatus: SaveStatus) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  saveStatus: 'saved',
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
}));
