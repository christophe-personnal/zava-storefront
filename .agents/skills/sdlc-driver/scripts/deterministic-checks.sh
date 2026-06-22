#!/usr/bin/env bash
# deterministic-checks.sh — Run npm lint + test and emit structured JSON output.
# 
# Usage: ./deterministic-checks.sh [--help]
# 
# Outputs JSON on stdout: { "passed": bool, "findings": [...], "output": "..." }
# Diagnostics on stderr.

set -euo pipefail

help() {
  cat <<'EOF'
deterministic-checks.sh — Run linting and tests with structured output.

Usage:
  ./deterministic-checks.sh [--help]

Exit codes:
  0 = all checks passed
  1 = checks failed (findings recorded in JSON output)

Output:
  JSON on stdout containing: { passed, findings, output, duration_ms }

Environment:
  Set NPM_COMMAND_LINT (default: "npm run lint")
  Set NPM_COMMAND_TEST (default: "npm run test -- --coverage")

Examples:
  ./deterministic-checks.sh
  NPM_COMMAND_LINT="npm run lint:strict" ./deterministic-checks.sh
EOF
  exit 0
}

[[ "${1:-}" == "--help" ]] && help

# Configuration
NPM_COMMAND_LINT="${NPM_COMMAND_LINT:-npm run lint}"
NPM_COMMAND_TEST="${NPM_COMMAND_TEST:-npm run test -- --coverage}"

# Timing
start_time=$(date +%s%N)

# Collect results
lint_passed=true
test_passed=true
findings=()
all_output=""

# Phase 1: Linting
echo "Running linting..." >&2
if output=$($NPM_COMMAND_LINT 2>&1); then
  echo "✓ Linting passed" >&2
else
  lint_passed=false
  echo "✗ Linting failed" >&2
  findings+=("$(echo "$output" | jq -R -s '{"category": "lint", "severity": "error", "brief": ., "tool": "eslint"}')")
fi
all_output+="${output}"$'\n'

# Phase 2: Testing
echo "Running tests with coverage..." >&2
if output=$($NPM_COMMAND_TEST 2>&1); then
  echo "✓ Tests passed" >&2
else
  test_passed=false
  echo "✗ Tests failed" >&2
  findings+=("$(echo "$output" | jq -R -s '{"category": "test", "severity": "error", "brief": ., "tool": "jest"}')")
fi
all_output+="${output}"$'\n'

# Compute duration
end_time=$(date +%s%N)
duration_ms=$(( (end_time - start_time) / 1000000 ))

# Emit JSON result
passed=false
if [[ "$lint_passed" == "true" && "$test_passed" == "true" ]]; then
  passed=true
fi

# Build findings array
findings_json="["
if [[ ${#findings[@]} -gt 0 ]]; then
  findings_json+=$(printf ',%s' "${findings[@]}" | sed 's/^,//')
fi
findings_json+="]"

# Output result as JSON
cat <<EOF
{
  "passed": $passed,
  "lint_passed": $lint_passed,
  "test_passed": $test_passed,
  "findings": $findings_json,
  "duration_ms": $duration_ms,
  "output_summary": "Ran $NPM_COMMAND_LINT and $NPM_COMMAND_TEST"
}
EOF

# Exit with status code
[[ "$passed" == "true" ]] && exit 0 || exit 1
