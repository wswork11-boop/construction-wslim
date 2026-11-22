# Spec 04 - Invoicing, Progress Claims and Payments

Status: DONE
Depends on: 01-foundation, 02-quotations

## 1. Requirements

### User stories

- As OFFICE, I can convert an accepted quotation into the project's contract.
- As OFFICE, I can raise a simple invoice with free line items, with or without a project.
- As OFFICE or PROJECT_MANAGER, I can record a variation order (addition or omission) and have it approved.
- As OFFICE or PROJECT_MANAGER, I can prepare a progress claim by entering cumulative percent or quantity complete per contract item.
- As OFFICE, I can see retention held per project and bill its release.
- As OFFICE, I can record a payment and allocate it across one or more invoices.
- As OFFICE, I can issue a credit note against an issued invoice.
- As OFFICE, I can export invoices and payments to CSV/Excel for the accountant.

### Acceptance criteria

- AC1: Converting an accepted quotation copies its items to `ContractItem`, sets `Project.contractSum`, and can be done once per project.
- AC2: An approved variation order adds `ContractItem` rows and changes the current contract sum. DRAFT or REJECTED variations have no effect on claims.
- AC3: Progress claim figures follow the formula in `docs/02-data-model.md` exactly, including the retention cap.
- AC4: `cumulativePercent` for an item cannot be lower than in the previous issued claim and cannot exceed 100.
- AC5: Only one DRAFT progress claim per project at a time. Claim numbers per project are consecutive (Claim 1, 2, 3...).
- AC6: Issuing an invoice assigns its number, freezes it, stores the PDF, and sets `dueDate = issueDate + payment term`.
- AC7: An ISSUED invoice cannot be edited or deleted. It can be voided only if it has no payments and no later claim depends on it.
- AC8: Total payment allocations on an invoice cannot exceed its total less credit notes. Status moves to PARTIALLY_PAID / PAID automatically.
- AC9: Total retention released on a project can never exceed retention held.
- AC10: The progress claim PDF shows, per item: contract amount, previous claimed, this claim, cumulative, percent; then gross to date, less retention, less previous certified, tax, amount due.
- AC11: Every invoice stores the buyer and supplier tax fields and a classification code per line so it can be submitted to MyInvois later.
- AC12: All calculation paths have unit tests, including: first claim, mid-contract claim, claim that hits the retention cap, claim after a variation order, final claim at 100%, omission variation.

## 2. Design

### Tables

`ContractItem`, `VariationOrder`, `VariationOrderItem`, `Invoice`, `InvoiceLine`, `ClaimLine`, `CreditNote`, `Payment`, `PaymentAllocation` - see `docs/02-data-model.md`.

### Invoice state machine

```
DRAFT --issue--> ISSUED --payment--> PARTIALLY_PAID --payment--> PAID
                   `--void (no payments)--> VOID
```

### API

Roles: OWNER, OFFICE for all. PROJECT_MANAGER may read, and may create/edit DRAFT variation orders and DRAFT progress claims on own projects. Issuing is OWNER, OFFICE only.

| Method | Route | Notes |
|---|---|---|
| POST | `/projects/:id/contract/from-quotation` | body: quotationId |
| GET | `/projects/:id/contract` | items, original sum, approved VOs, current sum, claimed to date, retention held |
| GET, POST | `/projects/:id/variation-orders` | |
| GET, PUT | `/variation-orders/:id` | DRAFT only for PUT |
| POST | `/variation-orders/:id/submit` `/approve` `/reject` | |
| GET, POST | `/invoices` | POST body has `type` |
| GET, PUT, DELETE | `/invoices/:id` | PUT/DELETE DRAFT only |
| POST | `/projects/:id/progress-claims` | creates DRAFT pre-filled with previous cumulative values |
| POST | `/projects/:id/retention-releases` | body: amount |
| POST | `/invoices/:id/issue` | |
| POST | `/invoices/:id/void` | body: reason |
| GET | `/invoices/:id/pdf` | |
| POST | `/invoices/:id/credit-notes` | |
| GET, POST | `/payments` | POST body includes allocations |
| DELETE | `/payments/:id` | reverses allocations, audit logged |
| GET | `/exports/invoices.csv` `/exports/payments.csv` | date range |

### Key components

- `ClaimCalculator` in `packages/shared` - pure function: (contract items, previous claim, inputs, retention terms, tax) -> all figures. Used by the API (authoritative) and the web form (live preview).
- `InvoiceService.issue()` - single transaction: validate, take number, snapshot totals, set status, queue PDF.
- `InvoiceBalanceService` - recomputes `amountPaid` and status from allocations and credit notes.
- When preparing a claim, show the latest site-reported percent per item (from `DailyReportProgress`, if used) beside the input as a hint.

### Web screens

Contract view per project; variation order list/form; simple invoice editor; progress claim editor (grid of contract items with previous %, this %, amounts, running totals panel); retention panel; invoice list with ageing colours; payment entry with allocation; credit note form.

## 3. Tasks

- [x] T01 Prisma models and migration
- [x] T02 Convert accepted quotation to contract
- [x] T03 Variation orders: CRUD, submit/approve/reject, contract item creation
- [x] T04 `ClaimCalculator` with the AC12 unit test set
- [x] T05 Simple invoices: CRUD, issue, void
- [x] T06 Progress claims: create pre-filled draft, edit, validate, issue
- [x] T07 Retention tracking and retention release invoices
- [x] T08 Payments, allocations and automatic invoice status
- [x] T09 Credit notes
- [x] T10 PDF templates: simple invoice, progress claim, credit note
- [x] T11 CSV/Excel exports
- [x] T12 e2e tests covering AC1-AC11
- [x] T13 Web: contract view and variation orders
- [x] T14 Web: simple invoice editor
- [x] T15 Web: progress claim editor with live totals
- [x] T16 Web: invoice list, payments, credit notes, retention panel
- [x] T17 Walk one real past project through the system and compare every figure with what was actually billed

