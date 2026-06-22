---
scope: "**/*.md | **/*.py | **/*.ts | **/*.tsx | **/*.js | **/*.go | **/*.java"
---

# PR Review Guardrails

This rule auto-loads whenever `pr-guidelines-review` skill is active. It
enforces hard constraints on the PR review process.

## Non-Negotiable Constraints

✓ **MUST**: Read guideline files from the repo as the source of truth  
✓ **MUST**: Post exactly ONE comment per PR review  
✓ **MUST**: Always include {recommendation, reasoning, findings per dimension}  
✓ **MUST**: Sort findings by severity (BLOCKER → HIGH → MEDIUM → LOW)  
✓ **MUST**: Use JSON for all inter-lens communication

✗ **NEVER**: Vote APPROVE via GitHub review API  
✗ **NEVER**: Vote REQUEST_CHANGES via GitHub review API  
✗ **NEVER**: Auto-merge the PR  
✗ **NEVER**: Edit code in the PR or push commits  
✗ **NEVER**: Modify files outside the PR (no .github/workflows edits, etc.)  
✗ **NEVER**: Post multiple comments (one only)  
✗ **NEVER**: Post findings without reasoning  

## Why These Constraints

1. **No GitHub API votes** → The skill is advisory; humans retain merge authority
2. **One comment** → Clarity; PR author sees one structured verdict, not N competing reports
3. **Guideline files are truth** → Team standards, not LLM hallucination
4. **JSON inter-lens** → Deterministic, schema-validated, no ambiguity
5. **No code edits** → This skill reviews; it does not fix. Fixing is separate work.

## Verification

Before posting a comment:
1. Verify that the arbiter's JSON is parseable and has all required fields
2. Verify that exactly one comment is about to be posted (not zero, not >1)
3. Verify that the recommendation is one of: ADVISE_MERGE, REQUEST_CHANGES, ADVISE_CONDITIONAL
4. If any check fails, HALT and raise an error; do not post

## If You Violate

If this rule is violated:
- The comment is NOT posted; the skill returns an error
- No code is committed; no GitHub state changes
- The violation is logged with timestamp and context
- Human review required before retry

These are not suggestions. They are hard stops.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
