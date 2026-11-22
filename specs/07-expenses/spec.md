# Spec 07 - Project & Company Expenses (Job Costing)

Status: DONE
Depends on: 01-foundation, 04-invoicing, 05-reports

## 1. Requirements

### User stories

- As OWNER or OFFICE, I can record purchases and expenses (materials, hardware, tools, subcontractor bills, transport, petty cash) with supplier details, bill/receipt reference, tax rate, and receipt attachment, so that every cost is tracked.
- As OWNER, OFFICE, or PROJECT_MANAGER, I can link an expense to a project (`P26-014`), so that I can see total project costs and gross profit (`Claimed to Date - Total Expenses`).
- As OWNER or OFFICE, I can record an expense as `UNPAID` (supplier bill to pay later) and later mark it `PAID` or `REIMBURSED`, or record an immediate cash/transfer purchase directly as `PAID`.
- As OWNER or OFFICE, I can export expenses to CSV and Excel for the accountant.

### Document Link Flow integration

```text
[3. PROJECT] (P26-014)
     ├──► [4. REPORTS]          (DR / PR / IR)
     ├──► [5. VARIATION ORDERS] (QT-26-014-ACM-VO01)
     ├──► [6. INVOICES]         (INV-26-0045 ──► Ref: P26-014 ──► Money In)
     └──► [7. EXPENSES]         (EXP-26-0001 ──► Ref: P26-014 ──► Money Out)
```

### Acceptance criteria

- AC1: Every expense is assigned an unbroken sequence number (`EXP-YY-NNNN`, e.g. `EXP-26-0001`) from `SequenceService` inside a database transaction (`formatExpenseNumber`).
- AC2: The server recalculates `subtotal`, `taxAmount`, and `total` from `amount` and optional `taxRateId` using `decimal.js` (`ROUND_HALF_UP`, 2 decimal places). Any totals sent by a client are ignored.
- AC3: When `projectId` is provided, `projectCodeRef` (e.g. `P26-014`) is automatically populated from the project's code. When `projectId` is omitted/null, the expense is treated as general company overhead.
- AC4: `PROJECT_MANAGER` can create, update, and list expenses only for projects they are a member of (`403 NOT_PROJECT_MEMBER` otherwise). `OWNER` and `OFFICE` can access all expenses.
- AC5: `SITE_STAFF` has no access to financial expense endpoints (`403 FORBIDDEN`).
- AC6: Marking an `UNPAID` expense as `PAID` or `REIMBURSED` sets `status`, `paidDate`, `paymentMethod`, and optional `paymentReference`. Voiding an expense sets `status = VOID`, records `voidReason`, and excludes it from all expense and profit totals.
- AC7: Project Summary (`GET /api/v1/reports/projects/:id/summary`) includes `totalExpenses` and `grossProfit` (`claimedToDate - totalExpenses`) across non-VOID project expenses, and Dashboard (`GET /api/v1/reports/dashboard`) includes `expensesThisMonth`.
- AC8: Expenses can be exported to CSV (`GET /api/v1/exports/expenses.csv?from=&to=`) and Excel (`GET /api/v1/reports/expenses?format=xlsx`).

## 2. Design

### Tables

`Expense`:
- `id` (UUID v7)
- `number` (`EXP-26-0001`, unique)
- `projectId` (UUID, nullable)
- `projectCodeRef` (String, nullable, e.g. `P26-014`)
- `category` (`ExpenseCategory`: `MATERIALS`, `SUBCONTRACTOR`, `TOOLS_EQUIPMENT`, `LABOUR`, `TRANSPORT`, `SITE_PETTY_CASH`, `OFFICE_OVERHEAD`, `OTHER`)
- `status` (`ExpenseStatus`: `UNPAID`, `PAID`, `REIMBURSED`, `VOID`)
- `expenseDate` (Date)
- `vendorName` (String — shop, supplier, or subcontractor name)
- `billReference` (String, nullable — supplier invoice/receipt number)
- `description` (String — items bought or work paid for)
- `subtotal` (`Decimal(14, 2)`)
- `taxRateId` (UUID, nullable)
- `taxPercent` (`Decimal(5, 2)`)
- `taxAmount` (`Decimal(14, 2)`)
- `total` (`Decimal(14, 2)`)
- `paidDate` (Date, nullable)
- `paymentMethod` (String, nullable — e.g. `BANK_TRANSFER`, `CASH`, `CARD`, `CHEQUE`)
- `paymentReference` (String, nullable)
- `receiptFileId` (UUID, nullable — attached photo/PDF of receipt)
- `notes` (String, nullable)
- `voidedAt` (DateTime, nullable)
- `voidReason` (String, nullable)
- `createdById` (UUID)
- `createdAt`, `updatedAt`

