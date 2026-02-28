# CLAUDE.md — Flutter Patient App

## READ THIS FIRST — EVERY SESSION
Everything you need is in this file. Do NOT scan the whole codebase.
Only open a specific file when you need to change it.

---

## What This App Is
Flutter patient app for SSDC Labs.
Patients log in using mobile + password sent by the lab via WhatsApp.
They view their medical reports and share them as PDF.

## Backend API
Base URL: `https://ssdclabs.online/api`

| Method | Endpoint | Body / Params | Returns |
|---|---|---|---|
| POST | /patient-app/login | `{mobile, password}` | `{patientId, name, mobile}` |
| GET | /patient-app/visits | `?mobile=9876543210` | `List<Patient>` |
| GET | /patient-app/report/{id} | — | `List<ReportItem>` |
| POST | /patient-app/change-password | `{mobile, oldPassword, newPassword}` | `{status}` |

## App Structure
```
lib/
├── main.dart                     ← entry point, auto-login check on startup
├── models/
│   ├── patient.dart              ← id, name, age, gender, mobile, address, visitDate, status, doctor
│   └── report_item.dart         ← testId, testName, parameterName, resultValue, unit, normalRange
├── services/
│   ├── api_service.dart         ← all HTTP calls
│   └── storage_service.dart     ← flutter_secure_storage (keys: patient_mobile, patient_name)
├── screens/
│   ├── login_screen.dart        ← mobile + password login
│   ├── patient_list_screen.dart ← list of visits, each card shows name/age-sex/date/address/status
│   └── report_screen.dart       ← report grouped by testName + PDF share button
└── utils/
    ├── theme.dart               ← primary=#1565C0, abnormal=#D32F2F, background=#F5F7FA
    └── pdf_generator.dart       ← pdf + printing packages, Printing.sharePdf()
```

## Key Decisions
- Packages: `http`, `flutter_secure_storage`, `pdf`, `printing`, `intl`
- Abnormal detection: parses normalRange string → shows result in red and bold
- Report grouped by testName in both UI and PDF
- Auto-login: reads secure storage on startup → goes directly to patient list if session exists
- PDF shared via native share sheet — no file saved to disk

## Status
- [x] Login screen
- [x] Patient list with name/age-sex/date/address/status badge
- [x] Report screen with abnormal value highlighting
- [x] PDF generation and share
- [ ] JWT auth for patient endpoints (security gap)
- [ ] Doctor app (separate project, not started)
- [ ] Play Store / App Store publish

## Run Commands
```bash
flutter pub get       # install packages (run this first)
flutter run           # run on emulator/device
flutter build apk     # build Android APK
```

## If You Get Errors
- Paste error in LOCAL VSCode Claude Code (not SSH Claude Code)
- This project is on your Mac, not on the VPS
