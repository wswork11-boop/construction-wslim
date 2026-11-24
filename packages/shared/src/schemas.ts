import { z } from 'zod';
import {
  DailyReportStatusSchema,
  ExpenseCategorySchema,
  ExpenseStatusSchema,
  InvoiceStatusSchema,
  InvoiceTypeSchema,
  ProjectStatusSchema,
  QuotationStatusSchema,
  RoleSchema,
  VariationStatusSchema,
  WeatherSchema,
} from './enums';
import {
  DateStringSchema,
  MoneySchema,
  NonNegativeMoneySchema,
  PercentSchema,
  PositiveMoneySchema,
  PositiveQuantitySchema,
  QuantitySchema,
} from './money';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('-createdAt'),
  q: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().max(100).optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  phone: z.string().max(30).nullable().optional(),
  role: RoleSchema,
  password: z.string().min(8),
  companyId: z.string().uuid().nullable().optional(),
  companyIds: z.array(z.string().uuid()).optional(),
  companyName: z.string().max(200).nullable().optional(),
  projectIds: z.array(z.string().uuid()).optional(),
});
export type UserCreate = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(1).max(200).optional(),
    phone: z.string().max(30).nullable().optional(),
    role: RoleSchema.optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
    companyId: z.string().uuid().nullable().optional(),
    companyIds: z.array(z.string().uuid()).optional(),
    companyName: z.string().max(200).nullable().optional(),
    projectIds: z.array(z.string().uuid()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export const UserListQuerySchema = PaginationQuerySchema.extend({
  role: RoleSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .or(z.boolean())
    .optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

// ---------------------------------------------------------------------------
// Company & Tax Rates
// ---------------------------------------------------------------------------

export const CompanyCreateSchema = z.object({
  code: z.string().max(20).nullable().optional(),
  name: z.string().min(1).max(200),
  registrationNo: z.string().nullable().optional(),
  tin: z.string().nullable().optional(),
  sstNo: z.string().nullable().optional(),
  msicCode: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  logoFileId: z.string().uuid().nullable().optional(),
  bankDetails: z.string().nullable().optional(),
  defaultPaymentTermDays: z.number().int().min(0).default(30),
  defaultRetentionPercent: PercentSchema.optional(),
  defaultRetentionCapPercent: PercentSchema.optional(),
  isDefault: z.boolean().optional(),
});
export type CompanyCreate = z.infer<typeof CompanyCreateSchema>;

export const CompanyUpdateSchema = z
  .object({
    code: z.string().max(20).nullable().optional(),
    name: z.string().min(1).optional(),
    registrationNo: z.string().nullable().optional(),
    tin: z.string().nullable().optional(),
    sstNo: z.string().nullable().optional(),
    msicCode: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    logoFileId: z.string().uuid().nullable().optional(),
    bankDetails: z.string().nullable().optional(),
    defaultPaymentTermDays: z.number().int().min(0).optional(),
    defaultRetentionPercent: PercentSchema.optional(),
    defaultRetentionCapPercent: PercentSchema.optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });
export type CompanyUpdate = z.infer<typeof CompanyUpdateSchema>;

export const TaxRateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  percent: PercentSchema,
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type TaxRateCreate = z.infer<typeof TaxRateCreateSchema>;

export const TaxRateUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    percent: PercentSchema.optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });
export type TaxRateUpdate = z.infer<typeof TaxRateUpdateSchema>;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const ClientCreateSchema = z.object({
  code: z.string().max(10).nullable().optional(),
  name: z.string().min(1).max(200),
  registrationNo: z.string().nullable().optional(),
  tin: z.string().nullable().optional(),
  sstNo: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});
export type ClientCreate = z.infer<typeof ClientCreateSchema>;

export const ClientUpdateSchema = z
  .object({
    code: z.string().max(10).nullable().optional(),
    name: z.string().min(1).max(200).optional(),
    registrationNo: z.string().nullable().optional(),
    tin: z.string().nullable().optional(),
    sstNo: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    contactName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });
export type ClientUpdate = z.infer<typeof ClientUpdateSchema>;

export const ClientListQuerySchema = PaginationQuerySchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .or(z.boolean())
    .optional(),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const ProjectCreateSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(200),
  clientId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  poNumber: z.string().max(100).nullable().optional(),
  siteAddress: z.string().nullable().optional(),
  status: ProjectStatusSchema.default('DRAFT'),
  startDate: DateStringSchema.nullable().optional(),
  endDate: DateStringSchema.nullable().optional(),
  retentionPercent: PercentSchema.optional(),
  retentionCapPercent: PercentSchema.optional(),
  defectsLiabilityMonths: z.number().int().min(0).default(12),
});
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

