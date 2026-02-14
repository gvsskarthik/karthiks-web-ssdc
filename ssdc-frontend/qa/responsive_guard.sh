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

printf 'Running responsive guard checks in %s\n' "$ROOT_DIR"

# 1) Every HTML page must define viewport meta.
missing_viewports=()
while IFS= read -r html_file; do
  if ! rg -qi '<meta[^>]*name=["'"'"']viewport["'"'"']' "$html_file"; then
    missing_viewports+=("$html_file")
  fi
done < <(find . -type f -name '*.html' -not -path './vendor/*' | sort)

if ((${#missing_viewports[@]} == 0)); then
  pass "Viewport meta exists on all HTML pages"
else
  fail "Missing viewport meta on ${#missing_viewports[@]} HTML page(s)"
  printf '       %s\n' "${missing_viewports[@]}"
fi

# 2) Disallow known overflow anti-pattern.
if rg -n 'overflow-x:\s*visible' . -g '*.css' > /tmp/ssdc_responsive_guard_overflow.txt; then
  fail "Found forbidden overflow-x: visible in CSS"
  sed 's/^/       /' /tmp/ssdc_responsive_guard_overflow.txt
else
  pass "No forbidden overflow-x: visible declarations"
fi

# 3) Required responsive breakpoints in core shell styles.
check_file_contains "style.css" '@media screen and \(max-width: 768px\)' "Dashboard shell has <=768 breakpoint"
check_file_contains "home/sub-tasks/components.css" '@media \(max-width: 768px\)' "Sub-task shared CSS has <=768 breakpoint"
check_file_contains "home/sub-tasks/components.css" '@media \(min-width: 1440px\)' "Sub-task shared CSS has >=1440 breakpoint"

# 4) Ensure table pages use a scroll container marker.
declare -A TABLE_PAGE_MARKERS=(
  ["home/sub-tasks/1-home.html"]='recent-scroll'
  ["home/sub-tasks/2-patient.html"]='table-wrap'
  ["home/sub-tasks/3-reports.html"]='table-wrap'
  ["home/sub-tasks/4-accounts.html"]='table-wrap'
  ["home/sub-tasks/4-accounts-due.html"]='table-wrap'
  ["home/sub-tasks/5-tests.html"]='table-wrap'
  ["home/sub-tasks/6-doctor.html"]='table-wrap'
  ["home/sub-tasks/export.html"]='table-wrap'
  ["home/sub-tasks/pt/bill.html"]='table-wrap'
  ["home/sub-tasks/pt/enter-values.html"]='table-wrap'
  ["home/sub-tasks/pt/reports.html"]='report-pages'
)

for html_file in "${!TABLE_PAGE_MARKERS[@]}"; do
  marker="${TABLE_PAGE_MARKERS[$html_file]}"
  check_file_contains "$html_file" "$marker" "Table container marker '$marker' exists in $html_file"
done

# 5) Ensure touch-scroll hardening exists in shared table wrapper.
check_file_contains "home/sub-tasks/components.css" 'touch-action:\s*pan-x pan-y' "Shared table wrapper has touch-action pan support"
check_file_contains "home/sub-tasks/components.css" 'overscroll-behavior-x:\s*contain' "Shared table wrapper has overscroll containment"

if ((failures > 0)); then
  printf '\nResponsive guard failed with %d issue(s).\n' "$failures"
  exit 1
fi

printf '\nResponsive guard passed.\n'
