# Loop State Schema and Findings Categorization

## Loop State Table

The sdlc-driver skill persists loop state across iterations. The state table tracks:

| Field | Type | Description |
|-------|------|-------------|
| `iteration` | int | Current iteration number (1-indexed) |
| `max_iterations` | int | Cap; loop stops when iteration >= max_iterations |
| `status` | enum | "running" \| "converged" \| "capped" \| "error" |
| `checks_passed` | bool | Did deterministic checks pass in this iteration? |
| `review_invoked` | bool | Was review-panel invoked in this iteration? |
| `review_clean` | bool | Did review return zero actionable findings? |
| `findings_ledger` | array | All findings identified across all iterations |
| `remediation_attempts` | array | Record of each builder invocation (what was fixed, what failed) |
| `deferred_findings` | array | Scope-crossing items escalated to human review |
| `changes_artifacts` | array | Per-pass summary of code changes made |

## Findings Ledger Entry

Each finding in `findings_ledger` has:

```json
{
  "iteration": 2,
  "source": "checks" | "review-panel",
  "category": "lint" | "test" | "style" | "correctness" | "test-coverage" | "architecture" | "design-philosophy" | "...",
  "severity": "error" | "warning" | "suggestion",
  "location": "src/api/handler.ts:42",
  "brief": "Unused variable 'x' in function foo()",
  "full_description": "longer text, if available",
  "status": "identified" | "handed_to_builder" | "remediated" | "deferred",
  "deferred_reason": "scope-crossing" | "builder_failed" | "unknown"
}
```

## Finding Categorization Rules

By default, findings are categorized as follows:

### In-Scope (Builder Receives)

These findings are actionable within a single PR's scope:

- **lint:** ESLint errors, static analysis issues. *Tool source:* eslint.
- **test:** Test failures, broken test suites. *Tool source:* jest / vitest / mocha.
- **style:** Code style, formatting issues (if enforced by checks). *Tool source:* prettier / eslint --format.
- **correctness:** Logic errors, type errors, null-check misses. *Tool source:* TypeScript / flow / eslint.
- **test-coverage:** Uncovered code branches. *Tool source:* nyc / c8.

### Scope-Crossing (Deferred to Human Review)

These findings require design decisions or domain knowledge beyond code remediation:

- **architecture:** "Consider moving this service to a different layer." Requires system redesign.
- **design-philosophy:** "This module violates our microservices boundary." Requires domain discussion.
- **performance:** "This query is O(N²); optimize the algorithm." May require algorithm redesign.
- **public-api-break:** "Removing this endpoint breaks backward compatibility." Requires release planning.
- **security-design:** "This auth flow is vulnerable to X; redesign required." Requires security review.

### Customization (scope_bounds parameter)

Users can pass `scope_bounds` to sdlc-driver to override categorization. Example:

```json
{
  "scope_bounds": {
    "test-coverage": "scope-crossing",
    "performance": "in-scope",
    "architecture": "scope-crossing"
  }
}
```

This moves `test-coverage` findings to deferred (if your team prefers not to mandate coverage) and allows performance improvements in-scope.

## Remediation Attempt Record

When the builder is invoked, the result is recorded:

```json
{
  "iteration": 1,
  "findings_given": [ "finding_id_1", "finding_id_2" ],
  "builder_status": "success" | "deferred" | "partial" | "failed",
  "changes_made": [
    "Fixed ESLint error in src/api.ts",
    "Added missing test case for edge case"
  ],
  "deferred_by_builder": [
    "finding_id_3: marked as out-of-scope by builder"
  ],
  "builder_notes": "Successfully implemented all in-scope fixes.",
  "total_code_changes": 12
}
```

## Convergence Conditions

The loop terminates when ANY of the following is true:

1. **CONVERGED (success):**
   - `checks_passed == true` AND `review_clean == true`
   - No pending findings remain.

2. **CAPPED (bounded):**
   - `iteration >= max_iterations`
   - Loop stops whether or not convergence was reached.
   - Any remaining in-scope findings are escalated to human review.

3. **ERROR (failure):**
   - Builder invocation fails repeatedly.
   - Deterministic check suite crashes (not just fails).
   - Out-of-memory or timeout on review-panel invocation.

## Loop State Example

```json
{
  "iteration": 3,
  "max_iterations": 5,
  "status": "converged",
  "checks_passed": true,
  "review_invoked": true,
  "review_clean": true,
  "findings_ledger": [
    {
      "iteration": 1,
      "source": "checks",
      "category": "lint",
      "severity": "error",
      "location": "src/api.ts:10",
      "brief": "ESLint: unused variable 'x'",
      "status": "remediated"
    },
    {
      "iteration": 2,
      "source": "review-panel",
      "category": "test-coverage",
      "severity": "warning",
      "location": "src/utils.ts:45",
      "brief": "Missing test for error case",
      "status": "remediated"
    },
    {
      "iteration": 2,
      "source": "review-panel",
      "category": "architecture",
      "severity": "suggestion",
      "location": "src/handler.ts",
      "brief": "Consider refactoring handler async flow",
      "status": "deferred",
      "deferred_reason": "scope-crossing"
    }
  ],
  "remediation_attempts": [
    {
      "iteration": 1,
      "findings_given": ["lint_1"],
      "builder_status": "success",
      "changes_made": ["Fixed unused variable"]
    },
    {
      "iteration": 2,
      "findings_given": ["test-coverage_1"],
      "builder_status": "success",
      "changes_made": ["Added error-case test"]
    }
  ],
  "deferred_findings": [
    {
      "iteration": 2,
      "source": "review-panel",
      "category": "architecture",
      "brief": "Consider refactoring handler async flow"
    }
  ],
  "changes_artifacts": [
    {
      "pass": 1,
      "phase": "remediation",
      "description": "Fixed ESLint error; linting now passes"
    },
    {
      "pass": 2,
      "phase": "remediation",
      "description": "Added test coverage; review found 1 architecture suggestion (deferred)"
    }
  ]
}
```

## Scope-Crossing Escalation

When a finding is deferred (marked `scope-crossing`), it is:

1. **Recorded in state:** Stored in `deferred_findings` array.
2. **NOT handed to builder:** Builder receives only in-scope findings.
3. **Included in final report:** Summarized for human review.
4. **Not re-checked:** Deferred findings do not cause another loop iteration.

This prevents the loop from grinding on items that cannot be resolved via code remediation alone.

## Persistence and Recovery

Loop state is persisted to the session artifact store. If the skill is interrupted and re-invoked on the same PR, it can resume from the saved state (future version; not yet implemented).

Current version:
- State is held in-memory for the duration of one skill invocation.
- If interrupted, the loop must restart from iteration 1.
- Final state is emitted in the summary report for audit/replay purposes.
