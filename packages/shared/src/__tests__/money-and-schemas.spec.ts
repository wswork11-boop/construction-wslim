import { describe, expect, it } from 'vitest';
import {
  ClientCreateSchema,
  formatMoney,
  formatPercent,
  formatQuantity,
  LoginRequestSchema,
  MoneySchema,
  PercentSchema,
  ProjectCreateSchema,
  QuantitySchema,
  roundMoney,
  sumMoney,
  UserCreateSchema,
} from '../index';

describe('money helpers and Zod schemas', () => {
  it('formats and rounds money using ROUND_HALF_UP', () => {
    expect(formatMoney('12.345')).toBe('12.35');
    expect(formatMoney('12.344')).toBe('12.34');
    expect(roundMoney('0.005').toFixed(2)).toBe('0.01');
    expect(sumMoney(['10.10', '20.25', '0.05'])).toBe('30.40');
  });

  it('formats quantities and percentages', () => {
    expect(formatQuantity('15.5')).toBe('15.500');
    expect(formatPercent('6')).toBe('6.00');
  });

  it('validates Money, Quantity and Percent strings', () => {
    expect(MoneySchema.safeParse('1234.50').success).toBe(true);
    expect(MoneySchema.safeParse('1234.5').success).toBe(false);
    expect(QuantitySchema.safeParse('10.125').success).toBe(true);
    expect(QuantitySchema.safeParse('10.1256').success).toBe(false);
    expect(PercentSchema.safeParse('100.00').success).toBe(true);
    expect(PercentSchema.safeParse('100.01').success).toBe(false);
  });

  it('validates Foundation schemas', () => {
    expect(
      LoginRequestSchema.safeParse({
        email: 'owner@example.com',
        password: 'Password123!',
      }).success,
    ).toBe(true);

    expect(
      UserCreateSchema.safeParse({
        email: 'staff@example.com',
        name: 'Kumar',
        role: 'SITE_STAFF',
        password: 'Password123!',
      }).success,
    ).toBe(true);

    expect(
      ClientCreateSchema.safeParse({
        name: 'Syarikat ABC Sdn Bhd',
        email: 'abc@example.com',
      }).success,
    ).toBe(true);

    expect(
      ProjectCreateSchema.safeParse({
        code: 'P-2026-003',
        name: 'Shoplot renovation',
        clientId: '018f0000-0000-7000-8000-000000000001',
      }).success,
    ).toBe(true);
  });
});
