# Findings Categorization and Scope Boundaries

## Overview

The sdlc-driver skill separates findings into two categories:

1. **In-scope:** Actionable by the builder skill within a single PR.
2. **Scope-crossing:** Require design decisions, human judgment, or cross-PR coordination. Deferred to human review.

This separation prevents the loop from grinding indefinitely on items outside the PR's immediate remediation scope.

## In-Scope Categories

These findings come from deterministic checks or code review and are handed to the builder for implementation.

### From Deterministic Checks

- **lint:** ESLint errors, static analysis warnings (unused variables, unreachable code, etc.)
  - *Example:* "Unused variable 'x' in function foo()"
  - *Tool:* eslint
  - *Severity:* error | warning
  - *Builder action:* Remove variable, fix the issue directly.

- **test:** Test suite failures, broken tests, assertion failures.
  - *Example:* "Test case 'should handle null' fails at line 42"
  - *Tool:* jest, vitest, mocha
  - *Severity:* error
  - *Builder action:* Fix the failing test (adjust assertion or code under test).

- **style:** Code formatting, whitespace, line length (when enforced by checks).
  - *Example:* "Line 105 exceeds max length of 120 characters"
  - *Tool:* prettier, eslint with style rules
  - *Severity:* error | warning
  - *Builder action:* Reformat or restructure code.

- **correctness:** Type errors, null-check misses, type mismatches.
  - *Example:* "Type 'null' is not assignable to type 'string'"
  - *Tool:* TypeScript, flow, eslint plugins
  - *Severity:* error
  - *Builder action:* Add type guards, fix type mismatches.

- **test-coverage:** Uncovered code branches, low coverage in new code.
  - *Example:* "Line 87 is not covered by tests"
  - *Tool:* nyc, c8, jest --coverage
  - *Severity:* warning
  - *Builder action:* Add test case to exercise the line.

### From Code Review (review-panel)

- **review-style:** Code organization, naming conventions, readability (if not enforced by linter).
  - *Example:* "Variable name 'x' is too terse; use 'elementIndex'"
  - *Severity:* suggestion | warning
  - *Builder action:* Rename variable, restructure code for clarity.

- **review-correctness:** Logic errors caught by human review (off-by-one, edge cases).
  - *Example:* "Loop condition should be '<=' not '<' to include final element"
  - *Severity:* error
  - *Builder action:* Fix the logic.

- **review-test:** Test quality issues (missing edge cases, weak assertions).
  - *Example:* "Test should verify error path when database is unavailable"
  - *Severity:* warning
  - *Builder action:* Add missing test case.

## Scope-Crossing Categories

These findings are identified but NOT handed to the builder. They are escalated to human review.

### Design / Architecture

- **architecture:** System design concerns (service boundaries, module responsibilities, layering).
  - *Example:* "Consider moving authentication logic to a separate service"
  - *Severity:* suggestion
  - *Why scope-crossing:* Requires cross-service coordination; out of scope for a single PR.
  - *Human action:* Discuss with team; may spawn a design doc or spike.

- **design-philosophy:** Violations of project design principles or patterns.
  - *Example:* "This module breaks our dependency-injection pattern; consider refactoring to use DI"
  - *Severity:* warning
  - *Why scope-crossing:* Enforcing the principle may require larger refactoring; out of scope for this PR.
  - *Human action:* Triage in design review; may require follow-up work.

- **performance:** Algorithmic or scalability concerns.
  - *Example:* "This query is O(N²); for large datasets, optimize to O(N log N)"
  - *Severity:* warning | suggestion
  - *Why scope-crossing:* Performance optimization often requires algorithm redesign; may be premature optimization.
  - *Human action:* Benchmark; decide if optimization is warranted for current scale.

### API / Breaking Changes

- **public-api-break:** Changes that break backward compatibility or deprecation path.
  - *Example:* "Removing endpoint /api/v1/users violates our deprecation policy"
  - *Severity:* error
  - *Why scope-crossing:* Requires release planning, migration path, consumer notification.
  - *Human action:* Coordinate with release management; plan deprecation phase.

- **api-contract:** Changes to API signature, payload shape, response format.
  - *Example:* "Changing response payload from {id, name} to {id, fullName} breaks clients"
  - *Severity:* error | warning
  - *Why scope-crossing:* Requires versioning strategy, client migration plan.
  - *Human action:* Decide on versioning approach; update contract documentation.

### Security / Compliance

