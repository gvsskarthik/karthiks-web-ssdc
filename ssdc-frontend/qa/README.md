# Responsive Guard

This folder contains Task 5 regression-prevention checks for responsive behavior.

## Run

From repository root:

```bash
bash ssdc-frontend/qa/responsive_guard.sh
```

## What It Checks

1. Every HTML page includes viewport meta.
2. CSS does not use `overflow-x: visible`.
3. Core responsive breakpoints exist in shell/shared styles.
4. Table pages include the required table scroll container markers.
5. Shared table wrapper includes touch-scroll hardening rules.

## When To Run

1. Before every deploy.
2. After any change in `ssdc-frontend/style.css`.
3. After any change in `ssdc-frontend/home/sub-tasks/*.css` or table markup.
