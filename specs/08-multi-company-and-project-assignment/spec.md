# Spec 08 - Multi-Company Profiles, User Project Assignment & Active Project Selector

Status: DONE
Depends on: 01-foundation, 04-invoicing, 07-expenses

## 1. Requirements

### User stories

- As OWNER, I can register and manage multiple own/sister companies (each with its own name, short code, SSM registration no., TIN, SST no., address, and bank details), so that different projects can be run and billed under the appropriate company profile.
- As OWNER or OFFICE, when creating or editing a project, I can select which of our companies owns the project, so that quotations and invoices linked to that project print the correct company's letterhead, tax IDs, and bank account.
- As OWNER, when creating or editing a user on the Users page, I can record their company name (either one of our companies or an external subcontractor/partner company) and directly tick which projects they are assigned to.
- As any logged-in user (OWNER, OFFICE, PROJECT_MANAGER, SITE_STAFF), I can use a global **Active Project Selector** in the navigation bar to pick one of my assigned projects (or "All Projects") and quickly filter/jump to that project's work, daily reports, claims, and expenses.

### Acceptance criteria

- AC1: `OWNER` can create multiple `Company` records (`POST /api/v1/companies`), list them (`GET /api/v1/companies`), and update any company (`PATCH /api/v1/companies/:id`). `GET /api/v1/company` continues to return the default/primary company for backwards compatibility.
- AC2: A `Project` can optionally reference a `companyId` (`Company`). When an invoice is issued for a project that has a `companyId`, the invoice's supplier snapshot (`supplierName`, `supplierRegistrationNo`, `supplierTin`, `supplierSstNo`, `supplierAddress`) and PDF header use that project's company profile.
- AC3: A `User` has an optional `companyName` (and `companyId`) and can be assigned to projects (`projectIds: string[]`) directly from `POST /api/v1/users` and `PATCH /api/v1/users/:id`.
- AC4: `GET /api/v1/users` returns each user's `companyName` and assigned `projects` (`[{ id, code, name }]`).
- AC5: `PROJECT_MANAGER` and `SITE_STAFF` users only see the projects they are assigned to in `GET /api/v1/projects` and in the global Active Project Selector.
- AC6: In the Web UI, the left sidebar / header includes an **Active Project Selector** dropdown that persists the user's selected project and filters/navigates across pages.

## 2. Design

### Tables

`Company` additions:
- `singleton`: changed from `@unique @default(true)` to optional `Boolean?` (without unique constraint so multiple companies can exist)
- `code`: `String?` (short code e.g. `CB`, `MB`)
- `isDefault`: `Boolean @default(false)`
- `isActive`: `Boolean @default(true)`

`Project` additions:
- `companyId`: `String? @db.Uuid` -> references `Company(id)`

`User` additions:
- `companyId`: `String? @db.Uuid` -> references `Company(id)`
- `companyName`: `String?` (for external subcontractor/client/partner company name or own company name)

### API

| Method | Route | Roles |
|---|---|---|
| GET | `/api/v1/companies` | OWNER, OFFICE, PROJECT_MANAGER |
| POST | `/api/v1/companies` | OWNER |
| PATCH | `/api/v1/companies/:id` | OWNER |
| POST | `/api/v1/users` (accepts `companyName`, `companyId`, `projectIds`) | OWNER |
| PATCH | `/api/v1/users/:id` (accepts `companyName`, `companyId`, `projectIds`) | OWNER |

### Screens

- **Company Settings (`/settings`)**: Multi-company switcher at the top + **"+ Add Another Company"** modal/form so OWNER can manage multiple company profiles.
- **Users Page (`/users`)**: Shows **Company** and **Assigned Projects** columns, and lets OWNER assign a user's company and tick their assigned projects directly in the New/Edit User form.
- **Projects Page (`/projects`)**: Lets OWNER/OFFICE pick which Company a project belongs to and shows the company badge on each project.
- **Global Active Project Selector (`Layout.tsx`)**: Dropdown in the navigation bar allowing users to select their active project and filter pages by that project.

## 3. Tasks

- [x] T01 Update `@construction/shared` Zod schemas (`CompanyCreateSchema`, `ProjectCreateSchema`, `ProjectUpdateSchema`, `UserCreateSchema`, `UserUpdateSchema`)
- [x] T02 Update `schema.prisma`, `migration.sql`, and `InMemoryDatabase` for multi-company (`Company`), `Project.companyId`, and `User.companyName` / `User.companyId`
- [x] T03 Update `CompanyService`, `CompanyController`, `UsersService`, `ProjectsService`, `InvoicesService`, and `PdfService` to support multiple companies and direct user-to-project assignment
- [x] T04 Update Web `CompanySettingsPage`, `UsersPage`, and `ProjectsPage` for multi-company management and user project checkboxes
- [x] T05 Add Global Active Project Selector to Web `Layout.tsx` and connect project filtering across pages
- [x] T06 Write E2E test (`apps/api/test/multi-company.e2e.spec.ts`) verifying AC1-AC5
- [x] T07 Run build, typecheck, lint, and tests across workspaces
