# SSDC Device/Browser Certification

This document is the certification log for responsive behavior across target environments.

## Target Matrix

### Desktop

1. Windows 11 + Chrome (latest)
2. Windows 11 + Edge (latest)
3. macOS + Chrome (latest)
4. macOS + Safari (latest)

### Mobile

1. iOS Safari (latest)
2. iOS Chrome (latest)
3. Android Chrome (latest)

## Required Widths

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

## Certification Steps

1. Run guard scripts:
   - `bash ssdc-frontend/qa/responsive_guard.sh`
   - `bash ssdc-frontend/qa/accessibility_guard.sh`
   - `bash ssdc-frontend/qa/performance_guard.sh`
2. Execute manual checks from `ssdc-frontend/docs/RESPONSIVE_QA_MATRIX.md`.
3. Record any issue with page, device, browser, and screenshot/video.
4. Re-test after fix and mark pass.

## Sign-off Template

| Environment | Pass/Fail | Notes |
|---|---|---|
| Windows + Chrome |  |  |
| Windows + Edge |  |  |
| macOS + Chrome |  |  |
| macOS + Safari |  |  |
| iOS Safari |  |  |
| iOS Chrome |  |  |
| Android Chrome |  |  |
