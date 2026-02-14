#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0

pass() {
  printf '[PASS] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  failures=$((failures + 1))
}

check_file_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

printf 'Running performance guard checks in %s\n' "$ROOT_DIR"

# 1) Local font faces should use font-display: swap.
font_face_count="$(rg -c '@font-face' vendor/fonts/fonts.css || true)"
font_swap_count="$(rg -c 'font-display:\s*swap' vendor/fonts/fonts.css || true)"
if [[ "$font_face_count" == "$font_swap_count" && "$font_face_count" != "0" ]]; then
  pass "All local font-face declarations use font-display: swap"
else
  fail "font-display: swap missing for one or more font-face declarations"
fi

# 2) Shared table wrappers should support render deferral for large tables.
check_file_contains "home/sub-tasks/components.css" 'content-visibility:\s*auto' "Shared table wrappers use content-visibility"
check_file_contains "home/sub-tasks/components.css" 'contain-intrinsic-size:' "Shared table wrappers define contain-intrinsic-size"

# 3) Dashboard resize logic should be animation-frame throttled.
check_file_contains "script.js" 'requestAnimationFrame' "Dashboard resize logic uses requestAnimationFrame throttling"

# 4) Avoid remote @import in CSS (prefer local assets/HTML links).
if rg -n '@import\s+url\(["'"'"']https?://' . -g '*.css' > /tmp/ssdc_perf_remote_imports.txt; then
  fail "Found remote @import usage in CSS"
  sed 's/^/       /' /tmp/ssdc_perf_remote_imports.txt
else
  pass "No remote @import usage in CSS"
fi

# 5) Primary entry page should preconnect to google font hosts.
check_file_contains "index.html" 'rel="preconnect"\s+href="https://fonts.googleapis.com"' "index.html preconnects to fonts.googleapis.com"
check_file_contains "index.html" 'rel="preconnect"\s+href="https://fonts.gstatic.com"' "index.html preconnects to fonts.gstatic.com"

if ((failures > 0)); then
  printf '\nPerformance guard failed with %d issue(s).\n' "$failures"
  exit 1
fi

printf '\nPerformance guard passed.\n'