export const ProjectUpdateSchema = z
  .object({
    code: z.string().min(1).max(30).optional(),
    name: z.string().min(1).max(200).optional(),
    companyId: z.string().uuid().nullable().optional(),
    poNumber: z.string().max(100).nullable().optional(),
    siteAddress: z.string().nullable().optional(),
    status: ProjectStatusSchema.optional(),
    startDate: DateStringSchema.nullable().optional(),
    endDate: DateStringSchema.nullable().optional(),
    retentionPercent: PercentSchema.optional(),
    retentionCapPercent: PercentSchema.optional(),
    defectsLiabilityMonths: z.number().int().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;

export const ProjectMembersInputSchema = z.object({
  userIds: z
    .array(z.string().uuid())
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate userIds are not allowed'),
});
export type ProjectMembersInput = z.infer<typeof ProjectMembersInputSchema>;

export const ProjectListQuerySchema = PaginationQuerySchema.extend({
  status: ProjectStatusSchema.optional(),
  clientId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const PresignRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().min(1),
  purpose: z.string().min(1),
});
export type PresignRequest = z.infer<typeof PresignRequestSchema>;

// ---------------------------------------------------------------------------
// Quotations (Spec 02)
// ---------------------------------------------------------------------------

export const QuotationItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1),
  unit: z.string().max(30).nullable().optional(),
  quantity: PositiveQuantitySchema,
  rate: MoneySchema,
  taxRateId: z.string().uuid().nullable().optional(),
});
export type QuotationItemInput = z.infer<typeof QuotationItemInputSchema>;

export const QuotationSectionInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  items: z.array(QuotationItemInputSchema),
});
export type QuotationSectionInput = z.infer<typeof QuotationSectionInputSchema>;

export const QuotationInputSchema = z.object({
  clientId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300),
  issueDate: DateStringSchema.nullable().optional(),
  validUntil: DateStringSchema.nullable().optional(),
  terms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  discountAmount: NonNegativeMoneySchema.default('0.00'),
  sections: z.array(QuotationSectionInputSchema),
});
export type QuotationInput = z.infer<typeof QuotationInputSchema>;

export const QuotationAcceptRequestSchema = z
  .object({
    createProject: z.boolean().optional(),
    projectCode: z.string().max(30).optional(),
    poNumber: z.string().max(100).nullable().optional(),
  })
  .optional();
export type QuotationAcceptRequest = z.infer<typeof QuotationAcceptRequestSchema>;

export const QuotationRejectRequestSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type QuotationRejectRequest = z.infer<typeof QuotationRejectRequestSchema>;

export const QuotationListQuerySchema = PaginationQuerySchema.extend({
  status: QuotationStatusSchema.optional(),
  clientId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
  latestOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .or(z.boolean())
    .default(true),
});

// ---------------------------------------------------------------------------
// Daily Reports, Progress Reports, Inspection Reports (Spec 03 & Link Flow)
// ---------------------------------------------------------------------------

export const DailyReportManpowerInputSchema = z.object({
  trade: z.string().min(1).max(100),
  headcount: z.number().int().min(0),
});
export type DailyReportManpowerInput = z.infer<typeof DailyReportManpowerInputSchema>;

export const DailyReportPhotoInputSchema = z.object({
  fileId: z.string().uuid(),
  caption: z.string().max(300).nullable().optional(),
  takenAt: z.string().datetime().nullable().optional(),
});
export type DailyReportPhotoInput = z.infer<typeof DailyReportPhotoInputSchema>;

export const DailyReportProgressInputSchema = z.object({
  contractItemId: z.string().uuid(),
  percentComplete: PercentSchema,
});
export type DailyReportProgressInput = z.infer<typeof DailyReportProgressInputSchema>;

export const DailyReportInputSchema = z.object({
  projectId: z.string().uuid(),
  reportDate: DateStringSchema,
  weather: WeatherSchema.nullable().optional(),
  workDone: z.string().min(1),
  issues: z.string().nullable().optional(),
  nextDayPlan: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  deviceCreatedAt: z.string().datetime().nullable().optional(),
  manpower: z.array(DailyReportManpowerInputSchema),
  photos: z.array(DailyReportPhotoInputSchema).min(1).max(20),
  progress: z.array(DailyReportProgressInputSchema).optional(),
});
export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

