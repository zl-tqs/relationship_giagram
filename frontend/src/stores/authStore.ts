import { create } from 'zustand';
import * as authApi from '../api/auth.js';
import { refreshAccessToken } from '../api/authRefresh';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../core/auth/tokens';
import { clearStoredUser, getStoredUser, setStoredUser } from '../core/auth/user';
import { clearUserDrafts } from '../core/save/drafts';

interface AuthState {
  token: string | null;
  user: { id: string; nickname: string; isAnonymous: boolean } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  anonymous: () => Promise<void>;
  restore: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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
  async restore() {
    if (!getAccessToken() && !getRefreshToken()) throw new Error('NO_SESSION');
    if (!getAccessToken()) await refreshAccessToken();
    const user = await authApi.me();
    setStoredUser(user);
    set({ token: getAccessToken(), user });
  },
  logout() {
    const refreshToken = getRefreshToken();
    const userId = get().user?.id;
    clearTokens();
    clearStoredUser();
    set({ token: null, user: null });
    if (userId) void clearUserDrafts(userId);
    if (refreshToken) void authApi.logout(refreshToken).catch(() => undefined);
  },
}));
