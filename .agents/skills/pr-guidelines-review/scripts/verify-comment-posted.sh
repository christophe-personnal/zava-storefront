#!/bin/bash
# verify-comment-posted.sh
# Part of pr-guidelines-review skill (S7 DETERMINISTIC TOOL BRIDGE)
# Verifies that a comment exists on a GitHub PR (simple fact-check).
# Non-interactive, deterministic, version-pinned.
#
# Requires: gh CLI >= 2.0 installed and authenticated
#
# Usage:
#   ./verify-comment-posted.sh <pr_url> <comment_id>

set -euo pipefail

# Help
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]] || [[ $# -lt 2 ]]; then
  cat << 'EOF'
verify-comment-posted.sh — Verify a comment exists on a GitHub PR

USAGE:
  ./verify-comment-posted.sh <pr_url> <comment_id>

ARGUMENTS:
  pr_url:        GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)
  comment_id:    GitHub comment ID (integer)

REQUIRES:
  - gh CLI >= 2.0
  - GitHub authentication: gh auth login

OUTPUT:
  JSON object:
  {
    "success": true/false,
    "posted": true/false,
    "comment_url": "https://...",
    "error": "<message if failed>"
  }

EXAMPLE:
  ./verify-comment-posted.sh \
    "https://github.com/owner/repo/pull/123" \
    "1234567890"

FACT CHECK:
  This script is part of A9 SUPERVISED EXECUTION. It verifies the FACT that
  the comment was actually posted to GitHub, not just that an LLM said it was.

EOF
  exit 1
fi

PR_URL="$1"
COMMENT_ID="$2"

# Validate gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "{\"success\": false, \"posted\": false, \"error\": \"gh CLI not found\"}" >&2
  exit 1
fi

# Extract PR owner/repo/number from URL
if [[ $PR_URL =~ github\.com/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]}"
  PR_NUMBER="${BASH_REMATCH[3]}"
else
  echo "{\"success\": false, \"posted\": false, \"error\": \"Invalid PR URL format\"}" >&2
  exit 1
fi

# Fetch comments from the PR
COMMENTS=$(gh pr view "$PR_NUMBER" --repo "$OWNER/$REPO" --json comments --jq '.comments' 2>&1) || {
  echo "{\"success\": false, \"posted\": false, \"error\": \"Failed to fetch PR comments\"}" >&2
  exit 1
}

# Check if our comment ID is in the list
if echo "$COMMENTS" | grep -q "\"id\": $COMMENT_ID"; then
  COMMENT_URL="https://github.com/$OWNER/$REPO/pull/$PR_NUMBER#issuecomment-$COMMENT_ID"
  echo "{\"success\": true, \"posted\": true, \"comment_url\": \"$COMMENT_URL\"}"
  exit 0
else
  echo "{\"success\": true, \"posted\": false, \"error\": \"Comment ID $COMMENT_ID not found on PR\"}" >&2
  exit 0  # Not a fatal error; just report the fact
fi
