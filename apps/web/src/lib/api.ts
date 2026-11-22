import { authStore } from './auth';

const DEFAULT_PROD_API = 'https://construction-stl.up.railway.app';
const rawApiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const effectiveBase =
  rawApiUrl && !rawApiUrl.includes('construction-api-production.up.railway.app')
    ? rawApiUrl
    : !isLocalHost && typeof window !== 'undefined'
      ? DEFAULT_PROD_API
      : '';

const API_BASE = effectiveBase
  ? `${effectiveBase.replace(/\/$/, '').replace(/\/api\/v1$/, '')}/api/v1`
  : '/api/v1';

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const { refreshToken, user } = authStore.getState();
  if (!refreshToken) {
    authStore.clearSession();
    return null;
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        authStore.clearSession();
        return null;
      }
      const data = await res.json();
      authStore.setSession({
        user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken as string;
    } catch {
      authStore.clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { accessToken } = authStore.getState();
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/login')) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return apiFetch<T>(path, options, false);
    }
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.message || `Request failed with ${res.status}`);
    err.statusCode = res.status;
    err.code = data.code;
    err.details = data.details;
    throw err;
  }
  return data as T;
}

export async function apiDownload(path: string, fallbackFileName: string): Promise<void> {
  const { accessToken } = authStore.getState();
  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`Export failed with status ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackFileName;
  a.click();
  URL.revokeObjectURL(url);
}