export const DailyReportListQuerySchema = PaginationQuerySchema.extend({
  projectId: z.string().uuid().optional(),
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
  submittedById: z.string().uuid().optional(),
  status: DailyReportStatusSchema.optional(),
});

export const SiteReportPdfQuerySchema = z.object({
  from: DateStringSchema,
  to: DateStringSchema,
});

export const ProgressReportLineInputSchema = z.object({
  contractItemId: z.string().uuid(),
  cumulativePercent: PercentSchema,
  notes: z.string().max(500).nullable().optional(),
});
export type ProgressReportLineInput = z.infer<typeof ProgressReportLineInputSchema>;

export const ProgressReportCreateSchema = z.object({
  reportDate: DateStringSchema.optional(),
  periodFrom: DateStringSchema.nullable().optional(),
  periodTo: DateStringSchema.nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  overallPercent: PercentSchema.optional(),
  lines: z.array(ProgressReportLineInputSchema).default([]),
});
export type ProgressReportCreate = z.infer<typeof ProgressReportCreateSchema>;

export const InspectionReportCreateSchema = z.object({
  inspectionDate: DateStringSchema.optional(),
  title: z.string().min(1).max(300),
  findings: z.string().max(2000).nullable().optional(),
  status: z.enum(['OPEN', 'PASSED', 'FAILED', 'CLOSED']).default('PASSED'),
});
export type InspectionReportCreate = z.infer<typeof InspectionReportCreateSchema>;

// ---------------------------------------------------------------------------
// Variation Orders, Invoices, Progress Claims, Payments (Spec 04)
// ---------------------------------------------------------------------------

export const VariationOrderItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1),
  unit: z.string().max(30).nullable().optional(),
  // Can be negative for an omission (AC12)
  quantity: QuantitySchema,
  rate: MoneySchema,
});
export type VariationOrderItemInput = z.infer<typeof VariationOrderItemInputSchema>;

export const VariationOrderInputSchema = z.object({
  title: z.string().min(1).max(300),
  reason: z.string().nullable().optional(),
  items: z.array(VariationOrderItemInputSchema),
});
export type VariationOrderInput = z.infer<typeof VariationOrderInputSchema>;

export const VariationOrderListQuerySchema = PaginationQuerySchema.extend({
  status: VariationStatusSchema.optional(),
});

export const InvoiceLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1),
  unit: z.string().max(30).nullable().optional(),
  quantity: PositiveQuantitySchema,
  rate: MoneySchema,
  taxRateId: z.string().uuid().nullable().optional(),
  classificationCode: z.string().max(10).nullable().optional(),
});
export type InvoiceLineInput = z.infer<typeof InvoiceLineInputSchema>;

export const SimpleInvoiceCreateSchema = z.object({
  type: InvoiceTypeSchema,
  clientId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  issueDate: DateStringSchema.nullable().optional(),
  quotePoRef: z.string().max(100).nullable().optional(),
  claimReportRef: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(InvoiceLineInputSchema),
});
export type SimpleInvoiceCreate = z.infer<typeof SimpleInvoiceCreateSchema>;

export const SimpleInvoiceUpdateSchema = z.object({
  clientId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  issueDate: DateStringSchema.nullable().optional(),
  quotePoRef: z.string().max(100).nullable().optional(),
  claimReportRef: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(InvoiceLineInputSchema),
});
export type SimpleInvoiceUpdate = z.infer<typeof SimpleInvoiceUpdateSchema>;

export const ClaimLineInputSchema = z
  .object({
    contractItemId: z.string().uuid(),
    cumulativePercent: PercentSchema.optional(),
    cumulativeQuantity: QuantitySchema.optional(),
  })
  .refine(
    (v) => v.cumulativePercent !== undefined || v.cumulativeQuantity !== undefined,
    'Either cumulativePercent or cumulativeQuantity is required',
  );
export type ClaimLineInput = z.infer<typeof ClaimLineInputSchema>;

export const ProgressClaimCreateSchema = z
  .object({
    issueDate: DateStringSchema.nullable().optional(),
    periodFrom: DateStringSchema.nullable().optional(),
    periodTo: DateStringSchema.nullable().optional(),
    progressReportId: z.string().uuid().nullable().optional(),
    quotePoRef: z.string().max(100).nullable().optional(),
    claimReportRef: z.string().max(100).nullable().optional(),
    notes: z.string().nullable().optional(),
    taxRateId: z.string().uuid().nullable().optional(),
  })
  .optional()
  .default({});
