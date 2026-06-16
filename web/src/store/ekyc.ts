import { create } from 'zustand';

interface EkycPromptState {
  open: boolean;
  next: string | null; // route to continue after verifying
  show: (next?: string) => void;
  hide: () => void;
}

export const useEkycPrompt = create<EkycPromptState>((set) => ({
  open: false,
  next: null,
  show: (next) => set({ open: true, next: next || null }),
  hide: () => set({ open: false, next: null }),
}));
