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
| `Client` | code (short code, e.g. `ACM`), name, registrationNo, tin, sstNo, address, contactName, phone, email, isActive |
| `Project` | code (unique, e.g. `P26-014`), name, clientId, contractQuotationId, contractQuoteRef (e.g. `QT-26-014-ACM-R1`), poNumber, siteAddress, status, startDate, endDate, contractSum, retentionPercent, retentionCapPercent, defectsLiabilityMonths |
| `ProjectMember` | projectId, userId - unique pair |
| `File` | bucketKey, fileName, mimeType, size, purpose, status (PENDING/READY), uploadedById |
| `AuditLog` | userId, entity, entityId, action, before (json), after (json), at |

## Quotations (spec 02)

| Table | Key fields |
|---|---|
| `Quotation` | number (`QT-26-014-ACM`), rootId (first revision's id), revisionNo, clientId, projectId (nullable), title, status, issueDate, validUntil, terms, notes, subtotal, discountAmount, taxAmount, total, pdfFileId |
| `QuotationSection` | quotationId, sortOrder, title |
| `QuotationItem` | quotationId, sectionId, sortOrder, description, unit, quantity, rate, amount, taxRateId, taxPercent (snapshot) |

Revisions share `number` and `rootId`; `revisionNo` increases. Displayed as `QT-26-014-ACM-R0` -> `QT-26-014-ACM-R1`. Accepting the winning revision can automatically create/link Project `P26-014` with `contractQuoteRef = QT-26-014-ACM-R1`.

## Contract and variations (spec 04)

| Table | Key fields |
|---|---|
| `ContractItem` | projectId, sourceQuotationItemId, variationOrderId (nullable), sectionTitle, sortOrder, description, unit, quantity, rate, amount, taxPercent |
| `VariationOrder` | number (`QT-26-014-ACM-VO01`), shortRef (`VO-01`), projectId, title, reason, status, approvedAt, total (can be negative for omissions) |
| `VariationOrderItem` | variationOrderId, description, unit, quantity, rate, amount |

`ContractItem` rows are copied from the accepted quotation when it is converted to a contract,
so later quotation changes never alter the contract. Approving a variation order appends
`ContractItem` rows linked to it.

## Invoicing (spec 04)

| Table | Key fields |
|---|---|
| `Invoice` | number (unbroken tax sequence `INV-26-0045` across all types), type, projectId (nullable for SIMPLE), clientId, status, issueDate, dueDate, claimNo (progress claims), progressReportId, projectCodeRef (`P26-014`), quotePoRef (`QT-26-014-ACM-R1`), claimReportRef (`PC-01 / PR-P26014-001` or `PC-02 / VO-01` or `RET`), referenceSummary (`P26-014 / PC-01 / PR-P26014-001`), periodFrom, periodTo, grossToDate, retentionToDate, previousNetCertified, subtotal, taxAmount, total, amountPaid, notes, pdfFileId, eInvoiceStatus, eInvoiceUuid, eInvoiceLongId, eInvoiceValidatedAt |
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

