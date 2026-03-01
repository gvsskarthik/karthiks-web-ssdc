# CLAUDE.md

## READ THIS FIRST — EVERY SESSION
**Before reading any source file, read `/srv/ssdc/PROJECT_CONTEXT.md`.**
It has: project status, all API endpoints, file locations, decisions made, and pending tasks.
This saves scanning the whole codebase. Everything needed is in that one file.
After completing any task, update PROJECT_CONTEXT.md to reflect the new state.

## Two Codebases — Two Locations
- **Web App (Spring Boot + JS)** → VPS at `/srv/ssdc/` — edit here via SSH Claude Code
- **Flutter Patient App** → Local Mac at `~/LOCAL_DISK/karthiks-web-ssdc/patient_app/` — edit there via Local Claude Code
- Both connect to the same backend API at `https://ssdclabs.online/api`

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SSDC Labs is a multi-tenant laboratory management system. Labs register accounts, onboard with test definitions, then manage patients, record test results, and generate reports. Billing tracks doctor referrals and due amounts.

- **Backend**: Spring Boot 3.5.11 (Java 17, Maven) — REST API at port 8080
- **Frontend**: Vanilla JS/HTML/CSS — no build tool, served statically
- **Database**: MySQL (`ssdclabs` DB, `ssdcuser` user)
- **Auth**: JWT (7-day TTL) + optional TOTP 2FA
- **Production**: https://ssdclabs.online — deployed via systemd (`ssdc-backend`)

## Commands

### Backend (run from `ssdclabs/`)
```bash
./mvnw clean package -DskipTests   # Build JAR (fast, skips tests)
./mvnw clean package               # Full build with tests
./mvnw test                        # Run all unit tests
./mvnw test -Dtest=ClassName       # Run a single test class
```

### Deployment
```bash
./deploy.sh   # git pull → Maven build → copy JAR → restart systemd service
```

### Frontend QA (run from repo root)
```bash
bash ssdc-frontend/qa/responsive_guard.sh
bash ssdc-frontend/qa/accessibility_guard.sh
bash ssdc-frontend/qa/performance_guard.sh
bash ssdc-frontend/qa/certification_guard.sh
```

### Service Management
```bash
systemctl restart ssdc-backend
systemctl status ssdc-backend
journalctl -u ssdc-backend -f      # Tail backend logs
```

## Architecture

### Backend (`ssdclabs/src/main/java/com/ssdc/ssdclabs/`)

Standard Spring MVC layering: **Controller → Service → Repository → JPA Entity**

All data is scoped to a `lab_id` — every table has a `lab_id` foreign key enforcing multi-tenancy. The authenticated lab's ID is extracted from the JWT in `JwtAuthFilter` and passed through to service calls.

**Request path for authenticated endpoints:**
`HTTP request → JwtAuthFilter (extract lab_id) → Controller → Service → Repository → MySQL`

Key config files:
- `config/SecurityConfig.java` — JWT stateless auth, CORS, which endpoints are public
- `config/JwtService.java` — token creation/validation (HMAC SHA256)
- `resources/application.properties` — DB, JWT secret, TOTP, mail (secrets via env vars)
- `resources/db/schema-reference.sql` — authoritative schema (DDL is `none`, schema managed manually)

### Frontend (`ssdc-frontend/`)

No framework, no bundler. Each "task" (feature area) is a pair of `.html` + `.js` (+ optional `.css`) files loaded into the dashboard.

**Core files:**
- `api.js` (1600+ lines) — All API calls, JWT token management (`sessionStorage`), response caching with TTL, request deduplication, lab profile prefetch, cross-tab logout broadcast
- `index.html/js` — Login/signup with 2FA flow
- `dashboard.html/script.js` — Shell that loads sub-task content
- `home/sub-tasks/` — 7 feature modules (1-home through 7-settings)

**API base URL**: defaults to `/api` (relative), overridable via `localStorage.SSDC_API_BASE_URL`.

**Auth flow:**
1. `POST /auth/login` → returns `{requiresTwoFactor, token}`
2. If 2FA: `POST /auth/verify-2fa-login` → returns final JWT
3. JWT stored in `sessionStorage` (cleared on tab close); attached as `Authorization: Bearer <token>` on every request

### Key Domain Concepts

- **Lab**: The tenant. Identified by a 3–6 char alphanumeric `app_login_id`. Owns all other entities.
- **Patient**: Has a `status` of `"NOT COMPLETE"` or `"COMPLETED"`. Linked to a doctor (referral).
- **Test**: Has `TestParameter`s with units, `NormalRange`s (male/female/other), and a `TestType` (`NUMERIC`, `TEXT`, `CHOICE`).
- **TestGroup**: A named bundle of Tests for ordering multiple tests together.
- **ReportResult**: Stores the result values per patient per test parameter.
- **Onboarding**: New labs import test templates from the `admin1` lab via `/onboarding/import`.

### Environment Variables (production)

| Variable | Purpose |
|---|---|
| `SPRING_DATASOURCE_PASSWORD` | MySQL password |
| `APP_JWT_SECRET` | JWT signing key (also default TOTP encryption key) |
| `APP_TOTP_ENCRYPTION_KEY` | TOTP secret encryption key |
| `SPRING_MAIL_PASSWORD` | Gmail App Password |

### Database Notes

- Schema is **not auto-managed** (`ddl-auto=none`). Schema changes must be applied manually via SQL against MySQL.
- `schema-reference.sql` is the canonical schema — consult it before writing queries or adding columns.
- All timestamps stored/displayed in IST (`Asia/Kolkata`).

### Testing

- Backend tests use H2 in-memory DB (configured automatically in the test scope).
- Test files live in `ssdclabs/src/test/java/com/ssdc/ssdclabs/service/`.
- Frontend has no automated test suite — quality is validated via the bash guard scripts in `ssdc-frontend/qa/`.
