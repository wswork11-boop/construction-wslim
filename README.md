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
| [specs/07-expenses/spec.md](specs/07-expenses/spec.md) | Project & company expenses (job costing) |

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
| 01 Foundation | Done |
| 02 Quotations | Done |
| 03 Daily reports | Done |
| 04 Invoicing | Done |
| 05 Reports | Done |
| 06 MyInvois | Draft - LHDN rules to be verified |
| 07 Expenses | Done |

## Next step

1. Review the mockups and document layouts and note any changes.
2. On a machine with Node.js and Docker (or a cloud session), start at
   `specs/01-foundation/spec.md`, task T01. The first job there is to run
   `prisma validate` on the schema and lint the OpenAPI file.
