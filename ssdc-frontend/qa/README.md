# Responsive Guard

This folder contains Task 5 regression-prevention checks for responsive behavior.

## Run

From repository root:

```bash
bash ssdc-frontend/qa/responsive_guard.sh
bash ssdc-frontend/qa/accessibility_guard.sh
bash ssdc-frontend/qa/performance_guard.sh
bash ssdc-frontend/qa/certification_guard.sh
```

## Scripts

1. `responsive_guard.sh`: responsive layout regression checks.
2. `accessibility_guard.sh`: baseline accessibility/static semantic checks.
3. `performance_guard.sh`: baseline performance/static optimization checks.
4. `certification_guard.sh`: device/browser certification doc completeness checks.

## What It Checks

1. Viewport and language metadata coverage.
2. Forbidden overflow patterns.
3. Core breakpoints and table wrapper markers.
4. Focus-visible and reduced-motion support.
5. Performance baselines (font swap, table render deferral, resize throttling).
6. Certification matrix completeness.

## When To Run

1. Before every deploy.
2. After any change in `ssdc-frontend/style.css`.
3. After any change in `ssdc-frontend/home/sub-tasks/*.css` or table markup.
