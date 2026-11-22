# Spec 02 - Quotations

Status: DONE
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

- [x] T01 Prisma models and migration
- [x] T02 Zod schemas and `QuotationCalculator` with unit tests (rounding, discount, mixed tax rates)
- [x] T03 CRUD endpoints with full-document `PUT`
- [x] T04 Status transitions: send, accept, reject, revise, duplicate
- [x] T05 Expiry handling
- [x] T06 `PdfService` and quotation HTML template
- [x] T07 Store PDF on send; preview with DRAFT watermark
- [x] T08 e2e tests covering AC1-AC9
- [x] T09 Web: quotation list
- [x] T10 Web: quotation editor with sections, reorder, live totals
- [x] T11 Web: send/accept/reject/revise flows and revision history
- [x] T12 Web: PDF preview and download

