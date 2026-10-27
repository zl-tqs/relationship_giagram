import { create } from 'zustand';
import * as authApi from '../api/auth.js';

interface AuthState {
  token: string | null;
  user: { id: string; nickname: string; isAnonymous: boolean } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  anonymous: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('accessToken'),
  user: null,
  async login(email, password) {
    const res = await authApi.login({ email, password });
    localStorage.setItem('accessToken', res.accessToken);
    set({ token: res.accessToken, user: res.user });
  },
  async register(email, password, nickname) {
    const res = await authApi.register({ email, password, nickname });
    localStorage.setItem('accessToken', res.accessToken);
    set({ token: res.accessToken, user: res.user });
  },
  async anonymous() {
    const res = await authApi.anonymous();
    localStorage.setItem('accessToken', res.accessToken);
    set({ token: res.accessToken, user: res.user });
  },
  logout() {
    localStorage.removeItem('accessToken');
    set({ token: null, user: null });
  },
}));
