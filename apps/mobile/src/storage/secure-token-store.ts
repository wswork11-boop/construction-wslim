import { Role } from '@construction/shared';

export interface MobileSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
}

export interface KeyValueDriver {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

class InMemoryKeyValueDriver implements KeyValueDriver {
  private map = new Map<string, string>();
  async getItemAsync(key: string) {
    return this.map.get(key) ?? null;
  }
  async setItemAsync(key: string, value: string) {
    this.map.set(key, value);
  }
  async deleteItemAsync(key: string) {
    this.map.delete(key);
  }
}

const SESSION_KEY = 'construction_mobile_session_v1';

export class SecureTokenStore {
  private cached: MobileSession | null = null;

  constructor(private readonly driver: KeyValueDriver = new InMemoryKeyValueDriver()) {}

  async loadSession(): Promise<MobileSession | null> {
    if (this.cached) return this.cached;
    const raw = await this.driver.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    try {
      this.cached = JSON.parse(raw) as MobileSession;
      return this.cached;
    } catch {
      return null;
    }
  }

  async saveSession(session: MobileSession): Promise<void> {
    this.cached = session;
    await this.driver.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }

  async clearSession(): Promise<void> {
    this.cached = null;
    await this.driver.deleteItemAsync(SESSION_KEY);
  }
}