### API

| Method | Route | Roles |
|---|---|---|
| GET | `/api/v1/expenses` | OWNER, OFFICE, PROJECT_MANAGER |
| POST | `/api/v1/expenses` | OWNER, OFFICE, PROJECT_MANAGER |
| GET | `/api/v1/expenses/:id` | OWNER, OFFICE, PROJECT_MANAGER |
| PUT | `/api/v1/expenses/:id` | OWNER, OFFICE, PROJECT_MANAGER |
| POST | `/api/v1/expenses/:id/pay` | OWNER, OFFICE |
| POST | `/api/v1/expenses/:id/void` | OWNER, OFFICE |
| GET | `/api/v1/exports/expenses.csv` | OWNER, OFFICE |
| GET | `/api/v1/reports/expenses` | OWNER, OFFICE, PROJECT_MANAGER |

### Key components

- `@construction/shared`: `ExpenseCategory`, `ExpenseStatus`, `formatExpenseNumber`, and Zod schemas (`ExpenseCreateSchema`, `ExpenseUpdateSchema`, `ExpensePaySchema`, `ExpenseVoidSchema`, `ExpenseListQuerySchema`).
- `ExpensesModule` (`ExpensesService`, `ExpensesController`): transactional `SequenceService.next('EXP', tx, year)` numbering, server-side `decimal.js` tax & total calculation, audit logging, and CSV export.
- `ReportsService`: `getExpensesReport` (by category, by project, and item list + `.xlsx` export) and `totalExpenses` / `grossProfit` in `getProjectSummary` and `expensesThisMonth` in `getDashboard`.

### Screens

- **Expenses Page (`/expenses`)**: Filter by Project, Category, Status, Date range, and Search; summary bar (Total Expenses, Paid, Unpaid Payable); "New Expense" form; Mark Paid / Void actions; CSV & Excel exports.
- **Project Detail Page (`/projects/:id`)**:
  - **Summary tab**: Adds `Total Expenses` and `Gross Profit` cards.
  - **Expenses tab**: Lists all expenses for `P26-014` and allows recording a project expense directly.
- **Dashboard (`/dashboard`) & Reports (`/reports`)**: Shows `Expenses this month` and an **Expenses & Job Costing** report tab.

## 3. Tasks

- [x] T01 Add `ExpenseCategory`, `ExpenseStatus`, `formatExpenseNumber`, and Zod schemas to `@construction/shared`
- [x] T02 Add `Expense` model and enums to `schema.prisma`, migration SQL, and `InMemoryDatabase`
- [x] T03 Implement `ExpensesModule` (`ExpensesService`, `ExpensesController`) with `SequenceService` numbering, tax calculation, pay/void flows, audit log, and CSV export
- [x] T04 Update `ReportsService` and `ReportsController` with `GET /api/v1/reports/expenses` (+ `.xlsx`), `expensesThisMonth` on Dashboard, and `totalExpenses` + `grossProfit` on Project Summary
- [x] T05 Build Web `ExpensesPage` (`/expenses`) and add Expenses link to sidebar navigation
- [x] T06 Add **Expenses** tab and Gross Profit summary card to Web `ProjectDetailPage`, `DashboardPage`, and `ReportsPage`
- [x] T07 Write E2E tests (`apps/api/test/expenses.e2e.spec.ts`) covering AC1-AC8
- [x] T08 Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` across all workspaces
