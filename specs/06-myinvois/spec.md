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

