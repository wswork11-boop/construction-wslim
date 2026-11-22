# Spec 05 - Reports and Dashboard

Status: DONE
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

- [x] T01 Seed data set with known expected totals for report tests
- [x] T02 Dashboard endpoint and tests
- [x] T03 Project summary endpoint and tests
- [x] T04 Receivables ageing endpoint and tests
- [x] T05 Quotation pipeline and billing/collections endpoints
- [x] T06 Retention register endpoint
- [x] T07 Daily report compliance endpoint
- [x] T08 Excel export helper
- [x] T09 Indexes and query timing check against AC4
- [x] T10 Web: dashboard
- [x] T11 Web: report pages with filters and export
- [x] T12 Web: project summary tab