export type ProgressClaimCreate = z.infer<typeof ProgressClaimCreateSchema>;

export const ProgressClaimUpdateSchema = z.object({
  issueDate: DateStringSchema.nullable().optional(),
  periodFrom: DateStringSchema.nullable().optional(),
  periodTo: DateStringSchema.nullable().optional(),
  progressReportId: z.string().uuid().nullable().optional(),
  quotePoRef: z.string().max(100).nullable().optional(),
  claimReportRef: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  taxRateId: z.string().uuid().nullable().optional(),
  claimLines: z.array(ClaimLineInputSchema),
});
export type ProgressClaimUpdate = z.infer<typeof ProgressClaimUpdateSchema>;

export const RetentionReleaseCreateSchema = z.object({
  amount: PositiveMoneySchema,
  issueDate: DateStringSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  taxRateId: z.string().uuid().nullable().optional(),
});
export type RetentionReleaseCreate = z.infer<typeof RetentionReleaseCreateSchema>;

export const RetentionReleaseUpdateSchema = z.object({
  amount: PositiveMoneySchema,
  issueDate: DateStringSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  taxRateId: z.string().uuid().nullable().optional(),
});
export type RetentionReleaseUpdate = z.infer<typeof RetentionReleaseUpdateSchema>;

export const InvoiceVoidRequestSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type InvoiceVoidRequest = z.infer<typeof InvoiceVoidRequestSchema>;

export const InvoiceListQuerySchema = PaginationQuerySchema.extend({
  type: InvoiceTypeSchema.optional(),
  status: InvoiceStatusSchema.optional(),
  clientId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .or(z.boolean())
    .optional(),
});

export const CreditNoteCreateSchema = z.object({
  issueDate: DateStringSchema.optional(),
  reason: z.string().min(1).max(1000),
  subtotal: PositiveMoneySchema,
  taxRateId: z.string().uuid().nullable().optional(),
});
export type CreditNoteCreate = z.infer<typeof CreditNoteCreateSchema>;

export const PaymentAllocationInputSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: PositiveMoneySchema,
});
export type PaymentAllocationInput = z.infer<typeof PaymentAllocationInputSchema>;

export const PaymentCreateSchema = z.object({
  clientId: z.string().uuid(),
  receivedDate: DateStringSchema,
  method: z.string().min(1).max(30),
  reference: z.string().max(100).nullable().optional(),
  amount: PositiveMoneySchema,
  notes: z.string().nullable().optional(),
  allocations: z.array(PaymentAllocationInputSchema),
});
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;

export const PaymentListQuerySchema = PaginationQuerySchema.extend({
  clientId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
});

export const CsvExportQuerySchema = z.object({
  from: DateStringSchema,
  to: DateStringSchema,
  companyId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Expenses (Spec 07)
// ---------------------------------------------------------------------------

export const ExpenseCreateSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  category: ExpenseCategorySchema,
  status: z.enum(['UNPAID', 'PAID', 'REIMBURSED']).default('UNPAID'),
  expenseDate: DateStringSchema,
  vendorName: z.string().min(1).max(200),
  billReference: z.string().max(100).nullable().optional(),
  description: z.string().min(1).max(2000),
  amount: PositiveMoneySchema,
  taxRateId: z.string().uuid().nullable().optional(),
  paidDate: DateStringSchema.nullable().optional(),
  paymentMethod: z.string().max(50).nullable().optional(),
  paymentReference: z.string().max(100).nullable().optional(),
  receiptFileId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;

export const ExpenseUpdateSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  category: ExpenseCategorySchema,
  expenseDate: DateStringSchema,
  vendorName: z.string().min(1).max(200),
  billReference: z.string().max(100).nullable().optional(),
  description: z.string().min(1).max(2000),
  amount: PositiveMoneySchema,
  taxRateId: z.string().uuid().nullable().optional(),
  receiptFileId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;

export const ExpensePaySchema = z.object({
  status: z.enum(['PAID', 'REIMBURSED']).default('PAID'),
  paidDate: DateStringSchema,
  paymentMethod: z.string().min(1).max(50),
  paymentReference: z.string().max(100).nullable().optional(),
});
export type ExpensePay = z.infer<typeof ExpensePaySchema>;

export const ExpenseVoidSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type ExpenseVoid = z.infer<typeof ExpenseVoidSchema>;

export const ExpenseListQuerySchema = PaginationQuerySchema.extend({
  projectId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  category: ExpenseCategorySchema.optional(),
  status: ExpenseStatusSchema.optional(),
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
});

export { QuantitySchema };