- **security-design:** High-level security concerns requiring review.
  - *Example:* "This auth flow is vulnerable to CSRF; redesign required"
  - *Severity:* error
  - *Why scope-crossing:* Requires security expert review; may need significant redesign.
  - *Human action:* Escalate to security team; may require threat modeling.

- **compliance:** Regulatory or policy concerns.
  - *Example:* "Logging PII in audit trail violates GDPR requirements"
  - *Severity:* error
  - *Why scope-crossing:* Requires legal / compliance review; fix may have system-wide impact.
  - *Human action:* Escalate to compliance officer; determine required changes.

### Domain / Business

- **business-logic:** Changes affecting business rules or workflows.
  - *Example:* "Discount logic should apply taxes before coupons, not after"
  - *Severity:* error
  - *Why scope-crossing:* Requires product / domain expert decision.
  - *Human action:* Clarify business requirement with product team.

- **ux-impact:** Changes affecting user experience or behavior.
  - *Example:* "Modal closes without confirmation; user may lose work"
  - *Severity:* warning
  - *Why scope-crossing:* Requires UX design decision; may need interaction redesign.
  - *Human action:* Discuss with design team; adjust UX flow.

## Customization: scope_bounds Parameter

Users can override the default categorization by passing `scope_bounds` to sdlc-driver.

### Example: Move test-coverage to scope-crossing

If your team doesn't mandate test coverage in PRs:

```json
{
  "scope_bounds": {
    "test-coverage": "scope-crossing"
  }
}
```

Now findings in the `test-coverage` category will be deferred instead of handed to the builder.

### Example: Move performance to in-scope

If your team values performance optimization:

```json
{
  "scope_bounds": {
    "performance": "in-scope"
  }
}
```

Now performance findings will be handed to the builder.

### Example: Default override

To override the entire default map:

```json
{
  "scope_bounds": {
    "lint": "in-scope",
    "test": "in-scope",
    "style": "in-scope",
    "correctness": "in-scope",
    "test-coverage": "scope-crossing",
    "architecture": "scope-crossing",
    "design-philosophy": "scope-crossing",
    "performance": "scope-crossing",
    "security-design": "scope-crossing"
  }
}
```

## Default Scope Map

| Category | Default | Rationale |
|----------|---------|-----------|
| lint | in-scope | Errors; directly fixable by code changes. |
| test | in-scope | Failures; directly fixable by code/test changes. |
| style | in-scope | Formatting; directly fixable by reformatting. |
| correctness | in-scope | Type/logic errors; fixable within PR scope. |
| test-coverage | in-scope | Add test case; fixable within PR scope. |
| review-style | in-scope | Naming/clarity; fixable within PR scope. |
| review-correctness | in-scope | Logic bugs; fixable within PR scope. |
| review-test | in-scope | Add test case; fixable within PR scope. |
| architecture | scope-crossing | System redesign; cross-PR coordination. |
| design-philosophy | scope-crossing | Principle violation; may require larger refactoring. |
| performance | scope-crossing | Algorithm optimization; may be premature. |
| public-api-break | scope-crossing | Requires release planning, versioning. |
| api-contract | scope-crossing | Requires versioning, client migration. |
| security-design | scope-crossing | Requires security expert review. |
| compliance | scope-crossing | Requires legal/compliance review. |
| business-logic | scope-crossing | Requires domain expert decision. |
| ux-impact | scope-crossing | Requires UX design decision. |

## Decision Rules (For Builder and Review-panel)

When classifying a finding, ask:

1. **Can it be fixed by changing code in this PR alone?** → Likely in-scope.
2. **Does the fix require design discussion or cross-system coordination?** → Likely scope-crossing.
3. **Is the fix temporary or a workaround for a larger issue?** → Consider scope-crossing.
4. **Does the finding affect code that was added in this PR?** → Likely in-scope.
5. **Does the finding affect an existing API or module contract?** → Likely scope-crossing.

## Deferral Process

When a finding is marked scope-crossing:

1. **Recorded:** Stored in loop state's `deferred_findings` array.
2. **Logged:** Included in the final summary report.
3. **Not re-handed:** Builder is NOT given scope-crossing findings.
4. **Not re-checked:** Scope-crossing findings do NOT trigger another loop iteration.
5. **Escalated:** Summarized for human review and triage.

## Future: Auto-Escalation

In a future version, scope-crossing findings may be automatically escalated to:

- A team Slack channel with findings for triage.
- A GitHub project board column for follow-up.
- A human checkpoint gate that pauses the PR merge flow.

For now, deferral is logged; human review is manual.
