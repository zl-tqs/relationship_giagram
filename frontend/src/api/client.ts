import axios from 'axios';

export const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('accessToken')) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
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
