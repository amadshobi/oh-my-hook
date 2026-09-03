#!/usr/bin/env bash
set -euo pipefail

echo "[verify] Running full repository verification..."

# 1. Full Secret Scan across all repository files (excluding tests, markdown documentation, & git metadata)
echo "[verify] Scanning all source files for leaked credentials..."
SECRET_MATCHES=$(git grep -EI 'ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[a-zA-Z0-9_-]{20,}|sk-ant-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----|eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}' -- ':!tests/' ':!.githooks/' ':!scripts/' ':!*.md' ':!docs/' || true)

if [ -n "$SECRET_MATCHES" ]; then
  echo "[verify] Error: Found hardcoded credentials in source files:"
  echo "$SECRET_MATCHES"
  exit 1
fi

# 2. Syntax Check on all JS/MJS files
echo "[verify] Checking syntax across all JS files..."
find . -type f \( -name "*.js" -o -name "*.mjs" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | while read -r file; do
  node --check "$file"
done

# 3. Clean TUI Build Check
echo "[verify] Building TUI bundle..."
npm run build:tui > /dev/null

if ! git diff --quiet tui/dist/; then
  echo "[verify] Error: tui/dist/tui.js does not match source. Please re-commit tui/dist/."
  exit 1
fi

# 4. Full Test Suites (Unit + E2E Hook Pipelines)
echo "[verify] Running all test suites (Unit + E2E)..."
npm run test:all

echo "[verify] Full verification passed successfully."
