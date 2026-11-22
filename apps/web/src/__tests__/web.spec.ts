import { describe, expect, it } from 'vitest';
import { Role } from '@construction/shared';
import { authStore } from '../lib/auth';

describe('Web auth store', () => {
  it('stores and clears user session', () => {
    authStore.setSession({
      user: {
        id: '018f0000-0000-7000-8000-000000000001',
        email: 'owner@example.com',
        name: 'Owner',
        phone: null,
        role: Role.OWNER,
        isActive: true,
      },
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
    });

    expect(authStore.getState().user?.email).toBe('owner@example.com');
    expect(authStore.getState().accessToken).toBe('access-123');

    authStore.clearSession();
    expect(authStore.getState().user).toBeNull();
  });
});
