import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: '/api/proxy',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let isRefreshing = false;
let queued: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  queued.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  queued = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const message =
      (error.response?.data as any)?.error?.message ||
      (error.response?.data as any)?.message ||
      error.message;

    if (status === 403 && typeof window !== 'undefined') {
      const isAdminRoute = typeof originalRequest?.url === 'string' && originalRequest.url.startsWith('/admin');
      const lower = String(message ?? '').toLowerCase();
      if (!isAdminRoute && (lower.includes('suspended') || lower.includes('inactive'))) {
        window.dispatchEvent(
          new CustomEvent('account-suspended', {
            detail: {
              title: 'Account Suspended',
              message: 'Your access has been suspended. Please contact support.',
            },
          }),
        );
        try {
          await axios.post('/api/auth/logout', {}, { headers: { 'Content-Type': 'application/json' } });
        } catch {
          // ignore
        }
        return Promise.reject(error);
      }
    }
    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (originalRequest.url?.includes('/api/auth/refresh')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queued.push({
          resolve: () => resolve(api(originalRequest)),
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await axios.post(
        '/api/auth/refresh',
        {},
        { headers: { 'Content-Type': 'application/json' } },
      );

      processQueue(null, 'ok');
      return api(originalRequest);
    } catch (err) {
      processQueue(err, null);
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
