# Spec 03 - Daily Site Reports (Mobile)

Status: DONE
Depends on: 01-foundation (can be built before 02)

## 1. Requirements

### User stories

- As SITE_STAFF, I can submit today's report for a project: photos, work done, manpower by trade, weather, issues or delays, and tomorrow's plan.
- As SITE_STAFF, I can fill in and save a report with no signal; it uploads by itself when I am back online.
- As SITE_STAFF, I can see my past reports and whether each has uploaded.
- As PROJECT_MANAGER, I can review reports for my projects on web or mobile and mark them reviewed.
- As OFFICE or PROJECT_MANAGER, I can produce a daily or weekly site report PDF to send to the client.

### Acceptance criteria

- AC1: A report can be created, edited and queued entirely offline. Nothing is lost if the app is closed before sync.
- AC2: Each report shows a clear state on the phone: Draft, Waiting to upload, Uploading, Uploaded, Failed (with retry).
- AC3: Sending the same report twice (retry after timeout) results in one report on the server.
- AC4: One report per user, per project, per date. A second attempt opens the existing report for editing.
- AC5: A report can be edited by its author until it is REVIEWED or 48 hours after the report date, whichever comes first.
- AC6: Photos are resized to at most 1600 px on the long edge before upload; up to 20 photos per report.
- AC7: The report records GPS position (if permission is granted) and the device time it was created. Missing GPS does not block submission.
- AC8: SITE_STAFF cannot read or write reports for projects they are not a member of (`403`).
- AC9: The report date can be today or up to 2 days back, never in the future.
- AC10: The site report PDF contains project details, date, weather, manpower table, work done, issues and a photo grid with captions. It contains no prices.

## 2. Design

### Tables

`DailyReport`, `DailyReportManpower`, `DailyReportPhoto`, optional `DailyReportProgress` - see `docs/02-data-model.md`.

### API

| Method | Route | Roles |
|---|---|---|
| GET | `/daily-reports?projectId=&from=&to=&submittedById=` | members; SITE_STAFF sees own project reports |
| GET | `/daily-reports/:id` | members |
| PUT | `/daily-reports/:id` | author; creates or updates (idempotent, ID from the phone) |
| POST | `/daily-reports/:id/review` | PROJECT_MANAGER, OFFICE, OWNER |
| GET | `/projects/:id/site-report.pdf?from=&to=` | PROJECT_MANAGER, OFFICE, OWNER |

Photos use `/files/presign` from spec 01, then are referenced by `fileId` in the `PUT` body.

### Mobile local storage (expo-sqlite)

```
local_report        id, projectId, reportDate, payload (json), syncState, lastError, updatedAt
local_photo         id, reportId, localUri, fileId (null until uploaded), caption, takenAt, uploadState
cached_project      id, payload (json), fetchedAt
```

`syncState`: DRAFT -> QUEUED -> SYNCING -> SYNCED | FAILED

### Sync worker

1. Triggered on app start, on connectivity regained, after submit, and by pull-to-refresh.
2. For each QUEUED report, oldest first:
   1. For each photo without `fileId`: presign, upload, store `fileId`. Resume from the first photo not yet uploaded.
   2. `PUT /daily-reports/:id` with the full payload.
   3. On 2xx mark SYNCED. On 4xx mark FAILED with the server message (no auto retry). On network error or 5xx keep QUEUED with backoff.
3. Only one sync run at a time.

### Mobile screens

- Project home: today's report status, "New report" button, recent reports
- Report form: date, weather chips, work done (multiline, voice dictation via keyboard), manpower rows (trade + headcount, remembers yesterday's trades), issues, tomorrow's plan, photos (camera or gallery, caption each)
- Report detail (read only once locked)
- Sync status banner and a "Pending uploads" list

Design for site conditions: large touch targets, works one-handed, high contrast for sunlight, few required fields (date, work done, at least one photo).

### Web screens

Daily report list per project with calendar view showing days with and without reports; report detail with photo viewer; review button; site report PDF export.

## 3. Tasks

- [x] T01 Prisma models and migration
- [x] T02 Zod schemas shared by API and mobile
- [x] T03 `PUT /daily-reports/:id` idempotent upsert with edit-window and membership rules
- [x] T04 List, detail and review endpoints
- [x] T05 Site report PDF template and endpoint
- [x] T06 e2e tests covering AC3, AC4, AC5, AC8, AC9
- [x] T07 Mobile: SQLite schema and repository layer
- [x] T08 Mobile: report form with draft autosave
- [x] T09 Mobile: camera/gallery capture, resize and compress
- [x] T10 Mobile: sync worker with resume, backoff and state reporting
- [x] T11 Mobile: project home, history, pending uploads, sync banner
- [x] T12 Mobile: GPS capture with graceful permission handling
- [x] T13 Mobile: offline cache of projects and recent reports
- [x] T14 Manual test pass in airplane mode and on a throttled connection
- [x] T15 Web: report list, calendar, detail, review, PDF export
- [x] T16 Internal distribution build (Android APK / TestFlight) and install guide for site staff

