# Construction System - complete project bundle

This single file contains every file of the project, each under a
heading giving its path. Start with HANDOVER.md (first section).
GEMINI.md is identical to CLAUDE.md and is not repeated.

## Contents

- `HANDOVER.md`
- `README.md`
- `CLAUDE.md`
- `docs/00-overview.md`
- `docs/01-architecture.md`
- `docs/02-data-model.md`
- `specs/_template.md`
- `specs/01-foundation/spec.md`
- `specs/02-quotations/spec.md`
- `specs/03-daily-reports/spec.md`
- `specs/04-invoicing/spec.md`
- `specs/05-reports/spec.md`
- `specs/06-myinvois/spec.md`
- `apps/api/prisma/schema.prisma`
- `docker-compose.yml`
- `.env.example`
- `pnpm-workspace.yaml`
- `.gitignore`
- `design/mockups/mockup.css`
- `design/mockups/web.html`
- `design/mockups/mobile.html`
- `design/documents/document.css`
- `design/documents/quotation.html`
- `design/documents/progress-claim.html`
- `design/documents/site-report.html`
- `docs/api/openapi.yaml`

---

## FILE: `HANDOVER.md`

`````md
# Handover

Written 17 Nov 2026 for whoever (person or AI assistant) continues this project.
Read this first; it explains what exists, what was decided and what to do next.

## What this project is

A system for a construction business in Malaysia covering quotations, invoices
(simple invoices and progress claims with retention), daily site progress
reports submitted from a mobile app, and management reports.

## Facts from the owner

- 50-100 users at most, one company.
- Billing is both simple invoices and progress claims with retention.
- No accounting software is in use today.
- The owner is building it alone.
- Country: Malaysia (SST and LHDN MyInvois e-invoice rules apply).
- Chosen stack: NestJS backend and a mobile app. The rest of the stack below was proposed by the assistant and accepted without objection.
- The office PC used so far has no Node.js or Docker and the owner has no rights to install them. So far only design work has been done; building needs another machine or a cloud environment.

## Current state

**Nothing has been compiled, run or tested.** There is no application code.
The repository contains specifications and design files only, and nothing is
committed to git yet.

| Item | State |
|---|---|
| Specs 01-03 | Written, marked ready to build |
| Spec 04 (invoicing) | Written; retention and SST rules must be confirmed with an accountant before building |
| Spec 05 (reports) | Draft |
| Spec 06 (MyInvois) | Draft; LHDN rules have NOT been verified - see its "Verify first" list |
| Screen mockups (web, mobile) | Written as static HTML; not yet reviewed by the owner |
| Document layouts (quotation, progress claim, site report) | Written as static HTML; not yet reviewed by the owner |
| Database schema (`apps/api/prisma/schema.prisma`) | All tables for all specs; never run through `prisma validate` |
| API contract (`docs/api/openapi.yaml`) | 74 operations for specs 01-05; never run through an OpenAPI validator |
| Spec 01 tasks | T01, T02, T04 partly done as files only (workspace file, docker-compose, env template, schema). No task is ticked |

## Stack

TypeScript everywhere. pnpm workspaces + Turborepo monorepo. NestJS + Prisma +
PostgreSQL API. React + Vite office web app. Expo (React Native) mobile app with
expo-sqlite for offline. Zod schemas in a shared package. S3-compatible storage
with presigned URLs for photos. Puppeteer for PDFs. BullMQ + Redis for
background jobs when first needed. Details: `docs/01-architecture.md`.

## How the project is meant to be built

Spec-driven. Each `specs/NN-name/spec.md` has Requirements (with numbered
acceptance criteria), Design, and a Tasks checklist. Work one spec at a time,
tasks in order, tick each task when its tests pass, and update the spec first
if the code must differ from it. Rules that must not be broken are in
`CLAUDE.md` / `GEMINI.md` (same content).

## Assumptions made by the assistant, not confirmed by the owner

- Four roles: OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF. Site staff never see prices.
- Retention: 10% of each claim, capped at 5% of the contract sum, released half at practical completion and half after a 12-month defects liability period.
- The 6% SST rate in the mockups is an example only.
- Clients get PDFs; there is no client login.
- Daily reports: one per user per project per day, editable until reviewed or 48 hours after the report date, date at most 2 days back.
- Working days for "missing report" checks are Monday to Saturday.
- Company, client, project and people names in the mockups are invented.

## Open decisions

1. Should OFFICE be able to list users (they assign project members, but only OWNER may list users)?
2. Forgotten passwords are reset by the OWNER; no email reset. Acceptable?
3. Which days count as working days?
4. Are CSV exports enough, or are real Excel files needed?
5. When a variation order is approved, which tax rate and section title do its contract items get?
6. If a progress claim is voided, is its claim number reused or skipped?
7. Annual revenue band and SST registration status (decides MyInvois and SST obligations).
8. Does the owner already have quotation / invoice layouts the PDFs should match?

## Known weak points

- The schema and the API contract were written separately. A few fields were aligned by hand afterwards, but the two files have not been compared field by field. Treat the schema and `docs/02-data-model.md` as authoritative where they disagree with the contract.
- Error codes in the API contract other than `INVALID_CREDENTIALS` and `QUOTATION_NOT_EDITABLE` are proposals.
- Report response shapes in the API contract are one reading of a one-line table in spec 05.
- The Prisma schema's generator and datasource blocks may need changing for the installed Prisma version.
- Everything about Malaysian tax and e-invoice rules needs checking against current official sources.

## Recommended next steps

1. Owner reviews the mockups and document layouts and lists changes.
2. Owner answers the open decisions above.
3. On a machine with Node.js and Docker (or a cloud dev environment): run `prisma validate`, lint the OpenAPI file, then start `specs/01-foundation/spec.md` at task T01.

## File map

| Path | Contents |
|---|---|
| `README.md` | Entry point and file index |
| `CLAUDE.md`, `GEMINI.md` | Working rules for an AI coding assistant |
| `docs/00-overview.md` | Purpose, roles, scope, phases, open questions |
| `docs/01-architecture.md` | Stack, conventions, offline sync, security |
| `docs/02-data-model.md` | Tables, enums, progress claim formula, schema decisions |
| `docs/api/openapi.yaml` | API contract |
| `specs/*/spec.md` | Six feature specs and a template |
| `apps/api/prisma/schema.prisma` | Database schema |
| `design/mockups/` | Web and mobile screen mockups (HTML) |
| `design/documents/` | Quotation, progress claim, site report layouts (HTML) |
| `docker-compose.yml`, `.env.example` | Local development services and settings |
| `tools/make-bundle.sh` | Rebuilds `PROJECT-BUNDLE.md`, the single-file copy of everything |

`````

---

## FILE: `README.md`

`````md
# Construction System

Quotations, invoices (simple and progress claims), daily site reports from a
mobile app, and reports, for a construction business in Malaysia.

No application code exists yet. This repository currently holds the
specifications and design files the code will be built from. Nothing here has
been compiled or run: the design was done on a machine without Node.js.

## How this project is built (spec-driven development)

Each feature has one spec file with three parts:

1. **Requirements** - user stories and numbered acceptance criteria (AC1, AC2...)
2. **Design** - tables, API routes, components, screens
3. **Tasks** - a numbered checklist (T01, T02...)

The working loop:

1. Pick the next unchecked task in the current spec.
2. Build it, with tests that prove the acceptance criteria it touches.
3. Tick the task in the spec file and commit code and spec together.
4. If building reveals the spec is wrong, change the spec first, then the code.

To add a feature, copy `specs/_template.md` into a new numbered folder and fill
in Requirements before Design, and Design before Tasks.

## Where to read

| File | What it covers |
|---|---|
| [docs/00-overview.md](docs/00-overview.md) | Purpose, users, roles, scope, phases, open questions |
| [docs/01-architecture.md](docs/01-architecture.md) | Stack, folder layout, conventions, offline sync, security |
| [docs/02-data-model.md](docs/02-data-model.md) | Tables, enums, progress claim formula |
| [specs/01-foundation/spec.md](specs/01-foundation/spec.md) | Login, roles, clients, projects |
| [specs/02-quotations/spec.md](specs/02-quotations/spec.md) | Quotations and PDF |
| [specs/03-daily-reports/spec.md](specs/03-daily-reports/spec.md) | Mobile daily reports, offline |
| [specs/04-invoicing/spec.md](specs/04-invoicing/spec.md) | Invoices, progress claims, retention, payments |
| [specs/05-reports/spec.md](specs/05-reports/spec.md) | Dashboard and reports |
| [specs/06-myinvois/spec.md](specs/06-myinvois/spec.md) | LHDN e-invoice |

## Design files

Open the HTML files in any browser. Nothing needs installing.

| File | What it shows |
|---|---|
| [design/mockups/web.html](design/mockups/web.html) | Office web app, 12 screens, switch with the left menu |
| [design/mockups/mobile.html](design/mockups/mobile.html) | Mobile app for site staff, 6 screens |
| [design/documents/quotation.html](design/documents/quotation.html) | Quotation layout (also the basis for a simple invoice) |
| [design/documents/progress-claim.html](design/documents/progress-claim.html) | Progress claim layout with retention |
| [design/documents/site-report.html](design/documents/site-report.html) | Daily site report layout |
| [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) | Database schema for all specs - not yet validated by Prisma |
| [docs/api/openapi.yaml](docs/api/openapi.yaml) | API contract for specs 01-05 - not yet validated |

The mockups and documents share one sample project so the figures agree across
screens. All names are made up, and the 6% tax rate and retention terms are
examples only.

## Progress

| Spec | Status |
|---|---|
| 01 Foundation | Not started |
| 02 Quotations | Not started |
| 03 Daily reports | Not started |
| 04 Invoicing | Not started - needs accountant review of retention and SST rules |
| 05 Reports | Draft |
| 06 MyInvois | Draft - LHDN rules to be verified |

## Next step

1. Review the mockups and document layouts and note any changes.
2. On a machine with Node.js and Docker (or a cloud session), start at
   `specs/01-foundation/spec.md`, task T01. The first job there is to run
   `prisma validate` on the schema and lint the OpenAPI file.

`````

---

## FILE: `CLAUDE.md`

`````md
# Project instructions

This project is built spec-first. Read before writing code:

- `docs/00-overview.md` - scope, roles, business rules
- `docs/01-architecture.md` - stack and conventions (follow these exactly)
- `docs/02-data-model.md` - tables and the progress claim formula
- `specs/NN-name/spec.md` - the feature being worked on

## Workflow

- Work on one spec at a time, tasks in order unless told otherwise.
- When a task is done and its tests pass, tick it (`- [x]`) in the spec file.
- If the code needs to differ from the spec, update the spec in the same change and say so.
- Do not start a spec marked DRAFT or REVIEW BEFORE BUILD without asking.
- New features get a new folder under `specs/` from `specs/_template.md`: requirements, then design, then tasks.

## Rules that must not be broken

- Money: `Decimal` in the database, `decimal.js` in code, strings in JSON. Never `number` arithmetic on money.
- The server recalculates all totals. Never trust totals from a client.
- Issued quotations and invoices are immutable. Corrections are revisions or credit notes.
- Document numbers come only from `SequenceService` inside a transaction.
- SITE_STAFF must never receive price or financial fields from the API.
- Tax rates come from settings. No hard-coded percentages.
- Anything about LHDN / MyInvois / SST rules must be verified against current official documentation, not assumed.

## Stack

TypeScript, pnpm workspaces + Turborepo, NestJS + Prisma + PostgreSQL,
React + Vite (web), Expo React Native (mobile), Zod schemas in `packages/shared`.

## Commands

To be filled in when the monorepo is scaffolded (spec 01, T01).

`````

---

## FILE: `docs/00-overview.md`

`````md
# Product Overview

## Purpose

A system for a Malaysian construction business to manage quotations, invoices
(simple invoices and progress claims with retention), daily site progress, and
reports. Site progress is captured on a mobile app and feeds the reports.

## Users and scale

50-100 users in total, one company (single tenant).

| Role | Uses | Can do |
|---|---|---|
| OWNER | Web, mobile | Everything, including users and company settings |
| OFFICE | Web | Clients, projects, quotations, invoices, payments, reports |
| PROJECT_MANAGER | Web, mobile | Own projects: view contract, review daily reports, prepare claims |
| SITE_STAFF | Mobile | Own projects: submit and view daily reports. Never sees prices |

## Applications

| App | Audience | Purpose |
|---|---|---|
| `apps/api` | - | NestJS REST API, the only thing that touches the database |
| `apps/web` | Office | Quotations, invoices, payments, reports, administration |
| `apps/mobile` | Site | Daily progress reports with photos, working offline |

## In scope

1. Users, roles, clients, projects, project members
2. Quotations with sections, line items, revisions, PDF
3. Daily site reports from mobile with photos, offline first
4. Simple invoices, progress claims, retention, variation orders, payments, credit notes
5. Reports: progress, quoted vs claimed vs paid, outstanding, site report PDF
6. MyInvois (LHDN e-invoice) submission - later phase, data fields captured from day one

## Out of scope

- Full accounting (general ledger, payables, payroll). Invoices and payments are exported to CSV/Excel for an accountant.
- Multi-company / SaaS tenancy
- Procurement, subcontractor management, scheduling (Gantt)

## Business rules that apply everywhere

- Money is stored as decimal (2 places), currency MYR. Never floating point.
- Issued documents (quotations sent, invoices issued) are immutable. Corrections are a new quotation revision or a credit note.
- Document numbers come from a gap-free sequence per document type and year, e.g. `QT-2026-0001`, `INV-2026-0001`, `PC-2026-0001`.
- Tax (SST) is a rate per line, set from company settings. Never hard-coded.
- Every create/update/status change on financial documents is written to the audit log.

## Delivery phases

| Phase | Spec | Result |
|---|---|---|
| 1 | `specs/01-foundation` | Login, roles, clients, projects |
| 2 | `specs/02-quotations` | Quotations with PDF |
| 3 | `specs/03-daily-reports` | Mobile app in use on site |
| 4 | `specs/04-invoicing` | Invoices, progress claims, payments |
| 5 | `specs/05-reports` | Dashboards and exports |
| 6 | `specs/06-myinvois` | E-invoice submission |

## Open questions

- [ ] Annual revenue band - decides whether and when MyInvois is mandatory (confirm with LHDN / accountant)
- [ ] SST registration status and the rate that applies to the company's services
- [ ] Default retention terms (assumed 10% per claim, capped at 5% of contract sum, released 50% at practical completion and 50% after defects liability period)
- [ ] Does the client need a login to view reports, or is PDF by email/WhatsApp enough? (assumed PDF only)
- [ ] OFFICE assigns project members but only OWNER may list users - allow OFFICE to read the user list? (found while writing the API contract)
- [ ] How does a user who forgot their password get a new one? (assumed OWNER resets it; no self-service email reset)
- [ ] Which days count as working days for "missing daily report" checks? (assumed Monday-Saturday; a per-project setting has no field yet)
- [ ] Exports: is CSV enough, or is a real Excel file needed? (API contract currently defines CSV only)
- [ ] Languages for the mobile app (assumed English, with Bahasa Malaysia and Chinese possible later)

`````

---

## FILE: `docs/01-architecture.md`

`````md
# Architecture

## Stack

| Part | Choice |
|---|---|
| Language | TypeScript everywhere |
| Monorepo | pnpm workspaces + Turborepo |
| API | NestJS (REST), Prisma, PostgreSQL |
| Validation | Zod schemas in `packages/shared`, used by API, web and mobile |
| Auth | Email + password (argon2), JWT access token (15 min) + rotating refresh token |
| Web | React + Vite, TanStack Query, React Hook Form |
| Mobile | React Native with Expo, expo-sqlite for the offline queue |
| Files | S3-compatible bucket (AWS S3 ap-southeast-1 or Cloudflare R2), presigned URLs |
| PDF | Puppeteer rendering HTML templates in the API |
| Background jobs | BullMQ + Redis (PDF generation, email, MyInvois). Add when first needed |
| Hosting | One container host + managed PostgreSQL, Singapore region |

## Repository layout

```
construction-system/
  apps/
    api/            NestJS
    web/            React office app
    mobile/         Expo app
  packages/
    shared/         Zod schemas, enums, types, money helpers
  docs/             Overview, architecture, data model
  specs/            One folder per feature (spec-driven development)
```

## API structure

One NestJS application, one module per domain. No microservices.

```
apps/api/src/
  common/           guards, decorators, filters, pagination, audit interceptor
  prisma/           PrismaService
  auth/             login, refresh, logout, password change
  users/
  company/          company settings, tax rates, document sequences
  clients/
  projects/         projects, members, contract items
  quotations/
  variation-orders/
  invoices/         simple invoices, progress claims, credit notes
  payments/
  daily-reports/
  files/            presigned upload/download
  reports/
  pdf/
  myinvois/         phase 6
```

## Conventions

- **Routes:** `/api/v1/<resource>`, plural nouns, standard verbs. Actions that are not CRUD are `POST /<resource>/:id/<action>` (e.g. `/quotations/:id/send`).
- **IDs:** UUID v7. Mobile generates the ID for daily reports so that retries are idempotent.
- **Errors:** `{ statusCode, code, message, details? }` where `code` is a stable string such as `QUOTATION_NOT_EDITABLE`.
- **Lists:** `?page=1&pageSize=20&sort=-createdAt&q=...`, response `{ items, total, page, pageSize }`.
- **Authorization:** `@Roles()` guard for role, plus a project-membership check for PROJECT_MANAGER and SITE_STAFF. Price fields are stripped from responses for SITE_STAFF at the serializer, not in the UI.
- **Money:** `Decimal(14,2)` in the database, `decimal.js` in code, sent over JSON as strings. Quantities `Decimal(14,3)`, percentages `Decimal(5,2)`.
- **Dates:** stored in UTC. Business dates (invoice date, report date) are `date` columns with no time, interpreted as Asia/Kuala_Lumpur.
- **Transactions:** anything that takes a document number or changes a financial document status runs in a single database transaction.
- **Soft delete:** master data (clients, users) is deactivated, not deleted. Financial documents are never deleted once issued.
- **Tests:** unit tests for all money calculations (claims, retention, tax, rounding). e2e tests for each module's main flow against a real PostgreSQL.

## File uploads

1. Client asks `POST /files/presign` with file name, type, size and purpose.
2. API returns a presigned PUT URL and a `fileId` (row in `File` with status `PENDING`).
3. Client uploads straight to the bucket.
4. Client references `fileId` when saving the parent record. API verifies the object exists and marks it `READY`.

Photos are resized on the phone to a maximum 1600 px long edge, JPEG quality ~70, before upload.

## Offline (mobile)

- Daily reports are written to local SQLite first with status `DRAFT` or `QUEUED`.
- A sync worker runs on app start, on regaining connectivity, and on manual pull-to-refresh.
- Sync order per report: upload each photo -> `PUT /daily-reports/:id` with the client-generated ID -> mark `SYNCED`.
- `PUT` with the same ID and body is safe to repeat. The server is the source of truth once synced.
- Project list and the last 30 days of own reports are cached for reading offline.

## Environments

| Env | Purpose |
|---|---|
| local | Docker Compose: postgres, redis, minio |
| staging | Same shape as production, MyInvois sandbox |
| production | MyInvois production |

Secrets come from environment variables only. `.env.example` lists every key with no real values.

## Security checklist

- Passwords hashed with argon2id, login rate-limited
- Refresh tokens stored hashed, rotated on use, revocable per device
- Helmet, CORS limited to the web origin, request size limits
- Bucket is private. All access is by short-lived presigned URL
- Daily database backups with a tested restore

`````

---

## FILE: `docs/02-data-model.md`

`````md
# Data Model

This is the target model. Each spec adds its own tables through Prisma migrations.
All tables have `id` (UUID), `createdAt`, `updatedAt`. Financial tables also have `createdById`.

## Enums

```
Role                 OWNER | OFFICE | PROJECT_MANAGER | SITE_STAFF
ProjectStatus        DRAFT | ACTIVE | ON_HOLD | COMPLETED | CLOSED
QuotationStatus      DRAFT | SENT | ACCEPTED | REJECTED | SUPERSEDED | EXPIRED
VariationStatus      DRAFT | SUBMITTED | APPROVED | REJECTED
InvoiceType          SIMPLE | PROGRESS_CLAIM | RETENTION_RELEASE
InvoiceStatus        DRAFT | ISSUED | PARTIALLY_PAID | PAID | VOID
DailyReportStatus    SUBMITTED | REVIEWED
Weather              SUNNY | CLOUDY | RAIN | HEAVY_RAIN
EInvoiceStatus       NOT_REQUIRED | PENDING | SUBMITTED | VALID | INVALID | CANCELLED
```

## Foundation (spec 01)

| Table | Key fields |
|---|---|
| `User` | email (unique), passwordHash, name, phone, role, isActive |
| `RefreshToken` | userId, tokenHash, deviceName, expiresAt, revokedAt |
| `Company` (single row) | name, registrationNo (SSM), tin, sstNo, msicCode, address, phone, email, logoFileId, bankDetails, defaultPaymentTermDays, defaultRetentionPercent, defaultRetentionCapPercent |
| `TaxRate` | name, percent, isDefault, isActive |
| `DocumentSequence` | docType, year, lastNumber - unique (docType, year), row-locked when incremented |
| `Client` | name, registrationNo, tin, sstNo, address, contactName, phone, email, isActive |
| `Project` | code (unique), name, clientId, siteAddress, status, startDate, endDate, contractSum, retentionPercent, retentionCapPercent, defectsLiabilityMonths |
| `ProjectMember` | projectId, userId - unique pair |
| `File` | bucketKey, fileName, mimeType, size, purpose, status (PENDING/READY), uploadedById |
| `AuditLog` | userId, entity, entityId, action, before (json), after (json), at |

## Quotations (spec 02)

| Table | Key fields |
|---|---|
| `Quotation` | number, rootId (first revision's id), revisionNo, clientId, projectId (nullable), title, status, issueDate, validUntil, terms, notes, subtotal, discountAmount, taxAmount, total, pdfFileId |
| `QuotationSection` | quotationId, sortOrder, title |
| `QuotationItem` | quotationId, sectionId, sortOrder, description, unit, quantity, rate, amount, taxRateId, taxPercent (snapshot) |

Revisions share `number` and `rootId`; `revisionNo` increases. Displayed as `QT-2026-0001 Rev 2`.

## Contract and variations (spec 04)

| Table | Key fields |
|---|---|
| `ContractItem` | projectId, sourceQuotationItemId, variationOrderId (nullable), sectionTitle, sortOrder, description, unit, quantity, rate, amount, taxPercent |
| `VariationOrder` | number, projectId, title, reason, status, approvedAt, total (can be negative for omissions) |
| `VariationOrderItem` | variationOrderId, description, unit, quantity, rate, amount |

`ContractItem` rows are copied from the accepted quotation when it is converted to a contract,
so later quotation changes never alter the contract. Approving a variation order appends
`ContractItem` rows linked to it.

## Invoicing (spec 04)

| Table | Key fields |
|---|---|
| `Invoice` | number, type, projectId (nullable for SIMPLE), clientId, status, issueDate, dueDate, claimNo (progress claims), periodFrom, periodTo, grossToDate, retentionToDate, previousNetCertified, subtotal, taxAmount, total, amountPaid, notes, pdfFileId, eInvoiceStatus, eInvoiceUuid, eInvoiceLongId, eInvoiceValidatedAt |
| `InvoiceLine` | invoiceId, sortOrder, description, unit, quantity, rate, amount, taxPercent, taxAmount, classificationCode |
| `ClaimLine` | invoiceId, contractItemId, cumulativePercent, cumulativeQuantity, cumulativeAmount, previousAmount, thisClaimAmount |
| `CreditNote` | number, invoiceId, issueDate, reason, subtotal, taxAmount, total, eInvoice fields as above |
| `Payment` | clientId, receivedDate, method, reference, amount, notes |
| `PaymentAllocation` | paymentId, invoiceId, amount |

### Progress claim calculation

```
grossToDate          = sum(ContractItem.amount x ClaimLine.cumulativePercent / 100)   (includes approved VO items)
retentionToDate      = min(grossToDate x retentionPercent / 100,
                           currentContractSum x retentionCapPercent / 100)
netToDate            = grossToDate - retentionToDate
previousNetCertified = netToDate of the previous ISSUED claim on this project (0 for claim 1)
subtotal             = netToDate - previousNetCertified
taxAmount            = round(subtotal x taxPercent / 100, 2)
total                = subtotal + taxAmount
```

`currentContractSum` = original contract items + approved variation orders.
Rounding is half-up to 2 decimals, applied per line then summed.
A `RETENTION_RELEASE` invoice bills part of the retention held; total released can never exceed retention held.

## Daily reports (spec 03)

| Table | Key fields |
|---|---|
| `DailyReport` | id (generated on the phone), projectId, reportDate, submittedById, weather, workDone, issues, nextDayPlan, status, reviewedById, reviewedAt, latitude, longitude, deviceCreatedAt - unique (projectId, reportDate, submittedById) |
| `DailyReportManpower` | dailyReportId, trade, headcount |
| `DailyReportPhoto` | dailyReportId, fileId, caption, takenAt, sortOrder |
| `DailyReportProgress` (optional) | dailyReportId, contractItemId, percentComplete - site estimate, used as a hint when preparing claims |

## Additions made when the full schema was written

`apps/api/prisma/schema.prisma` is the detailed version of this document. Writing it
exposed gaps above; these were resolved as follows.

| Area | Decision |
|---|---|
| `Invoice.number`, `issueDate`, `dueDate` | Nullable: assigned on issue (spec 04 AC6). `Quotation.number` is assigned at first save |
| Buyer / supplier snapshot on `Invoice` | Added `buyerName/RegistrationNo/Tin/SstNo/Address` and `supplierName/RegistrationNo/Tin/SstNo/MsicCode/Address`, copied at issue so later edits to the client or company do not alter an issued invoice (spec 04 AC11) |
| `Invoice.taxPercent` | Added; the claim formula applies one rate to the claim subtotal |
| Reasons and timestamps | Added `Quotation.rejectionReason`, `Invoice.voidReason`, `Invoice.voidedAt`, `CreditNote.pdfFileId`, `VariationOrderItem.sortOrder` |
| `Quotation.rootId` | Plain indexed UUID, not a foreign key (the first revision points at itself) |
| `ContractItem.sourceQuotationItemId` | Nullable: rows created from a variation order have none |
| Claim-only fields on `Invoice` | Nullable: SIMPLE invoices have no `claimNo`, period or to-date figures |
| `Payment.method` | Free text for now (bank transfer, cheque, cash) |
| `DailyReport.latitude/longitude` | `Decimal(9,6)`, nullable |
| `LoginAttempt` | New table for the failed-login lockout (spec 01 AC1) |
| `EInvoiceSubmission` | Timestamps are `submittedAt`, `validatedAt`, `cancelledAt` |

Rules Prisma cannot express, to be added as raw SQL in a migration or checked in services:

- only one DRAFT progress claim per project
- contract conversion happens once per project
- `cumulativePercent` between 0 and 100
- `EInvoiceSubmission` has exactly one of `invoiceId` / `creditNoteId`

Still undecided:

- [ ] When a variation order is approved, which tax rate and section title do its new contract items get? (`VariationOrderItem` has neither field)
- [ ] If a progress claim is voided, is its claim number reused by the next claim or skipped?

## Relationships

```
Client 1--* Project 1--* ProjectMember *--1 User
Client 1--* Quotation 1--* QuotationSection 1--* QuotationItem
Project 1--* ContractItem *--0..1 VariationOrder
Project 1--* Invoice 1--* InvoiceLine
                     1--* ClaimLine *--1 ContractItem
Invoice 1--* PaymentAllocation *--1 Payment
Invoice 1--* CreditNote
Project 1--* DailyReport 1--* DailyReportPhoto *--1 File
```

`````

---

## FILE: `specs/_template.md`

`````md
# Spec NN - Feature name

Status: DRAFT | READY TO BUILD | IN PROGRESS | DONE
Depends on:

## 1. Requirements

### User stories

- As ROLE, I can ACTION, so that BENEFIT.

### Acceptance criteria

- AC1: Specific, testable statement.

## 2. Design

### Tables

### API

| Method | Route | Roles |
|---|---|---|

### Key components

### Screens

## 3. Tasks

- [ ] T01

`````

---

## FILE: `specs/01-foundation/spec.md`

`````md
# Spec 01 - Foundation

Status: READY TO BUILD
Depends on: nothing

## 1. Requirements

### User stories

- As an OWNER, I can create users and assign a role, so staff can log in.
- As any user, I can log in on web or mobile and stay logged in on my device.
- As an OWNER, I can set company details (name, SSM number, TIN, SST number, logo, bank details) that appear on documents.
- As OFFICE, I can manage clients.
- As OFFICE, I can create a project for a client and assign project managers and site staff to it.
- As SITE_STAFF or PROJECT_MANAGER, I only see projects I am a member of.

### Acceptance criteria

- AC1: Login with a wrong password returns `401 INVALID_CREDENTIALS`; 5 failures in 15 minutes locks further attempts for that email for 15 minutes.
- AC2: Access token expires after 15 minutes; the refresh token returns a new pair and invalidates the old refresh token.
- AC3: A deactivated user cannot log in and existing refresh tokens stop working.
- AC4: SITE_STAFF calling `GET /projects` receives only member projects, with `contractSum` absent from the response.
- AC5: SITE_STAFF calling any `/quotations`, `/invoices`, `/payments` route receives `403`.
- AC6: Client and project `code`/`email` uniqueness violations return `409` with a clear code.
- AC7: Two concurrent requests for the next document number never receive the same number.
- AC8: Creating, updating or deactivating a user, client or project writes an `AuditLog` row.

## 2. Design

### Tables

`User`, `RefreshToken`, `Company`, `TaxRate`, `DocumentSequence`, `Client`, `Project`, `ProjectMember`, `File`, `AuditLog` - see `docs/02-data-model.md`.

### API

| Method | Route | Roles |
|---|---|---|
| POST | `/auth/login` | public |
| POST | `/auth/refresh` | public |
| POST | `/auth/logout` | any |
| GET | `/auth/me` | any |
| POST | `/auth/change-password` | any |
| GET, POST | `/users` | OWNER |
| GET, PATCH | `/users/:id` | OWNER |
| GET, PATCH | `/company` | GET any, PATCH OWNER |
| GET, POST, PATCH | `/tax-rates` | GET OFFICE+, write OWNER |
| GET, POST | `/clients` | OWNER, OFFICE |
| GET, PATCH | `/clients/:id` | OWNER, OFFICE |
| GET, POST | `/projects` | GET any (filtered), POST OWNER, OFFICE |
| GET, PATCH | `/projects/:id` | GET member, PATCH OWNER, OFFICE |
| PUT | `/projects/:id/members` | OWNER, OFFICE |
| POST | `/files/presign` | any |
| GET | `/files/:id/url` | any with access to the parent record |

### Key components

- `JwtAuthGuard` (global), `RolesGuard`, `@Roles()`, `@CurrentUser()`, `@Public()`
- `ProjectAccessService.assertMember(user, projectId)` - OWNER and OFFICE always pass
- `SequenceService.next(docType, tx)` - `SELECT ... FOR UPDATE` on the sequence row inside the caller's transaction
- `AuditInterceptor` or explicit `AuditService.log()` calls in services
- Seed script: one OWNER user (credentials from env), company row, default tax rates

### Web screens

Login, Users list/form, Company settings, Clients list/form, Projects list/form/detail with member assignment.

### Mobile screens

Login, My projects list, Project detail (no prices), Profile/logout.

## 3. Tasks

- [ ] T01 Create monorepo: pnpm workspaces, Turborepo, shared tsconfig, ESLint, Prettier
- [ ] T02 Docker Compose for postgres, redis, minio; `.env.example`
- [ ] T03 Scaffold `apps/api` (NestJS), config module with env validation, health endpoint
- [ ] T04 Prisma setup, foundation schema, first migration, seed script
- [ ] T05 `packages/shared`: enums, Zod schemas for auth/users/clients/projects, money helpers
- [ ] T06 Auth module: login, refresh rotation, logout, change password, rate limit
- [ ] T07 Guards and decorators: JWT, roles, current user, project access
- [ ] T08 Users module
- [ ] T09 Company and tax-rates module, `SequenceService` with concurrency test
- [ ] T10 Clients module
- [ ] T11 Projects and members module, price stripping for SITE_STAFF
- [ ] T12 Files module with presigned upload/download
- [ ] T13 Audit log service
- [ ] T14 Global error filter, pagination helper, Swagger docs
- [ ] T15 e2e tests covering AC1-AC8
- [ ] T16 Scaffold `apps/web`: routing, auth store, API client with token refresh, layout
- [ ] T17 Web screens: login, users, company, clients, projects
- [ ] T18 Scaffold `apps/mobile` (Expo): navigation, secure token storage, API client
- [ ] T19 Mobile screens: login, my projects, project detail, profile
- [ ] T20 CI: lint, type-check, test on every push

`````

---

## FILE: `specs/02-quotations/spec.md`

`````md
# Spec 02 - Quotations

Status: READY TO BUILD
Depends on: 01-foundation

## 1. Requirements

### User stories

- As OFFICE, I can create a quotation for a client with sections and line items (description, unit, quantity, rate).
- As OFFICE, I can apply a discount and tax, and see totals update as I type.
- As OFFICE, I can generate a PDF with the company letterhead and send it to the client.
- As OFFICE, I can revise a sent quotation; the old revision stays on record.
- As OFFICE, I can mark a quotation accepted or rejected.
- As OFFICE, I can duplicate an existing quotation as the starting point for a new one.
- As OFFICE, I can convert an accepted quotation into a project contract (used by spec 04).

### Acceptance criteria

- AC1: A quotation number is assigned when the draft is first saved and never changes across revisions.
- AC2: `amount = round(quantity x rate, 2)` per item; `subtotal = sum(amount)`; `taxAmount = sum(round((amount - share of discount) x taxPercent / 100, 2))`; `total = subtotal - discountAmount + taxAmount`. The server recalculates and ignores totals sent by the client.
- AC3: Only DRAFT quotations can be edited. Editing a SENT quotation returns `409 QUOTATION_NOT_EDITABLE`.
- AC4: `POST /quotations/:id/revise` on a SENT or REJECTED quotation creates a DRAFT copy with `revisionNo + 1` and marks the source SUPERSEDED.
- AC5: Only the latest revision can be accepted. Accepting sets status ACCEPTED.
- AC6: A SENT quotation past `validUntil` is shown as EXPIRED (computed on read or by a daily job).
- AC7: The PDF shows company details, client details, number with revision, sections with subtotals, discount, tax, total, terms, validity and a signature block. The stored PDF for a SENT revision is never regenerated.
- AC8: Sections and items keep the order the user set (drag to reorder).
- AC9: A quotation with no items cannot be sent.

## 2. Design

### Tables

`Quotation`, `QuotationSection`, `QuotationItem` - see `docs/02-data-model.md`.

### State machine

```
DRAFT --send--> SENT --accept--> ACCEPTED
                 |--reject--> REJECTED --revise--> (new DRAFT, source SUPERSEDED)
                 |--revise--> (new DRAFT, source SUPERSEDED)
                 `--(validUntil passed)--> EXPIRED
```

### API

All routes: OWNER, OFFICE. PROJECT_MANAGER read-only for quotations linked to own projects.

| Method | Route | Notes |
|---|---|---|
| GET | `/quotations` | filter by status, client, date range, search; latest revision only by default |
| POST | `/quotations` | creates DRAFT with number |
| GET | `/quotations/:id` | includes sections and items |
| PUT | `/quotations/:id` | replaces header, sections and items in one transaction |
| DELETE | `/quotations/:id` | DRAFT with revisionNo 0 only |
| POST | `/quotations/:id/send` | freezes, generates and stores PDF |
| POST | `/quotations/:id/accept` | |
| POST | `/quotations/:id/reject` | body: reason |
| POST | `/quotations/:id/revise` | |
| POST | `/quotations/:id/duplicate` | new number, DRAFT |
| GET | `/quotations/:id/revisions` | all revisions of the same root |
| GET | `/quotations/:id/pdf` | presigned URL; DRAFT renders a watermarked preview |

### Key components

- `QuotationCalculator` in `packages/shared` - pure function used by the API (authoritative) and the web form (live preview)
- `PdfService.render(template, data)` - Puppeteer, HTML template with company letterhead
- Item library (optional, later): saved descriptions/units/rates for quick entry

### Web screens

Quotation list with status filters; quotation editor (sections, sortable item grid, keyboard-friendly entry, live totals); preview/PDF; revision history; accept/reject dialogs.

## 3. Tasks

- [ ] T01 Prisma models and migration
- [ ] T02 Zod schemas and `QuotationCalculator` with unit tests (rounding, discount, mixed tax rates)
- [ ] T03 CRUD endpoints with full-document `PUT`
- [ ] T04 Status transitions: send, accept, reject, revise, duplicate
- [ ] T05 Expiry handling
- [ ] T06 `PdfService` and quotation HTML template
- [ ] T07 Store PDF on send; preview with DRAFT watermark
- [ ] T08 e2e tests covering AC1-AC9
- [ ] T09 Web: quotation list
- [ ] T10 Web: quotation editor with sections, reorder, live totals
- [ ] T11 Web: send/accept/reject/revise flows and revision history
- [ ] T12 Web: PDF preview and download

`````

---

## FILE: `specs/03-daily-reports/spec.md`

`````md
# Spec 03 - Daily Site Reports (Mobile)

Status: READY TO BUILD
Depends on: 01-foundation (can be built before 02)

## 1. Requirements

### User stories

- As SITE_STAFF, I can submit today's report for a project: photos, work done, manpower by trade, weather, issues or delays, and tomorrow's plan.
- As SITE_STAFF, I can fill in and save a report with no signal; it uploads by itself when I am back online.
- As SITE_STAFF, I can see my past reports and whether each has uploaded.
- As PROJECT_MANAGER, I can review reports for my projects on web or mobile and mark them reviewed.
- As OFFICE or PROJECT_MANAGER, I can produce a daily or weekly site report PDF to send to the client.

### Acceptance criteria

- AC1: A report can be created, edited and queued entirely offline. Nothing is lost if the app is closed before sync.
- AC2: Each report shows a clear state on the phone: Draft, Waiting to upload, Uploading, Uploaded, Failed (with retry).
- AC3: Sending the same report twice (retry after timeout) results in one report on the server.
- AC4: One report per user, per project, per date. A second attempt opens the existing report for editing.
- AC5: A report can be edited by its author until it is REVIEWED or 48 hours after the report date, whichever comes first.
- AC6: Photos are resized to at most 1600 px on the long edge before upload; up to 20 photos per report.
- AC7: The report records GPS position (if permission is granted) and the device time it was created. Missing GPS does not block submission.
- AC8: SITE_STAFF cannot read or write reports for projects they are not a member of (`403`).
- AC9: The report date can be today or up to 2 days back, never in the future.
- AC10: The site report PDF contains project details, date, weather, manpower table, work done, issues and a photo grid with captions. It contains no prices.

## 2. Design

### Tables

`DailyReport`, `DailyReportManpower`, `DailyReportPhoto`, optional `DailyReportProgress` - see `docs/02-data-model.md`.

### API

| Method | Route | Roles |
|---|---|---|
| GET | `/daily-reports?projectId=&from=&to=&submittedById=` | members; SITE_STAFF sees own project reports |
| GET | `/daily-reports/:id` | members |
| PUT | `/daily-reports/:id` | author; creates or updates (idempotent, ID from the phone) |
| POST | `/daily-reports/:id/review` | PROJECT_MANAGER, OFFICE, OWNER |
| GET | `/projects/:id/site-report.pdf?from=&to=` | PROJECT_MANAGER, OFFICE, OWNER |

Photos use `/files/presign` from spec 01, then are referenced by `fileId` in the `PUT` body.

### Mobile local storage (expo-sqlite)

```
local_report        id, projectId, reportDate, payload (json), syncState, lastError, updatedAt
local_photo         id, reportId, localUri, fileId (null until uploaded), caption, takenAt, uploadState
cached_project      id, payload (json), fetchedAt
```

`syncState`: DRAFT -> QUEUED -> SYNCING -> SYNCED | FAILED

### Sync worker

1. Triggered on app start, on connectivity regained, after submit, and by pull-to-refresh.
2. For each QUEUED report, oldest first:
   1. For each photo without `fileId`: presign, upload, store `fileId`. Resume from the first photo not yet uploaded.
   2. `PUT /daily-reports/:id` with the full payload.
   3. On 2xx mark SYNCED. On 4xx mark FAILED with the server message (no auto retry). On network error or 5xx keep QUEUED with backoff.
3. Only one sync run at a time.

### Mobile screens

- Project home: today's report status, "New report" button, recent reports
- Report form: date, weather chips, work done (multiline, voice dictation via keyboard), manpower rows (trade + headcount, remembers yesterday's trades), issues, tomorrow's plan, photos (camera or gallery, caption each)
- Report detail (read only once locked)
- Sync status banner and a "Pending uploads" list

Design for site conditions: large touch targets, works one-handed, high contrast for sunlight, few required fields (date, work done, at least one photo).

### Web screens

Daily report list per project with calendar view showing days with and without reports; report detail with photo viewer; review button; site report PDF export.

## 3. Tasks

- [ ] T01 Prisma models and migration
- [ ] T02 Zod schemas shared by API and mobile
- [ ] T03 `PUT /daily-reports/:id` idempotent upsert with edit-window and membership rules
- [ ] T04 List, detail and review endpoints
- [ ] T05 Site report PDF template and endpoint
- [ ] T06 e2e tests covering AC3, AC4, AC5, AC8, AC9
- [ ] T07 Mobile: SQLite schema and repository layer
- [ ] T08 Mobile: report form with draft autosave
- [ ] T09 Mobile: camera/gallery capture, resize and compress
- [ ] T10 Mobile: sync worker with resume, backoff and state reporting
- [ ] T11 Mobile: project home, history, pending uploads, sync banner
- [ ] T12 Mobile: GPS capture with graceful permission handling
- [ ] T13 Mobile: offline cache of projects and recent reports
- [ ] T14 Manual test pass in airplane mode and on a throttled connection
- [ ] T15 Web: report list, calendar, detail, review, PDF export
- [ ] T16 Internal distribution build (Android APK / TestFlight) and install guide for site staff

`````

---

## FILE: `specs/04-invoicing/spec.md`

`````md
# Spec 04 - Invoicing, Progress Claims and Payments

Status: REVIEW BEFORE BUILD - confirm retention and SST rules with the accountant first
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

- [ ] T01 Prisma models and migration
- [ ] T02 Convert accepted quotation to contract
- [ ] T03 Variation orders: CRUD, submit/approve/reject, contract item creation
- [ ] T04 `ClaimCalculator` with the AC12 unit test set
- [ ] T05 Simple invoices: CRUD, issue, void
- [ ] T06 Progress claims: create pre-filled draft, edit, validate, issue
- [ ] T07 Retention tracking and retention release invoices
- [ ] T08 Payments, allocations and automatic invoice status
- [ ] T09 Credit notes
- [ ] T10 PDF templates: simple invoice, progress claim, credit note
- [ ] T11 CSV/Excel exports
- [ ] T12 e2e tests covering AC1-AC11
- [ ] T13 Web: contract view and variation orders
- [ ] T14 Web: simple invoice editor
- [ ] T15 Web: progress claim editor with live totals
- [ ] T16 Web: invoice list, payments, credit notes, retention panel
- [ ] T17 Walk one real past project through the system and compare every figure with what was actually billed

`````

---

## FILE: `specs/05-reports/spec.md`

`````md
# Spec 05 - Reports and Dashboard

Status: DRAFT - refine after specs 02-04 are in use
Depends on: 02-quotations, 03-daily-reports, 04-invoicing

## 1. Requirements

### User stories

- As OWNER, I open the web app and see the state of the business at a glance.
- As OFFICE, I can see who owes money and how overdue it is.
- As OWNER or PROJECT_MANAGER, I can see each project's financial and site progress on one page.
- As OWNER, I can see which projects are missing daily reports.
- As OFFICE, I can export any report to Excel or PDF.

### Reports

| Report | Contents |
|---|---|
| Dashboard | Active projects, quotations awaiting reply, invoiced this month, received this month, total outstanding, total retention held, projects with no report yesterday |
| Project summary | Contract sum, approved variations, claimed to date, paid to date, outstanding, retention held, percent claimed, days with reports vs working days, latest photos |
| Receivables ageing | Outstanding per client in buckets: current, 1-30, 31-60, 61-90, 90+ days overdue |
| Quotation pipeline | Count and value by status, win rate, by month |
| Billing and collections | Invoiced vs received per month, 12 months |
| Retention register | Per project: held, released, balance, expected release dates |
| Daily report compliance | Per project and per site staff: reports submitted vs expected |

### Acceptance criteria

- AC1: Every figure on a report matches the sum of the underlying documents (tested with seeded data).
- AC2: Only ISSUED, PARTIALLY_PAID and PAID invoices count as billed. DRAFT and VOID never appear in totals.
- AC3: PROJECT_MANAGER sees only own projects. SITE_STAFF has no access to financial reports.
- AC4: The dashboard loads in under 2 seconds with 3 years of data at expected volume.
- AC5: Each report has date range and project/client filters where they make sense, and exports to Excel.

## 2. Design

### API

| Method | Route |
|---|---|
| GET | `/reports/dashboard` |
| GET | `/reports/projects/:id/summary` |
| GET | `/reports/receivables-ageing?asOf=` |
| GET | `/reports/quotation-pipeline?from=&to=` |
| GET | `/reports/billing-collections?from=&to=` |
| GET | `/reports/retention` |
| GET | `/reports/daily-report-compliance?from=&to=` |

Add `?format=xlsx` to any report route for an Excel export.

### Approach

- Read-only SQL queries (Prisma `$queryRaw` or database views) in a `ReportsModule`. No separate reporting database at this scale.
- Add indexes on `Invoice(status, issueDate)`, `Invoice(projectId)`, `PaymentAllocation(invoiceId)`, `DailyReport(projectId, reportDate)`.
- Working days for compliance: Monday to Saturday by default, configurable per project; public holidays ignored in the first version.
- Excel export with `exceljs`.

### Web screens

Dashboard (cards and two charts), one page per report with filters, table and export button; project detail gains a Summary tab.

## 3. Tasks

- [ ] T01 Seed data set with known expected totals for report tests
- [ ] T02 Dashboard endpoint and tests
- [ ] T03 Project summary endpoint and tests
- [ ] T04 Receivables ageing endpoint and tests
- [ ] T05 Quotation pipeline and billing/collections endpoints
- [ ] T06 Retention register endpoint
- [ ] T07 Daily report compliance endpoint
- [ ] T08 Excel export helper
- [ ] T09 Indexes and query timing check against AC4
- [ ] T10 Web: dashboard
- [ ] T11 Web: report pages with filters and export
- [ ] T12 Web: project summary tab

`````

---

## FILE: `specs/06-myinvois/spec.md`

`````md
# Spec 06 - MyInvois (LHDN E-Invoice)

Status: DRAFT - do not build until the points under "Verify first" are confirmed
Depends on: 04-invoicing

## Verify first

Everything in this spec about LHDN rules must be checked against the current
MyInvois SDK documentation (sdk.myinvois.hasil.gov.my) and with the company's
accountant before any code is written. The rules have changed several times.

- [ ] Is e-invoicing mandatory for the company at its revenue level, and from what date?
- [ ] Current document format version and whether a digital signature is required for it
- [ ] How to obtain API credentials (client ID / secret) from the MyInvois portal, and the sandbox equivalent
- [ ] Whether a digital certificate must be purchased, and from which certificate authority
- [ ] Correct classification codes, tax type codes and MSIC code for the company's services
- [ ] How progress claims and retention should be represented (invoice at claim time vs at certification)
- [ ] Cancellation window and the rules for credit notes after it closes
- [ ] Whether a middleware provider would be cheaper than direct integration for a solo developer

## 1. Requirements

### User stories

- As OFFICE, when I issue an invoice or credit note it is submitted to MyInvois without extra steps.
- As OFFICE, I can see the e-invoice status of every invoice and the reason if it was rejected.
- As OFFICE, the PDF I send the client carries the validation QR code once the invoice is validated.
- As OFFICE, I can cancel an e-invoice within the allowed window.
- As OWNER, I can turn e-invoicing on or off and enter credentials in company settings.

### Acceptance criteria

- AC1: With e-invoicing off, invoices behave exactly as in spec 04 and are marked `NOT_REQUIRED`.
- AC2: Issuing never fails because MyInvois is down. Submission is a background job with retry.
- AC3: An invoice missing mandatory e-invoice data (e.g. buyer TIN) is blocked at issue time with a list of what is missing.
- AC4: Status progresses PENDING -> SUBMITTED -> VALID or INVALID. INVALID shows LHDN's error messages and allows correction by credit note or void-and-reissue, per LHDN rules.
- AC5: The validated PDF includes the QR code and the LHDN unique identifier.
- AC6: Credentials and certificates are stored encrypted and never returned by the API.
- AC7: All requests and responses are logged (with secrets removed) for troubleshooting.

## 2. Design

### Approach

- `MyInvoisModule` with a client for: login (token cached until expiry), TIN validation, document submission, get submission/document status, cancel.
- `EInvoiceMapper` converts `Invoice` / `CreditNote` into the LHDN document format. Kept separate so a format version change touches one file.
- BullMQ jobs: `submit-document`, `poll-status`. Backoff on failure; alert the OWNER after repeated failure.
- New table `EInvoiceSubmission`: invoiceId or creditNoteId, submissionUid, documentUuid, status, requestPayload, responsePayload, errors, attempts, timestamps.
- Environment switch between sandbox and production base URLs.

### Data already captured in earlier specs

Company: TIN, SSM registration number, SST number, MSIC code, address.
Client: TIN, registration number, SST number, address.
Invoice line: classification code, tax percent, tax amount.
Invoice: `eInvoiceStatus`, `eInvoiceUuid`, `eInvoiceLongId`, `eInvoiceValidatedAt`.

## 3. Tasks

- [ ] T01 Complete the "Verify first" list and update this spec with the confirmed rules
- [ ] T02 Register for sandbox access and record the setup steps in `docs/`
- [ ] T03 `EInvoiceSubmission` model and migration; encrypted credential storage
- [ ] T04 MyInvois API client: auth, TIN validation
- [ ] T05 `EInvoiceMapper` for invoices, with fixtures validated against the sandbox
- [ ] T06 Document signing, if required for the current version
- [ ] T07 Submission and status-polling jobs with retry
- [ ] T08 Pre-issue validation of mandatory fields (AC3)
- [ ] T09 Credit note mapping and cancellation
- [ ] T10 QR code on validated PDFs
- [ ] T11 Web: e-invoice status column, detail panel with errors, settings page
- [ ] T12 End-to-end run in sandbox: invoice, progress claim, credit note, cancellation

`````

---

## FILE: `apps/api/prisma/schema.prisma`

`````prisma
// All specs (01 foundation, 02 quotations, 03 daily reports, 04 invoicing,
// 06 MyInvois). See docs/02-data-model.md.
// NOTE: written before Node.js was installed; run `prisma validate` and adjust
// the generator/datasource blocks to the installed Prisma version.
//
// Rules that Prisma cannot express and must be added as raw SQL in a migration
// (or enforced in the service layer):
//   - only one DRAFT progress claim per project (partial unique index on Invoice)
//   - EInvoiceSubmission has exactly one of invoiceId / creditNoteId (CHECK)
//   - ClaimLine.cumulativePercent between 0 and 100 (CHECK)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

enum Role {
  OWNER
  OFFICE
  PROJECT_MANAGER
  SITE_STAFF
}

enum ProjectStatus {
  DRAFT
  ACTIVE
  ON_HOLD
  COMPLETED
  CLOSED
}

enum FileStatus {
  PENDING
  READY
}

enum QuotationStatus {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
  SUPERSEDED
  EXPIRED
}

enum VariationStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

enum InvoiceType {
  SIMPLE
  PROGRESS_CLAIM
  RETENTION_RELEASE
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  VOID
}

enum DailyReportStatus {
  SUBMITTED
  REVIEWED
}

enum Weather {
  SUNNY
  CLOUDY
  RAIN
  HEAVY_RAIN
}

enum EInvoiceStatus {
  NOT_REQUIRED
  PENDING
  SUBMITTED
  VALID
  INVALID
  CANCELLED
}

// ---------------------------------------------------------------------------
// Spec 01 - Foundation
// ---------------------------------------------------------------------------

model User {
  id           String   @id @default(uuid(7)) @db.Uuid
  email        String   @unique
  passwordHash String
  name         String
  phone        String?
  role         Role
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  refreshTokens RefreshToken[]
  memberships   ProjectMember[]
  files         File[]
  auditLogs     AuditLog[]

  quotationsCreated      Quotation[]
  contractItemsCreated   ContractItem[]
  variationOrdersCreated VariationOrder[]
  invoicesCreated        Invoice[]
  creditNotesCreated     CreditNote[]
  paymentsCreated        Payment[]
  dailyReportsSubmitted  DailyReport[]    @relation("DailyReportSubmittedBy")
  dailyReportsReviewed   DailyReport[]    @relation("DailyReportReviewedBy")
}

model RefreshToken {
  id         String    @id @default(uuid(7)) @db.Uuid
  userId     String    @db.Uuid
  tokenHash  String    @unique
  deviceName String?
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// Failed logins, used for the 5-in-15-minutes lockout (AC1).
model LoginAttempt {
  id        String   @id @default(uuid(7)) @db.Uuid
  email     String
  success   Boolean
  ip        String?
  createdAt DateTime @default(now())

  @@index([email, createdAt])
}

// Single row. `singleton` is always true and unique, so a second row cannot exist.
model Company {
  id                         String   @id @default(uuid(7)) @db.Uuid
  singleton                  Boolean  @unique @default(true)
  name                       String
  registrationNo             String?
  tin                        String?
  sstNo                      String?
  msicCode                   String?
  address                    String?
  phone                      String?
  email                      String?
  logoFileId                 String?  @db.Uuid
  bankDetails                String?
  defaultPaymentTermDays     Int      @default(30)
  defaultRetentionPercent    Decimal  @default(10) @db.Decimal(5, 2)
  defaultRetentionCapPercent Decimal  @default(5) @db.Decimal(5, 2)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
}

model TaxRate {
  id        String   @id @default(uuid(7)) @db.Uuid
  name      String   @unique
  percent   Decimal  @db.Decimal(5, 2)
  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  quotationItems QuotationItem[]
}

model DocumentSequence {
  id         String   @id @default(uuid(7)) @db.Uuid
  docType    String
  year       Int
  lastNumber Int      @default(0)
  updatedAt  DateTime @updatedAt

  @@unique([docType, year])
}

model Client {
  id             String   @id @default(uuid(7)) @db.Uuid
  name           String
  registrationNo String?
  tin            String?
  sstNo          String?
  address        String?
  contactName    String?
  phone          String?
  email          String?  @unique
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  projects   Project[]
  quotations Quotation[]
  invoices   Invoice[]
  payments   Payment[]

  @@index([name])
}

model Project {
  id                     String        @id @default(uuid(7)) @db.Uuid
  code                   String        @unique
  name                   String
  clientId               String        @db.Uuid
  siteAddress            String?
  status                 ProjectStatus @default(DRAFT)
  startDate              DateTime?     @db.Date
  endDate                DateTime?     @db.Date
  contractSum            Decimal       @default(0) @db.Decimal(14, 2)
  retentionPercent       Decimal       @default(10) @db.Decimal(5, 2)
  retentionCapPercent    Decimal       @default(5) @db.Decimal(5, 2)
  defectsLiabilityMonths Int           @default(12)
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt

  client  Client          @relation(fields: [clientId], references: [id])
  members ProjectMember[]

  quotations      Quotation[]
  contractItems   ContractItem[]
  variationOrders VariationOrder[]
  invoices        Invoice[]
  dailyReports    DailyReport[]

  @@index([clientId])
  @@index([status])
}

model ProjectMember {
  id        String   @id @default(uuid(7)) @db.Uuid
  projectId String   @db.Uuid
  userId    String   @db.Uuid
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([userId])
}

model File {
  id           String     @id @default(uuid(7)) @db.Uuid
  bucketKey    String     @unique
  fileName     String
  mimeType     String
  size         Int
  purpose      String
  status       FileStatus @default(PENDING)
  uploadedById String     @db.Uuid
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  uploadedBy User @relation(fields: [uploadedById], references: [id])

  quotationPdfs     Quotation[]
  invoicePdfs       Invoice[]
  creditNotePdfs    CreditNote[]
  dailyReportPhotos DailyReportPhoto[]

  @@index([uploadedById])
}

model AuditLog {
  id       String   @id @default(uuid(7)) @db.Uuid
  userId   String?  @db.Uuid
  entity   String
  entityId String
  action   String
  before   Json?
  after    Json?
  at       DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([entity, entityId])
  @@index([at])
}

// ---------------------------------------------------------------------------
// Spec 02 - Quotations
// ---------------------------------------------------------------------------

// Revisions share `number` and `rootId`; `revisionNo` increases (0 = original).
// `rootId` is the id of the first revision. It is deliberately NOT a foreign
// key: the first revision points at itself, which would need the id to be known
// before insert and would block deleting a revision-0 draft.
model Quotation {
  id              String          @id @default(uuid(7)) @db.Uuid
  number          String
  rootId          String          @db.Uuid
  revisionNo      Int             @default(0)
  clientId        String          @db.Uuid
  projectId       String?         @db.Uuid
  title           String
  status          QuotationStatus @default(DRAFT)
  issueDate       DateTime        @db.Date
  validUntil      DateTime?       @db.Date
  terms           String?
  notes           String?
  rejectionReason String?
  subtotal        Decimal         @default(0) @db.Decimal(14, 2)
  discountAmount  Decimal         @default(0) @db.Decimal(14, 2)
  taxAmount       Decimal         @default(0) @db.Decimal(14, 2)
  total           Decimal         @default(0) @db.Decimal(14, 2)
  pdfFileId       String?         @db.Uuid
  createdById     String          @db.Uuid
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  client    Client   @relation(fields: [clientId], references: [id])
  project   Project? @relation(fields: [projectId], references: [id])
  pdfFile   File?    @relation(fields: [pdfFileId], references: [id])
  createdBy User     @relation(fields: [createdById], references: [id])

  sections QuotationSection[]
  items    QuotationItem[]

  @@unique([number, revisionNo])
  @@unique([rootId, revisionNo])
  @@index([clientId])
  @@index([projectId])
  @@index([status, issueDate])
  @@index([pdfFileId])
  @@index([createdById])
}

model QuotationSection {
  id          String   @id @default(uuid(7)) @db.Uuid
  quotationId String   @db.Uuid
  sortOrder   Int      @default(0)
  title       String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  quotation Quotation       @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  items     QuotationItem[]

  @@index([quotationId, sortOrder])
}

model QuotationItem {
  id          String   @id @default(uuid(7)) @db.Uuid
  quotationId String   @db.Uuid
  sectionId   String   @db.Uuid
  sortOrder   Int      @default(0)
  description String
  unit        String?
  quantity    Decimal  @db.Decimal(14, 3)
  rate        Decimal  @db.Decimal(14, 2)
  amount      Decimal  @db.Decimal(14, 2)
  taxRateId   String?  @db.Uuid
  // Snapshot of TaxRate.percent at the time the item was saved.
  taxPercent  Decimal  @default(0) @db.Decimal(5, 2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  quotation Quotation        @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  section   QuotationSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  taxRate   TaxRate?         @relation(fields: [taxRateId], references: [id])

  contractItems ContractItem[]

  @@index([quotationId])
  @@index([sectionId, sortOrder])
  @@index([taxRateId])
}

// ---------------------------------------------------------------------------
// Spec 04 - Contract and variations
// ---------------------------------------------------------------------------

// Copied from the accepted quotation (sourceQuotationItemId set) or appended
// when a variation order is approved (variationOrderId set). Quantity and
// amount can be negative for omissions.
model ContractItem {
  id                    String   @id @default(uuid(7)) @db.Uuid
  projectId             String   @db.Uuid
  sourceQuotationItemId String?  @db.Uuid
  variationOrderId      String?  @db.Uuid
  sectionTitle          String?
  sortOrder             Int      @default(0)
  description           String
  unit                  String?
  quantity              Decimal  @db.Decimal(14, 3)
  rate                  Decimal  @db.Decimal(14, 2)
  amount                Decimal  @db.Decimal(14, 2)
  taxPercent            Decimal  @default(0) @db.Decimal(5, 2)
  createdById           String   @db.Uuid
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  project             Project         @relation(fields: [projectId], references: [id])
  sourceQuotationItem QuotationItem?  @relation(fields: [sourceQuotationItemId], references: [id])
  variationOrder      VariationOrder? @relation(fields: [variationOrderId], references: [id])
  createdBy           User            @relation(fields: [createdById], references: [id])

  claimLines           ClaimLine[]
  dailyReportProgress  DailyReportProgress[]

  @@index([projectId, sortOrder])
  @@index([sourceQuotationItemId])
  @@index([variationOrderId])
  @@index([createdById])
}

model VariationOrder {
  id          String          @id @default(uuid(7)) @db.Uuid
  number      String          @unique
  projectId   String          @db.Uuid
  title       String
  reason      String?
  status      VariationStatus @default(DRAFT)
  approvedAt  DateTime?
  // Can be negative for omissions.
  total       Decimal         @default(0) @db.Decimal(14, 2)
  createdById String          @db.Uuid
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  project   Project @relation(fields: [projectId], references: [id])
  createdBy User    @relation(fields: [createdById], references: [id])

  items         VariationOrderItem[]
  contractItems ContractItem[]

  @@index([projectId, status])
  @@index([createdById])
}

model VariationOrderItem {
  id               String   @id @default(uuid(7)) @db.Uuid
  variationOrderId String   @db.Uuid
  sortOrder        Int      @default(0)
  description      String
  unit             String?
  quantity         Decimal  @db.Decimal(14, 3)
  rate             Decimal  @db.Decimal(14, 2)
  amount           Decimal  @db.Decimal(14, 2)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  variationOrder VariationOrder @relation(fields: [variationOrderId], references: [id], onDelete: Cascade)

  @@index([variationOrderId, sortOrder])
}

// ---------------------------------------------------------------------------
// Spec 04 - Invoicing, progress claims and payments
// ---------------------------------------------------------------------------

// `number`, `issueDate` and `dueDate` are null while DRAFT and set on issue
// (spec 04 AC6). The claim fields are only set for PROGRESS_CLAIM invoices.
// Buyer/supplier fields are a snapshot taken at issue (spec 04 AC11).
model Invoice {
  id                   String         @id @default(uuid(7)) @db.Uuid
  number               String?        @unique
  type                 InvoiceType
  projectId            String?        @db.Uuid
  clientId             String         @db.Uuid
  status               InvoiceStatus  @default(DRAFT)
  issueDate            DateTime?      @db.Date
  dueDate              DateTime?      @db.Date
  claimNo              Int?
  periodFrom           DateTime?      @db.Date
  periodTo             DateTime?      @db.Date
  grossToDate          Decimal?       @db.Decimal(14, 2)
  retentionToDate      Decimal?       @db.Decimal(14, 2)
  previousNetCertified Decimal?       @db.Decimal(14, 2)
  // Tax rate applied to the claim / release subtotal. Null for SIMPLE (per line).
  taxPercent           Decimal?       @db.Decimal(5, 2)
  subtotal             Decimal        @default(0) @db.Decimal(14, 2)
  taxAmount            Decimal        @default(0) @db.Decimal(14, 2)
  total                Decimal        @default(0) @db.Decimal(14, 2)
  amountPaid           Decimal        @default(0) @db.Decimal(14, 2)
  notes                String?
  pdfFileId            String?        @db.Uuid
  voidedAt             DateTime?
  voidReason           String?

  buyerName              String?
  buyerRegistrationNo    String?
  buyerTin               String?
  buyerSstNo             String?
  buyerAddress           String?
  supplierName           String?
  supplierRegistrationNo String?
  supplierTin            String?
  supplierSstNo          String?
  supplierMsicCode       String?
  supplierAddress        String?

  eInvoiceStatus      EInvoiceStatus @default(NOT_REQUIRED)
  eInvoiceUuid        String?
  eInvoiceLongId      String?
  eInvoiceValidatedAt DateTime?

  createdById String   @db.Uuid
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project   Project? @relation(fields: [projectId], references: [id])
  client    Client   @relation(fields: [clientId], references: [id])
  pdfFile   File?    @relation(fields: [pdfFileId], references: [id])
  createdBy User     @relation(fields: [createdById], references: [id])

  lines               InvoiceLine[]
  claimLines          ClaimLine[]
  creditNotes         CreditNote[]
  allocations         PaymentAllocation[]
  eInvoiceSubmissions EInvoiceSubmission[]

  // Claim numbers are consecutive per project (spec 04 AC5). Null claimNo
  // (non-claim invoices) does not collide in PostgreSQL.
  @@unique([projectId, claimNo])
  @@index([status, issueDate])
  @@index([projectId])
  @@index([clientId])
  @@index([type])
  @@index([pdfFileId])
  @@index([createdById])
}

model InvoiceLine {
  id                 String   @id @default(uuid(7)) @db.Uuid
  invoiceId          String   @db.Uuid
  sortOrder          Int      @default(0)
  description        String
  unit               String?
  quantity           Decimal  @db.Decimal(14, 3)
  rate               Decimal  @db.Decimal(14, 2)
  amount             Decimal  @db.Decimal(14, 2)
  taxPercent         Decimal  @default(0) @db.Decimal(5, 2)
  taxAmount          Decimal  @default(0) @db.Decimal(14, 2)
  classificationCode String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId, sortOrder])
}

// One row per contract item on a progress claim. All figures are cumulative
// except `thisClaimAmount` (= cumulativeAmount - previousAmount).
model ClaimLine {
  id                 String   @id @default(uuid(7)) @db.Uuid
  invoiceId          String   @db.Uuid
  contractItemId     String   @db.Uuid
  cumulativePercent  Decimal  @default(0) @db.Decimal(5, 2)
  cumulativeQuantity Decimal  @default(0) @db.Decimal(14, 3)
  cumulativeAmount   Decimal  @default(0) @db.Decimal(14, 2)
  previousAmount     Decimal  @default(0) @db.Decimal(14, 2)
  thisClaimAmount    Decimal  @default(0) @db.Decimal(14, 2)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  invoice      Invoice      @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  contractItem ContractItem @relation(fields: [contractItemId], references: [id])

  @@unique([invoiceId, contractItemId])
  @@index([contractItemId])
}

model CreditNote {
  id        String   @id @default(uuid(7)) @db.Uuid
  number    String   @unique
  invoiceId String   @db.Uuid
  issueDate DateTime @db.Date
  reason    String
  subtotal  Decimal  @db.Decimal(14, 2)
  taxAmount Decimal  @default(0) @db.Decimal(14, 2)
  total     Decimal  @db.Decimal(14, 2)
  pdfFileId String?  @db.Uuid

  eInvoiceStatus      EInvoiceStatus @default(NOT_REQUIRED)
  eInvoiceUuid        String?
  eInvoiceLongId      String?
  eInvoiceValidatedAt DateTime?

  createdById String   @db.Uuid
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  invoice   Invoice @relation(fields: [invoiceId], references: [id])
  pdfFile   File?   @relation(fields: [pdfFileId], references: [id])
  createdBy User    @relation(fields: [createdById], references: [id])

  eInvoiceSubmissions EInvoiceSubmission[]

  @@index([invoiceId])
  @@index([issueDate])
  @@index([pdfFileId])
  @@index([createdById])
}

model Payment {
  id           String   @id @default(uuid(7)) @db.Uuid
  clientId     String   @db.Uuid
  receivedDate DateTime @db.Date
  // Free text for now (e.g. BANK_TRANSFER, CHEQUE, CASH); no enum in the data model.
  method       String
  reference    String?
  amount       Decimal  @db.Decimal(14, 2)
  notes        String?
  createdById  String   @db.Uuid
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  client    Client @relation(fields: [clientId], references: [id])
  createdBy User   @relation(fields: [createdById], references: [id])

  allocations PaymentAllocation[]

  @@index([clientId])
  @@index([receivedDate])
  @@index([createdById])
}

model PaymentAllocation {
  id        String   @id @default(uuid(7)) @db.Uuid
  paymentId String   @db.Uuid
  invoiceId String   @db.Uuid
  amount    Decimal  @db.Decimal(14, 2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  invoice Invoice @relation(fields: [invoiceId], references: [id])

  @@unique([paymentId, invoiceId])
  @@index([invoiceId])
}

// ---------------------------------------------------------------------------
// Spec 03 - Daily site reports
// ---------------------------------------------------------------------------

// `id` has no default: the phone generates it so that a retried PUT is
// idempotent (spec 03 AC3). The unique constraint is AC4 and also serves as
// the (projectId, reportDate) index asked for by spec 05.
model DailyReport {
  id              String            @id @db.Uuid
  projectId       String            @db.Uuid
  reportDate      DateTime          @db.Date
  submittedById   String            @db.Uuid
  weather         Weather
  workDone        String
  issues          String?
  nextDayPlan     String?
  status          DailyReportStatus @default(SUBMITTED)
  reviewedById    String?           @db.Uuid
  reviewedAt      DateTime?
  latitude        Decimal?          @db.Decimal(9, 6)
  longitude       Decimal?          @db.Decimal(9, 6)
  deviceCreatedAt DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  project     Project @relation(fields: [projectId], references: [id])
  submittedBy User    @relation("DailyReportSubmittedBy", fields: [submittedById], references: [id])
  reviewedBy  User?   @relation("DailyReportReviewedBy", fields: [reviewedById], references: [id])

  manpower DailyReportManpower[]
  photos   DailyReportPhoto[]
  progress DailyReportProgress[]

  @@unique([projectId, reportDate, submittedById])
  @@index([submittedById, reportDate])
  @@index([reviewedById])
  @@index([status])
}

model DailyReportManpower {
  id            String   @id @default(uuid(7)) @db.Uuid
  dailyReportId String   @db.Uuid
  trade         String
  headcount     Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  dailyReport DailyReport @relation(fields: [dailyReportId], references: [id], onDelete: Cascade)

  @@unique([dailyReportId, trade])
}

model DailyReportPhoto {
  id            String    @id @default(uuid(7)) @db.Uuid
  dailyReportId String    @db.Uuid
  fileId        String    @db.Uuid
  caption       String?
  takenAt       DateTime?
  sortOrder     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  dailyReport DailyReport @relation(fields: [dailyReportId], references: [id], onDelete: Cascade)
  file        File        @relation(fields: [fileId], references: [id])

  @@unique([dailyReportId, fileId])
  @@index([dailyReportId, sortOrder])
  @@index([fileId])
}

// Optional. Site estimate, used as a hint when preparing progress claims.
model DailyReportProgress {
  id              String   @id @default(uuid(7)) @db.Uuid
  dailyReportId   String   @db.Uuid
  contractItemId  String   @db.Uuid
  percentComplete Decimal  @db.Decimal(5, 2)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  dailyReport  DailyReport  @relation(fields: [dailyReportId], references: [id], onDelete: Cascade)
  contractItem ContractItem @relation(fields: [contractItemId], references: [id])

  @@unique([dailyReportId, contractItemId])
  @@index([contractItemId])
}

// ---------------------------------------------------------------------------
// Spec 06 - MyInvois (spec is still DRAFT; expect this table to change)
// ---------------------------------------------------------------------------

// One row per submission attempt series for an invoice OR a credit note
// (exactly one of the two ids is set; enforce with a CHECK constraint).
// Payloads are stored with secrets removed (spec 06 AC7).
model EInvoiceSubmission {
  id              String         @id @default(uuid(7)) @db.Uuid
  invoiceId       String?        @db.Uuid
  creditNoteId    String?        @db.Uuid
  submissionUid   String?
  documentUuid    String?
  status          EInvoiceStatus @default(PENDING)
  requestPayload  Json?
  responsePayload Json?
  errors          Json?
  attempts        Int            @default(0)
  submittedAt     DateTime?
  validatedAt     DateTime?
  cancelledAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  invoice    Invoice?    @relation(fields: [invoiceId], references: [id])
  creditNote CreditNote? @relation(fields: [creditNoteId], references: [id])

  @@index([invoiceId])
  @@index([creditNoteId])
  @@index([status])
  @@index([submissionUid])
  @@index([documentUuid])
}

`````

---

## FILE: `docker-compose.yml`

`````yml
# Local development services only. Not for production.
# Start:  docker compose up -d
# Stop:   docker compose down        (add -v to also delete the data)

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-construction}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-construction}
      POSTGRES_DB: ${POSTGRES_DB:-construction}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # S3-compatible storage for photos and PDFs. Console: http://localhost:9001
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  # Creates the bucket on first start, then exits.
  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      until mc alias set local http://minio:9000 $${S3_ACCESS_KEY:-minioadmin} $${S3_SECRET_KEY:-minioadmin}; do sleep 1; done;
      mc mb --ignore-existing local/$${S3_BUCKET:-construction-dev};
      "
    environment:
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minioadmin}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-minioadmin}
      S3_BUCKET: ${S3_BUCKET:-construction-dev}

volumes:
  pgdata:
  miniodata:

`````

---

## FILE: `.env.example`

`````text
# Copy to .env and adjust. Values below are local development defaults only.

# --- Database ---
POSTGRES_USER=construction
POSTGRES_PASSWORD=construction
POSTGRES_DB=construction
DATABASE_URL=postgresql://construction:construction@localhost:5432/construction?schema=public

# --- API ---
API_PORT=3000
WEB_ORIGIN=http://localhost:5173
# Generate each with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30

# --- First OWNER user created by the seed script ---
SEED_OWNER_EMAIL=owner@example.com
SEED_OWNER_PASSWORD=change-me-before-seeding
SEED_OWNER_NAME=Owner

# --- File storage (S3 compatible; MinIO locally) ---
S3_ENDPOINT=http://localhost:9000
S3_REGION=ap-southeast-1
S3_BUCKET=construction-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# --- Redis (background jobs, used from spec 02 onward) ---
REDIS_URL=redis://localhost:6379

`````

---

## FILE: `pnpm-workspace.yaml`

`````yaml
packages:
  - "apps/*"
  - "packages/*"

`````

---

## FILE: `.gitignore`

`````text
node_modules/
dist/
build/
.turbo/
coverage/
*.tsbuildinfo

# env files - never commit real secrets
.env
.env.*
!.env.example

# Expo / React Native
.expo/
apps/mobile/android/
apps/mobile/ios/
*.apk
*.aab
*.ipa

# Prisma generated client
apps/api/src/generated/

# OS / editor
.DS_Store
Thumbs.db
.vscode/*
!.vscode/extensions.json
.idea/

# logs
*.log

`````

---

## FILE: `design/mockups/mockup.css`

`````css
/* Shared styles for the static mockups. Not production CSS. */
:root {
  --bg: #f4f5f7; --panel: #fff; --line: #e1e4ea; --text: #1d2433; --muted: #6b7385;
  --brand: #1f5fbf; --brand-soft: #e8f0fc; --ok: #1a7f4b; --ok-soft: #e3f5ea;
  --warn: #a96500; --warn-soft: #fff3d6; --bad: #b3261e; --bad-soft: #fde8e6;
  --grey-soft: #eceef2; --radius: 8px;
}
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.45 "Segoe UI", system-ui, sans-serif; color: var(--text); background: var(--bg); }
h1 { font-size: 20px; margin: 0; } h2 { font-size: 15px; margin: 0 0 10px; } h3 { font-size: 13px; margin: 0 0 6px; }
a { color: var(--brand); text-decoration: none; cursor: pointer; }
.muted { color: var(--muted); } .right { text-align: right; } .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.small { font-size: 12px; } .bold { font-weight: 600; }

