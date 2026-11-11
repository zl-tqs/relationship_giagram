import { create } from 'zustand';
import * as authApi from '../api/auth.js';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../core/auth/tokens';
import { clearStoredUser, getStoredUser, setStoredUser } from '../core/auth/user';

interface AuthState {
  token: string | null;
  user: { id: string; nickname: string; isAnonymous: boolean } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  anonymous: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getAccessToken(),
  user: getStoredUser(),
  async login(email, password) {
    const res = await authApi.login({ email, password });
    setTokens(res);
    setStoredUser(res.user);
    set({ token: res.accessToken, user: res.user });
  },
  async register(email, password, nickname) {
    const res = await authApi.register({ email, password, nickname });
    setTokens(res);
    setStoredUser(res.user);
    set({ token: res.accessToken, user: res.user });
  },
  async anonymous() {
    const res = await authApi.anonymous();
    setTokens(res);
    setStoredUser(res.user);
    set({ token: res.accessToken, user: res.user });
  },
  logout() {
    const refreshToken = getRefreshToken();
    clearTokens();
    clearStoredUser();
    set({ token: null, user: null });
    if (refreshToken) void authApi.logout(refreshToken).catch(() => undefined);
  },
}));
