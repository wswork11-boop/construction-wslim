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