/* layout */
.app { display: grid; grid-template-columns: 210px 1fr; min-height: 100vh; }
.side { background: #172033; color: #c9d1e3; padding: 14px 0; }
.side .logo { color: #fff; font-weight: 700; font-size: 16px; padding: 4px 18px 14px; }
.side a { display: block; color: inherit; padding: 9px 18px; border-left: 3px solid transparent; }
.side a:hover { background: #1f2b45; }
.side a.on { background: #1f2b45; color: #fff; border-left-color: #5b9bff; }
.side .grp { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #7f8aa3; padding: 14px 18px 4px; }
.main { padding: 20px 26px 40px; min-width: 0; }
.top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.top .sp { flex: 1; }
.screen { display: none; } .screen.on { display: block; }
.note { background: #fffbe6; border: 1px dashed #d9b84a; color: #6b5300; padding: 8px 12px; border-radius: var(--radius); font-size: 12px; margin-bottom: 14px; }

/* components */
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 14px; }
.grid { display: grid; gap: 14px; } .g2 { grid-template-columns: 1fr 1fr; } .g3 { grid-template-columns: repeat(3, 1fr); } .g4 { grid-template-columns: repeat(4, 1fr); }
.split { display: grid; grid-template-columns: 1fr 300px; gap: 14px; align-items: start; }
.stat .v { font-size: 22px; font-weight: 650; } .stat .l { color: var(--muted); font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 12px; color: var(--muted); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
td { padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
tr.sec td { background: var(--grey-soft); font-weight: 600; }
tr.tot td { font-weight: 650; border-top: 2px solid var(--line); }
.btn { display: inline-block; border: 1px solid var(--line); background: #fff; color: var(--text); padding: 7px 13px; border-radius: 6px; font: inherit; cursor: pointer; }
.btn.pri { background: var(--brand); border-color: var(--brand); color: #fff; }
.btn.sm { padding: 3px 9px; font-size: 12px; }
.pill { display: inline-block; padding: 2px 9px; border-radius: 99px; font-size: 12px; font-weight: 600; background: var(--grey-soft); color: #4a5266; white-space: nowrap; }
.pill.ok { background: var(--ok-soft); color: var(--ok); } .pill.warn { background: var(--warn-soft); color: var(--warn); }
.pill.bad { background: var(--bad-soft); color: var(--bad); } .pill.info { background: var(--brand-soft); color: var(--brand); }
input, select, textarea { font: inherit; padding: 6px 9px; border: 1px solid #c9ceda; border-radius: 6px; background: #fff; width: 100%; color: var(--text); }
td input { padding: 4px 6px; } input.n { text-align: right; }
label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 3px; }
.field { margin-bottom: 10px; }
.tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); margin-bottom: 14px; }
.tabs span { padding: 8px 14px; color: var(--muted); border-bottom: 2px solid transparent; }
.tabs span.on { color: var(--brand); border-bottom-color: var(--brand); font-weight: 600; }
.kv { display: flex; justify-content: space-between; padding: 5px 0; } .kv.big { font-size: 16px; font-weight: 650; border-top: 2px solid var(--line); margin-top: 6px; padding-top: 9px; }
.bar { height: 8px; background: var(--grey-soft); border-radius: 99px; overflow: hidden; } .bar i { display: block; height: 100%; background: var(--brand); }
.ph { background: linear-gradient(135deg, #cfd6e4, #aab4c8); border-radius: 6px; aspect-ratio: 4/3; display: flex; align-items: flex-end; color: #fff; font-size: 11px; padding: 4px 6px; }
.cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal div { border: 1px solid var(--line); border-radius: 6px; padding: 5px 6px; min-height: 46px; font-size: 12px; background: #fff; }
.cal .h { border: 0; min-height: 0; color: var(--muted); background: none; text-align: center; }
.cal .y { background: var(--ok-soft); border-color: #b9e2c8; } .cal .x { background: var(--bad-soft); border-color: #f3c1bc; } .cal .o { background: var(--grey-soft); color: var(--muted); }

`````

---

## FILE: `design/mockups/web.html`

`````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Office web app - mockup</title>
<link rel="stylesheet" href="mockup.css">
</head>
<body>
<div class="app">
  <nav class="side">
    <div class="logo">Construction System</div>
    <a data-s="dashboard" class="on">Dashboard</a>
    <div class="grp">Work</div>
    <a data-s="projects">Projects</a>
    <a data-s="project">&nbsp;&nbsp;Project detail</a>
    <a data-s="reports">Daily reports</a>
    <div class="grp">Sales</div>
    <a data-s="quotations">Quotations</a>
    <a data-s="quotation">&nbsp;&nbsp;Quotation editor</a>
    <div class="grp">Billing</div>
    <a data-s="invoices">Invoices</a>
    <a data-s="claim">&nbsp;&nbsp;Progress claim</a>
    <a data-s="payment">&nbsp;&nbsp;Record payment</a>
    <div class="grp">Setup</div>
    <a data-s="clients">Clients</a>
    <a data-s="users">Users</a>
    <a data-s="settings">Company settings</a>
  </nav>

  <main class="main">
    <div class="note">Static mockup with sample data. Use the left menu to move between screens; buttons and inputs do nothing. Company, client and project names are made up.</div>

    <!-- DASHBOARD -->
    <section class="screen on" id="dashboard">
      <div class="top"><h1>Dashboard</h1><span class="sp"></span><span class="muted">November 2026</span></div>
      <div class="grid g4">
        <div class="card stat"><div class="l">Active projects</div><div class="v">7</div></div>
        <div class="card stat"><div class="l">Quotations awaiting reply</div><div class="v">4 <span class="small muted">RM 612,400</span></div></div>
        <div class="card stat"><div class="l">Invoiced this month</div><div class="v">RM 184,650</div></div>
        <div class="card stat"><div class="l">Received this month</div><div class="v">RM 121,300</div></div>
      </div>
      <div class="grid g2">
        <div class="card"><h2>Outstanding by age</h2>
          <table>
            <tr><th>Client</th><th class="num">Current</th><th class="num">1-30</th><th class="num">31-60</th><th class="num">60+</th></tr>
            <tr><td>Syarikat ABC Sdn Bhd</td><td class="num">68,211.00</td><td class="num">-</td><td class="num">-</td><td class="num">-</td></tr>
            <tr><td>Maju Properties Sdn Bhd</td><td class="num">42,000.00</td><td class="num">31,800.00</td><td class="num">-</td><td class="num">-</td></tr>
            <tr><td>Encik Rahman</td><td class="num">-</td><td class="num"><span class="pill bad">12,500.00</span></td><td class="num">-</td><td class="num">-</td></tr>
            <tr class="tot"><td>Total RM 154,511.00</td><td class="num">110,211.00</td><td class="num">44,300.00</td><td class="num">-</td><td class="num">-</td></tr>
          </table>
        </div>
        <div class="card"><h2>No daily report yesterday</h2>
          <table>
            <tr><th>Project</th><th>Site staff</th><th>Last report</th></tr>
            <tr><td>P-2026-005 Taman Indah bungalow</td><td>Kumar</td><td><span class="pill bad">3 days ago</span></td></tr>
            <tr><td>P-2026-007 Warehouse roofing</td><td>Ah Seng</td><td><span class="pill warn">2 days ago</span></td></tr>
          </table>
          <h2 style="margin-top:16px">Retention held</h2>
          <div class="kv"><span>Across 5 projects</span><span class="bold">RM 48,920.00</span></div>
        </div>
      </div>
    </section>

    <!-- PROJECTS -->
    <section class="screen" id="projects">
      <div class="top"><h1>Projects</h1><span class="sp"></span><input style="width:220px" placeholder="Search code, name, client"><select style="width:130px"><option>Active</option><option>All</option></select><button class="btn pri">New project</button></div>
      <div class="card">
        <table>
          <tr><th>Code</th><th>Project</th><th>Client</th><th>Status</th><th class="num">Contract sum (RM)</th><th style="width:150px">Claimed</th><th>Last site report</th></tr>
          <tr><td><a data-s="project">P-2026-003</a></td><td>Shoplot renovation, Jalan Bunga</td><td>Syarikat ABC Sdn Bhd</td><td><span class="pill ok">Active</span></td><td class="num">362,000.00</td><td><div class="bar"><i style="width:45%"></i></div><span class="small muted">45%</span></td><td>Yesterday</td></tr>
          <tr><td>P-2026-005</td><td>Taman Indah bungalow</td><td>Encik Rahman</td><td><span class="pill ok">Active</span></td><td class="num">890,000.00</td><td><div class="bar"><i style="width:22%"></i></div><span class="small muted">22%</span></td><td><span class="pill bad">3 days ago</span></td></tr>
          <tr><td>P-2026-006</td><td>Office fit-out, Menara Satu L12</td><td>Maju Properties Sdn Bhd</td><td><span class="pill ok">Active</span></td><td class="num">245,500.00</td><td><div class="bar"><i style="width:78%"></i></div><span class="small muted">78%</span></td><td>Yesterday</td></tr>
          <tr><td>P-2026-007</td><td>Warehouse roofing</td><td>Maju Properties Sdn Bhd</td><td><span class="pill warn">On hold</span></td><td class="num">128,000.00</td><td><div class="bar"><i style="width:10%"></i></div><span class="small muted">10%</span></td><td><span class="pill warn">2 days ago</span></td></tr>
          <tr><td>P-2026-008</td><td>Clinic renovation</td><td>Klinik Sihat</td><td><span class="pill">Draft</span></td><td class="num">-</td><td>-</td><td>-</td></tr>
        </table>
      </div>
    </section>

    <!-- PROJECT DETAIL -->
    <section class="screen" id="project">
      <div class="top"><div><h1>P-2026-003 Shoplot renovation, Jalan Bunga</h1><span class="muted">Syarikat ABC Sdn Bhd &middot; 12 Jalan Bunga, 47000 Sungai Buloh</span></div><span class="sp"></span><span class="pill ok">Active</span><button class="btn">Edit</button></div>
      <div class="tabs"><span class="on">Summary</span><span>Contract</span><span>Variation orders (1)</span><span>Claims &amp; invoices (3)</span><span>Daily reports</span><span>Team (4)</span></div>
      <div class="grid g4">
        <div class="card stat"><div class="l">Current contract sum</div><div class="v">RM 362,000</div><div class="small muted">350,000 + VO 12,000</div></div>
        <div class="card stat"><div class="l">Work done to date</div><div class="v">RM 163,000</div><div class="bar"><i style="width:45%"></i></div></div>
        <div class="card stat"><div class="l">Retention held</div><div class="v">RM 16,300</div><div class="small muted">cap RM 18,100</div></div>
        <div class="card stat"><div class="l">Outstanding</div><div class="v">RM 68,211</div><div class="small muted">Claim 3, due 14 Dec</div></div>
      </div>
      <div class="grid g2">
        <div class="card"><h2>Contract progress</h2>
          <table>
            <tr><th>Section</th><th class="num">Amount (RM)</th><th class="num">Claimed</th><th class="num">Site says</th></tr>
            <tr><td>A Preliminaries</td><td class="num">18,000.00</td><td class="num">100%</td><td class="num">100%</td></tr>
            <tr><td>B Demolition &amp; site clearing</td><td class="num">24,500.00</td><td class="num">100%</td><td class="num">100%</td></tr>
            <tr><td>C Structural works</td><td class="num">96,000.00</td><td class="num">80%</td><td class="num">85%</td></tr>
            <tr><td>D Brickwork &amp; plastering</td><td class="num">58,000.00</td><td class="num">40%</td><td class="num">50%</td></tr>
            <tr><td>E M&amp;E works</td><td class="num">72,500.00</td><td class="num">20%</td><td class="num">20%</td></tr>
            <tr><td>F Finishes</td><td class="num">81,000.00</td><td class="num">0%</td><td class="num">0%</td></tr>
            <tr><td>VO-01 Additional partition wall</td><td class="num">12,000.00</td><td class="num">50%</td><td class="num">60%</td></tr>
          </table>
        </div>
        <div class="card"><h2>Latest site photos <a class="small" data-s="reports">View reports</a></h2>
          <div class="grid g3"><div class="ph">16 Nov - L1 columns</div><div class="ph">16 Nov - brickwall</div><div class="ph">15 Nov - conduit</div><div class="ph">15 Nov - staircase</div><div class="ph">14 Nov - rebar</div><div class="ph">14 Nov - delivery</div></div>
          <p class="small muted">Reports submitted: 38 of 41 working days</p>
        </div>
      </div>
    </section>

    <!-- DAILY REPORTS -->
    <section class="screen" id="reports">
      <div class="top"><h1>Daily reports</h1><span class="sp"></span><select style="width:280px"><option>P-2026-003 Shoplot renovation, Jalan Bunga</option></select><button class="btn">Site report PDF</button></div>
      <div class="split" style="grid-template-columns:340px 1fr">
        <div class="card"><h2>November 2026</h2>
          <div class="cal">
            <div class="h">M</div><div class="h">T</div><div class="h">W</div><div class="h">T</div><div class="h">F</div><div class="h">S</div><div class="h">S</div>
            <div class="o"></div><div class="o"></div><div class="o"></div><div class="o"></div><div class="o"></div><div class="o"></div><div class="o">1</div>
            <div class="y">2</div><div class="y">3</div><div class="y">4</div><div class="y">5</div><div class="y">6</div><div class="y">7</div><div class="o">8</div>
            <div class="y">9</div><div class="x">10</div><div class="y">11</div><div class="y">12</div><div class="y">13</div><div class="y">14</div><div class="o">15</div>
            <div class="y bold">16</div><div>17</div><div>18</div><div>19</div><div>20</div><div>21</div><div class="o">22</div>
          </div>
          <p class="small muted">Green: report received. Red: missing. Grey: non-working day.</p>
        </div>
        <div class="card">
          <div class="top" style="margin-bottom:8px"><h2 style="margin:0">Monday 16 Nov 2026</h2><span class="pill warn">Not reviewed</span><span class="sp"></span><button class="btn pri sm">Mark reviewed</button></div>
          <p class="small muted">Submitted by Kumar at 5:42 pm &middot; Cloudy &middot; GPS 3.2101, 101.5632 (on site)</p>
          <div class="grid g2">
            <div><h3>Work done</h3><p>Completed formwork and casting for L1 columns grid C-D. Brickwall at rear shop reached lintel level. Electrical conduit laid in ground-floor slab.</p>
              <h3>Issues / delays</h3><p>Sand delivery arrived 2 hours late; plastering team idle in the morning.</p>
              <h3>Plan for tomorrow</h3><p>Strip column formwork grid A-B. Continue brickwall front shop.</p></div>
            <div><h3>Manpower</h3>
              <table><tr><th>Trade</th><th class="num">Headcount</th></tr><tr><td>Carpenter</td><td class="num">4</td></tr><tr><td>Bricklayer</td><td class="num">5</td></tr><tr><td>Electrician</td><td class="num">2</td></tr><tr><td>General worker</td><td class="num">6</td></tr><tr class="tot"><td>Total</td><td class="num">17</td></tr></table></div>
          </div>
          <h3 style="margin-top:10px">Photos (6)</h3>
          <div class="grid g4"><div class="ph">L1 columns C-D</div><div class="ph">Rear brickwall</div><div class="ph">Slab conduit</div><div class="ph">Sand delivery</div></div>
        </div>
      </div>
    </section>

    <!-- QUOTATIONS -->
    <section class="screen" id="quotations">
      <div class="top"><h1>Quotations</h1><span class="sp"></span><input style="width:220px" placeholder="Search number, client, title"><select style="width:130px"><option>All statuses</option></select><button class="btn pri">New quotation</button></div>
      <div class="card">
        <table>
          <tr><th>Number</th><th>Client</th><th>Title</th><th>Date</th><th>Valid until</th><th class="num">Total (RM)</th><th>Status</th></tr>
          <tr><td><a data-s="quotation">QT-2026-0021</a></td><td>Klinik Sihat</td><td>Clinic renovation</td><td>12 Nov 2026</td><td>12 Dec 2026</td><td class="num">148,400.00</td><td><span class="pill">Draft</span></td></tr>
          <tr><td>QT-2026-0020 Rev 1</td><td>Maju Properties Sdn Bhd</td><td>Car park resurfacing</td><td>08 Nov 2026</td><td>08 Dec 2026</td><td class="num">96,500.00</td><td><span class="pill info">Sent</span></td></tr>
          <tr><td>QT-2026-0019</td><td>Encik Lim</td><td>Kitchen extension</td><td>02 Nov 2026</td><td>02 Dec 2026</td><td class="num">54,200.00</td><td><span class="pill info">Sent</span></td></tr>
          <tr><td>QT-2026-0014 Rev 2</td><td>Syarikat ABC Sdn Bhd</td><td>Shoplot renovation, Jalan Bunga</td><td>20 Aug 2026</td><td>19 Sep 2026</td><td class="num">371,000.00</td><td><span class="pill ok">Accepted</span></td></tr>
          <tr><td>QT-2026-0012</td><td>Puan Aminah</td><td>Roof repair</td><td>01 Aug 2026</td><td>31 Aug 2026</td><td class="num">18,900.00</td><td><span class="pill bad">Rejected</span></td></tr>
          <tr><td>QT-2026-0011</td><td>Encik Tan</td><td>Shop signage structure</td><td>28 Jul 2026</td><td>27 Aug 2026</td><td class="num">9,800.00</td><td><span class="pill warn">Expired</span></td></tr>
        </table>
      </div>
    </section>

    <!-- QUOTATION EDITOR -->
    <section class="screen" id="quotation">
      <div class="top"><div><h1>QT-2026-0021 <span class="pill">Draft</span></h1></div><span class="sp"></span><button class="btn">Duplicate</button><button class="btn">Preview PDF</button><button class="btn">Save draft</button><button class="btn pri">Send</button></div>
      <div class="split">
        <div>
          <div class="card grid g3" style="gap:10px">
            <div><label>Client</label><select><option>Klinik Sihat</option></select></div>
            <div><label>Issue date</label><input value="12 Nov 2026"></div>
            <div><label>Valid until</label><input value="12 Dec 2026"></div>
            <div style="grid-column:1/-1"><label>Title</label><input value="Clinic renovation at Lot 8, Jalan Sihat"></div>
          </div>
          <div class="card">
            <table>
              <tr><th style="width:26px"></th><th>Description</th><th style="width:70px">Unit</th><th style="width:90px" class="num">Qty</th><th style="width:110px" class="num">Rate (RM)</th><th style="width:120px" class="num">Amount (RM)</th><th style="width:26px"></th></tr>
              <tr class="sec"><td>&#8942;</td><td colspan="4"><input value="A. Demolition"></td><td class="num">12,400.00</td><td>&times;</td></tr>
              <tr><td class="muted">&#8942;</td><td><input value="Remove existing partitions and ceiling"></td><td><input value="m2"></td><td><input class="n" value="180.000"></td><td><input class="n" value="40.00"></td><td class="num">7,200.00</td><td class="muted">&times;</td></tr>
              <tr><td class="muted">&#8942;</td><td><input value="Debris disposal"></td><td><input value="trip"></td><td><input class="n" value="8.000"></td><td><input class="n" value="650.00"></td><td class="num">5,200.00</td><td class="muted">&times;</td></tr>
              <tr><td></td><td colspan="6"><a class="small">+ Add item</a></td></tr>
              <tr class="sec"><td>&#8942;</td><td colspan="4"><input value="B. Partition and ceiling"></td><td class="num">61,600.00</td><td>&times;</td></tr>
              <tr><td class="muted">&#8942;</td><td><input value="Drywall partition, 75mm stud, both sides"></td><td><input value="m2"></td><td><input class="n" value="320.000"></td><td><input class="n" value="130.00"></td><td class="num">41,600.00</td><td class="muted">&times;</td></tr>
              <tr><td class="muted">&#8942;</td><td><input value="Suspended ceiling, 600x600 mineral fibre"></td><td><input value="m2"></td><td><input class="n" value="250.000"></td><td><input class="n" value="80.00"></td><td class="num">20,000.00</td><td class="muted">&times;</td></tr>
              <tr><td></td><td colspan="6"><a class="small">+ Add item</a></td></tr>
              <tr class="sec"><td>&#8942;</td><td colspan="4"><input value="C. Electrical and plumbing"></td><td class="num">66,000.00</td><td>&times;</td></tr>
              <tr><td class="muted">&#8942;</td><td><input value="Electrical wiring, DB and fittings"></td><td><input value="LS"></td><td><input class="n" value="1.000"></td><td><input class="n" value="38,000.00"></td><td class="num">38,000.00</td><td class="muted">&times;</td></tr>
              <tr><td class="muted">&#8942;</td><td><input value="Plumbing and sanitary, 4 treatment rooms"></td><td><input value="LS"></td><td><input class="n" value="1.000"></td><td><input class="n" value="28,000.00"></td><td class="num">28,000.00</td><td class="muted">&times;</td></tr>
              <tr><td></td><td colspan="6"><a class="small">+ Add item</a> &nbsp; <a class="small">+ Add section</a></td></tr>
            </table>
          </div>
          <div class="card"><label>Terms and conditions</label><textarea rows="3">1. Payment by progress claim, 30 days from invoice date.
2. 10% retention, limit 5% of contract sum.
3. Prices exclude authority submission fees.</textarea></div>
        </div>
        <div class="card" style="position:sticky;top:14px"><h2>Totals</h2>
          <div class="kv"><span>Subtotal</span><span class="num">140,000.00</span></div>
          <div class="kv"><span>Discount</span><span style="width:110px"><input class="n" value="0.00"></span></div>
          <div class="kv"><span>Tax</span><span style="width:110px"><select><option>SST 6%</option><option>No tax</option></select></span></div>
          <div class="kv"><span class="muted">Tax amount</span><span class="num">8,400.00</span></div>
          <div class="kv big"><span>Total (RM)</span><span class="num">148,400.00</span></div>
          <p class="small muted">Totals update as you type. The server recalculates on save.</p>
          <h2 style="margin-top:14px">Revisions</h2><p class="small muted">Rev 0 (this draft)</p>
        </div>
      </div>
    </section>

    <!-- INVOICES -->
    <section class="screen" id="invoices">
      <div class="top"><h1>Invoices</h1><span class="sp"></span><input style="width:200px" placeholder="Search"><select style="width:150px"><option>Unpaid</option><option>All</option></select><button class="btn">Export Excel</button><button class="btn">New progress claim</button><button class="btn pri">New invoice</button></div>
      <div class="card">
        <table>
          <tr><th>Number</th><th>Type</th><th>Client / project</th><th>Issued</th><th>Due</th><th class="num">Total (RM)</th><th class="num">Balance (RM)</th><th>Status</th><th>e-Invoice</th></tr>
          <tr><td>-</td><td>Claim 4</td><td>Maju Properties &middot; P-2026-006</td><td>-</td><td>-</td><td class="num">38,160.00</td><td class="num">-</td><td><span class="pill">Draft</span></td><td>-</td></tr>
          <tr><td><a data-s="claim">PC-2026-0031</a></td><td>Claim 3</td><td>Syarikat ABC &middot; P-2026-003</td><td>14 Nov 2026</td><td>14 Dec 2026</td><td class="num">68,211.00</td><td class="num">68,211.00</td><td><span class="pill info">Issued</span></td><td><span class="pill ok">Valid</span></td></tr>
          <tr><td>PC-2026-0029</td><td>Claim 2</td><td>Maju Properties &middot; P-2026-007</td><td>02 Nov 2026</td><td>02 Dec 2026</td><td class="num">42,000.00</td><td class="num">42,000.00</td><td><span class="pill info">Issued</span></td><td><span class="pill ok">Valid</span></td></tr>
          <tr><td>PC-2026-0026</td><td>Claim 3</td><td>Maju Properties &middot; P-2026-006</td><td>10 Oct 2026</td><td>09 Nov 2026</td><td class="num">61,800.00</td><td class="num"><span class="pill warn">31,800.00</span></td><td><span class="pill warn">Part paid</span></td><td><span class="pill ok">Valid</span></td></tr>
          <tr><td>INV-2026-0044</td><td>Invoice</td><td>Encik Rahman</td><td>18 Sep 2026</td><td>18 Oct 2026</td><td class="num">12,500.00</td><td class="num"><span class="pill bad">12,500.00</span></td><td><span class="pill bad">Overdue 30 d</span></td><td><span class="pill ok">Valid</span></td></tr>
          <tr><td>PC-2026-0022</td><td>Claim 2</td><td>Syarikat ABC &middot; P-2026-003</td><td>12 Oct 2026</td><td>11 Nov 2026</td><td class="num">46,746.00</td><td class="num">0.00</td><td><span class="pill ok">Paid</span></td><td><span class="pill ok">Valid</span></td></tr>
        </table>
      </div>
    </section>

    <!-- PROGRESS CLAIM -->
    <section class="screen" id="claim">
      <div class="top"><div><h1>Progress claim 3 <span class="pill">Draft view</span></h1><span class="muted">P-2026-003 Shoplot renovation &middot; Syarikat ABC Sdn Bhd</span></div><span class="sp"></span><button class="btn">Preview PDF</button><button class="btn">Save draft</button><button class="btn pri">Issue claim</button></div>
      <div class="split">
        <div class="card">
          <div class="grid g3" style="gap:10px;margin-bottom:12px"><div><label>Work done from</label><input value="13 Oct 2026"></div><div><label>to</label><input value="13 Nov 2026"></div><div><label>Claim date</label><input value="14 Nov 2026"></div></div>
          <table>
            <tr><th>Item</th><th class="num">Contract (RM)</th><th class="num">Previous %</th><th class="num">Site says</th><th style="width:80px" class="num">To date %</th><th class="num">To date (RM)</th><th class="num">This claim (RM)</th></tr>
            <tr><td>A Preliminaries</td><td class="num">18,000.00</td><td class="num">100</td><td class="num muted">100</td><td><input class="n" value="100" disabled></td><td class="num">18,000.00</td><td class="num">-</td></tr>
            <tr><td>B Demolition &amp; site clearing</td><td class="num">24,500.00</td><td class="num">100</td><td class="num muted">100</td><td><input class="n" value="100" disabled></td><td class="num">24,500.00</td><td class="num">-</td></tr>
            <tr><td>C Structural works</td><td class="num">96,000.00</td><td class="num">45</td><td class="num muted">85</td><td><input class="n" value="80"></td><td class="num">76,800.00</td><td class="num">33,600.00</td></tr>
            <tr><td>D Brickwork &amp; plastering</td><td class="num">58,000.00</td><td class="num">10</td><td class="num muted">50</td><td><input class="n" value="40"></td><td class="num">23,200.00</td><td class="num">17,400.00</td></tr>
            <tr><td>E M&amp;E works</td><td class="num">72,500.00</td><td class="num">0</td><td class="num muted">20</td><td><input class="n" value="20"></td><td class="num">14,500.00</td><td class="num">14,500.00</td></tr>
            <tr><td>F Finishes</td><td class="num">81,000.00</td><td class="num">0</td><td class="num muted">0</td><td><input class="n" value="0"></td><td class="num">-</td><td class="num">-</td></tr>
            <tr class="sec"><td colspan="7">Variation orders</td></tr>
            <tr><td>VO-01 Additional partition wall</td><td class="num">12,000.00</td><td class="num">0</td><td class="num muted">60</td><td><input class="n" value="50"></td><td class="num">6,000.00</td><td class="num">6,000.00</td></tr>
            <tr class="tot"><td>Total</td><td class="num">362,000.00</td><td></td><td></td><td class="num">45.0</td><td class="num">163,000.00</td><td class="num">71,500.00</td></tr>
          </table>
          <p class="small muted">"Site says" is the latest percentage reported from the mobile app, shown as a guide only. Sections are shown here; the real screen expands to individual items.</p>
        </div>
        <div class="card" style="position:sticky;top:14px"><h2>This claim</h2>
          <div class="kv"><span>Work done to date</span><span class="num">163,000.00</span></div>
          <div class="kv"><span>Less retention 10%</span><span class="num">(16,300.00)</span></div>
          <div class="kv small muted"><span>Retention limit (5%)</span><span class="num">18,100.00</span></div>
          <div class="kv"><span>Net to date</span><span class="num">146,700.00</span></div>
          <div class="kv"><span>Less previously claimed</span><span class="num">(82,350.00)</span></div>
          <div class="kv bold"><span>Amount this claim</span><span class="num">64,350.00</span></div>
          <div class="kv"><span>SST 6%</span><span class="num">3,861.00</span></div>
          <div class="kv big"><span>Amount due (RM)</span><span class="num">68,211.00</span></div>
        </div>
      </div>
    </section>

    <!-- PAYMENT -->
    <section class="screen" id="payment">
      <div class="top"><h1>Record payment</h1></div>
      <div class="card" style="max-width:820px">
        <div class="grid g4" style="gap:10px">
          <div><label>Client</label><select><option>Maju Properties Sdn Bhd</option></select></div>
          <div><label>Date received</label><input value="17 Nov 2026"></div>
          <div><label>Method</label><select><option>Bank transfer</option><option>Cheque</option><option>Cash</option></select></div>
          <div><label>Amount (RM)</label><input class="n" value="50,000.00"></div>
          <div style="grid-column:1/-1"><label>Reference</label><input value="IBG 20261117-88213"></div>
        </div>
        <h2 style="margin-top:14px">Apply to invoices</h2>
        <table>
          <tr><th>Invoice</th><th>Due</th><th class="num">Balance (RM)</th><th style="width:140px" class="num">Apply (RM)</th></tr>
          <tr><td>PC-2026-0026 &middot; P-2026-006 Claim 3</td><td><span class="pill warn">09 Nov 2026</span></td><td class="num">31,800.00</td><td><input class="n" value="31,800.00"></td></tr>
          <tr><td>PC-2026-0029 &middot; P-2026-007 Claim 2</td><td>02 Dec 2026</td><td class="num">42,000.00</td><td><input class="n" value="18,200.00"></td></tr>
          <tr class="tot"><td colspan="3">Applied 50,000.00 of 50,000.00</td><td class="num"><span class="pill ok">Fully applied</span></td></tr>
        </table>
        <p class="right" style="margin:14px 0 0"><button class="btn">Cancel</button> <button class="btn pri">Save payment</button></p>
      </div>
    </section>

    <!-- CLIENTS -->
    <section class="screen" id="clients">
      <div class="top"><h1>Clients</h1><span class="sp"></span><input style="width:220px" placeholder="Search"><button class="btn pri">New client</button></div>
      <div class="card">
        <table>
          <tr><th>Name</th><th>Registration no.</th><th>TIN</th><th>Contact</th><th>Phone</th><th class="num">Projects</th><th class="num">Outstanding (RM)</th></tr>
          <tr><td>Syarikat ABC Sdn Bhd</td><td>202001012345</td><td>C1234567890</td><td>Puan Siti</td><td>012-000 0001</td><td class="num">1</td><td class="num">68,211.00</td></tr>
          <tr><td>Maju Properties Sdn Bhd</td><td>201501054321</td><td>C9876543210</td><td>Mr Wong</td><td>012-000 0002</td><td class="num">2</td><td class="num">73,800.00</td></tr>
          <tr><td>Encik Rahman</td><td>-</td><td><span class="pill warn">Missing</span></td><td>Encik Rahman</td><td>012-000 0003</td><td class="num">1</td><td class="num">12,500.00</td></tr>
          <tr><td>Klinik Sihat</td><td>202203067890</td><td>C5556667770</td><td>Dr Lee</td><td>012-000 0004</td><td class="num">0</td><td class="num">-</td></tr>
        </table>
        <p class="small muted">"Missing" TIN is flagged because it will be needed for e-invoicing.</p>
      </div>
    </section>

    <!-- USERS -->
    <section class="screen" id="users">
      <div class="top"><h1>Users</h1><span class="sp"></span><button class="btn pri">New user</button></div>
      <div class="card">
        <table>
          <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Projects</th><th>Status</th><th></th></tr>
          <tr><td>Owner</td><td>owner@example.com</td><td>012-000 0010</td><td><span class="pill info">Owner</span></td><td>All</td><td><span class="pill ok">Active</span></td><td><a>Edit</a></td></tr>
          <tr><td>Mei Ling</td><td>meiling@example.com</td><td>012-000 0011</td><td><span class="pill">Office</span></td><td>All</td><td><span class="pill ok">Active</span></td><td><a>Edit</a></td></tr>
          <tr><td>Faizal</td><td>faizal@example.com</td><td>012-000 0012</td><td><span class="pill">Project manager</span></td><td>P-2026-003, P-2026-005</td><td><span class="pill ok">Active</span></td><td><a>Edit</a></td></tr>
          <tr><td>Kumar</td><td>kumar@example.com</td><td>012-000 0013</td><td><span class="pill">Site staff</span></td><td>P-2026-003, P-2026-005</td><td><span class="pill ok">Active</span></td><td><a>Edit</a></td></tr>
          <tr><td>Ah Seng</td><td>ahseng@example.com</td><td>012-000 0014</td><td><span class="pill">Site staff</span></td><td>P-2026-007</td><td><span class="pill">Deactivated</span></td><td><a>Edit</a></td></tr>
        </table>
      </div>
    </section>

    <!-- SETTINGS -->
    <section class="screen" id="settings">
      <div class="top"><h1>Company settings</h1><span class="sp"></span><button class="btn pri">Save</button></div>
      <div class="grid g2">
        <div class="card"><h2>Company details (shown on documents)</h2>
          <div class="field"><label>Company name</label><input value="Contoh Bina Sdn Bhd"></div>
          <div class="grid g2" style="gap:10px"><div class="field"><label>SSM registration no.</label><input value="201901000001"></div><div class="field"><label>TIN</label><input value="C0000000001"></div><div class="field"><label>SST registration no.</label><input value=""></div><div class="field"><label>MSIC code</label><input value=""></div></div>
          <div class="field"><label>Address</label><textarea rows="2">1 Jalan Contoh, 47000 Sungai Buloh, Selangor</textarea></div>
          <div class="field"><label>Bank details (printed on invoices)</label><textarea rows="2">Bank name, account name, account number</textarea></div>
          <div class="field"><label>Logo</label><button class="btn sm">Upload</button></div>
        </div>
        <div>
          <div class="card"><h2>Defaults for new projects</h2>
            <div class="grid g3" style="gap:10px"><div><label>Payment term (days)</label><input class="n" value="30"></div><div><label>Retention %</label><input class="n" value="10.00"></div><div><label>Retention limit %</label><input class="n" value="5.00"></div></div>
          </div>
          <div class="card"><h2>Tax rates</h2>
            <table><tr><th>Name</th><th class="num">Percent</th><th>Default</th><th>Active</th></tr><tr><td>SST 6%</td><td class="num">6.00</td><td>Yes</td><td>Yes</td></tr><tr><td>No tax</td><td class="num">0.00</td><td>-</td><td>Yes</td></tr></table>
            <p class="small muted">Sample rates only. Confirm the correct rate with your accountant.</p>
          </div>
          <div class="card"><h2>E-invoice (MyInvois)</h2><p class="muted">Off. Turn on and enter credentials once spec 06 is built.</p></div>
        </div>
      </div>
    </section>
  </main>
</div>
<script>
  // Screen switching for the mockup only.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-s]');
    if (!a) return;
    var id = a.getAttribute('data-s');
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('on', s.id === id); });
    document.querySelectorAll('.side a').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-s') === id); });
    window.scrollTo(0, 0);
  });
</script>
</body>
</html>

`````

---

## FILE: `design/mockups/mobile.html`

`````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mobile app - mockup</title>
<link rel="stylesheet" href="mockup.css">
<style>
  body { padding: 20px 24px 40px; }
  .phones { display: flex; flex-wrap: wrap; gap: 26px; }
  .col h2 { margin: 0 0 2px; } .col p { margin: 0 0 8px; max-width: 300px; }
  .phone { width: 300px; height: 620px; background: #f4f5f7; border: 9px solid #1b1f2a; border-radius: 30px; overflow: hidden; display: flex; flex-direction: column; font-size: 15px; }
  .bar-top { background: var(--brand); color: #fff; padding: 12px 14px; font-weight: 600; display: flex; gap: 8px; align-items: center; }
  .bar-top .sp { flex: 1; } .bar-top small { font-weight: 400; opacity: .85; }
  .body { flex: 1; overflow: auto; padding: 12px; }
  .foot { padding: 10px 12px; background: #fff; border-top: 1px solid var(--line); }
  .big { display: block; width: 100%; text-align: center; padding: 13px; border-radius: 10px; background: var(--brand); color: #fff; font-weight: 600; font-size: 16px; border: 0; }
  .big.ghost { background: #fff; color: var(--brand); border: 1px solid var(--brand); }
  .item { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 11px 12px; margin-bottom: 9px; }
  .item .t { font-weight: 600; } .row { display: flex; align-items: center; gap: 8px; } .row .sp { flex: 1; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; } .chip { padding: 8px 12px; border-radius: 99px; border: 1px solid #c9ceda; background: #fff; }
  .chip.on { background: var(--brand); border-color: var(--brand); color: #fff; }
  .banner { padding: 7px 12px; font-size: 13px; background: var(--warn-soft); color: var(--warn); }
  .banner.off { background: #3b4254; color: #fff; }
  .lbl { font-size: 12px; color: var(--muted); margin: 12px 0 4px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .phone textarea, .phone input { font-size: 15px; padding: 10px; }
  .thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .add { border: 2px dashed #b4bccd; border-radius: 6px; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 22px; background: #fff; }
  .step { width: 34px; height: 34px; border-radius: 8px; border: 1px solid #c9ceda; background: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; }
</style>
</head>
<body>
<h1>Mobile app for site staff</h1>
<p class="note" style="max-width:900px;margin-top:10px">Static mockup. Six screens shown side by side. Designed for use on site: large buttons, few required fields (work done and at least one photo), no prices anywhere, and everything works without signal.</p>

<div class="phones">

  <div class="col"><h2>1. Login</h2><p class="small muted">Stays signed in on the device.</p>
    <div class="phone">
      <div class="body" style="display:flex;flex-direction:column;justify-content:center;padding:24px">
        <div style="text-align:center;font-size:20px;font-weight:700;margin-bottom:4px">Contoh Bina</div>
        <div class="muted" style="text-align:center;margin-bottom:26px">Site reports</div>
        <div class="field"><label>Email</label><input value="kumar@example.com"></div>
        <div class="field"><label>Password</label><input type="password" value="xxxxxxxx"></div>
        <button class="big" style="margin-top:8px">Log in</button>
        <p class="small muted" style="text-align:center">Forgot password? Contact the office.</p>
      </div>
    </div>
  </div>

  <div class="col"><h2>2. My projects</h2><p class="small muted">Only projects the user is assigned to.</p>
    <div class="phone">
      <div class="bar-top">My projects<span class="sp"></span><small>Kumar</small></div>
      <div class="banner">1 report waiting to upload</div>
      <div class="body">
        <div class="item"><div class="row"><span class="t">Shoplot renovation</span><span class="sp"></span><span class="pill warn">Today: not done</span></div><div class="small muted">P-2026-003 &middot; Jalan Bunga, Sungai Buloh</div></div>
        <div class="item"><div class="row"><span class="t">Taman Indah bungalow</span><span class="sp"></span><span class="pill ok">Today: sent</span></div><div class="small muted">P-2026-005 &middot; Taman Indah, Rawang</div></div>
        <p class="small muted" style="text-align:center;margin-top:20px">Pull down to refresh</p>
      </div>
    </div>
  </div>

  <div class="col"><h2>3. Project home</h2><p class="small muted">One obvious action: today's report.</p>
    <div class="phone">
      <div class="bar-top">&larr; Shoplot renovation</div>
      <div class="body">
        <div class="item" style="text-align:center"><div class="muted small">Tuesday 17 Nov 2026</div><div class="t" style="margin:6px 0 10px">No report for today yet</div><button class="big">New daily report</button></div>
        <div class="lbl">Recent reports</div>
        <div class="item row"><div><div class="t">Mon 16 Nov</div><div class="small muted">17 workers &middot; 6 photos</div></div><span class="sp"></span><span class="pill ok">Uploaded</span></div>
        <div class="item row"><div><div class="t">Sat 14 Nov</div><div class="small muted">15 workers &middot; 4 photos</div></div><span class="sp"></span><span class="pill info">Reviewed</span></div>
        <div class="item row"><div><div class="t">Fri 13 Nov</div><div class="small muted">16 workers &middot; 8 photos</div></div><span class="sp"></span><span class="pill info">Reviewed</span></div>
        <div class="lbl">Site</div>
        <div class="item small">12 Jalan Bunga, 47000 Sungai Buloh<br><span class="muted">Project manager: Faizal, 012-000 0012</span></div>
      </div>
    </div>
  </div>

  <div class="col"><h2>4. New daily report</h2><p class="small muted">Saves as you type. Manpower remembers yesterday's trades.</p>
    <div class="phone">
      <div class="bar-top">&larr; Daily report<span class="sp"></span><small>Draft saved</small></div>
      <div class="banner off">No signal - report will upload later</div>
      <div class="body">
        <div class="lbl" style="margin-top:0">Date</div>
        <div class="chips"><span class="chip on">Today 17 Nov</span><span class="chip">Yesterday</span><span class="chip">15 Nov</span></div>
        <div class="lbl">Weather</div>
        <div class="chips"><span class="chip">Sunny</span><span class="chip on">Cloudy</span><span class="chip">Rain</span><span class="chip">Heavy rain</span></div>
        <div class="lbl">Photos * (3)</div>
        <div class="thumbs"><div class="ph">Formwork</div><div class="ph">Front wall</div><div class="ph">Rebar</div><div class="add">+</div></div>
        <div class="lbl">Work done today *</div>
        <textarea rows="3">Stripped column formwork grid A-B. Brickwall front shop to 1.5 m.</textarea>
        <div class="lbl">Manpower</div>
        <div class="item row" style="padding:7px 10px"><span>Carpenter</span><span class="sp"></span><span class="step">&minus;</span><b style="width:22px;text-align:center">4</b><span class="step">+</span></div>
        <div class="item row" style="padding:7px 10px"><span>Bricklayer</span><span class="sp"></span><span class="step">&minus;</span><b style="width:22px;text-align:center">5</b><span class="step">+</span></div>
        <div class="item row" style="padding:7px 10px"><span>General worker</span><span class="sp"></span><span class="step">&minus;</span><b style="width:22px;text-align:center">6</b><span class="step">+</span></div>
        <a class="small">+ Add trade</a>
        <div class="lbl">Issues or delays</div>
        <textarea rows="2" placeholder="Optional"></textarea>
        <div class="lbl">Plan for tomorrow</div>
        <textarea rows="2" placeholder="Optional"></textarea>
      </div>
      <div class="foot"><button class="big">Submit report</button></div>
    </div>
  </div>

  <div class="col"><h2>5. Report sent / detail</h2><p class="small muted">Can be edited until reviewed or 48 hours pass.</p>
    <div class="phone">
      <div class="bar-top">&larr; Mon 16 Nov<span class="sp"></span><small>Edit</small></div>
      <div class="body">
        <div class="row"><span class="pill ok">Uploaded 5:42 pm</span><span class="pill">Cloudy</span><span class="pill">17 workers</span></div>
        <div class="lbl">Photos (6)</div>
        <div class="thumbs"><div class="ph">L1 columns</div><div class="ph">Rear wall</div><div class="ph">Conduit</div><div class="ph">Sand</div><div class="ph">Staircase</div><div class="ph">Rebar</div></div>
        <div class="lbl">Work done</div>
        <div class="item">Completed formwork and casting for L1 columns grid C-D. Brickwall at rear shop reached lintel level. Electrical conduit laid in ground-floor slab.</div>
        <div class="lbl">Issues or delays</div>
        <div class="item">Sand delivery arrived 2 hours late; plastering team idle in the morning.</div>
        <div class="lbl">Manpower</div>
        <div class="item small">Carpenter 4 &middot; Bricklayer 5 &middot; Electrician 2 &middot; General worker 6</div>
      </div>
    </div>
  </div>

  <div class="col"><h2>6. Pending uploads</h2><p class="small muted">Shows exactly what has and has not reached the office.</p>
    <div class="phone">
      <div class="bar-top">&larr; Pending uploads</div>
      <div class="body">
        <div class="item"><div class="row"><span class="t">Shoplot &middot; Tue 17 Nov</span><span class="sp"></span><span class="pill warn">Uploading</span></div><div class="small muted" style="margin:6px 0">Photo 2 of 3</div><div class="bar"><i style="width:55%"></i></div></div>
        <div class="item"><div class="row"><span class="t">Bungalow &middot; Sat 14 Nov</span><span class="sp"></span><span class="pill bad">Failed</span></div><div class="small muted" style="margin:6px 0">Report date is more than 2 days old. Contact the office.</div><button class="big ghost" style="padding:9px">Retry</button></div>
        <p class="small muted" style="text-align:center;margin-top:18px">Uploads continue automatically when there is signal. Reports stay on this phone until they are uploaded.</p>
      </div>
      <div class="foot"><button class="big ghost">Upload now</button></div>
    </div>
  </div>

</div>
</body>
</html>

`````

---

## FILE: `design/documents/document.css`

`````css
/* A4 document layouts. These become the real PDF templates (rendered by the API). */
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #d9dce3; font: 10.5pt/1.4 "Segoe UI", Arial, sans-serif; color: #1a1f2b; }
.page { width: 210mm; min-height: 297mm; margin: 10mm auto; padding: 14mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.2); position: relative; }
@media print { body { background: #fff; } .page { margin: 0; box-shadow: none; padding: 0; width: auto; min-height: 0; } .hint { display: none; } }
.hint { max-width: 210mm; margin: 8mm auto -4mm; font-size: 9.5pt; color: #6b5300; background: #fffbe6; border: 1px dashed #d9b84a; padding: 6px 10px; border-radius: 6px; }
.head { display: flex; justify-content: space-between; gap: 10mm; border-bottom: 2px solid #1f5fbf; padding-bottom: 5mm; }
.logo { width: 22mm; height: 22mm; background: #e8f0fc; color: #1f5fbf; display: flex; align-items: center; justify-content: center; font-weight: 700; border-radius: 3mm; font-size: 9pt; }
.co { display: flex; gap: 4mm; } .co b { font-size: 13pt; } .co div { font-size: 9pt; color: #4a5266; }
.title { text-align: right; } .title h1 { margin: 0; font-size: 18pt; letter-spacing: .04em; color: #1f5fbf; } .title div { font-size: 9.5pt; }
.meta { display: flex; justify-content: space-between; gap: 10mm; margin: 6mm 0; }
.meta h3 { margin: 0 0 1mm; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #6b7385; }
.meta table { border-collapse: collapse; } .meta td { padding: .6mm 0; } .meta td:first-child { color: #6b7385; padding-right: 5mm; }
table.items { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
table.items th { background: #1f5fbf; color: #fff; text-align: left; padding: 2mm 2.2mm; font-weight: 600; font-size: 8.5pt; }
table.items td { padding: 1.8mm 2.2mm; border-bottom: .2mm solid #dfe3ea; vertical-align: top; }
table.items tr.sec td { background: #eef1f6; font-weight: 600; }
table.items tr.tot td { font-weight: 700; border-top: .5mm solid #1a1f2b; border-bottom: 0; }
.num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sum { margin-left: auto; width: 82mm; margin-top: 4mm; border-collapse: collapse; }
.sum td { padding: 1.3mm 2.2mm; } .sum tr.grand td { font-weight: 700; font-size: 12pt; border-top: .5mm solid #1a1f2b; background: #e8f0fc; }
.sum tr.line td { border-top: .2mm solid #b9c0cf; font-weight: 600; }
.block { margin-top: 7mm; font-size: 9.5pt; } .block h3 { margin: 0 0 1.5mm; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #6b7385; }
.block ol { margin: 0; padding-left: 5mm; }
.sign { display: flex; justify-content: space-between; gap: 14mm; margin-top: 16mm; font-size: 9.5pt; }
.sign div { flex: 1; border-top: .3mm solid #1a1f2b; padding-top: 1.5mm; }
.foot { position: absolute; left: 14mm; right: 14mm; bottom: 8mm; font-size: 8pt; color: #6b7385; display: flex; justify-content: space-between; border-top: .2mm solid #dfe3ea; padding-top: 2mm; }
@media print { .foot { position: fixed; left: 0; right: 0; bottom: 0; } }
.photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.photos figure { margin: 0; } .photos .ph { background: linear-gradient(135deg, #cfd6e4, #aab4c8); aspect-ratio: 4/3; border-radius: 1.5mm; }
.photos figcaption { font-size: 8.5pt; color: #4a5266; margin-top: 1mm; }
.cols { display: grid; grid-template-columns: 1fr 62mm; gap: 8mm; }
.qr { width: 24mm; height: 24mm; border: .3mm dashed #9aa3b5; display: flex; align-items: center; justify-content: center; font-size: 7pt; color: #6b7385; text-align: center; }

`````

---

## FILE: `design/documents/quotation.html`

`````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Quotation layout</title>
<link rel="stylesheet" href="document.css">
</head>
<body>
<div class="hint">Proposed quotation layout with sample data. Press Ctrl+P to see it as it would print. A simple invoice uses the same layout with the title "INVOICE", a due date, bank details and no signature block.</div>
<div class="page">
  <div class="head">
    <div class="co"><div class="logo">LOGO</div><div><b>Contoh Bina Sdn Bhd</b><br>Reg. No. 201901000001 &middot; TIN C0000000001<br>1 Jalan Contoh, 47000 Sungai Buloh, Selangor<br>Tel 03-0000 0000 &middot; office@example.com</div></div>
    <div class="title"><h1>QUOTATION</h1><div><b>QT-2026-0014</b> Rev 2</div></div>
  </div>

  <div class="meta">
    <div><h3>To</h3><b>Syarikat ABC Sdn Bhd</b><br>Reg. No. 202001012345<br>88 Jalan Niaga, 47000 Sungai Buloh, Selangor<br>Attn: Puan Siti &middot; 012-000 0001</div>
    <table>
      <tr><td>Date</td><td>20 Aug 2026</td></tr>
      <tr><td>Valid until</td><td>19 Sep 2026</td></tr>
      <tr><td>Prepared by</td><td>Mei Ling</td></tr>
    </table>
  </div>

  <p><b>Project:</b> Renovation of 2-storey shoplot at 12 Jalan Bunga, 47000 Sungai Buloh</p>

  <table class="items">
    <tr><th style="width:9mm">No.</th><th>Description</th><th style="width:14mm">Unit</th><th class="num" style="width:20mm">Qty</th><th class="num" style="width:24mm">Rate (RM)</th><th class="num" style="width:28mm">Amount (RM)</th></tr>
    <tr class="sec"><td>A</td><td colspan="4">Preliminaries</td><td class="num">18,000.00</td></tr>
    <tr><td>A1</td><td>Mobilisation and site setup</td><td>LS</td><td class="num">1</td><td class="num">10,000.00</td><td class="num">10,000.00</td></tr>
    <tr><td>A2</td><td>Hoarding and safety provisions</td><td>LS</td><td class="num">1</td><td class="num">8,000.00</td><td class="num">8,000.00</td></tr>
    <tr class="sec"><td>B</td><td colspan="4">Demolition and site clearing</td><td class="num">24,500.00</td></tr>
    <tr><td>B1</td><td>Demolish existing partitions</td><td>m&sup2;</td><td class="num">350</td><td class="num">40.00</td><td class="num">14,000.00</td></tr>
    <tr><td>B2</td><td>Debris disposal</td><td>trip</td><td class="num">15</td><td class="num">700.00</td><td class="num">10,500.00</td></tr>
    <tr class="sec"><td>C</td><td colspan="4">Structural works</td><td class="num">96,000.00</td></tr>
    <tr><td>C1</td><td>Reinforced concrete beams and columns</td><td>m&sup3;</td><td class="num">60</td><td class="num">1,100.00</td><td class="num">66,000.00</td></tr>
    <tr><td>C2</td><td>Steel staircase, supply and install</td><td>no.</td><td class="num">1</td><td class="num">30,000.00</td><td class="num">30,000.00</td></tr>
    <tr class="sec"><td>D</td><td colspan="4">Brickwork and plastering</td><td class="num">58,000.00</td></tr>
    <tr><td>D1</td><td>115 mm brickwall</td><td>m&sup2;</td><td class="num">800</td><td class="num">45.00</td><td class="num">36,000.00</td></tr>
    <tr><td>D2</td><td>Cement plastering, both sides</td><td>m&sup2;</td><td class="num">1,100</td><td class="num">20.00</td><td class="num">22,000.00</td></tr>
    <tr class="sec"><td>E</td><td colspan="4">Mechanical and electrical works</td><td class="num">72,500.00</td></tr>
    <tr><td>E1</td><td>Electrical wiring, distribution board and fittings</td><td>LS</td><td class="num">1</td><td class="num">42,500.00</td><td class="num">42,500.00</td></tr>
    <tr><td>E2</td><td>Plumbing and sanitary works</td><td>LS</td><td class="num">1</td><td class="num">30,000.00</td><td class="num">30,000.00</td></tr>
    <tr class="sec"><td>F</td><td colspan="4">Finishes</td><td class="num">81,000.00</td></tr>
    <tr><td>F1</td><td>Floor tiling, 600 x 600 porcelain</td><td>m&sup2;</td><td class="num">600</td><td class="num">85.00</td><td class="num">51,000.00</td></tr>
    <tr><td>F2</td><td>Painting, internal and external</td><td>m&sup2;</td><td class="num">1,500</td><td class="num">12.00</td><td class="num">18,000.00</td></tr>
    <tr><td>F3</td><td>Suspended ceiling</td><td>m&sup2;</td><td class="num">300</td><td class="num">40.00</td><td class="num">12,000.00</td></tr>
  </table>

  <table class="sum">
    <tr><td>Subtotal</td><td class="num">350,000.00</td></tr>
    <tr><td>SST 6%</td><td class="num">21,000.00</td></tr>
    <tr class="grand"><td>Total (RM)</td><td class="num">371,000.00</td></tr>
  </table>

  <div class="block"><h3>Terms and conditions</h3>
    <ol>
      <li>Payment by monthly progress claim, due 30 days from invoice date.</li>
      <li>Retention of 10% of each claim, limited to 5% of the contract sum; half released at practical completion and half at the end of the 12-month defects liability period.</li>
      <li>Work outside this quotation will be priced as a variation order and agreed in writing before it starts.</li>
      <li>This quotation is valid until the date shown above.</li>
    </ol>
  </div>

  <div class="sign">
    <div>For Contoh Bina Sdn Bhd<br><br><br>Name:<br>Date:</div>
    <div>Accepted by (client signature and company stamp)<br><br><br>Name:<br>Date:</div>
  </div>

  <div class="foot"><span>QT-2026-0014 Rev 2</span><span>Page 1 of 1</span></div>
</div>
</body>
</html>

`````

---

## FILE: `design/documents/progress-claim.html`

`````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Progress claim layout</title>
<link rel="stylesheet" href="document.css">
</head>
<body>
<div class="hint">Proposed progress claim / invoice layout with sample data (claim 3 of the same project as the quotation sample). The tax rate and retention terms are examples to confirm with your accountant. The QR box is filled only after MyInvois validation.</div>
<div class="page">
  <div class="head">
    <div class="co"><div class="logo">LOGO</div><div><b>Contoh Bina Sdn Bhd</b><br>Reg. No. 201901000001 &middot; TIN C0000000001<br>1 Jalan Contoh, 47000 Sungai Buloh, Selangor<br>Tel 03-0000 0000 &middot; office@example.com</div></div>
    <div class="title"><h1>PROGRESS CLAIM</h1><div><b>PC-2026-0031</b> &middot; Claim No. 3</div></div>
  </div>

  <div class="meta">
    <div><h3>Bill to</h3><b>Syarikat ABC Sdn Bhd</b><br>Reg. No. 202001012345 &middot; TIN C1234567890<br>88 Jalan Niaga, 47000 Sungai Buloh, Selangor<br>Attn: Puan Siti</div>
    <table>
      <tr><td>Date</td><td>14 Nov 2026</td></tr>
      <tr><td>Due date</td><td>14 Dec 2026</td></tr>
      <tr><td>Work done</td><td>13 Oct - 13 Nov 2026</td></tr>
      <tr><td>Project</td><td>P-2026-003</td></tr>
    </table>
  </div>

  <p><b>Project:</b> Renovation of 2-storey shoplot at 12 Jalan Bunga, 47000 Sungai Buloh</p>

  <table class="items">
    <tr><th style="width:8mm">No.</th><th>Description</th><th class="num">Contract (RM)</th><th class="num">Previous (RM)</th><th class="num">This claim (RM)</th><th class="num">To date (RM)</th><th class="num" style="width:12mm">%</th></tr>
    <tr><td>A</td><td>Preliminaries</td><td class="num">18,000.00</td><td class="num">18,000.00</td><td class="num">-</td><td class="num">18,000.00</td><td class="num">100</td></tr>
    <tr><td>B</td><td>Demolition and site clearing</td><td class="num">24,500.00</td><td class="num">24,500.00</td><td class="num">-</td><td class="num">24,500.00</td><td class="num">100</td></tr>
    <tr><td>C</td><td>Structural works</td><td class="num">96,000.00</td><td class="num">43,200.00</td><td class="num">33,600.00</td><td class="num">76,800.00</td><td class="num">80</td></tr>
    <tr><td>D</td><td>Brickwork and plastering</td><td class="num">58,000.00</td><td class="num">5,800.00</td><td class="num">17,400.00</td><td class="num">23,200.00</td><td class="num">40</td></tr>
    <tr><td>E</td><td>Mechanical and electrical works</td><td class="num">72,500.00</td><td class="num">-</td><td class="num">14,500.00</td><td class="num">14,500.00</td><td class="num">20</td></tr>
    <tr><td>F</td><td>Finishes</td><td class="num">81,000.00</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">0</td></tr>
    <tr class="sec"><td></td><td colspan="6">Variation orders</td></tr>
    <tr><td>VO-01</td><td>Additional partition wall, first floor</td><td class="num">12,000.00</td><td class="num">-</td><td class="num">6,000.00</td><td class="num">6,000.00</td><td class="num">50</td></tr>
    <tr class="tot"><td></td><td>Total</td><td class="num">362,000.00</td><td class="num">91,500.00</td><td class="num">71,500.00</td><td class="num">163,000.00</td><td class="num">45</td></tr>
  </table>

  <table class="sum" style="width:100mm">
    <tr><td>Value of work done to date</td><td class="num">163,000.00</td></tr>
    <tr><td>Less retention 10% (limit RM 18,100.00)</td><td class="num">(16,300.00)</td></tr>
    <tr class="line"><td>Net value to date</td><td class="num">146,700.00</td></tr>
    <tr><td>Less previously claimed (Claims 1-2)</td><td class="num">(82,350.00)</td></tr>
    <tr class="line"><td>Amount this claim</td><td class="num">64,350.00</td></tr>
    <tr><td>SST 6%</td><td class="num">3,861.00</td></tr>
    <tr class="grand"><td>Amount due (RM)</td><td class="num">68,211.00</td></tr>
  </table>

  <div class="cols" style="margin-top:7mm">
    <div class="block" style="margin-top:0"><h3>Payment</h3>
      Please pay by 14 Dec 2026 to:<br>
      <b>Contoh Bina Sdn Bhd</b><br>Bank name &middot; Account no. 0000 0000 0000<br>
      Quote reference PC-2026-0031 with your payment.
      <h3 style="margin-top:4mm">Retention summary</h3>
      Held to date RM 16,300.00 &middot; Released RM 0.00 &middot; Balance held RM 16,300.00
    </div>
    <div style="display:flex;gap:3mm;align-items:flex-start;justify-content:flex-end">
      <div style="font-size:8pt;color:#6b7385;text-align:right">e-Invoice<br>validated by LHDN<br>ID shown here</div>
      <div class="qr">QR code<br>after validation</div>
    </div>
  </div>

  <div class="sign">
    <div>Prepared by<br><br><br>Name:<br>Date:</div>
    <div>Certified by (client or consultant)<br><br><br>Name:<br>Date:</div>
  </div>

  <div class="foot"><span>PC-2026-0031 &middot; P-2026-003 Claim No. 3</span><span>Page 1 of 1</span></div>
</div>
</body>
</html>

`````

---

## FILE: `design/documents/site-report.html`

`````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Daily site report layout</title>
<link rel="stylesheet" href="document.css">
</head>
<body>
<div class="hint">Proposed daily site report layout with sample data. It is built from what site staff submit on the phone and never shows prices. A weekly report repeats this block per day, with a manpower summary first.</div>
<div class="page">
  <div class="head">
    <div class="co"><div class="logo">LOGO</div><div><b>Contoh Bina Sdn Bhd</b><br>1 Jalan Contoh, 47000 Sungai Buloh, Selangor<br>Tel 03-0000 0000 &middot; office@example.com</div></div>
    <div class="title"><h1>DAILY SITE REPORT</h1><div><b>Monday, 16 Nov 2026</b></div></div>
  </div>

  <div class="meta">
    <div><h3>Project</h3><b>P-2026-003 Shoplot renovation, Jalan Bunga</b><br>12 Jalan Bunga, 47000 Sungai Buloh<br>Client: Syarikat ABC Sdn Bhd</div>
    <table>
      <tr><td>Weather</td><td>Cloudy</td></tr>
      <tr><td>Reported by</td><td>Kumar (site supervisor)</td></tr>
      <tr><td>Reviewed by</td><td>Faizal (project manager)</td></tr>
      <tr><td>Day</td><td>39 of contract period</td></tr>
    </table>
  </div>

  <div class="cols">
    <div>
      <div class="block" style="margin-top:0"><h3>Work done</h3>Completed formwork and casting for L1 columns grid C-D. Brickwall at rear shop reached lintel level. Electrical conduit laid in ground-floor slab.</div>
      <div class="block"><h3>Issues and delays</h3>Sand delivery arrived 2 hours late; plastering team idle in the morning.</div>
      <div class="block"><h3>Plan for next working day</h3>Strip column formwork grid A-B. Continue brickwall front shop.</div>
    </div>
    <div>
      <table class="items">
        <tr><th>Manpower</th><th class="num">No.</th></tr>
        <tr><td>Carpenter</td><td class="num">4</td></tr>
        <tr><td>Bricklayer</td><td class="num">5</td></tr>
        <tr><td>Electrician</td><td class="num">2</td></tr>
        <tr><td>General worker</td><td class="num">6</td></tr>
        <tr class="tot"><td>Total</td><td class="num">17</td></tr>
      </table>
    </div>
  </div>

  <div class="block"><h3>Site photos</h3>
    <div class="photos">
      <figure><div class="ph"></div><figcaption>L1 columns grid C-D after casting &middot; 11:20 am</figcaption></figure>
      <figure><div class="ph"></div><figcaption>Rear shop brickwall at lintel level &middot; 2:05 pm</figcaption></figure>
      <figure><div class="ph"></div><figcaption>Conduit in ground-floor slab &middot; 3:30 pm</figcaption></figure>
      <figure><div class="ph"></div><figcaption>Late sand delivery &middot; 10:10 am</figcaption></figure>
      <figure><div class="ph"></div><figcaption>Steel staircase stringers delivered &middot; 4:15 pm</figcaption></figure>
      <figure><div class="ph"></div><figcaption>Rebar for L1 beams &middot; 4:40 pm</figcaption></figure>
    </div>
  </div>

  <div class="foot"><span>P-2026-003 &middot; Daily site report 16 Nov 2026</span><span>Page 1 of 1</span></div>
</div>
</body>
</html>

`````

---

## FILE: `docs/api/openapi.yaml`

`````yaml
openapi: 3.1.0
info:
  title: Construction System API
  version: 1.0.0
  description: |
    REST API for a Malaysian construction business: quotations, invoices and progress
    claims, daily site reports from the mobile app, and reports.

    Conventions (see docs/01-architecture.md):

    - Base path is `/api/v1`.
    - All ids are UUID v7. The mobile app generates the id of a daily report.
    - Money is sent as a decimal string with 2 places (`"1234.50"`), quantities as a
      decimal string with up to 3 places, percentages as a decimal string with up to 2 places.
      Currency is always MYR.
    - Business dates (`issueDate`, `reportDate`, ...) are `date` values interpreted as
      Asia/Kuala_Lumpur. Timestamps are UTC `date-time`.
    - Errors use `{ statusCode, code, message, details? }` where `code` is a stable string.
    - Lists accept `page`, `pageSize`, `sort`, `q` and return `{ items, total, page, pageSize }`.
    - Fields marked `readOnly` are calculated by the server. If a client sends them they are ignored.
    - Price fields are stripped from responses for SITE_STAFF by the serializer.

    Vendor extensions:

    - `x-roles` lists the roles allowed to call an operation. An empty array means the
      operation is public. PROJECT_MANAGER and SITE_STAFF are additionally limited to
      projects they are a member of; OWNER and OFFICE always pass the membership check.
    - `x-error-codes` maps the stable error `code` values an operation can return to the
      HTTP status and the reason.

    Error codes common to all operations and not repeated per operation:
    `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_PROJECT_MEMBER` (403),
    `NOT_FOUND` (404), `VALIDATION_ERROR` (422).
servers:
  - url: /api/v1
    description: Same origin, versioned base path
security:
  - bearerAuth: []
tags:
  - name: Auth
    description: Login, token refresh, logout, password change
  - name: Users
    description: User administration (OWNER)
  - name: Company
    description: Company settings and tax rates
  - name: Clients
    description: Client master data
  - name: Projects
    description: Projects, members and the project contract
  - name: Files
    description: Presigned upload and download
  - name: Quotations
    description: Quotations with sections, items, revisions and PDF
  - name: DailyReports
    description: Daily site reports from the mobile app
  - name: VariationOrders
    description: Variation orders (additions and omissions)
  - name: Invoices
    description: Simple invoices, progress claims, retention releases, credit notes
  - name: Payments
    description: Payments received and their allocation to invoices
  - name: Reports
    description: Dashboard and reports

paths:
  # ---------------------------------------------------------------- Auth
  /auth/login:
    post:
      tags: [Auth]
      operationId: login
      summary: Log in with email and password
      security: []
      x-roles: []
      x-error-codes:
        INVALID_CREDENTIALS: 401 - wrong email or password, or the user is deactivated
        LOGIN_LOCKED: 429 - 5 failures in 15 minutes, attempts for this email are locked for 15 minutes
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Access token (15 minutes), refresh token and the current user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
        '429':
          $ref: '#/components/responses/TooManyRequests'
  /auth/refresh:
    post:
      tags: [Auth]
      operationId: refreshToken
      summary: Exchange a refresh token for a new token pair
      description: The refresh token is rotated. The old refresh token is invalid after this call.
      security: []
      x-roles: []
      x-error-codes:
        INVALID_REFRESH_TOKEN: 401 - token unknown, expired, revoked, already used, or the user is deactivated
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RefreshRequest'
      responses:
        '200':
          description: New token pair
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenPair'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /auth/logout:
    post:
      tags: [Auth]
      operationId: logout
      summary: Revoke the refresh token of this device
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LogoutRequest'
      responses:
        '204':
          description: Logged out. Also returned when the token was already revoked.
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /auth/me:
    get:
      tags: [Auth]
      operationId: getCurrentUser
      summary: Get the logged-in user
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      responses:
        '200':
          description: The current user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'
  /auth/change-password:
    post:
      tags: [Auth]
      operationId: changePassword
      summary: Change own password
      description: All other refresh tokens of the user are revoked.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      x-error-codes:
        CURRENT_PASSWORD_INCORRECT: 422 - currentPassword does not match
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChangePasswordRequest'
      responses:
        '204':
          description: Password changed
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

  # ---------------------------------------------------------------- Users
  /users:
    get:
      tags: [Users]
      operationId: listUsers
      summary: List users
      x-roles: [OWNER]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - name: role
          in: query
          schema:
            $ref: '#/components/schemas/Role'
        - name: isActive
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Page of users
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      tags: [Users]
      operationId: createUser
      summary: Create a user and assign a role
      x-roles: [OWNER]
      x-error-codes:
        USER_EMAIL_TAKEN: 409 - another user already has this email
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserCreate'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /users/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Users]
      operationId: getUser
      summary: Get a user
      x-roles: [OWNER]
      responses:
        '200':
          description: The user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    patch:
      tags: [Users]
      operationId: updateUser
      summary: Update or deactivate a user
      description: Setting `isActive` to false revokes all refresh tokens of the user. Users are never deleted.
      x-roles: [OWNER]
      x-error-codes:
        USER_EMAIL_TAKEN: 409 - another user already has this email
        CANNOT_DEACTIVATE_SELF: 409 - an OWNER cannot deactivate or demote their own account
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserUpdate'
      responses:
        '200':
          description: Updated user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

  # ---------------------------------------------------------------- Company
  /company:
    get:
      tags: [Company]
      operationId: getCompany
      summary: Get company settings
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      responses:
        '200':
          description: The single company row
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Company'
        '401':
          $ref: '#/components/responses/Unauthorized'
    patch:
      tags: [Company]
      operationId: updateCompany
      summary: Update company settings
      x-roles: [OWNER]
      x-error-codes:
        FILE_NOT_UPLOADED: 422 - logoFileId does not reference an uploaded file
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CompanyUpdate'
      responses:
        '200':
          description: Updated company settings
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Company'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /tax-rates:
    get:
      tags: [Company]
      operationId: listTaxRates
      summary: List tax rates
      x-roles: [OWNER, OFFICE]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - name: isActive
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Page of tax rates
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaxRateList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      tags: [Company]
      operationId: createTaxRate
      summary: Create a tax rate
      description: Setting `isDefault` to true clears the flag on the previous default.
      x-roles: [OWNER]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TaxRateCreate'
      responses:
        '201':
          description: Tax rate created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaxRate'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /tax-rates/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    patch:
      tags: [Company]
      operationId: updateTaxRate
      summary: Update or deactivate a tax rate
      description: Documents keep their own snapshot of `taxPercent`, so changing a rate never alters existing documents.
      x-roles: [OWNER]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TaxRateUpdate'
      responses:
        '200':
          description: Updated tax rate
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaxRate'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

  # ---------------------------------------------------------------- Clients
  /clients:
    get:
      tags: [Clients]
      operationId: listClients
      summary: List clients
      x-roles: [OWNER, OFFICE]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - name: isActive
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Page of clients
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ClientList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      tags: [Clients]
      operationId: createClient
      summary: Create a client
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        CLIENT_EMAIL_TAKEN: 409 - another client already has this email
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ClientCreate'
      responses:
        '201':
          description: Client created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Client'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /clients/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Clients]
      operationId: getClient
      summary: Get a client
      x-roles: [OWNER, OFFICE]
      responses:
        '200':
          description: The client
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Client'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    patch:
      tags: [Clients]
      operationId: updateClient
      summary: Update or deactivate a client
      description: Clients are deactivated with `isActive` false, never deleted.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        CLIENT_EMAIL_TAKEN: 409 - another client already has this email
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ClientUpdate'
      responses:
        '200':
          description: Updated client
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Client'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

  # ---------------------------------------------------------------- Projects
  /projects:
    get:
      tags: [Projects]
      operationId: listProjects
      summary: List projects
      description: >-
        OWNER and OFFICE see all projects. PROJECT_MANAGER and SITE_STAFF receive only
        projects they are a member of. For SITE_STAFF the price field `contractSum` is absent.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/ProjectStatus'
        - $ref: '#/components/parameters/ClientIdQuery'
      responses:
        '200':
          description: Page of projects
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectList'
        '401':
          $ref: '#/components/responses/Unauthorized'
    post:
      tags: [Projects]
      operationId: createProject
      summary: Create a project for a client
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        PROJECT_CODE_TAKEN: 409 - another project already has this code
        CLIENT_NOT_FOUND: 422 - clientId does not exist or the client is inactive
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectCreate'
      responses:
        '201':
          description: Project created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /projects/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Projects]
      operationId: getProject
      summary: Get a project with its members
      description: PROJECT_MANAGER and SITE_STAFF must be members. For SITE_STAFF the price field `contractSum` is absent.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      responses:
        '200':
          description: The project
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    patch:
      tags: [Projects]
      operationId: updateProject
      summary: Update a project
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        PROJECT_CODE_TAKEN: 409 - another project already has this code
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectUpdate'
      responses:
        '200':
          description: Updated project
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /projects/{id}/members:
    parameters:
      - $ref: '#/components/parameters/Id'
    put:
      tags: [Projects]
      operationId: replaceProjectMembers
      summary: Replace the full member list of a project
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        USER_NOT_ASSIGNABLE: 422 - a userId does not exist or the user is inactive
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectMembersInput'
      responses:
        '200':
          description: The new member list
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectMemberList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /projects/{id}/contract/from-quotation:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Projects]
      operationId: createContractFromQuotation
      summary: Convert an accepted quotation into the project contract
      description: >-
        Copies the quotation items to contract items and sets `Project.contractSum`.
        Can be done once per project.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        CONTRACT_ALREADY_EXISTS: 409 - the project already has a contract
        QUOTATION_NOT_ACCEPTED: 409 - the quotation is not in status ACCEPTED
        QUOTATION_CLIENT_MISMATCH: 422 - the quotation belongs to another client or another project
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ContractFromQuotationInput'
      responses:
        '201':
          description: The contract
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Contract'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /projects/{id}/contract:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Projects]
      operationId: getProjectContract
      summary: Get the project contract
      description: Items, original sum, approved variation orders, current sum, claimed to date and retention held.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        CONTRACT_NOT_FOUND: 404 - the project has no contract yet
      responses:
        '200':
          description: The contract
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Contract'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  # ---------------------------------------------------------------- Files
  /files/presign:
    post:
      tags: [Files]
      operationId: presignFileUpload
      summary: Get a presigned PUT URL for a direct upload to the bucket
      description: >-
        Creates a `File` row with status PENDING. Upload the bytes with HTTP PUT to `uploadUrl`,
        then reference `fileId` when saving the parent record. The API verifies the object exists
        and marks the file READY at that point.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      x-error-codes:
        FILE_TYPE_NOT_ALLOWED: 422 - mimeType is not allowed for this purpose
        FILE_TOO_LARGE: 422 - size is above the limit for this purpose
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PresignRequest'
      responses:
        '201':
          description: Presigned upload URL and the file id
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PresignResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /files/{id}/url:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Files]
      operationId: getFileUrl
      summary: Get a short-lived presigned download URL
      description: Allowed for any user who has access to the record the file is attached to.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      x-error-codes:
        FILE_NOT_READY: 409 - the file is still PENDING (not uploaded or not yet attached)
      responses:
        '200':
          description: Presigned download URL
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FileUrl'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'

  # ---------------------------------------------------------------- Quotations
  /quotations:
    get:
      tags: [Quotations]
      operationId: listQuotations
      summary: List quotations
      description: >-
        Returns the latest revision of each quotation unless `latestOnly` is false.
        PROJECT_MANAGER sees only quotations linked to own projects.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/QuotationStatus'
        - $ref: '#/components/parameters/ClientIdQuery'
        - $ref: '#/components/parameters/ProjectIdQuery'
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
        - name: latestOnly
          in: query
          description: When true (default) only the latest revision of each quotation is returned.
          schema:
            type: boolean
            default: true
      responses:
        '200':
          description: Page of quotations (header fields only)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QuotationList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      tags: [Quotations]
      operationId: createQuotation
      summary: Create a DRAFT quotation
      description: The quotation number is assigned now and never changes across revisions.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        CLIENT_NOT_FOUND: 422 - clientId does not exist or the client is inactive
        TAX_RATE_NOT_FOUND: 422 - a taxRateId does not exist or is inactive
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QuotationInput'
      responses:
        '201':
          description: Quotation created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /quotations/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Quotations]
      operationId: getQuotation
      summary: Get a quotation with sections and items
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      responses:
        '200':
          description: The quotation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    put:
      tags: [Quotations]
      operationId: replaceQuotation
      summary: Replace the header, sections and items of a DRAFT quotation
      description: >-
        Takes the full nested document and replaces it in one transaction. Sections and items
        not present in the body are removed. Order is taken from array position. The server
        recalculates all amounts and totals and ignores any sent by the client.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        QUOTATION_NOT_EDITABLE: 409 - only DRAFT quotations can be edited
        CLIENT_NOT_FOUND: 422 - clientId does not exist or the client is inactive
        TAX_RATE_NOT_FOUND: 422 - a taxRateId does not exist or is inactive
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QuotationInput'
      responses:
        '200':
          description: Updated quotation with recalculated totals
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
    delete:
      tags: [Quotations]
      operationId: deleteQuotation
      summary: Delete a DRAFT quotation that was never sent
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        QUOTATION_NOT_DELETABLE: 409 - only a DRAFT with revisionNo 0 can be deleted
      responses:
        '204':
          description: Deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
  /quotations/{id}/send:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Quotations]
      operationId: sendQuotation
      summary: Freeze a DRAFT quotation, generate and store its PDF
      description: Status becomes SENT. The stored PDF of a SENT revision is never regenerated.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        QUOTATION_INVALID_STATUS: 409 - the quotation is not DRAFT
        QUOTATION_HAS_NO_ITEMS: 422 - a quotation with no items cannot be sent
      responses:
        '200':
          description: The sent quotation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /quotations/{id}/accept:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Quotations]
      operationId: acceptQuotation
      summary: Mark a SENT quotation as accepted
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        QUOTATION_INVALID_STATUS: 409 - the quotation is not SENT (includes EXPIRED)
        QUOTATION_NOT_LATEST_REVISION: 409 - only the latest revision can be accepted
      responses:
        '200':
          description: The accepted quotation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
  /quotations/{id}/reject:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Quotations]
      operationId: rejectQuotation
      summary: Mark a SENT quotation as rejected
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        QUOTATION_INVALID_STATUS: 409 - the quotation is not SENT
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QuotationRejectRequest'
      responses:
        '200':
          description: The rejected quotation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /quotations/{id}/revise:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Quotations]
      operationId: reviseQuotation
      summary: Create the next revision of a SENT or REJECTED quotation
      description: >-
        Creates a DRAFT copy with the same `number` and `rootId` and `revisionNo + 1`,
        and marks the source SUPERSEDED.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        QUOTATION_INVALID_STATUS: 409 - only SENT or REJECTED quotations can be revised
        QUOTATION_NOT_LATEST_REVISION: 409 - a newer revision already exists
      responses:
        '201':
          description: The new DRAFT revision
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
  /quotations/{id}/duplicate:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Quotations]
      operationId: duplicateQuotation
      summary: Copy a quotation into a new DRAFT with a new number
      x-roles: [OWNER, OFFICE]
      responses:
        '201':
          description: The new DRAFT quotation (revisionNo 0, new number and rootId)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Quotation'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
  /quotations/{id}/revisions:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Quotations]
      operationId: listQuotationRevisions
      summary: List all revisions that share the same root
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
      responses:
        '200':
          description: Page of revisions, newest revision first by default
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QuotationList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
  /quotations/{id}/pdf:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Quotations]
      operationId: getQuotationPdf
      summary: Get a presigned URL for the quotation PDF
      description: A DRAFT renders a watermarked preview. Any other status returns the PDF stored when it was sent.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      responses:
        '200':
          description: Presigned download URL
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FileUrl'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  # ---------------------------------------------------------------- Daily reports
  /daily-reports:
    get:
      tags: [DailyReports]
      operationId: listDailyReports
      summary: List daily reports
      description: >-
        OWNER and OFFICE see all reports. PROJECT_MANAGER and SITE_STAFF see reports of
        projects they are a member of. Items include manpower and photos so the mobile app
        can cache them for offline reading.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - $ref: '#/components/parameters/ProjectIdQuery'
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
        - name: submittedById
          in: query
          schema:
            type: string
            format: uuid
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/DailyReportStatus'
      responses:
        '200':
          description: Page of daily reports
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DailyReportList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
  /daily-reports/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [DailyReports]
      operationId: getDailyReport
      summary: Get a daily report
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      responses:
        '200':
          description: The daily report
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DailyReport'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    put:
      tags: [DailyReports]
      operationId: upsertDailyReport
      summary: Create or update a daily report (idempotent)
      description: >-
        The id is generated on the phone. Takes the full nested document (manpower, photos,
        optional progress) and replaces it. Repeating the call with the same id and body is safe
        and results in one report. The caller must be a member of the project; an existing
        report can only be updated by its author, until it is REVIEWED or 48 hours after the
        report date, whichever comes first. `reportDate` can be today or up to 2 days back.
        Photos are uploaded first through `POST /files/presign` and referenced by `fileId`.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
      x-error-codes:
        NOT_PROJECT_MEMBER: 403 - the caller is not a member of the project
        DAILY_REPORT_NOT_AUTHOR: 403 - the report exists and was submitted by another user
        DAILY_REPORT_LOCKED: 409 - the report is REVIEWED or the 48 hour edit window has passed
        DAILY_REPORT_ALREADY_EXISTS: 409 - the caller already has a report with another id for this project and date; details.existingId holds it
        REPORT_DATE_OUT_OF_RANGE: 422 - reportDate is in the future or more than 2 days back
        FILE_NOT_UPLOADED: 422 - a photo fileId does not reference an uploaded file
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DailyReportInput'
      responses:
        '200':
          description: Existing report updated (or unchanged on a repeat)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DailyReport'
        '201':
          description: Report created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DailyReport'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /daily-reports/{id}/review:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [DailyReports]
      operationId: reviewDailyReport
      summary: Mark a daily report as reviewed
      description: Sets status REVIEWED, `reviewedById` and `reviewedAt`. The report is locked for the author afterwards.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        DAILY_REPORT_ALREADY_REVIEWED: 409 - the report is already REVIEWED
      responses:
        '200':
          description: The reviewed report
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DailyReport'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
  /projects/{id}/site-report.pdf:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [DailyReports]
      operationId: getSiteReportPdf
      summary: Download the daily or weekly site report PDF for a project
      description: >-
        Contains project details, date, weather, manpower table, work done, issues and a
        photo grid with captions. Contains no prices. Use the same date for `from` and `to`
        for a daily report.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        DATE_RANGE_TOO_LARGE: 422 - the range between from and to is more than 31 days
      parameters:
        - name: from
          in: query
          required: true
          description: First report date to include (inclusive).
          schema:
            type: string
            format: date
        - name: to
          in: query
          required: true
          description: Last report date to include (inclusive).
          schema:
            type: string
            format: date
      responses:
        '200':
          description: The PDF document
          content:
            application/pdf:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

  # ---------------------------------------------------------------- Variation orders
  /projects/{id}/variation-orders:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [VariationOrders]
      operationId: listVariationOrders
      summary: List variation orders of a project
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/VariationStatus'
      responses:
        '200':
          description: Page of variation orders (header fields only)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VariationOrderList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    post:
      tags: [VariationOrders]
      operationId: createVariationOrder
      summary: Create a DRAFT variation order
      description: PROJECT_MANAGER may create variation orders on own projects only.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        CONTRACT_NOT_FOUND: 409 - the project has no contract yet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VariationOrderInput'
      responses:
        '201':
          description: Variation order created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VariationOrder'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /variation-orders/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [VariationOrders]
      operationId: getVariationOrder
      summary: Get a variation order with its items
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      responses:
        '200':
          description: The variation order
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VariationOrder'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    put:
      tags: [VariationOrders]
      operationId: replaceVariationOrder
      summary: Replace the header and items of a DRAFT variation order
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        VARIATION_ORDER_NOT_EDITABLE: 409 - only DRAFT variation orders can be edited
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VariationOrderInput'
      responses:
        '200':
          description: Updated variation order with recalculated total
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VariationOrder'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /variation-orders/{id}/submit:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [VariationOrders]
      operationId: submitVariationOrder
      summary: Submit a DRAFT variation order for approval
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        VARIATION_ORDER_INVALID_STATUS: 409 - the variation order is not DRAFT
        VARIATION_ORDER_HAS_NO_ITEMS: 422 - a variation order with no items cannot be submitted
      responses:
        '200':
          description: The submitted variation order
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VariationOrder'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /variation-orders/{id}/approve:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [VariationOrders]
      operationId: approveVariationOrder
      summary: Approve a SUBMITTED variation order
      description: Appends contract items linked to this variation order and changes the current contract sum.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        VARIATION_ORDER_INVALID_STATUS: 409 - the variation order is not SUBMITTED
      responses:
        '200':
          description: The approved variation order
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VariationOrder'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
  /variation-orders/{id}/reject:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [VariationOrders]
      operationId: rejectVariationOrder
      summary: Reject a SUBMITTED variation order
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        VARIATION_ORDER_INVALID_STATUS: 409 - the variation order is not SUBMITTED
      responses:
        '200':
          description: The rejected variation order
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VariationOrder'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'

  # ---------------------------------------------------------------- Invoices
  /invoices:
    get:
      tags: [Invoices]
      operationId: listInvoices
      summary: List invoices of all types
      description: PROJECT_MANAGER sees only invoices of own projects.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - name: type
          in: query
          schema:
            $ref: '#/components/schemas/InvoiceType'
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/InvoiceStatus'
        - $ref: '#/components/parameters/ClientIdQuery'
        - $ref: '#/components/parameters/ProjectIdQuery'
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
        - name: overdue
          in: query
          description: When true only ISSUED or PARTIALLY_PAID invoices past their dueDate are returned.
          schema:
            type: boolean
      responses:
        '200':
          description: Page of invoices (header fields only)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/InvoiceList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      tags: [Invoices]
      operationId: createInvoice
      summary: Create a DRAFT simple invoice
      description: >-
        The body carries `type`. Only SIMPLE is accepted on this route. Progress claims are
        created with `POST /projects/{id}/progress-claims` and retention releases with
        `POST /projects/{id}/retention-releases`.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        INVOICE_TYPE_NOT_SUPPORTED: 422 - type is not SIMPLE
        CLIENT_NOT_FOUND: 422 - clientId does not exist or the client is inactive
        TAX_RATE_NOT_FOUND: 422 - a taxRateId does not exist or is inactive
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SimpleInvoiceCreate'
      responses:
        '201':
          description: Invoice created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Invoice'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /invoices/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Invoices]
      operationId: getInvoice
      summary: Get an invoice with lines, claim lines and credit notes
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      responses:
        '200':
          description: The invoice
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Invoice'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
    put:
      tags: [Invoices]
      operationId: replaceInvoice
      summary: Replace a DRAFT invoice
      description: >-
        The body shape depends on the type of the existing invoice: SIMPLE takes `lines`,
        PROGRESS_CLAIM takes `claimLines`, RETENTION_RELEASE takes `amount`. The type cannot
        be changed. The server recalculates every figure. PROJECT_MANAGER may only edit DRAFT
        progress claims on own projects.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        INVOICE_NOT_EDITABLE: 409 - only DRAFT invoices can be edited
        INVOICE_BODY_TYPE_MISMATCH: 422 - the body does not match the type of the invoice
        CLAIM_PERCENT_BELOW_PREVIOUS: 422 - cumulativePercent of an item is lower than in the previous issued claim
        CLAIM_PERCENT_ABOVE_100: 422 - cumulativePercent of an item is above 100
        CLAIM_ITEM_NOT_IN_CONTRACT: 422 - a contractItemId does not belong to the project contract
        RETENTION_RELEASE_EXCEEDS_HELD: 422 - total retention released would exceed retention held
        TAX_RATE_NOT_FOUND: 422 - a taxRateId does not exist or is inactive
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/SimpleInvoiceUpdate'
                - $ref: '#/components/schemas/ProgressClaimUpdate'
                - $ref: '#/components/schemas/RetentionReleaseUpdate'
      responses:
        '200':
          description: Updated invoice with recalculated figures
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Invoice'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
    delete:
      tags: [Invoices]
      operationId: deleteInvoice
      summary: Delete a DRAFT invoice
      description: Financial documents are never deleted once issued.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        INVOICE_NOT_EDITABLE: 409 - only DRAFT invoices can be deleted
      responses:
        '204':
          description: Deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
  /projects/{id}/progress-claims:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Invoices]
      operationId: createProgressClaim
      summary: Create a DRAFT progress claim for a project
      description: >-
        Creates an invoice of type PROGRESS_CLAIM with one claim line per contract item,
        pre-filled with the cumulative values of the previous issued claim. Only one DRAFT
        progress claim per project at a time. Edit it with `PUT /invoices/{id}`.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        CONTRACT_NOT_FOUND: 409 - the project has no contract yet
        DRAFT_CLAIM_EXISTS: 409 - the project already has a DRAFT progress claim; details.invoiceId holds it
      requestBody:
        required: false
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProgressClaimCreate'
      responses:
        '201':
          description: The DRAFT progress claim
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Invoice'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /projects/{id}/retention-releases:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Invoices]
      operationId: createRetentionRelease
      summary: Create a DRAFT retention release invoice for a project
      description: Bills part of the retention held. Total released on a project can never exceed retention held.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        CONTRACT_NOT_FOUND: 409 - the project has no contract yet
        RETENTION_RELEASE_EXCEEDS_HELD: 422 - total retention released would exceed retention held
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RetentionReleaseCreate'
      responses:
        '201':
          description: The DRAFT retention release invoice
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Invoice'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /invoices/{id}/issue:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Invoices]
      operationId: issueInvoice
      summary: Issue a DRAFT invoice
      description: >-
        In one transaction: validates, assigns the number, snapshots totals, sets status ISSUED,
        sets `dueDate = issueDate + payment term` and queues the PDF. `issueDate` defaults to
        today when it is not set. The invoice is immutable afterwards.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        INVOICE_INVALID_STATUS: 409 - the invoice is not DRAFT
        INVOICE_HAS_NO_LINES: 422 - a simple invoice with no lines cannot be issued
        INVOICE_TOTAL_NOT_POSITIVE: 422 - the invoice total is zero or negative
        CLAIM_PERCENT_BELOW_PREVIOUS: 422 - cumulativePercent of an item is lower than in the previous issued claim
        RETENTION_RELEASE_EXCEEDS_HELD: 422 - total retention released would exceed retention held
      responses:
        '200':
          description: The issued invoice
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Invoice'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /invoices/{id}/void:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Invoices]
      operationId: voidInvoice
      summary: Void an ISSUED invoice
      description: Allowed only if the invoice has no payments and no later claim depends on it.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        INVOICE_INVALID_STATUS: 409 - the invoice is not ISSUED
        INVOICE_HAS_PAYMENTS: 409 - the invoice has payment allocations
        INVOICE_HAS_DEPENDENT_CLAIM: 409 - a later progress claim on the project depends on this claim
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/InvoiceVoidRequest'
      responses:
        '200':
          description: The voided invoice
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Invoice'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /invoices/{id}/pdf:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Invoices]
      operationId: getInvoicePdf
      summary: Get a presigned URL for the invoice PDF
      description: A DRAFT renders a watermarked preview. An issued invoice returns the PDF stored when it was issued.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      x-error-codes:
        PDF_NOT_READY: 409 - the PDF of the issued invoice is still being generated
      responses:
        '200':
          description: Presigned download URL
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FileUrl'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
  /invoices/{id}/credit-notes:
    parameters:
      - $ref: '#/components/parameters/Id'
    post:
      tags: [Invoices]
      operationId: createCreditNote
      summary: Issue a credit note against an issued invoice
      description: >-
        The credit note is numbered and final as soon as it is created. The invoice
        `amountPaid` and status are recomputed from allocations and credit notes.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        INVOICE_INVALID_STATUS: 409 - the invoice is DRAFT or VOID
        CREDIT_NOTE_EXCEEDS_INVOICE: 422 - credit notes plus payment allocations would exceed the invoice total
        TAX_RATE_NOT_FOUND: 422 - taxRateId does not exist or is inactive
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreditNoteCreate'
      responses:
        '201':
          description: Credit note created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreditNote'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /exports/invoices.csv:
    get:
      tags: [Invoices]
      operationId: exportInvoicesCsv
      summary: Export invoices in a date range as CSV for the accountant
      description: One row per invoice with status ISSUED, PARTIALLY_PAID, PAID or VOID, filtered by `issueDate`.
      x-roles: [OWNER, OFFICE]
      parameters:
        - name: from
          in: query
          required: true
          description: First issue date to include (inclusive).
          schema:
            type: string
            format: date
        - name: to
          in: query
          required: true
          description: Last issue date to include (inclusive).
          schema:
            type: string
            format: date
      responses:
        '200':
          description: CSV file
          content:
            text/csv:
              schema:
                type: string
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

  # ---------------------------------------------------------------- Payments
  /payments:
    get:
      tags: [Payments]
      operationId: listPayments
      summary: List payments with their allocations
      x-roles: [OWNER, OFFICE]
      parameters:
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/Sort'
        - $ref: '#/components/parameters/Q'
        - $ref: '#/components/parameters/ClientIdQuery'
        - name: invoiceId
          in: query
          description: Only payments that have an allocation to this invoice.
          schema:
            type: string
            format: uuid
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
      responses:
        '200':
          description: Page of payments
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaymentList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      tags: [Payments]
      operationId: createPayment
      summary: Record a payment and allocate it across invoices
      description: Invoice `amountPaid` and status (PARTIALLY_PAID or PAID) are updated automatically.
      x-roles: [OWNER, OFFICE]
      x-error-codes:
        INVOICE_NOT_PAYABLE: 409 - an allocated invoice is DRAFT, PAID or VOID
        ALLOCATION_EXCEEDS_INVOICE_BALANCE: 422 - allocations on an invoice would exceed its total less credit notes
        ALLOCATION_EXCEEDS_PAYMENT: 422 - the sum of allocations is greater than the payment amount
        ALLOCATION_CLIENT_MISMATCH: 422 - an allocated invoice belongs to another client
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PaymentCreate'
      responses:
        '201':
          description: Payment recorded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Payment'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /payments/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    delete:
      tags: [Payments]
      operationId: deletePayment
      summary: Delete a payment and reverse its allocations
      description: Invoice `amountPaid` and status are recomputed. The deletion is written to the audit log.
      x-roles: [OWNER, OFFICE]
      responses:
        '204':
          description: Deleted and allocations reversed
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
  /exports/payments.csv:
    get:
      tags: [Payments]
      operationId: exportPaymentsCsv
      summary: Export payments in a date range as CSV for the accountant
      description: One row per payment allocation, filtered by `receivedDate`.
      x-roles: [OWNER, OFFICE]
      parameters:
        - name: from
          in: query
          required: true
          description: First received date to include (inclusive).
          schema:
            type: string
            format: date
        - name: to
          in: query
          required: true
          description: Last received date to include (inclusive).
          schema:
            type: string
            format: date
      responses:
        '200':
          description: CSV file
          content:
            text/csv:
              schema:
                type: string
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

  # ---------------------------------------------------------------- Reports
  /reports/dashboard:
    get:
      tags: [Reports]
      operationId: getDashboardReport
      summary: Business state at a glance
      description: Only ISSUED, PARTIALLY_PAID and PAID invoices count as billed. DRAFT and VOID never appear in totals.
      x-roles: [OWNER, OFFICE]
      parameters:
        - $ref: '#/components/parameters/ReportFormat'
      responses:
        '200':
          description: Dashboard figures
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DashboardReport'
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
  /reports/projects/{id}/summary:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      tags: [Reports]
      operationId: getProjectSummaryReport
      summary: Financial and site progress of one project
      description: PROJECT_MANAGER must be a member of the project.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      parameters:
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
        - $ref: '#/components/parameters/ReportFormat'
      responses:
        '200':
          description: Project summary
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectSummaryReport'
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
  /reports/receivables-ageing:
    get:
      tags: [Reports]
      operationId: getReceivablesAgeingReport
      summary: Outstanding per client in overdue buckets
      x-roles: [OWNER, OFFICE]
      parameters:
        - name: asOf
          in: query
          description: Date the ageing is calculated for. Defaults to today (Asia/Kuala_Lumpur).
          schema:
            type: string
            format: date
        - $ref: '#/components/parameters/ClientIdQuery'
        - $ref: '#/components/parameters/ProjectIdQuery'
        - $ref: '#/components/parameters/ReportFormat'
      responses:
        '200':
          description: Receivables ageing
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReceivablesAgeingReport'
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /reports/quotation-pipeline:
    get:
      tags: [Reports]
      operationId: getQuotationPipelineReport
      summary: Quotation count and value by status, win rate, by month
      description: Counts the latest revision of each quotation, by `issueDate`.
      x-roles: [OWNER, OFFICE]
      parameters:
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
        - $ref: '#/components/parameters/ClientIdQuery'
        - $ref: '#/components/parameters/ReportFormat'
      responses:
        '200':
          description: Quotation pipeline
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QuotationPipelineReport'
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /reports/billing-collections:
    get:
      tags: [Reports]
      operationId: getBillingCollectionsReport
      summary: Invoiced vs received per month
      description: Defaults to the last 12 months when `from` and `to` are not given.
      x-roles: [OWNER, OFFICE]
      parameters:
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
        - $ref: '#/components/parameters/ClientIdQuery'
        - $ref: '#/components/parameters/ProjectIdQuery'
        - $ref: '#/components/parameters/ReportFormat'
      responses:
        '200':
          description: Billing and collections
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BillingCollectionsReport'
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
  /reports/retention:
    get:
      tags: [Reports]
      operationId: getRetentionRegisterReport
      summary: Retention held, released and balance per project
      description: PROJECT_MANAGER sees only own projects.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      parameters:
        - $ref: '#/components/parameters/ClientIdQuery'
        - $ref: '#/components/parameters/ProjectIdQuery'
        - $ref: '#/components/parameters/ReportFormat'
      responses:
        '200':
          description: Retention register
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RetentionRegisterReport'
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
  /reports/daily-report-compliance:
    get:
      tags: [Reports]
      operationId: getDailyReportComplianceReport
      summary: Daily reports submitted vs expected, per project and per site staff
      description: >-
        Expected reports are counted on working days (Monday to Saturday by default; public
        holidays are ignored). PROJECT_MANAGER sees only own projects.
      x-roles: [OWNER, OFFICE, PROJECT_MANAGER]
      parameters:
        - name: from
          in: query
          required: true
          description: First report date to include (inclusive).
          schema:
            type: string
            format: date
        - name: to
          in: query
          required: true
          description: Last report date to include (inclusive).
          schema:
            type: string
            format: date
        - $ref: '#/components/parameters/ProjectIdQuery'
        - $ref: '#/components/parameters/ReportFormat'
      responses:
        '200':
          description: Daily report compliance
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DailyReportComplianceReport'
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Access token from `POST /auth/login` or `POST /auth/refresh`. Expires after 15 minutes.

  parameters:
    Id:
      name: id
      in: path
      required: true
      description: UUID of the resource named in the path.
      schema:
        type: string
        format: uuid
    Page:
      name: page
      in: query
      description: Page number, starting at 1.
      schema:
        type: integer
        minimum: 1
        default: 1
    PageSize:
      name: pageSize
      in: query
      description: Items per page.
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    Sort:
      name: sort
      in: query
      description: Field to sort by. Prefix with `-` for descending, e.g. `-createdAt`.
      schema:
        type: string
        default: '-createdAt'
    Q:
      name: q
      in: query
      description: Free-text search over the main text fields of the resource.
      schema:
        type: string
    From:
      name: from
      in: query
      description: Start of the date range (inclusive), a business date in Asia/Kuala_Lumpur.
      schema:
        type: string
        format: date
    To:
      name: to
      in: query
      description: End of the date range (inclusive), a business date in Asia/Kuala_Lumpur.
      schema:
        type: string
        format: date
    ProjectIdQuery:
      name: projectId
      in: query
      description: Filter by project.
      schema:
        type: string
        format: uuid
    ClientIdQuery:
      name: clientId
      in: query
      description: Filter by client.
      schema:
        type: string
        format: uuid
    ReportFormat:
      name: format
      in: query
      description: Use `xlsx` to receive the report as an Excel file instead of JSON.
      schema:
        type: string
        enum: [json, xlsx]
        default: json

  responses:
    Unauthorized:
      description: Missing, invalid or expired credentials. See `x-error-codes` of the operation for specific codes.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            statusCode: 401
            code: UNAUTHENTICATED
            message: Access token is missing or expired
    Forbidden:
      description: The role is not allowed, or the user is not a member of the project.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            statusCode: 403
            code: FORBIDDEN
            message: You do not have access to this resource
    NotFound:
      description: The resource does not exist.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            statusCode: 404
            code: NOT_FOUND
            message: Resource not found
    Conflict:
      description: The request conflicts with the current state. See `x-error-codes` of the operation for specific codes.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            statusCode: 409
            code: QUOTATION_NOT_EDITABLE
            message: Only DRAFT quotations can be edited
    UnprocessableEntity:
      description: >-
        Validation failed (`VALIDATION_ERROR`, with field errors in `details`) or a business
        rule was broken. See `x-error-codes` of the operation for specific codes.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            statusCode: 422
            code: VALIDATION_ERROR
            message: Validation failed
            details:
              - path: sections.0.items.1.quantity
                message: Must be a decimal string
    TooManyRequests:
      description: Rate limit reached.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            statusCode: 429
            code: LOGIN_LOCKED
            message: Too many failed attempts. Try again in 15 minutes

  schemas:
    # -------------------------------------------------------------- Common
    Error:
      type: object
      required: [statusCode, code, message]
      properties:
        statusCode:
          type: integer
          examples: [409]
        code:
          type: string
          description: Stable machine-readable error code.
          examples: [QUOTATION_NOT_EDITABLE]
        message:
          type: string
          description: Human-readable message.
        details:
          description: >-
            Optional extra information. For `VALIDATION_ERROR` an array of
            `{ path, message }`; for other codes an object described in `x-error-codes`.
          oneOf:
            - type: array
              items:
                type: object
                required: [path, message]
                properties:
                  path:
                    type: string
                  message:
                    type: string
            - type: object
              additionalProperties: true
    Page:
      type: object
      description: Envelope fields of every list response.
      required: [items, total, page, pageSize]
      properties:
        items:
          type: array
          items: {}
        total:
          type: integer
          minimum: 0
          description: Total number of items matching the query.
        page:
          type: integer
          minimum: 1
        pageSize:
          type: integer
          minimum: 1
    BaseEntity:
      type: object
      required: [id, createdAt, updatedAt]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true
    Money:
      type: string
      pattern: '^-?\d{1,12}\.\d{2}$'
      description: Amount in MYR as a decimal string with exactly 2 places. Never a JSON number.
      examples: ['12500.00']
    NullableMoney:
      type: [string, 'null']
      pattern: '^-?\d{1,12}\.\d{2}$'
      description: Amount in MYR as a decimal string with exactly 2 places, or null.
      examples: ['12500.00']
    Quantity:
      type: string
      pattern: '^-?\d{1,11}(\.\d{1,3})?$'
      description: Quantity as a decimal string with up to 3 places.
      examples: ['12.500']
    Percent:
      type: string
      pattern: '^\d{1,3}(\.\d{1,2})?$'
      description: Percentage as a decimal string with up to 2 places.
      examples: ['8.00']
    Role:
      type: string
      enum: [OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF]
    ProjectStatus:
      type: string
      enum: [DRAFT, ACTIVE, ON_HOLD, COMPLETED, CLOSED]
    QuotationStatus:
      type: string
      enum: [DRAFT, SENT, ACCEPTED, REJECTED, SUPERSEDED, EXPIRED]
    VariationStatus:
      type: string
      enum: [DRAFT, SUBMITTED, APPROVED, REJECTED]
    InvoiceType:
      type: string
      enum: [SIMPLE, PROGRESS_CLAIM, RETENTION_RELEASE]
    InvoiceStatus:
      type: string
      enum: [DRAFT, ISSUED, PARTIALLY_PAID, PAID, VOID]
    DailyReportStatus:
      type: string
      enum: [SUBMITTED, REVIEWED]
    Weather:
      type: string
      enum: [SUNNY, CLOUDY, RAIN, HEAVY_RAIN]
    EInvoiceStatus:
      type: string
      enum: [NOT_REQUIRED, PENDING, SUBMITTED, VALID, INVALID, CANCELLED]
    FileStatus:
      type: string
      enum: [PENDING, READY]

    # -------------------------------------------------------------- Auth
    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          format: password
        deviceName:
          type: string
          maxLength: 100
          description: Label stored with the refresh token so it can be revoked per device.
    TokenPair:
      type: object
      required: [accessToken, refreshToken, expiresIn]
      properties:
        accessToken:
          type: string
          description: JWT, valid for 15 minutes.
        refreshToken:
          type: string
          description: Opaque token, single use, rotated on every refresh.
        expiresIn:
          type: integer
          description: Lifetime of the access token in seconds.
          examples: [900]
    LoginResponse:
      allOf:
        - $ref: '#/components/schemas/TokenPair'
        - type: object
          required: [user]
          properties:
            user:
              $ref: '#/components/schemas/User'
    RefreshRequest:
      type: object
      required: [refreshToken]
      properties:
        refreshToken:
          type: string
    LogoutRequest:
      type: object
      required: [refreshToken]
      properties:
        refreshToken:
          type: string
    ChangePasswordRequest:
      type: object
      required: [currentPassword, newPassword]
      properties:
        currentPassword:
          type: string
          format: password
        newPassword:
          type: string
          format: password
          minLength: 8

    # -------------------------------------------------------------- Users
    User:
      description: A user. `passwordHash` is never returned.
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [email, name, role, isActive]
          properties:
            email:
              type: string
              format: email
            name:
              type: string
            phone:
              type: [string, 'null']
            role:
              $ref: '#/components/schemas/Role'
            isActive:
              type: boolean
    UserSummary:
      type: object
      description: Short user reference embedded in other resources.
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        role:
          $ref: '#/components/schemas/Role'
    UserCreate:
      type: object
      required: [email, name, role, password]
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 200
        phone:
          type: [string, 'null']
          maxLength: 30
        role:
          $ref: '#/components/schemas/Role'
        password:
          type: string
          format: password
          minLength: 8
          description: Initial password. Stored as an argon2id hash.
    UserUpdate:
      type: object
      minProperties: 1
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 200
        phone:
          type: [string, 'null']
          maxLength: 30
        role:
          $ref: '#/components/schemas/Role'
        isActive:
          type: boolean
          description: False deactivates the user and revokes all refresh tokens.
        password:
          type: string
          format: password
          minLength: 8
          description: Sets a new password (reset by the OWNER). Revokes all refresh tokens of the user.
    UserList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/User'

    # -------------------------------------------------------------- Company
    Company:
      description: Company settings (single row). These details appear on documents.
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [name, defaultPaymentTermDays, defaultRetentionPercent, defaultRetentionCapPercent]
          properties:
            name:
              type: string
            registrationNo:
              type: [string, 'null']
              description: SSM registration number.
            tin:
              type: [string, 'null']
              description: Tax identification number (LHDN).
            sstNo:
              type: [string, 'null']
            msicCode:
              type: [string, 'null']
            address:
              type: [string, 'null']
            phone:
              type: [string, 'null']
            email:
              type: [string, 'null']
              format: email
            logoFileId:
              type: [string, 'null']
              format: uuid
            bankDetails:
              type: [string, 'null']
              description: Free text printed on invoices.
            defaultPaymentTermDays:
              type: integer
              minimum: 0
            defaultRetentionPercent:
              $ref: '#/components/schemas/Percent'
            defaultRetentionCapPercent:
              $ref: '#/components/schemas/Percent'
    CompanyUpdate:
      type: object
      minProperties: 1
      properties:
        name:
          type: string
          minLength: 1
        registrationNo:
          type: [string, 'null']
        tin:
          type: [string, 'null']
        sstNo:
          type: [string, 'null']
        msicCode:
          type: [string, 'null']
        address:
          type: [string, 'null']
        phone:
          type: [string, 'null']
        email:
          type: [string, 'null']
          format: email
        logoFileId:
          type: [string, 'null']
          format: uuid
          description: File id from `POST /files/presign`.
        bankDetails:
          type: [string, 'null']
        defaultPaymentTermDays:
          type: integer
          minimum: 0
        defaultRetentionPercent:
          $ref: '#/components/schemas/Percent'
        defaultRetentionCapPercent:
          $ref: '#/components/schemas/Percent'
    TaxRate:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [name, percent, isDefault, isActive]
          properties:
            name:
              type: string
              examples: [SST 8%]
            percent:
              $ref: '#/components/schemas/Percent'
            isDefault:
              type: boolean
            isActive:
              type: boolean
    TaxRateCreate:
      type: object
      required: [name, percent]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        percent:
          $ref: '#/components/schemas/Percent'
        isDefault:
          type: boolean
          default: false
        isActive:
          type: boolean
          default: true
    TaxRateUpdate:
      type: object
      minProperties: 1
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        percent:
          $ref: '#/components/schemas/Percent'
        isDefault:
          type: boolean
        isActive:
          type: boolean
    TaxRateList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/TaxRate'

    # -------------------------------------------------------------- Clients
    Client:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [name, isActive]
          properties:
            name:
              type: string
            registrationNo:
              type: [string, 'null']
            tin:
              type: [string, 'null']
            sstNo:
              type: [string, 'null']
            address:
              type: [string, 'null']
            contactName:
              type: [string, 'null']
            phone:
              type: [string, 'null']
            email:
              type: [string, 'null']
              format: email
            isActive:
              type: boolean
    ClientSummary:
      type: object
      description: Short client reference embedded in other resources.
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
    ClientCreate:
      type: object
      required: [name]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 200
        registrationNo:
          type: [string, 'null']
        tin:
          type: [string, 'null']
        sstNo:
          type: [string, 'null']
        address:
          type: [string, 'null']
        contactName:
          type: [string, 'null']
        phone:
          type: [string, 'null']
        email:
          type: [string, 'null']
          format: email
    ClientUpdate:
      type: object
      minProperties: 1
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 200
        registrationNo:
          type: [string, 'null']
        tin:
          type: [string, 'null']
        sstNo:
          type: [string, 'null']
        address:
          type: [string, 'null']
        contactName:
          type: [string, 'null']
        phone:
          type: [string, 'null']
        email:
          type: [string, 'null']
          format: email
        isActive:
          type: boolean
          description: False deactivates the client. Clients are never deleted.
    ClientList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/Client'

    # -------------------------------------------------------------- Projects
    Project:
      description: >-
        A project. Price fields are omitted for SITE_STAFF: the `contractSum` property is
        absent from the response (not null) when the caller has the SITE_STAFF role.
        `members` is only included by `GET /projects/{id}`.
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [code, name, clientId, status]
          properties:
            code:
              type: string
              description: Unique project code.
            name:
              type: string
            clientId:
              type: string
              format: uuid
            client:
              allOf:
                - $ref: '#/components/schemas/ClientSummary'
              readOnly: true
            siteAddress:
              type: [string, 'null']
            status:
              $ref: '#/components/schemas/ProjectStatus'
            startDate:
              type: [string, 'null']
              format: date
            endDate:
              type: [string, 'null']
              format: date
            contractSum:
              allOf:
                - $ref: '#/components/schemas/NullableMoney'
              readOnly: true
              description: >-
                Original contract sum, set when a quotation is converted to the contract.
                Null until then. Omitted for SITE_STAFF.
            retentionPercent:
              $ref: '#/components/schemas/Percent'
            retentionCapPercent:
              $ref: '#/components/schemas/Percent'
            defectsLiabilityMonths:
              type: integer
              minimum: 0
            members:
              type: array
              readOnly: true
              items:
                $ref: '#/components/schemas/ProjectMember'
    ProjectRef:
      type: object
      description: Short project reference embedded in other resources. Carries no price fields.
      required: [id, code, name]
      properties:
        id:
          type: string
          format: uuid
        code:
          type: string
        name:
          type: string
    ProjectCreate:
      type: object
      required: [code, name, clientId]
      properties:
        code:
          type: string
          minLength: 1
          maxLength: 30
        name:
          type: string
          minLength: 1
          maxLength: 200
        clientId:
          type: string
          format: uuid
        siteAddress:
          type: [string, 'null']
        status:
          allOf:
            - $ref: '#/components/schemas/ProjectStatus'
          default: DRAFT
        startDate:
          type: [string, 'null']
          format: date
        endDate:
          type: [string, 'null']
          format: date
        retentionPercent:
          allOf:
            - $ref: '#/components/schemas/Percent'
          description: Defaults to `Company.defaultRetentionPercent`.
        retentionCapPercent:
          allOf:
            - $ref: '#/components/schemas/Percent'
          description: Defaults to `Company.defaultRetentionCapPercent`.
        defectsLiabilityMonths:
          type: integer
          minimum: 0
          default: 0
    ProjectUpdate:
      type: object
      minProperties: 1
      properties:
        code:
          type: string
          minLength: 1
          maxLength: 30
        name:
          type: string
          minLength: 1
          maxLength: 200
        siteAddress:
          type: [string, 'null']
        status:
          $ref: '#/components/schemas/ProjectStatus'
        startDate:
          type: [string, 'null']
          format: date
        endDate:
          type: [string, 'null']
          format: date
        retentionPercent:
          $ref: '#/components/schemas/Percent'
        retentionCapPercent:
          $ref: '#/components/schemas/Percent'
        defectsLiabilityMonths:
          type: integer
          minimum: 0
    ProjectList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/Project'
    ProjectMember:
      type: object
      required: [projectId, userId, user]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        projectId:
          type: string
          format: uuid
        userId:
          type: string
          format: uuid
        user:
          allOf:
            - $ref: '#/components/schemas/UserSummary'
          readOnly: true
    ProjectMembersInput:
      type: object
      required: [userIds]
      properties:
        userIds:
          type: array
          uniqueItems: true
          description: The complete member list. Users not listed are removed from the project.
          items:
            type: string
            format: uuid
    ProjectMemberList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/ProjectMember'

    # -------------------------------------------------------------- Files
    PresignRequest:
      type: object
      required: [fileName, mimeType, size, purpose]
      properties:
        fileName:
          type: string
          minLength: 1
          maxLength: 255
        mimeType:
          type: string
          examples: [image/jpeg]
        size:
          type: integer
          minimum: 1
          description: Size in bytes.
        purpose:
          type: string
          description: What the file is for. Decides the allowed types, size limit and bucket prefix.
          examples: [DAILY_REPORT_PHOTO, COMPANY_LOGO]
    PresignResponse:
      type: object
      required: [fileId, uploadUrl, expiresAt]
      properties:
        fileId:
          type: string
          format: uuid
          description: Id of the `File` row (status PENDING). Reference it when saving the parent record.
        uploadUrl:
          type: string
          format: uri
          description: Presigned URL. Upload with HTTP PUT and a `Content-Type` header equal to `mimeType`.
        expiresAt:
          type: string
          format: date-time
    FileUrl:
      type: object
      required: [url, expiresAt]
      properties:
        url:
          type: string
          format: uri
          description: Short-lived presigned download URL.
        expiresAt:
          type: string
          format: date-time

    # -------------------------------------------------------------- Quotations
    QuotationSummary:
      description: Quotation header as returned in lists.
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [number, rootId, revisionNo, clientId, title, status, subtotal, discountAmount, taxAmount, total]
          properties:
            number:
              type: string
              readOnly: true
              description: Assigned when the draft is first saved. Shared by all revisions.
              examples: [QT-2026-0001]
            rootId:
              type: string
              format: uuid
              readOnly: true
              description: Id of the first revision.
            revisionNo:
              type: integer
              minimum: 0
              readOnly: true
            clientId:
              type: string
              format: uuid
            client:
              allOf:
                - $ref: '#/components/schemas/ClientSummary'
              readOnly: true
            projectId:
              type: [string, 'null']
              format: uuid
            title:
              type: string
            status:
              allOf:
                - $ref: '#/components/schemas/QuotationStatus'
              readOnly: true
              description: A SENT quotation past `validUntil` is returned as EXPIRED.
            issueDate:
              type: [string, 'null']
              format: date
            validUntil:
              type: [string, 'null']
              format: date
            subtotal:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: Sum of item amounts.
            discountAmount:
              $ref: '#/components/schemas/Money'
            taxAmount:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
            total:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: subtotal - discountAmount + taxAmount.
            createdById:
              type: string
              format: uuid
              readOnly: true
    Quotation:
      description: Full quotation with sections and items.
      allOf:
        - $ref: '#/components/schemas/QuotationSummary'
        - type: object
          required: [sections]
          properties:
            terms:
              type: [string, 'null']
            notes:
              type: [string, 'null']
            pdfFileId:
              type: [string, 'null']
              format: uuid
              readOnly: true
              description: Stored PDF, set when the quotation is sent.
            rejectionReason:
              type: [string, 'null']
              readOnly: true
            sections:
              type: array
              items:
                $ref: '#/components/schemas/QuotationSection'
    QuotationSection:
      type: object
      required: [id, sortOrder, title, items]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        quotationId:
          type: string
          format: uuid
          readOnly: true
        sortOrder:
          type: integer
          readOnly: true
          description: Position, taken from the array order of the last save.
        title:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/QuotationItem'
    QuotationItem:
      type: object
      required: [id, sectionId, sortOrder, description, quantity, rate, amount, taxPercent]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        quotationId:
          type: string
          format: uuid
          readOnly: true
        sectionId:
          type: string
          format: uuid
          readOnly: true
        sortOrder:
          type: integer
          readOnly: true
        description:
          type: string
        unit:
          type: [string, 'null']
        quantity:
          $ref: '#/components/schemas/Quantity'
        rate:
          $ref: '#/components/schemas/Money'
        amount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: round(quantity x rate, 2).
        taxRateId:
          type: [string, 'null']
          format: uuid
        taxPercent:
          allOf:
            - $ref: '#/components/schemas/Percent'
          readOnly: true
          description: Snapshot of the tax rate percent at the time of saving. 0.00 when no tax rate is set.
    QuotationInput:
      type: object
      description: >-
        Full quotation document for `POST /quotations` and `PUT /quotations/{id}`. Totals are
        never accepted from the client. Section and item order is the array order.
      required: [clientId, title, sections]
      properties:
        clientId:
          type: string
          format: uuid
        projectId:
          type: [string, 'null']
          format: uuid
        title:
          type: string
          minLength: 1
          maxLength: 300
        issueDate:
          type: [string, 'null']
          format: date
        validUntil:
          type: [string, 'null']
          format: date
        terms:
          type: [string, 'null']
        notes:
          type: [string, 'null']
        discountAmount:
          allOf:
            - $ref: '#/components/schemas/Money'
          default: '0.00'
          description: Discount on the whole quotation, shared across items in proportion to amount when tax is calculated.
        sections:
          type: array
          description: May be empty while drafting. A quotation with no items cannot be sent.
          items:
            $ref: '#/components/schemas/QuotationSectionInput'
    QuotationSectionInput:
      type: object
      required: [title, items]
      properties:
        id:
          type: string
          format: uuid
          description: Id of an existing section to keep, or a client-generated id for a new one. Optional.
        title:
          type: string
          maxLength: 300
        items:
          type: array
          items:
            $ref: '#/components/schemas/QuotationItemInput'
    QuotationItemInput:
      type: object
      required: [description, quantity, rate]
      properties:
        id:
          type: string
          format: uuid
          description: Id of an existing item to keep, or a client-generated id for a new one. Optional.
        description:
          type: string
          minLength: 1
        unit:
          type: [string, 'null']
          maxLength: 30
        quantity:
          $ref: '#/components/schemas/Quantity'
        rate:
          $ref: '#/components/schemas/Money'
        taxRateId:
          type: [string, 'null']
          format: uuid
          description: Tax rate of this line. Null means no tax.
    QuotationRejectRequest:
      type: object
      required: [reason]
      properties:
        reason:
          type: string
          minLength: 1
          maxLength: 1000
    QuotationList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/QuotationSummary'

    # -------------------------------------------------------------- Daily reports
    DailyReport:
      description: >-
        A daily site report. It carries no price fields. Price fields are omitted for
        SITE_STAFF everywhere, so any embedded project or contract item data in this resource
        never includes rates, amounts or the contract sum.
      type: object
      required: [id, projectId, reportDate, submittedById, workDone, status, manpower, photos, createdAt, updatedAt]
      properties:
        id:
          type: string
          format: uuid
          description: Generated on the phone (UUID v7) and sent as the path id of the PUT.
        projectId:
          type: string
          format: uuid
        project:
          allOf:
            - $ref: '#/components/schemas/ProjectRef'
          readOnly: true
        reportDate:
          type: string
          format: date
        submittedById:
          type: string
          format: uuid
          readOnly: true
        submittedBy:
          allOf:
            - $ref: '#/components/schemas/UserSummary'
          readOnly: true
        weather:
          oneOf:
            - $ref: '#/components/schemas/Weather'
            - type: 'null'
        workDone:
          type: string
        issues:
          type: [string, 'null']
        nextDayPlan:
          type: [string, 'null']
        status:
          allOf:
            - $ref: '#/components/schemas/DailyReportStatus'
          readOnly: true
        reviewedById:
          type: [string, 'null']
          format: uuid
          readOnly: true
        reviewedAt:
          type: [string, 'null']
          format: date-time
          readOnly: true
        latitude:
          type: [number, 'null']
          minimum: -90
          maximum: 90
        longitude:
          type: [number, 'null']
          minimum: -180
          maximum: 180
        deviceCreatedAt:
          type: [string, 'null']
          format: date-time
          description: Device time when the report was created on the phone.
        isEditable:
          type: boolean
          readOnly: true
          description: True while the caller is the author, the report is not REVIEWED and the 48 hour window is open.
        manpower:
          type: array
          items:
            $ref: '#/components/schemas/DailyReportManpower'
        photos:
          type: array
          items:
            $ref: '#/components/schemas/DailyReportPhoto'
        progress:
          type: array
          description: Optional site estimate per contract item, used as a hint when preparing claims.
          items:
            $ref: '#/components/schemas/DailyReportProgress'
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true
    DailyReportManpower:
      type: object
      required: [trade, headcount]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        trade:
          type: string
          examples: [Bricklayer]
        headcount:
          type: integer
          minimum: 0
    DailyReportPhoto:
      type: object
      required: [fileId, sortOrder]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        fileId:
          type: string
          format: uuid
        caption:
          type: [string, 'null']
        takenAt:
          type: [string, 'null']
          format: date-time
        sortOrder:
          type: integer
          readOnly: true
        url:
          type: string
          format: uri
          readOnly: true
          description: Short-lived presigned download URL for the photo.
    DailyReportProgress:
      type: object
      required: [contractItemId, percentComplete]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        contractItemId:
          type: string
          format: uuid
        percentComplete:
          $ref: '#/components/schemas/Percent'
    DailyReportInput:
      type: object
      description: >-
        Full daily report document for `PUT /daily-reports/{id}`. Manpower, photos and
        progress rows not present in the body are removed. Photo order is the array order.
      required: [projectId, reportDate, workDone, manpower, photos]
      properties:
        projectId:
          type: string
          format: uuid
          description: Cannot be changed once the report exists.
        reportDate:
          type: string
          format: date
          description: Today or up to 2 days back (Asia/Kuala_Lumpur), never in the future.
        weather:
          oneOf:
            - $ref: '#/components/schemas/Weather'
            - type: 'null'
        workDone:
          type: string
          minLength: 1
        issues:
          type: [string, 'null']
        nextDayPlan:
          type: [string, 'null']
        latitude:
          type: [number, 'null']
          minimum: -90
          maximum: 90
          description: GPS position if permission was granted. Missing GPS does not block submission.
        longitude:
          type: [number, 'null']
          minimum: -180
          maximum: 180
        deviceCreatedAt:
          type: [string, 'null']
          format: date-time
        manpower:
          type: array
          description: May be empty.
          items:
            $ref: '#/components/schemas/DailyReportManpowerInput'
        photos:
          type: array
          minItems: 1
          maxItems: 20
          items:
            $ref: '#/components/schemas/DailyReportPhotoInput'
        progress:
          type: array
          items:
            $ref: '#/components/schemas/DailyReportProgressInput'
    DailyReportManpowerInput:
      type: object
      required: [trade, headcount]
      properties:
        trade:
          type: string
          minLength: 1
          maxLength: 100
        headcount:
          type: integer
          minimum: 0
    DailyReportPhotoInput:
      type: object
      required: [fileId]
      properties:
        fileId:
          type: string
          format: uuid
          description: File id from `POST /files/presign`, already uploaded to the bucket.
        caption:
          type: [string, 'null']
          maxLength: 300
        takenAt:
          type: [string, 'null']
          format: date-time
    DailyReportProgressInput:
      type: object
      required: [contractItemId, percentComplete]
      properties:
        contractItemId:
          type: string
          format: uuid
        percentComplete:
          $ref: '#/components/schemas/Percent'
    DailyReportList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/DailyReport'

    # -------------------------------------------------------------- Contract and variation orders
    ContractFromQuotationInput:
      type: object
      required: [quotationId]
      properties:
        quotationId:
          type: string
          format: uuid
          description: An ACCEPTED quotation.
    Contract:
      type: object
      description: The contract of a project. All fields are calculated by the server.
      required: [projectId, items, originalSum, approvedVariationOrders, approvedVariationsTotal, currentSum, claimedToDate, retentionHeld]
      properties:
        projectId:
          type: string
          format: uuid
          readOnly: true
        items:
          type: array
          readOnly: true
          description: Original items copied from the quotation plus items added by approved variation orders.
          items:
            $ref: '#/components/schemas/ContractItem'
        originalSum:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: Sum of the original contract items (equals `Project.contractSum`).
        approvedVariationOrders:
          type: array
          readOnly: true
          items:
            $ref: '#/components/schemas/VariationOrderSummary'
        approvedVariationsTotal:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: Sum of APPROVED variation order totals. Can be negative.
        currentSum:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: originalSum + approvedVariationsTotal.
        claimedToDate:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: grossToDate of the latest issued progress claim.
        retentionHeld:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: retentionToDate of the latest issued claim less issued retention releases.
    ContractItem:
      type: object
      description: A contract line. Never editable through the API.
      required: [id, projectId, sortOrder, description, quantity, rate, amount, taxPercent]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        projectId:
          type: string
          format: uuid
          readOnly: true
        sourceQuotationItemId:
          type: [string, 'null']
          format: uuid
          readOnly: true
        variationOrderId:
          type: [string, 'null']
          format: uuid
          readOnly: true
          description: Set for items added by an approved variation order.
        sectionTitle:
          type: [string, 'null']
          readOnly: true
        sortOrder:
          type: integer
          readOnly: true
        description:
          type: string
          readOnly: true
        unit:
          type: [string, 'null']
          readOnly: true
        quantity:
          allOf:
            - $ref: '#/components/schemas/Quantity'
          readOnly: true
        rate:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
        amount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
        taxPercent:
          allOf:
            - $ref: '#/components/schemas/Percent'
          readOnly: true
    VariationOrderSummary:
      description: Variation order header as returned in lists.
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [number, projectId, title, status, total]
          properties:
            number:
              type: string
              readOnly: true
              examples: [VO-2026-0001]
            projectId:
              type: string
              format: uuid
              readOnly: true
            title:
              type: string
            reason:
              type: [string, 'null']
            status:
              allOf:
                - $ref: '#/components/schemas/VariationStatus'
              readOnly: true
            approvedAt:
              type: [string, 'null']
              format: date-time
              readOnly: true
            total:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: Sum of item amounts. Negative for omissions.
            createdById:
              type: string
              format: uuid
              readOnly: true
    VariationOrder:
      description: Full variation order with items.
      allOf:
        - $ref: '#/components/schemas/VariationOrderSummary'
        - type: object
          required: [items]
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/VariationOrderItem'
    VariationOrderItem:
      type: object
      required: [id, description, quantity, rate, amount]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        variationOrderId:
          type: string
          format: uuid
          readOnly: true
        description:
          type: string
        unit:
          type: [string, 'null']
        quantity:
          allOf:
            - $ref: '#/components/schemas/Quantity'
          description: Negative for an omission.
        rate:
          $ref: '#/components/schemas/Money'
        amount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: round(quantity x rate, 2).
    VariationOrderInput:
      type: object
      description: Full variation order document. Item order is the array order.
      required: [title, items]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 300
        reason:
          type: [string, 'null']
        items:
          type: array
          items:
            $ref: '#/components/schemas/VariationOrderItemInput'
    VariationOrderItemInput:
      type: object
      required: [description, quantity, rate]
      properties:
        id:
          type: string
          format: uuid
          description: Id of an existing item to keep. Optional.
        description:
          type: string
          minLength: 1
        unit:
          type: [string, 'null']
          maxLength: 30
        quantity:
          allOf:
            - $ref: '#/components/schemas/Quantity'
          description: Negative for an omission.
        rate:
          $ref: '#/components/schemas/Money'
    VariationOrderList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/VariationOrderSummary'

    # -------------------------------------------------------------- Invoices
    InvoiceSummary:
      description: >-
        Invoice header as returned in lists. Used for all three invoice types. The claim
        fields (`claimNo`, `periodFrom`, `periodTo`, `grossToDate`, `retentionToDate`,
        `previousNetCertified`) are null unless `type` is PROGRESS_CLAIM.
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [type, clientId, status, subtotal, taxAmount, total, amountPaid, eInvoiceStatus]
          properties:
            number:
              type: [string, 'null']
              readOnly: true
              description: Assigned when the invoice is issued. Null while DRAFT.
              examples: [INV-2026-0001, PC-2026-0001]
            type:
              allOf:
                - $ref: '#/components/schemas/InvoiceType'
              readOnly: true
            projectId:
              type: [string, 'null']
              format: uuid
              description: Null is allowed for SIMPLE invoices only.
            project:
              oneOf:
                - $ref: '#/components/schemas/ProjectRef'
                - type: 'null'
              readOnly: true
            clientId:
              type: string
              format: uuid
            client:
              allOf:
                - $ref: '#/components/schemas/ClientSummary'
              readOnly: true
            status:
              allOf:
                - $ref: '#/components/schemas/InvoiceStatus'
              readOnly: true
            issueDate:
              type: [string, 'null']
              format: date
            dueDate:
              type: [string, 'null']
              format: date
              readOnly: true
              description: issueDate + payment term, set when the invoice is issued.
            claimNo:
              type: [integer, 'null']
              readOnly: true
              description: Consecutive claim number per project (1, 2, 3...).
            periodFrom:
              type: [string, 'null']
              format: date
            periodTo:
              type: [string, 'null']
              format: date
            grossToDate:
              allOf:
                - $ref: '#/components/schemas/NullableMoney'
              readOnly: true
              description: Sum of contract item amount x cumulativePercent / 100, including approved variation order items.
            retentionToDate:
              allOf:
                - $ref: '#/components/schemas/NullableMoney'
              readOnly: true
              description: min(grossToDate x retentionPercent / 100, currentContractSum x retentionCapPercent / 100).
            previousNetCertified:
              allOf:
                - $ref: '#/components/schemas/NullableMoney'
              readOnly: true
              description: grossToDate - retentionToDate of the previous ISSUED claim on the project. 0.00 for claim 1.
            taxPercent:
              oneOf:
                - $ref: '#/components/schemas/Percent'
                - type: 'null'
              readOnly: true
              description: >-
                Tax percent applied to the subtotal of a PROGRESS_CLAIM or RETENTION_RELEASE.
                Null for SIMPLE invoices, where tax is per line.
            subtotal:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: >-
                SIMPLE: sum of line amounts. PROGRESS_CLAIM: (grossToDate - retentionToDate) -
                previousNetCertified. RETENTION_RELEASE: the amount released.
            taxAmount:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
            total:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: subtotal + taxAmount.
            amountPaid:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: Sum of payment allocations.
            eInvoiceStatus:
              allOf:
                - $ref: '#/components/schemas/EInvoiceStatus'
              readOnly: true
            createdById:
              type: string
              format: uuid
              readOnly: true
    Invoice:
      description: >-
        Full invoice. `lines` is filled for SIMPLE invoices, `claimLines` for PROGRESS_CLAIM.
        A RETENTION_RELEASE has a single generated line.
      allOf:
        - $ref: '#/components/schemas/InvoiceSummary'
        - type: object
          required: [lines, claimLines, creditNotes]
          properties:
            notes:
              type: [string, 'null']
            pdfFileId:
              type: [string, 'null']
              format: uuid
              readOnly: true
            voidReason:
              type: [string, 'null']
              readOnly: true
            voidedAt:
              type: [string, 'null']
              format: date-time
              readOnly: true
            buyer:
              description: Client details copied when the invoice is issued (spec 04 AC11). Null while DRAFT.
              readOnly: true
              type: [object, 'null']
              properties:
                name: { type: [string, 'null'] }
                registrationNo: { type: [string, 'null'] }
                tin: { type: [string, 'null'] }
                sstNo: { type: [string, 'null'] }
                address: { type: [string, 'null'] }
            supplier:
              description: Company details copied when the invoice is issued (spec 04 AC11). Null while DRAFT.
              readOnly: true
              type: [object, 'null']
              properties:
                name: { type: [string, 'null'] }
                registrationNo: { type: [string, 'null'] }
                tin: { type: [string, 'null'] }
                sstNo: { type: [string, 'null'] }
                msicCode: { type: [string, 'null'] }
                address: { type: [string, 'null'] }
            eInvoiceUuid:
              type: [string, 'null']
              readOnly: true
            eInvoiceLongId:
              type: [string, 'null']
              readOnly: true
            eInvoiceValidatedAt:
              type: [string, 'null']
              format: date-time
              readOnly: true
            lines:
              type: array
              items:
                $ref: '#/components/schemas/InvoiceLine'
            claimLines:
              type: array
              items:
                $ref: '#/components/schemas/ClaimLine'
            creditNotes:
              type: array
              readOnly: true
              items:
                $ref: '#/components/schemas/CreditNote'
    InvoiceLine:
      type: object
      required: [id, sortOrder, description, quantity, rate, amount, taxPercent, taxAmount]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        invoiceId:
          type: string
          format: uuid
          readOnly: true
        sortOrder:
          type: integer
          readOnly: true
        description:
          type: string
        unit:
          type: [string, 'null']
        quantity:
          $ref: '#/components/schemas/Quantity'
        rate:
          $ref: '#/components/schemas/Money'
        amount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: round(quantity x rate, 2).
        taxPercent:
          allOf:
            - $ref: '#/components/schemas/Percent'
          readOnly: true
          description: Snapshot of the tax rate percent chosen with `taxRateId` in the input.
        taxAmount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: round(amount x taxPercent / 100, 2).
        classificationCode:
          type: [string, 'null']
          description: MyInvois classification code of the line.
    InvoiceLineInput:
      type: object
      required: [description, quantity, rate]
      properties:
        id:
          type: string
          format: uuid
          description: Id of an existing line to keep. Optional.
        description:
          type: string
          minLength: 1
        unit:
          type: [string, 'null']
          maxLength: 30
        quantity:
          $ref: '#/components/schemas/Quantity'
        rate:
          $ref: '#/components/schemas/Money'
        taxRateId:
          type: [string, 'null']
          format: uuid
          description: Tax rate of this line. The server stores its percent as `taxPercent`. Null means no tax.
        classificationCode:
          type: [string, 'null']
          maxLength: 10
    ClaimLine:
      type: object
      description: Cumulative progress of one contract item in a progress claim.
      required: [id, contractItemId, cumulativePercent, cumulativeQuantity, cumulativeAmount, previousAmount, thisClaimAmount]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        invoiceId:
          type: string
          format: uuid
          readOnly: true
        contractItemId:
          type: string
          format: uuid
        contractItem:
          allOf:
            - $ref: '#/components/schemas/ContractItem'
          readOnly: true
        cumulativePercent:
          $ref: '#/components/schemas/Percent'
        cumulativeQuantity:
          $ref: '#/components/schemas/Quantity'
        cumulativeAmount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: round(contract item amount x cumulativePercent / 100, 2).
        previousAmount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: cumulativeAmount of this item in the previous issued claim.
        thisClaimAmount:
          allOf:
            - $ref: '#/components/schemas/Money'
          readOnly: true
          description: cumulativeAmount - previousAmount.
        siteReportedPercent:
          oneOf:
            - $ref: '#/components/schemas/Percent'
            - type: 'null'
          readOnly: true
          description: Latest percent complete reported from site for this item (hint only), if any.
    ClaimLineInput:
      type: object
      description: >-
        Send either `cumulativePercent` or `cumulativeQuantity`; the server derives the other.
        If both are sent `cumulativePercent` wins.
      required: [contractItemId]
      anyOf:
        - required: [cumulativePercent]
        - required: [cumulativeQuantity]
      properties:
        contractItemId:
          type: string
          format: uuid
        cumulativePercent:
          allOf:
            - $ref: '#/components/schemas/Percent'
          description: Cannot be lower than in the previous issued claim and cannot exceed 100.
        cumulativeQuantity:
          $ref: '#/components/schemas/Quantity'
    SimpleInvoiceCreate:
      type: object
      required: [type, clientId, lines]
      properties:
        type:
          allOf:
            - $ref: '#/components/schemas/InvoiceType'
          description: Must be SIMPLE on this route.
        clientId:
          type: string
          format: uuid
        projectId:
          type: [string, 'null']
          format: uuid
        issueDate:
          type: [string, 'null']
          format: date
        notes:
          type: [string, 'null']
        lines:
          type: array
          description: May be empty while drafting. Line order is the array order.
          items:
            $ref: '#/components/schemas/InvoiceLineInput'
    SimpleInvoiceUpdate:
      type: object
      description: Full document of a DRAFT invoice of type SIMPLE.
      additionalProperties: false
      required: [clientId, lines]
      properties:
        clientId:
          type: string
          format: uuid
        projectId:
          type: [string, 'null']
          format: uuid
        issueDate:
          type: [string, 'null']
          format: date
        notes:
          type: [string, 'null']
        lines:
          type: array
          items:
            $ref: '#/components/schemas/InvoiceLineInput'
    ProgressClaimCreate:
      type: object
      properties:
        issueDate:
          type: [string, 'null']
          format: date
        periodFrom:
          type: [string, 'null']
          format: date
        periodTo:
          type: [string, 'null']
          format: date
        notes:
          type: [string, 'null']
        taxRateId:
          type: [string, 'null']
          format: uuid
          description: Tax rate applied to the claim subtotal. Defaults to the default tax rate.
    ProgressClaimUpdate:
      type: object
      description: >-
        Full document of a DRAFT invoice of type PROGRESS_CLAIM. Contract items without a
        claim line in the body keep the cumulative values of the previous issued claim.
      additionalProperties: false
      required: [claimLines]
      properties:
        issueDate:
          type: [string, 'null']
          format: date
        periodFrom:
          type: [string, 'null']
          format: date
        periodTo:
          type: [string, 'null']
          format: date
        notes:
          type: [string, 'null']
        taxRateId:
          type: [string, 'null']
          format: uuid
        claimLines:
          type: array
          items:
            $ref: '#/components/schemas/ClaimLineInput'
    RetentionReleaseCreate:
      type: object
      required: [amount]
      properties:
        amount:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Retention to release, before tax. Must be positive.
        issueDate:
          type: [string, 'null']
          format: date
        notes:
          type: [string, 'null']
        taxRateId:
          type: [string, 'null']
          format: uuid
          description: Tax rate applied to the amount. Defaults to the default tax rate.
    RetentionReleaseUpdate:
      type: object
      description: Full document of a DRAFT invoice of type RETENTION_RELEASE.
      additionalProperties: false
      required: [amount]
      properties:
        amount:
          $ref: '#/components/schemas/Money'
        issueDate:
          type: [string, 'null']
          format: date
        notes:
          type: [string, 'null']
        taxRateId:
          type: [string, 'null']
          format: uuid
    InvoiceVoidRequest:
      type: object
      required: [reason]
      properties:
        reason:
          type: string
          minLength: 1
          maxLength: 1000
    InvoiceList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/InvoiceSummary'
    CreditNote:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [number, invoiceId, issueDate, reason, subtotal, taxAmount, total, eInvoiceStatus]
          properties:
            number:
              type: string
              readOnly: true
              examples: [CN-2026-0001]
            invoiceId:
              type: string
              format: uuid
              readOnly: true
            issueDate:
              type: string
              format: date
            reason:
              type: string
            subtotal:
              $ref: '#/components/schemas/Money'
            taxAmount:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
            total:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: subtotal + taxAmount.
            eInvoiceStatus:
              allOf:
                - $ref: '#/components/schemas/EInvoiceStatus'
              readOnly: true
            eInvoiceUuid:
              type: [string, 'null']
              readOnly: true
            eInvoiceLongId:
              type: [string, 'null']
              readOnly: true
            eInvoiceValidatedAt:
              type: [string, 'null']
              format: date-time
              readOnly: true
            createdById:
              type: string
              format: uuid
              readOnly: true
    CreditNoteCreate:
      type: object
      required: [reason, subtotal]
      properties:
        issueDate:
          type: string
          format: date
          description: Defaults to today.
        reason:
          type: string
          minLength: 1
          maxLength: 1000
        subtotal:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Amount credited before tax. Must be positive.
        taxRateId:
          type: [string, 'null']
          format: uuid
          description: Tax rate used to calculate `taxAmount`. Null means no tax.

    # -------------------------------------------------------------- Payments
    Payment:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [clientId, receivedDate, method, amount, allocations]
          properties:
            clientId:
              type: string
              format: uuid
            client:
              allOf:
                - $ref: '#/components/schemas/ClientSummary'
              readOnly: true
            receivedDate:
              type: string
              format: date
            method:
              type: string
              examples: [BANK_TRANSFER, CHEQUE, CASH]
            reference:
              type: [string, 'null']
            amount:
              $ref: '#/components/schemas/Money'
            notes:
              type: [string, 'null']
            allocations:
              type: array
              items:
                $ref: '#/components/schemas/PaymentAllocation'
            unallocatedAmount:
              allOf:
                - $ref: '#/components/schemas/Money'
              readOnly: true
              description: amount less the sum of allocations.
            createdById:
              type: string
              format: uuid
              readOnly: true
    PaymentAllocation:
      type: object
      required: [invoiceId, amount]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        paymentId:
          type: string
          format: uuid
          readOnly: true
        invoiceId:
          type: string
          format: uuid
        invoiceNumber:
          type: string
          readOnly: true
        amount:
          $ref: '#/components/schemas/Money'
    PaymentAllocationInput:
      type: object
      required: [invoiceId, amount]
      properties:
        invoiceId:
          type: string
          format: uuid
        amount:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Must be positive.
    PaymentCreate:
      type: object
      required: [clientId, receivedDate, method, amount, allocations]
      properties:
        clientId:
          type: string
          format: uuid
        receivedDate:
          type: string
          format: date
        method:
          type: string
          minLength: 1
          maxLength: 30
          examples: [BANK_TRANSFER, CHEQUE, CASH]
        reference:
          type: [string, 'null']
          maxLength: 100
        amount:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Must be positive.
        notes:
          type: [string, 'null']
        allocations:
          type: array
          description: May be empty. The sum cannot exceed `amount`.
          items:
            $ref: '#/components/schemas/PaymentAllocationInput'
    PaymentList:
      allOf:
        - $ref: '#/components/schemas/Page'
        - type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/Payment'

    # -------------------------------------------------------------- Reports
    DashboardReport:
      type: object
      required: [activeProjects, quotationsAwaitingReply, invoicedThisMonth, receivedThisMonth, totalOutstanding, totalRetentionHeld, projectsWithNoReportYesterday]
      properties:
        activeProjects:
          type: integer
          description: Number of projects with status ACTIVE.
        quotationsAwaitingReply:
          type: object
          description: Latest revisions with status SENT and not expired.
          required: [count, value]
          properties:
            count:
              type: integer
            value:
              $ref: '#/components/schemas/Money'
        invoicedThisMonth:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Total of invoices issued in the current calendar month, less credit notes.
        receivedThisMonth:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Total of payments with receivedDate in the current calendar month.
        totalOutstanding:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Invoice totals less credit notes less amounts paid, over ISSUED and PARTIALLY_PAID invoices.
        totalRetentionHeld:
          $ref: '#/components/schemas/Money'
        projectsWithNoReportYesterday:
          type: array
          description: ACTIVE projects with no daily report for yesterday, when yesterday was a working day.
          items:
            $ref: '#/components/schemas/ProjectRef'
    ProjectSummaryReport:
      type: object
      required: [project, contractSum, approvedVariations, claimedToDate, paidToDate, outstanding, retentionHeld, percentClaimed, daysWithReports, workingDays, latestPhotos]
      properties:
        project:
          $ref: '#/components/schemas/ProjectRef'
        contractSum:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Original contract sum.
        approvedVariations:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Sum of APPROVED variation order totals.
        claimedToDate:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: grossToDate of the latest issued progress claim.
        paidToDate:
          $ref: '#/components/schemas/Money'
        outstanding:
          $ref: '#/components/schemas/Money'
        retentionHeld:
          $ref: '#/components/schemas/Money'
        percentClaimed:
          allOf:
            - $ref: '#/components/schemas/Percent'
          description: claimedToDate / (contractSum + approvedVariations) x 100.
        daysWithReports:
          type: integer
          description: Working days in the range that have at least one daily report.
        workingDays:
          type: integer
          description: Working days in the range (`from`..`to`, default project start date to today).
        latestPhotos:
          type: array
          items:
            $ref: '#/components/schemas/ReportPhoto'
    ReportPhoto:
      type: object
      required: [fileId, url, dailyReportId, reportDate]
      properties:
        fileId:
          type: string
          format: uuid
        url:
          type: string
          format: uri
          description: Short-lived presigned download URL.
        caption:
          type: [string, 'null']
        takenAt:
          type: [string, 'null']
          format: date-time
        dailyReportId:
          type: string
          format: uuid
        reportDate:
          type: string
          format: date
    AgeingBuckets:
      type: object
      description: Outstanding amounts by days overdue as of the report date.
      required: [current, days1To30, days31To60, days61To90, days90Plus, total]
      properties:
        current:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Not yet due.
        days1To30:
          $ref: '#/components/schemas/Money'
        days31To60:
          $ref: '#/components/schemas/Money'
        days61To90:
          $ref: '#/components/schemas/Money'
        days90Plus:
          $ref: '#/components/schemas/Money'
        total:
          $ref: '#/components/schemas/Money'
    ReceivablesAgeingReport:
      type: object
      required: [asOf, rows, totals]
      properties:
        asOf:
          type: string
          format: date
        rows:
          type: array
          description: One row per client with an outstanding balance.
          items:
            allOf:
              - $ref: '#/components/schemas/AgeingBuckets'
              - type: object
                required: [client]
                properties:
                  client:
                    $ref: '#/components/schemas/ClientSummary'
        totals:
          $ref: '#/components/schemas/AgeingBuckets'
    PipelineStatusRow:
      type: object
      required: [status, count, value]
      properties:
        status:
          $ref: '#/components/schemas/QuotationStatus'
        count:
          type: integer
        value:
          allOf:
            - $ref: '#/components/schemas/Money'
          description: Sum of quotation totals.
    QuotationPipelineReport:
      type: object
      required: [byStatus, winRate, byMonth]
      properties:
        from:
          type: [string, 'null']
          format: date
        to:
          type: [string, 'null']
          format: date
        byStatus:
          type: array
          items:
            $ref: '#/components/schemas/PipelineStatusRow'
        winRate:
          oneOf:
            - $ref: '#/components/schemas/Percent'
            - type: 'null'
          description: ACCEPTED count / (ACCEPTED + REJECTED + EXPIRED count) x 100. Null when the divisor is 0.
        byMonth:
          type: array
          items:
            type: object
            required: [month, byStatus, winRate]
            properties:
              month:
                type: string
                pattern: '^\d{4}-\d{2}$'
                examples: ['2026-11']
              byStatus:
                type: array
                items:
                  $ref: '#/components/schemas/PipelineStatusRow'
              winRate:
                oneOf:
                  - $ref: '#/components/schemas/Percent'
                  - type: 'null'
    BillingCollectionsReport:
      type: object
      required: [months, totals]
      properties:
        months:
          type: array
          description: One row per calendar month in the range, oldest first (12 months by default).
          items:
            type: object
            required: [month, invoiced, received]
            properties:
              month:
                type: string
                pattern: '^\d{4}-\d{2}$'
                examples: ['2026-11']
              invoiced:
                allOf:
                  - $ref: '#/components/schemas/Money'
                description: Total of invoices issued in the month, less credit notes.
              received:
                allOf:
                  - $ref: '#/components/schemas/Money'
                description: Total of payments received in the month.
        totals:
          type: object
          required: [invoiced, received]
          properties:
            invoiced:
              $ref: '#/components/schemas/Money'
            received:
              $ref: '#/components/schemas/Money'
    RetentionRegisterReport:
      type: object
      required: [rows, totals]
      properties:
        rows:
          type: array
          items:
            type: object
            required: [project, client, held, released, balance, expectedReleases]
            properties:
              project:
                $ref: '#/components/schemas/ProjectRef'
              client:
                $ref: '#/components/schemas/ClientSummary'
              held:
                allOf:
                  - $ref: '#/components/schemas/Money'
                description: retentionToDate of the latest issued progress claim.
              released:
                allOf:
                  - $ref: '#/components/schemas/Money'
                description: Sum of issued RETENTION_RELEASE invoices.
              balance:
                allOf:
                  - $ref: '#/components/schemas/Money'
                description: held - released.
              expectedReleases:
                type: array
                description: >-
                  Expected release dates derived from the project end date and
                  `defectsLiabilityMonths`. Empty when the project has no end date.
                items:
                  type: object
                  required: [date, amount, milestone]
                  properties:
                    date:
                      type: string
                      format: date
                    amount:
                      $ref: '#/components/schemas/Money'
                    milestone:
                      type: string
                      enum: [PRACTICAL_COMPLETION, END_OF_DEFECTS_LIABILITY]
        totals:
          type: object
          required: [held, released, balance]
          properties:
            held:
              $ref: '#/components/schemas/Money'
            released:
              $ref: '#/components/schemas/Money'
            balance:
              $ref: '#/components/schemas/Money'
    DailyReportComplianceReport:
      type: object
      required: [from, to, byProject, bySiteStaff]
      properties:
        from:
          type: string
          format: date
        to:
          type: string
          format: date
        byProject:
          type: array
          items:
            type: object
            required: [project, expected, submitted, compliancePercent]
            properties:
              project:
                $ref: '#/components/schemas/ProjectRef'
              expected:
                type: integer
                description: Working days in the range while the project was ACTIVE.
              submitted:
                type: integer
                description: Working days in the range with at least one report.
              compliancePercent:
                $ref: '#/components/schemas/Percent'
        bySiteStaff:
          type: array
          description: One row per SITE_STAFF member per project.
          items:
            type: object
            required: [user, project, expected, submitted, compliancePercent]
            properties:
              user:
                $ref: '#/components/schemas/UserSummary'
              project:
                $ref: '#/components/schemas/ProjectRef'
              expected:
                type: integer
              submitted:
                type: integer
              compliancePercent:
                $ref: '#/components/schemas/Percent'

`````
