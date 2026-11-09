import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken } from '../core/auth/tokens';
import { refreshAccessToken } from './authRefresh';

export const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/anonymous', '/auth/refresh', '/auth/logout'];

function isAuthRequest(url?: string) {
  return !!url && AUTH_PATHS.some((path) => url.includes(path));
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error?.config as RetryConfig | undefined;
    const status = error?.response?.status;
    if (status !== 401 || !config || config._retry || isAuthRequest(config.url)) {
      return Promise.reject(error);
    }
    if (!getRefreshToken()) {
      clearTokens();
      redirectToLogin();
      return Promise.reject(error);
    }
    config._retry = true;
    try {
      const accessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${accessToken}`;
      return api(config);
    } catch (refreshError) {
      clearTokens();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function toApiError(err: unknown): ApiError {
  const data = (err as { response?: { data?: ApiError } })?.response?.data;
  return data ?? { code: 'UNKNOWN', message: '网络错误' };
}
