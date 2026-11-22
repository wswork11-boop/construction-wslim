import { SecureTokenStore } from '../storage/secure-token-store';

export interface HttpTransport {
  request(input: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string | Uint8Array;
  }): Promise<{ status: number; body: any }>;
}

export class MobileApiClient {
  private refreshPromise: Promise<string | null> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly tokenStore: SecureTokenStore,
    private readonly transport: HttpTransport,
  ) {}

  private async rotateToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;
    const session = await this.tokenStore.loadSession();
    if (!session?.refreshToken) {
      await this.tokenStore.clearSession();
      return null;
    }

    this.refreshPromise = (async () => {
      try {
        const res = await this.transport.request({
          url: `${this.baseUrl}/auth/refresh`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (res.status !== 200) {
          await this.tokenStore.clearSession();
          return null;
        }
        await this.tokenStore.saveSession({
          ...session,
          accessToken: res.body.accessToken,
          refreshToken: res.body.refreshToken,
        });
        return res.body.accessToken as string;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T = any>(
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {},
    retry = true,
  ): Promise<{ status: number; data: T }> {
    const session = await this.tokenStore.loadSession();
    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }
    if (options.body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await this.transport.request({
      url: `${this.baseUrl}${path}`,
      method: options.method || 'GET',
      headers,
      body:
        options.body !== undefined
          ? typeof options.body === 'string' || options.body instanceof Uint8Array
            ? options.body
            : JSON.stringify(options.body)
          : undefined,
    });

    if (res.status === 401 && retry && !path.startsWith('/auth/login')) {
      const nextToken = await this.rotateToken();
      if (nextToken) {
        return this.request<T>(path, options, false);
      }
    }

    return { status: res.status, data: res.body as T };
  }

  async uploadToPresignedUrl(
    uploadUrl: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<void> {
    const res = await this.transport.request({
      url: uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: bytes,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Presigned upload failed with status ${res.status}`);
    }
  }
}
