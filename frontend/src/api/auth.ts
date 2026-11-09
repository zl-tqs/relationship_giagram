import { api } from './client.js';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string | null; nickname: string; isAnonymous: boolean };
}

export async function register(payload: { email: string; password: string; nickname: string }) {
  const { data } = await api.post<AuthResult>('/auth/register', payload);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResult>('/auth/login', payload);
  return data;
}

export async function anonymous(nickname?: string) {
  const { data } = await api.post<AuthResult>('/auth/anonymous', { nickname });
  return data;
}

export async function logout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}
