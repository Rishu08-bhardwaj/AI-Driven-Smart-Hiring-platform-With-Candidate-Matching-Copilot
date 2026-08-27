import axios from 'axios';

/**
 * Access token is kept in memory and mirrored to localStorage so a page
 * reload can rehydrate it. The refresh token lives in an httpOnly cookie
 * (set by the server) and is never readable from JS.
 */
const TOKEN_KEY = 'hrms_access_token';

let accessToken = localStorage.getItem(TOKEN_KEY) || null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getAccessToken() {
  return accessToken;
}
/** Register a callback invoked when refresh ultimately fails (force logout). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send refresh cookie
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ── Refresh-on-401 with request queueing ───────────────────
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response || response.status !== 401 || config._retried || config.url?.includes('/auth/')) {
      return Promise.reject(error);
    }
    config._retried = true;
    try {
      refreshing = refreshing || api.post('/auth/refresh').then((r) => r.data?.data?.accessToken);
      const newToken = await refreshing;
      refreshing = null;
      if (!newToken) throw new Error('No token');
      setAccessToken(newToken);
      config.headers.Authorization = `Bearer ${newToken}`;
      return api(config);
    } catch (e) {
      refreshing = null;
      setAccessToken(null);
      if (onUnauthorized) onUnauthorized();
      return Promise.reject(error);
    }
  }
);

/** Extract a human-friendly message from an axios error. */
export function errorMessage(err, fallback = 'Something went wrong.') {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.errors?.[0]?.message ||
    err?.message ||
    fallback
  );
}
