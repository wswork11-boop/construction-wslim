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

- `pnpm build` - build all packages and applications
- `pnpm dev` - start API and web dev servers
- `pnpm lint` - run ESLint across all workspaces
- `pnpm typecheck` - run TypeScript type checking across all workspaces
- `pnpm test` - run all unit and e2e tests
- `pnpm --filter @construction/api prisma:validate` - validate Prisma schema
- `pnpm --filter @construction/api prisma:migrate` - run database migrations
- `pnpm --filter @construction/api prisma:seed` - seed initial OWNER user, company and tax rates
