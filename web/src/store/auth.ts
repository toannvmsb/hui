import { create } from 'zustand';
import { api } from '../lib/api';

export interface Me {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  ekycStatus: string;
  creditScore: number;
  trustRating: number;
  avatarColor: string;
  hasPin: boolean;
  wallet: { available: number; blocked: number; accountNumber: string } | null;
  stats: { ownedSlots: number; groupsJoined: number };
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  token: string | null;
  setToken: (t: string) => void;
  fetchMe: () => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loading: true,
  token: localStorage.getItem('hui_token'),
  setToken: (t: string) => {
    localStorage.setItem('hui_token', t);
    set({ token: t });
  },
  fetchMe: async () => {
    const token = localStorage.getItem('hui_token');
    if (!token) {
      set({ loading: false, me: null });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ me: data, loading: false });
    } catch {
      set({ me: null, loading: false });
    }
  },
  logout: () => {
    localStorage.removeItem('hui_token');
    set({ me: null, token: null });
    location.href = '/welcome';
  },
}));
