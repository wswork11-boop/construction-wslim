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

