import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hui_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.startsWith('/login') && location.pathname !== '/welcome') {
      localStorage.removeItem('hui_token');
      location.href = '/welcome';
    }
    return Promise.reject(err);
  }
);

export function apiError(err: any): string {
  return err?.response?.data?.error || err?.message || 'Đã có lỗi xảy ra';
}
