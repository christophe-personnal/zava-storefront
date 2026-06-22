#!/usr/bin/env bash
# summary-reporter.sh — Format final loop summary as human-readable + JSON.
# 
# Reads JSON from stdin; outputs a combined report.
# Usage: ./summary-reporter.sh

help() {
  cat <<'EOF'
summary-reporter.sh — Format sdlc-driver loop summary for display.

Usage:
  ./summary-reporter.sh < loop_summary.json

Outputs both human-readable text and JSON to stdout.

Example input (JSON):
{
  "loop_passes": 3,
  "final_status": "converged",
  "findings_resolved": { "check_findings": 4, "review_findings": 2 },
  "findings_deferred": [ { "category": "...", "brief": "..." } ],
  "changes_made": [ { "pass": 1, "description": "..." } ]
}
EOF
  exit 0
}

[[ "${1:-}" == "--help" ]] && help

# Read input JSON
input=$(cat)

# Extract fields
loop_passes=$(echo "$input" | jq -r '.loop_passes // 0')
final_status=$(echo "$input" | jq -r '.final_status // "unknown"')
check_findings=$(echo "$input" | jq -r '.findings_resolved.check_findings // 0')
review_findings=$(echo "$input" | jq -r '.findings_resolved.review_findings // 0')
deferred_count=$(echo "$input" | jq -r '.findings_deferred | length // 0')

# Human-readable report
cat <<EOF
================================================================================
                    SDLC-DRIVER LOOP SUMMARY
================================================================================

Status: $final_status
Loop Passes: $loop_passes

Findings Resolved:
  - Check findings: $check_findings
  - Review findings: $review_findings
  - Total: $(( check_findings + review_findings ))

Findings Deferred (scope-crossing):
  - Count: $deferred_count

EOF

if [[ "$deferred_count" -gt 0 ]]; then
  echo "Deferred items (for human review):"
  echo "$input" | jq -r '.findings_deferred[] | "  - [\(.category)] \(.brief) (at \(.location // "n/a"))"'
  echo ""
fi

echo "Changes Made:"
echo "$input" | jq -r '.changes_made[] | "  Pass \(.pass): \(.description)"'

echo ""
echo "Summary: Loop \($final_status) in $loop_passes passes. Resolved $(( check_findings + review_findings )) finding(s); deferred $deferred_count for human review."
echo ""
echo "================================================================================
"

# Emit JSON as well
echo "$input" | jq '.'
