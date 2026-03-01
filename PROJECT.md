# SSDC Labs — Project Document

---

## Abstract

**SSDC Labs** is a cloud-based diagnostic laboratory management platform consisting of three interconnected applications:

1. **Lab Web App** — For lab staff to manage patients, tests, reports, billing, and doctors
2. **Patient App** — For patients to log in and view their own test reports
3. **Doctor App** — For referring doctors to view their patients' reports and billing

The platform is multi-tenant — each lab has its own isolated data. The backend is a Spring Boot REST API connected to a MySQL database. The lab web app is built in vanilla JavaScript/HTML/CSS served statically. The patient and doctor apps currently exist as web-based portals (not native mobile apps).

---

## 1. Application 1 — Lab Web App (ssdclabs.online)

### 1.1 Entry & Authentication

- User visits `ssdclabs.online` → sees a **login page**
- After login → redirected to **Dashboard**
- Optional: Two-step verification (TOTP via authenticator app) can be enabled per lab

### 1.2 Dashboard Layout

```
┌──────────────────────────────────────────────────┐
│  NAVBAR  [Lab Name Heading]                      │
├────────────┬─────────────────────────────────────┤
│  SIDEBAR   │                                     │
│  - Home    │         MAIN CONTENT (iframe)       │
│  - Patients│                                     │
│  - Reports │                                     │
│  - Accounts│                                     │
│  - Tests   │                                     │
│  - Doctors │                                     │
│  - Settings│                                     │
└────────────┴─────────────────────────────────────┘
```

---

### 1.3 Page: Home (Default after login)

**Stats Row**
- Total patients registered: Today / This Week / This Month / This Year

**Pending Patients Table**
- Combined list of: pending patients + patients with bill due
- Columns: Name, Doctor, Status, Due Amount

**Summary Row**
- Today's count: Total | Pending | Completed

---

### 1.4 Page: Patients

**Filters:** Doctor filter | Date picker | [+ New Patient] button

**Table columns:** S.No | Name | Doctor | Total Bill | Due | Status | Options

**Options per row:**
- **Select** — choose this patient to enter results
- **Edit** — edit patient registration details
- **Bill** — view/edit billing
- **Delete** — remove patient

**New Patient Registration Flow:**
1. Fill: Name, Age, Sex, Phone Number, Address
2. Select Doctor (from registered doctors list)
3. Select Tests — search by name or shortcut; tests and groups both visible and selectable
4. Selected tests listed with individual prices → Total Amount shown
5. Enter: Discount → Final Payable → Paid Now → Due (auto-calculated)
6. Click **Save** → goes to **Enter Values** page

**Enter Values Page:**
- One input section per selected test
- Enter results for all parameters of each test
- Click **Save** → goes to **Results / Report** page

**Results / Report Page:**
- Displays formatted report with patient details + all test values
- Buttons: **Save** (back to patients) | **Complete** (locks patient, enables print/share) | **Print** | **Download** | **Share**
- Once marked **Complete**: patient record is locked; unlocking requires a PIN
- After Complete: Print/Download/Share become active

**Edit Patient:**
- Opens existing patient details pre-filled
- Save updates the record

---

### 1.5 Page: Reports

**Filters:** Doctor filter | Date picker | Patient name or mobile search

**Table columns:** S.No | Name | Doctor | Status | Report View | Inform

- **Report View** — opens the report for that patient
- **Inform** — sends message to patient (enabled only when status is Completed)
- Clicking patient name → opens **Enter Values** page with existing saved values for editing

---

### 1.6 Page: Accounts

**Summary Boxes:**
| Box | Description |
|---|---|
| Total Revenue | Sum of all final payable amounts |
| Discounts Given | Total discounts applied |
| Total Due | Click → opens list of all due patients |
| Total Commission | Sum of doctor commissions |
| Net Profit | Revenue − Discounts − Commission |

**Filters:** Doctor name | Date From | Date To | [Apply] | [Export Excel]

**Table columns:** Date | Report ID | Patient | Doctor | Bill | Due | Commission

> **Report ID format:** `DD-MM-LABID-SNO` (e.g., `27-02-ssdc-1`)

---

### 1.7 Page: Tests

**Top:** [+ New Test] [+ New Group] | Filter: All / Single / Group

