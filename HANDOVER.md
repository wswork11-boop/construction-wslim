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
