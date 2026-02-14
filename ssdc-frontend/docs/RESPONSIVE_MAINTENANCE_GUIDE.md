# SSDC Responsive Maintenance Guide

## Ownership Map

1. Dashboard shell layout: `ssdc-frontend/style.css`, `ssdc-frontend/script.js`, `ssdc-frontend/dashboard.html`
2. Shared iframe styles: `ssdc-frontend/home/sub-tasks/components.css`
3. Page-specific layouts: `ssdc-frontend/home/sub-tasks/*.css`
4. QA guards: `ssdc-frontend/qa/*.sh`
5. Release QA docs: `ssdc-frontend/docs/*.md`

## Safe Editing Rules

1. Keep table overflow inside `.table-wrap`; never allow page-level overflow.
2. Avoid `overflow-x: visible` in responsive pages.
3. Keep responsive breakpoints aligned with QA matrix.
4. When adding a new table page, wrap the table in `.table-wrap`.
5. When adding animation, ensure `prefers-reduced-motion` fallback exists.

## Mandatory Pre-Deploy Commands

```bash
bash ssdc-frontend/qa/responsive_guard.sh
bash ssdc-frontend/qa/accessibility_guard.sh
bash ssdc-frontend/qa/performance_guard.sh
```

## If A Regression Is Found

1. Reproduce with exact page, width, device, browser.
2. Fix in shared CSS first (`components.css`) if issue is generic.
3. If page-specific, patch only that page CSS/HTML.
4. Re-run all guard scripts and manual smoke checks.