**Tests Table columns:** S.No | Test Name | Category | Cost | Active | Options (Edit, Delete)

---

#### New Test Form

| Field | Type | Notes |
|---|---|---|
| Test Name | Text input | |
| Shortcut | Text input | Used for quick search |
| Category | Dropdown | |
| Cost | Number input | |
| Active | Checkbox | If checked, test is selectable for patients |
| Parameters | Checkbox | If checked, enables parameter entry |
| Show test name in report | Checkbox | |

**Parameters Section** (when Parameters checkbox is checked):
- [+ Add Parameter] button → adds a row per click (unlimited)
- Each parameter row has:
  - Parameter Name input
  - Units input
  - Value Type (Numeric / Text)
  - Default Result checkbox → if checked: shows default value input + [+ Add] for multiple default options
  - Add New Line checkbox → if checked: in the Enter Values page, a [+ Add Line] button appears so the lab user can add multiple result lines per parameter

**Normal Values Section:**
- [+ Add] button → adds input row per click (unlimited)
- Stores reference range values (plain text)

Save → stores to database (plain text) → returns to Tests page

---

#### New Group Form

| Field | Type |
|---|---|
| Group Name | Text input |
| Group Shortcut | Text input |
| Category | Dropdown |
| Cost | Number input |
| Active | Checkbox |
| Show group name in report | Checkbox |

**Add Tests to Group:**
- [+ Add Test] → opens a table with a search input (type name or shortcut)
- Matching tests appear → click to select; selected test details shown below
- Unlimited tests can be added

**Add Subgroup to Group:**
- [+ Add Group] → opens a table with search input (groups only)
- Unlimited subgroups can be nested inside a group

Save → stores group with all linked test/group IDs (plain text) → returns to Tests page

---

### 1.8 Page: Doctors

**Top:** [+ New Doctor] button

**Table columns:** S.No | Doctor Name | Specialisation | Hospital | Phone | This Month Profit (₹) | This Month Share (₹) | Options (Edit, Delete)

**New Doctor Form:**
| Field | Type |
|---|---|
| Doctor Name | Text input |
| Specialization | Text input |
| Phone Number | Text input |
| Hospital Name | Text input |
| Share % | Number input (commission %) |

Save → database → returns to Doctors page

---

### 1.9 Page: Settings

- **Lab Name** — editable
- **Change Password**
- **2-Step Verification** — enable/disable TOTP authenticator app (default: disabled)

---

## 2. Application 2 — Patient App

### Flow

1. Patient installs app (or opens web portal)
2. Sees **Login Page** — enters ID + Password
   - ID and password are generated by the lab and sent to the patient after their report is completed
3. After login → sees a list of **patient names** that match their mobile number (covers cases where multiple family members registered under same number)
4. Patient clicks on their name → sees **list of visits** (one entry per visit date)
   - If visited once: 1 entry; if multiple visits: multiple entries
