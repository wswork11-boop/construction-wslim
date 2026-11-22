import { z } from 'zod';

export const Role = {
  OWNER: 'OWNER',
  OFFICE: 'OFFICE',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  SITE_STAFF: 'SITE_STAFF',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const RoleSchema = z.enum(['OWNER', 'OFFICE', 'PROJECT_MANAGER', 'SITE_STAFF']);

export const ProjectStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export const ProjectStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED']);

export const FileStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
} as const;
export type FileStatus = (typeof FileStatus)[keyof typeof FileStatus];
export const FileStatusSchema = z.enum(['PENDING', 'READY']);

export const QuotationStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
  EXPIRED: 'EXPIRED',
} as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];
export const QuotationStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'SUPERSEDED',
  'EXPIRED',
]);

export const VariationStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type VariationStatus = (typeof VariationStatus)[keyof typeof VariationStatus];
export const VariationStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);

export const InvoiceType = {
  SIMPLE: 'SIMPLE',
  PROGRESS_CLAIM: 'PROGRESS_CLAIM',
  RETENTION_RELEASE: 'RETENTION_RELEASE',
} as const;
export type InvoiceType = (typeof InvoiceType)[keyof typeof InvoiceType];
export const InvoiceTypeSchema = z.enum(['SIMPLE', 'PROGRESS_CLAIM', 'RETENTION_RELEASE']);

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOID: 'VOID',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
export const InvoiceStatusSchema = z.enum([
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
]);

export const DailyReportStatus = {
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
} as const;
export type DailyReportStatus = (typeof DailyReportStatus)[keyof typeof DailyReportStatus];
export const DailyReportStatusSchema = z.enum(['SUBMITTED', 'REVIEWED']);

export const Weather = {
  SUNNY: 'SUNNY',
  CLOUDY: 'CLOUDY',
  RAIN: 'RAIN',
  HEAVY_RAIN: 'HEAVY_RAIN',
} as const;
export type Weather = (typeof Weather)[keyof typeof Weather];
export const WeatherSchema = z.enum(['SUNNY', 'CLOUDY', 'RAIN', 'HEAVY_RAIN']);

export const EInvoiceStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  VALID: 'VALID',
  INVALID: 'INVALID',
  CANCELLED: 'CANCELLED',
} as const;
export type EInvoiceStatus = (typeof EInvoiceStatus)[keyof typeof EInvoiceStatus];
export const EInvoiceStatusSchema = z.enum([
  'NOT_REQUIRED',
  'PENDING',
  'SUBMITTED',
  'VALID',
  'INVALID',
  'CANCELLED',
]);

export const ExpenseCategory = {
  MATERIALS: 'MATERIALS',
  SUBCONTRACTOR: 'SUBCONTRACTOR',
  TOOLS_EQUIPMENT: 'TOOLS_EQUIPMENT',
  LABOUR: 'LABOUR',
  TRANSPORT: 'TRANSPORT',
  SITE_PETTY_CASH: 'SITE_PETTY_CASH',
  OFFICE_OVERHEAD: 'OFFICE_OVERHEAD',
  OTHER: 'OTHER',
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];
export const ExpenseCategorySchema = z.enum([
  'MATERIALS',
  'SUBCONTRACTOR',
  'TOOLS_EQUIPMENT',
  'LABOUR',
  'TRANSPORT',
  'SITE_PETTY_CASH',
  'OFFICE_OVERHEAD',
  'OTHER',
]);

export const ExpenseStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  REIMBURSED: 'REIMBURSED',
  VOID: 'VOID',
} as const;
export type ExpenseStatus = (typeof ExpenseStatus)[keyof typeof ExpenseStatus];
export const ExpenseStatusSchema = z.enum(['UNPAID', 'PAID', 'REIMBURSED', 'VOID']);

