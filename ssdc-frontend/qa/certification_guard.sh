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

printf 'Running certification guard checks in %s\n' "$ROOT_DIR"

if [[ -f "docs/DEVICE_BROWSER_CERTIFICATION.md" ]]; then
  pass "Device/browser certification doc exists"
else
  fail "Missing docs/DEVICE_BROWSER_CERTIFICATION.md"
fi

check_file_contains "docs/DEVICE_BROWSER_CERTIFICATION.md" 'Windows 11 \+ Chrome' "Certification matrix includes Windows Chrome"
check_file_contains "docs/DEVICE_BROWSER_CERTIFICATION.md" 'Windows 11 \+ Edge' "Certification matrix includes Windows Edge"
check_file_contains "docs/DEVICE_BROWSER_CERTIFICATION.md" 'macOS \+ Safari' "Certification matrix includes macOS Safari"
check_file_contains "docs/DEVICE_BROWSER_CERTIFICATION.md" 'iOS Safari' "Certification matrix includes iOS Safari"
check_file_contains "docs/DEVICE_BROWSER_CERTIFICATION.md" 'Android Chrome' "Certification matrix includes Android Chrome"
check_file_contains "docs/DEVICE_BROWSER_CERTIFICATION.md" '`390`' "Certification matrix includes smallest mobile width"
check_file_contains "docs/RESPONSIVE_QA_MATRIX.md" 'Final Acceptance' "QA matrix includes final acceptance section"

if ((failures > 0)); then
  printf '\nCertification guard failed with %d issue(s).\n' "$failures"
  exit 1
fi

printf '\nCertification guard passed.\n'
