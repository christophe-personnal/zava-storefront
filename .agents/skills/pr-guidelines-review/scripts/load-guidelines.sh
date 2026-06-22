#!/bin/bash
# load-guidelines.sh
# Part of pr-guidelines-review skill (S7 DETERMINISTIC TOOL BRIDGE)
# Reads three guideline files and outputs structured JSON.
# Non-interactive, deterministic, version-pinned.
#
# Usage:
#   ./load-guidelines.sh
#   ./load-guidelines.sh /path/to/security.md /path/to/architecture.md /path/to/documentation.md

set -euo pipefail

# Defaults (customize for your repo)
SECURITY_GUIDELINE="${1:-guidelines/security.md}"
ARCHITECTURE_GUIDELINE="${2:-guidelines/architecture.md}"
DOCUMENTATION_GUIDELINE="${3:-guidelines/documentation.md}"

# Help
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat << 'EOF'
load-guidelines.sh — Load team guideline files for PR review

USAGE:
  ./load-guidelines.sh
  ./load-guidelines.sh /path/to/security.md /path/to/architecture.md /path/to/docs.md

DEFAULTS:
  Security:       docs/security-guidelines.md
  Architecture:   docs/architecture-guidelines.md
  Documentation:  docs/documentation-guidelines.md

OUTPUT:
  JSON object with three fields:
  - security_guidelines: <loaded text or error>
  - architecture_guidelines: <loaded text or error>
  - documentation_guidelines: <loaded text or error>

EXAMPLE:
  ./load-guidelines.sh | jq '.security_guidelines' | head -20

EOF
  exit 0
fi

# Function to safely read a file and JSON-encode it
read_guideline() {
  local filepath="$1"
  local name="$2"
  
  if [[ ! -f "$filepath" ]]; then
    echo "{\"error\": \"File not found: $filepath\"}" >&2
    echo "null"
    return 1
  fi
  
  # Read file, escape JSON special chars
  cat "$filepath" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || {
    echo "{\"error\": \"Failed to read or encode $filepath\"}" >&2
    echo "null"
    return 1
  fi
}

# Load all three guidelines
SEC=$(read_guideline "$SECURITY_GUIDELINE" "security" || echo "null")
ARC=$(read_guideline "$ARCHITECTURE_GUIDELINE" "architecture" || echo "null")
DOC=$(read_guideline "$DOCUMENTATION_GUIDELINE" "documentation" || echo "null")

# Output as JSON
cat << EOF
{
  "security_guidelines": $SEC,
  "architecture_guidelines": $ARC,
  "documentation_guidelines": $DOC
}
EOF

exit 0
