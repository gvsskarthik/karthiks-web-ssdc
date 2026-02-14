# SSDC Responsive Release Checklist

## Pre-Release

1. Run responsive guard:
   `bash ssdc-frontend/qa/responsive_guard.sh`
2. Run accessibility guard:
   `bash ssdc-frontend/qa/accessibility_guard.sh`
3. Run performance guard:
   `bash ssdc-frontend/qa/performance_guard.sh`
4. Run certification guard:
   `bash ssdc-frontend/qa/certification_guard.sh`
5. Ensure working tree has only intended responsive changes.
6. Verify commit message clearly describes responsive scope.

## Functional Smoke (Desktop)

1. Login and open dashboard.
2. Open all sidebar pages once.
3. Verify shell behavior at `1512`, `1366`, `1024`.

## Functional Smoke (Mobile/Real Device)

1. Validate iPhone Chrome/Safari:
   - `Accounts`
   - `Accounts Due`
   - `Tests`
   - `Doctors`
   - `Export`
2. Confirm horizontal table scroll works where needed.
3. Confirm no full-page horizontal leak.

## Post-Deploy

1. Re-run quick smoke on deployed URL.
2. Watch for user-reported layout issues for 24-48 hours.
3. If issue appears, capture:
   - page
   - device
   - browser/version
   - screen size
   - screenshot/video
