import { create } from 'zustand';

export type Accent = 'violet' | 'blue';

interface UiState {
  accent: Accent;
  sidebarCollapsed: boolean;
  setAccent: (accent: Accent) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  accent: 'violet',
  sidebarCollapsed: false,
  setAccent: (accent) => set({ accent }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
