# Spec 01 - Foundation

Status: DONE
Depends on: nothing

## 1. Requirements

### User stories

- As an OWNER, I can create users and assign a role, so staff can log in.
- As any user, I can log in on web or mobile and stay logged in on my device.
- As an OWNER, I can set company details (name, SSM number, TIN, SST number, logo, bank details) that appear on documents.
- As OFFICE, I can manage clients.
- As OFFICE, I can create a project for a client and assign project managers and site staff to it.
- As SITE_STAFF or PROJECT_MANAGER, I only see projects I am a member of.

### Acceptance criteria

- AC1: Login with a wrong password returns `401 INVALID_CREDENTIALS`; 5 failures in 15 minutes locks further attempts for that email for 15 minutes.
- AC2: Access token expires after 15 minutes; the refresh token returns a new pair and invalidates the old refresh token.
- AC3: A deactivated user cannot log in and existing refresh tokens stop working.
- AC4: SITE_STAFF calling `GET /projects` receives only member projects, with `contractSum` absent from the response.
- AC5: SITE_STAFF calling any `/quotations`, `/invoices`, `/payments` route receives `403`.
- AC6: Client and project `code`/`email` uniqueness violations return `409` with a clear code.
- AC7: Two concurrent requests for the next document number never receive the same number.
- AC8: Creating, updating or deactivating a user, client or project writes an `AuditLog` row.

## 2. Design

### Tables

`User`, `RefreshToken`, `Company`, `TaxRate`, `DocumentSequence`, `Client`, `Project`, `ProjectMember`, `File`, `AuditLog` - see `docs/02-data-model.md`.

### API

| Method | Route | Roles |
|---|---|---|
| POST | `/auth/login` | public |
| POST | `/auth/refresh` | public |
| POST | `/auth/logout` | any |
| GET | `/auth/me` | any |
| POST | `/auth/change-password` | any |
| GET, POST | `/users` | OWNER |
| GET, PATCH | `/users/:id` | OWNER |
| GET, PATCH | `/company` | GET any, PATCH OWNER |
| GET, POST, PATCH | `/tax-rates` | GET OFFICE+, write OWNER |
| GET, POST | `/clients` | OWNER, OFFICE |
| GET, PATCH | `/clients/:id` | OWNER, OFFICE |
| GET, POST | `/projects` | GET any (filtered), POST OWNER, OFFICE |
| GET, PATCH | `/projects/:id` | GET member, PATCH OWNER, OFFICE |
| PUT | `/projects/:id/members` | OWNER, OFFICE |
| POST | `/files/presign` | any |
| GET | `/files/:id/url` | any with access to the parent record |

### Key components

- `JwtAuthGuard` (global), `RolesGuard`, `@Roles()`, `@CurrentUser()`, `@Public()`
- `ProjectAccessService.assertMember(user, projectId)` - OWNER and OFFICE always pass
- `SequenceService.next(docType, tx)` - `SELECT ... FOR UPDATE` on the sequence row inside the caller's transaction
- `AuditInterceptor` or explicit `AuditService.log()` calls in services
- Seed script: one OWNER user (credentials from env), company row, default tax rates

### Web screens

Login, Users list/form, Company settings, Clients list/form, Projects list/form/detail with member assignment.

### Mobile screens

Login, My projects list, Project detail (no prices), Profile/logout.

## 3. Tasks

- [x] T01 Create monorepo: pnpm workspaces, Turborepo, shared tsconfig, ESLint, Prettier
- [x] T02 Docker Compose for postgres, redis, minio; `.env.example`
- [x] T03 Scaffold `apps/api` (NestJS), config module with env validation, health endpoint
- [x] T04 Prisma setup, foundation schema, first migration, seed script
- [x] T05 `packages/shared`: enums, Zod schemas for auth/users/clients/projects, money helpers
- [x] T06 Auth module: login, refresh rotation, logout, change password, rate limit
- [x] T07 Guards and decorators: JWT, roles, current user, project access
- [x] T08 Users module
- [x] T09 Company and tax-rates module, `SequenceService` with concurrency test
- [x] T10 Clients module
- [x] T11 Projects and members module, price stripping for SITE_STAFF
- [x] T12 Files module with presigned upload/download
- [x] T13 Audit log service
- [x] T14 Global error filter, pagination helper, Swagger docs
- [x] T15 e2e tests covering AC1-AC8
- [x] T16 Scaffold `apps/web`: routing, auth store, API client with token refresh, layout
- [x] T17 Web screens: login, users, company, clients, projects
- [x] T18 Scaffold `apps/mobile` (Expo): navigation, secure token storage, API client
- [x] T19 Mobile screens: login, my projects, project detail, profile
- [x] T20 CI: lint, type-check, test on every push

