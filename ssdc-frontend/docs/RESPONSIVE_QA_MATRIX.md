# SSDC Responsive QA Matrix

Use browser zoom at `100%` (`Ctrl/Cmd + 0`) before testing.

## Widths To Validate

1. `1920`
2. `1512`
3. `1440`
4. `1366`
5. `1280`
6. `1024`
7. `900`
8. `768`
9. `576`
10. `390`

## Core Shell (`dashboard.html`)

1. Sidebar toggles correctly.
2. Overlay appears only when sidebar is expanded on mobile.
3. Content area does not leak outside viewport.
4. Iframe fills available area below navbar.
5. No manual zoom required.

## Main Iframe Pages

1. `1-home.html`: Recent Pendings and daily cards align correctly at medium widths; stack at small widths.
2. `2-patient.html`: table scrolls horizontally on small screens; filters wrap cleanly.
3. `3-reports.html`: table scrolls horizontally on small screens; filters wrap cleanly.
4. `4-accounts.html`: table horizontal scroll works on mobile and iPhone Chrome/Safari.
5. `4-accounts-due.html`: table horizontal scroll works on mobile and iPhone Chrome/Safari.
6. `5-tests.html`: table stays inside iframe at `1366` and below.
7. `6-doctor.html`: table stays inside iframe at `1366` and below.
8. `7-settings.html`: form controls and button rows do not clip on small screens.

## Secondary Pages

1. `pt/new.html`: two-column layout collapses correctly on small screens.
2. `pt/enter-values.html`: result table scrolls horizontally on small screens.
3. `pt/bill.html`: totals and actions align correctly on small screens.
4. `export.html`: export table scrolls horizontally on small screens.
5. `dr/new-doctor.html`, `test/new-tests.html`, `test/new-group.html`: cards and forms do not overflow.

## Final Acceptance

1. No horizontal page leak outside iframe on tested widths.
2. Table scroll is available where table min-width exceeds viewport.
3. Text does not clip or overlap.
4. Interactions still work (menu clicks, filters, modal open/close).