5. Patient clicks on a visit → sees the **full report** (same format as lab's report view)
   - Can **Download** and **Share** the report

### Authentication
- Login credentials: mobile number (as ID) + auto-generated password
- Sent to patient by the lab after marking the report as Complete

---

## 3. Application 3 — Doctor App

### Flow

1. Doctor opens app → sees **Login Page** — enters ID + Password
   - Credentials generated and shared by the lab
2. After login → sees **date-wise list** of patients referred by this doctor
3. Can click on a patient → view their **report** (same format as lab)
4. Can access **Accounts** — shows their billing summary, commission earned
5. Can access **Reports** — filter by date, view specific patient reports

### Key Difference from Patient App
- Doctor sees **all patients they referred**, not just their own
- Sees financial data (commission, bills)

---

## 4. What Is Already Built

| Feature | Status |
|---|---|
| Lab login, signup, email verification | ✅ Done |
| 2FA (TOTP authenticator) | ✅ Done |
| Password reset via email | ✅ Done |
| Patient registration | ✅ Done |
| Test creation with parameters and normal ranges | ✅ Done |
| Test groups with subgroup nesting | ✅ Done |
| Enter test values / results | ✅ Done |
| Report view and print | ✅ Done |
| Patient status (Complete / Pending) | ✅ Done |
| Billing tracking (paid, due, discount) | ✅ Done |
| Accounts page with doctor-wise summary | ✅ Done |
| Doctor management | ✅ Done |
| Dashboard home summary | ✅ Done |
| Lab name and print settings | ✅ Done |
| Onboarding (import test templates for new labs) | ✅ Done |
| Patient App login endpoint (`/patient-app/login`) | ✅ Done (backend) |
| Patient App visit list and report view | ✅ Done (backend) |
| WhatsApp report sharing (service layer) | ⚠️ Partial |
| Doctor App login/portal | ❌ Not started |
| Patient App frontend (Flutter — login, visits, report, PDF share) | ✅ Done |
| Doctor App frontend (separate UI) | ❌ Not started |
| Unlock completed patient with PIN | ❌ Not started |
| Report ID format (DD-MM-LABID-SNO) | ⚠️ Check needed |
| Export accounts to Excel | ⚠️ Check needed |
| Inform patient (send message when complete) | ⚠️ Partial |

---

## 5. What Is Missing — Development Plan

### Priority 1: Security Fix (Patient App)
**Problem:** Patient app endpoints have no authentication — any visitor can access any patient's report by guessing an ID.

**Fix needed:**
- Issue a JWT token on patient login (`/patient-app/login`)
- Validate JWT on all patient app endpoints
- Ensure a patient can only access reports matching their own mobile number

---

### Priority 2: Patient App Frontend
A separate, mobile-friendly web UI (or native app) for patients:
- Login page
- Name selection (if multiple patients under same mobile)
- Visit list page
- Report view page with Download and Share

---

### Priority 3: Doctor App Backend
New endpoints needed:
- `POST /doctor-app/login` — Doctor login with their own credentials
- `GET /doctor-app/patients` — Patients referred by this doctor (date-filtered)
- `GET /doctor-app/accounts` — Doctor's billing/commission summary
- `GET /doctor-app/report/{patientId}` — View a patient's report

Doctor credentials (ID + password) need to be generated by the lab and stored against the doctor record.

---

### Priority 4: Doctor App Frontend
Separate UI:
- Login page
- Patient list (date filter)
- Report view
- Accounts/commission summary

---

### Priority 5: Remaining Lab App Features
- **Unlock completed patient with PIN** — currently Complete locks the patient permanently; a PIN-based unlock is needed
- **Inform patient button** — trigger WhatsApp/SMS with report link when Complete is clicked
- **Excel export** for accounts (accounts page Export button)
- **Report ID** — verify the `DD-MM-LABID-SNO` format is generated correctly
- **Doctor edit** — edit doctor details (currently only add/delete exists in some flows)

---

## 6. Data Flow Summary

```
Lab Staff
   │
   ▼
[Register Patient] → [Select Tests] → [Enter Values] → [View Report] → [Mark Complete]
                                                                              │
                                             ┌────────────────────────────────┘
                                             │
                                             ▼
                                    Patient gets credentials
                                    (ID + password sent via WhatsApp/SMS)
                                             │
                        ┌────────────────────┴───────────────────┐
                        ▼                                         ▼
                  Patient App                              Doctor App
              (login → see own reports)           (login → see referred patients)
```

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 3.5.9, Java 17, Maven |
| Database | MySQL 8, JPA/Hibernate |
| Auth (Lab) | JWT (7-day), BCrypt, TOTP |
| Auth (Patient/Doctor) | To be secured with JWT |
| Frontend (Lab) | Vanilla JS, HTML, CSS (no framework) |
| Frontend (Patient/Doctor) | To be built |
| Email | Gmail SMTP (Spring Mail) |
| Messaging | WhatsApp (service exists, integration pending) |
| Deployment | systemd on Linux, Nginx reverse proxy |
| CI/CD | GitHub Actions (frontend quality guards) |

---

## 8. Environment Variables Required (Production)

| Variable | Purpose |
|---|---|
| `SPRING_DATASOURCE_PASSWORD` | MySQL password |
| `APP_JWT_SECRET` | JWT signing secret |
| `APP_TOTP_ENCRYPTION_KEY` | Encrypts TOTP secrets at rest |
| `SPRING_MAIL_PASSWORD` | Gmail App Password for emails |
