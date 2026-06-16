import { create } from 'zustand';

interface ToastState {
  msg: string | null;
  tone: 'green' | 'red';
  show: (msg: string, tone?: 'green' | 'red') => void;
}

export const useToast = create<ToastState>((set) => ({
  msg: null,
  tone: 'green',
  show: (msg, tone = 'green') => {
    set({ msg, tone });
    setTimeout(() => set({ msg: null }), 2600);
  },
}));
