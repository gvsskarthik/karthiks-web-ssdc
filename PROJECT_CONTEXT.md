# PROJECT_CONTEXT.md
# Single source of truth. Claude reads THIS file instead of scanning the whole codebase.
# UPDATE THIS FILE whenever a feature is completed or a decision is made.

---

## Project Status (Last updated: 2026-03-01)

### Web App — VPS at /srv/ssdc/
| Module | Status | Key Files |
|---|---|---|
| Auth (login, 2FA, JWT) | Done | AuthController.java, JwtService.java, SecurityConfig.java |
| Patient management | Done | PatientController.java, PatientService.java, 2-patient.html/js |
| Test management | Done | TestController.java, TestService.java, 5-tests.html/js |
| Reports view | Done | ReportService.java, 3-reports.html/js |
| Accounts/Billing | Done | AccountsController.java, 4-accounts.html/js |
| Doctor management | Done | DoctorController.java, 6-doctor.html/js |
| Settings | Done | PrintSettingsController.java, 7-settings.html/js |
| Dashboard | Done | DashboardController.java, dashboard.html/script.js |
| Patient App API | Done | PatientAppController.java |

### Flutter Patient App — in /srv/ssdc/patient_app/ (also on Mac at ~/Desktop/patient_app_base/)
| Screen | Status | File |
|---|---|---|
| Login screen | Done | lib/screens/login_screen.dart |
| Patient list screen | Done | lib/screens/patient_list_screen.dart |
| Report screen | Done | lib/screens/report_screen.dart |
| PDF share | Done | lib/utils/pdf_generator.dart |
| API service | Done | lib/services/api_service.dart |
| Secure storage | Done | lib/services/storage_service.dart |

### Flutter Doctor App — NOT STARTED YET

---

## Key Architecture Decisions

### Web App
- Multi-tenant: every table has lab_id FK. All service calls take labId from JWT.
- No ORM migrations — schema managed manually via SQL. Reference: ssdclabs/src/main/resources/db/schema-reference.sql
- Frontend is vanilla JS — no React/Vue. Files in ssdc-frontend/home/sub-tasks/
- api.js (1600+ lines) is the single JS file for all API calls + caching + auth

### Flutter Patient App
- Packages: http, flutter_secure_storage, pdf, printing, intl
- Auth: POST /patient-app/login stores mobile+name in secure storage (no JWT yet)
- Auto-login: checks secure storage on startup, skips login if session exists
- Abnormal values: parsed from normalRange string (formats: "12-17", "< 200", "> 4.5")
- PDF: generated in-memory, shared via native share sheet (no file saved to disk)
- Lab name "SAI SREE SWETHA DIAGNOSTICS" is hardcoded in report_screen.dart and pdf_generator.dart

---

## API Endpoints Reference

### Lab (Web App) — requires JWT header
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /auth/login | Lab login |
| POST | /auth/verify-2fa-login | 2FA verify |
| GET | /patients | List patients |
| POST | /patients | Create patient |
| GET | /report-results | Get report results |
| GET | /doctors | List doctors |
| GET | /tests | List tests |
| GET | /dashboard/stats | Dashboard stats |

### Patient App — mobile verification (no JWT)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /patient-app/login | Patient login (mobile+password) returns patientId, name, mobile |
| GET | /patient-app/visits?mobile= | All visits (only if patient has app credentials) |
| GET | /patient-app/report/{patientId}?mobile= | Report for a visit (mobile must match patient) |
| POST | /patient-app/change-password | Change patient password |
| POST | /patient-app/generate-credentials/{patientId} | Lab staff: generate 6-digit password (requires lab JWT) |

---

## Database — Key Tables
```
lab           -> id, app_login_id, name, email, password, ...
patient       -> id, lab_id, name, age, gender, mobile, address, visit_date, status, doctor, password, app_login_id
test          -> id, lab_id, name, test_type (NUMERIC/TEXT/CHOICE)
test_parameter -> id, test_id, name, unit
normal_range  -> id, parameter_id, gender, min_value, max_value, text_value
report_result -> id, lab_id, patient_id, parameter_id, result_value
```

---

## File Locations — VPS (/srv/ssdc/)
```
ssdclabs/src/main/java/com/ssdc/ssdclabs/
  controller/     <- HTTP endpoints
  service/        <- Business logic
  repository/     <- JPA DB queries
  model/          <- JPA entities
  dto/            <- Data transfer objects
  config/         <- Security, JWT config

ssdc-frontend/
  index.html/js   <- Login page
  dashboard.html  <- Main shell
  api.js          <- ALL API calls (read before touching frontend API)
  home/sub-tasks/ <- Feature modules (1-home to 7-settings)

patient_app/      <- Flutter source (same as ~/Desktop/patient_app_base/ on Mac)
```

---

## Environment Variables (production — /etc/ssdc/ssdc-backend-secrets.env)
| Variable | Purpose |
|---|---|
| SPRING_DATASOURCE_PASSWORD | MySQL password |
| APP_JWT_SECRET | JWT signing key (also default TOTP encryption key) |
| APP_TOTP_ENCRYPTION_KEY | TOTP secret encryption key |
| SPRING_MAIL_PASSWORD | Gmail App Password |
| APP_EDIT_PIN | PIN required to edit/reopen a COMPLETED patient record |

---

## Pending / TODO
- Flutter Doctor App (not started)
- Patient App: proper JWT auth (currently uses mobile-matching verification, no session token)
- Patient App: publish to Play Store / App Store
- Patient App: dynamic lab name (currently hardcoded "SAI SREE SWETHA DIAGNOSTICS")
- Add FK constraints on lab_id in doctors, tests, test_groups tables
- Test on physical Android device

---

## Important Rules
- Schema changes: write SQL manually, apply to MySQL, then update schema-reference.sql
- Deploy: always use ./deploy.sh from /srv/ssdc/ (runs tests + backup + health check + auto-rollback)
- Flutter changes: edit files in /srv/ssdc/patient_app/ and commit/push from VPS. The Mac copies from git.
- Spring Boot version: 3.5.11
- Edit PIN: controlled by APP_EDIT_PIN env var in /etc/ssdc/ssdc-backend-secrets.env
- deploy.sh runs tests by default. Use ./mvnw clean package -DskipTests only for quick local checks.
