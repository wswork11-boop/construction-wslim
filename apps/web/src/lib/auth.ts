import { Role } from '@construction/shared';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
}

export interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const STORAGE_KEY = 'construction_web_auth';
const listeners = new Set<() => void>();

function readStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    return JSON.parse(raw);
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

let currentState: AuthState = readStorage();

export const authStore = {
  getState(): AuthState {
    return currentState;
  },
  setSession(next: AuthState) {
    currentState = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    listeners.forEach((l) => l());
  },
  clearSession() {
    currentState = { user: null, accessToken: null, refreshToken: null };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
