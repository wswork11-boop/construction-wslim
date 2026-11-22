import Decimal from 'decimal.js';
import { z } from 'zod';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type DecimalInput = Decimal.Value | { toString(): string };

export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(String(value));
}

export function formatMoney(value: DecimalInput): string {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function formatQuantity(value: DecimalInput): string {
  return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);
}

export function formatPercent(value: DecimalInput): string {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function roundMoney(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function roundQuantity(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

export function roundPercent(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sumMoney(values: DecimalInput[]): string {
  let acc = new Decimal(0);
  for (const v of values) {
    acc = acc.add(roundMoney(v));
  }
  return formatMoney(acc);
}

export const MoneySchema = z
  .string()
  .regex(/^-?\d{1,12}\.\d{2}$/, 'Must be a decimal string with 2 decimal places (e.g. "100.00")');

export const NonNegativeMoneySchema = MoneySchema.refine(
  (v) => new Decimal(v).gte(0),
  'Amount cannot be negative',
);

export const PositiveMoneySchema = MoneySchema.refine(
  (v) => new Decimal(v).gt(0),
  'Amount must be greater than zero',
);

export const QuantitySchema = z
  .string()
  .regex(/^-?\d{1,11}(\.\d{1,3})?$/, 'Must be a decimal string with up to 3 decimal places');

export const PositiveQuantitySchema = QuantitySchema.refine(
  (v) => new Decimal(v).gt(0),
  'Quantity must be greater than zero',
);

export const PercentSchema = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Must be a decimal string with up to 2 decimal places')
  .refine((v) => {
    const d = new Decimal(v);
    return d.gte(0) && d.lte(100);
  }, 'Percent must be between 0 and 100');

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date string');
