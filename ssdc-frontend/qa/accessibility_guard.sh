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

printf 'Running accessibility guard checks in %s\n' "$ROOT_DIR"

# 1) All HTML pages must declare lang.
missing_lang=()
while IFS= read -r html_file; do
  if ! rg -q '<html[^>]*lang="' "$html_file"; then
    missing_lang+=("$html_file")
  fi
done < <(find . -type f -name '*.html' -not -path './vendor/*' | sort)

if ((${#missing_lang[@]} == 0)); then
  pass "All HTML pages declare a lang attribute"
else
  fail "Missing lang attribute on ${#missing_lang[@]} HTML page(s)"
  printf '       %s\n' "${missing_lang[@]}"
fi

# 2) Every HTML page should include viewport meta.
missing_viewport=()
while IFS= read -r html_file; do
  if ! rg -qi '<meta[^>]*name=["'"'"']viewport["'"'"']' "$html_file"; then
    missing_viewport+=("$html_file")
  fi
done < <(find . -type f -name '*.html' -not -path './vendor/*' | sort)

if ((${#missing_viewport[@]} == 0)); then
  pass "All HTML pages include viewport meta"
else
  fail "Missing viewport meta on ${#missing_viewport[@]} HTML page(s)"
  printf '       %s\n' "${missing_viewport[@]}"
fi

# 3) Dashboard menu toggle accessibility markers.
check_file_contains "dashboard.html" 'id="sidebar-toggle"' "Dashboard menu toggle has stable id"
check_file_contains "dashboard.html" 'aria-label="Toggle sidebar"' "Dashboard menu toggle has aria-label"
check_file_contains "dashboard.html" 'role="button"' "Dashboard menu toggle has role=button"
check_file_contains "dashboard.html" 'tabindex="0"' "Dashboard menu toggle is keyboard focusable"
check_file_contains "dashboard.html" 'title="SSDC dashboard content"' "Dashboard iframe has accessible title"

# 4) Focus-visible styles must exist in shell and shared styles.
check_file_contains "style.css" ':focus-visible' "Dashboard shell defines focus-visible styles"
check_file_contains "home/sub-tasks/components.css" ':focus-visible' "Sub-task shared CSS defines focus-visible styles"

# 5) Reduced motion fallback should exist.
check_file_contains "style.css" '@media \(prefers-reduced-motion: reduce\)' "Dashboard shell supports reduced motion"
check_file_contains "home/sub-tasks/components.css" '@media \(prefers-reduced-motion: reduce\)' "Sub-task shared CSS supports reduced motion"

# 6) Images, if present, must include alt.
img_without_alt=()
while IFS= read -r match; do
  file="${match%%:*}"
  line="${match#*:}"
  if [[ "$line" != *"alt="* ]]; then
    img_without_alt+=("$match")
  fi
done < <(rg -n '<img[^>]*>' . -g '*.html' -g '!vendor/*' || true)

if ((${#img_without_alt[@]} == 0)); then
  pass "All image tags include alt attributes"
else
  fail "Found image tag(s) without alt attributes"
  printf '       %s\n' "${img_without_alt[@]}"
fi

if ((failures > 0)); then
  printf '\nAccessibility guard failed with %d issue(s).\n' "$failures"
  exit 1
fi

printf '\nAccessibility guard passed.\n'
