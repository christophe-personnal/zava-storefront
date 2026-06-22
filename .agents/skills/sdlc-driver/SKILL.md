---
name: sdlc-driver
description: Use this skill to run a deterministic checks -> code review -> remediation loop on a pull request. Orchestrates your builder skill (to implement findings) and review panel skill (to inspect changes). Repeats until checks pass and review has no actionable findings. Stop on bounded cap (5 iterations) to avoid runaway loops. Defers scope-crossing or design-level findings to human review. Trigger when you want a full quality checkpoint before merge.
---

# sdlc-driver: Build-and-Review Orchestration Loop

This skill drives a pull request through a bounded loop of deterministic checks, code review, and remediation until the PR reaches a clean state (checks pass + review has no actionable findings) or hits the iteration cap.

## How it works

The skill follows a **reconciliation loop pattern** (inspired by Kubernetes operators and SRE control loops). It orchestrates three phases per iteration:

1. **Deterministic checks** -- Run `npm run lint` and `npm run test` with coverage.
   - Pass? -> proceed to review (if not yet reviewed).
   - Fail? -> record findings, hand to builder for remediation, loop back.

2. **Code review** -- Invoke the `review-panel` skill on the PR (only if checks pass).
   - No actionable findings? -> **convergence reached**, exit.
   - Has findings? -> record findings, hand to builder, loop back.

3. **Remediation** -- Invoke the `builder` skill with findings (from checks or review).
   - Builder implements the findings or defers scope-crossing issues.
   - Loop back to checks.

The loop repeats until:
- **Convergence:** Checks pass AND review has no actionable findings.
- **Cap reached:** Iterations >= max_iterations (default: 5).

Scope-crossing or design-level findings (outside the PR's immediate purview) are recorded and deferred to human review.

## Inputs

- `pr_number` (required, integer): Pull request number to process.
- `max_iterations` (optional, integer, default: 5): Maximum loop iterations before capping.
- `scope_bounds` (optional, JSON object): Rules for categorizing findings as "scope-crossing". If a finding matches a rule, it is deferred instead of handed to the builder.

**Example scope_bounds rule:**
```json
{
  "architecture": "scope-crossing",
  "design-philosophy": "scope-crossing",
  "public-api-break": "scope-crossing"
}
```

## Outputs

A structured loop summary (JSON + human-readable report):

```json
{
  "loop_passes": 3,
  "final_status": "converged",
  "iterations_before_stop": 3,
  "convergence_reason": "checks_pass_and_review_clean",
  "findings_resolved": {
    "check_findings": 4,
    "review_findings": 2
  },
  "findings_deferred": [
    {
      "category": "architecture",
      "severity": "high",
      "location": "src/api/handler.ts",
      "brief": "Consider refactoring handler to follow async/await pattern",
      "source": "review-panel"
    }
  ],
  "changes_made": [
    {
      "pass": 1,
      "phase": "remediation",
      "description": "Fixed ESLint errors; added missing test coverage"
    },
    {
      "pass": 2,
      "phase": "remediation",
      "description": "Refactored error handling per review findings"
    }
  ],
  "summary_text": "Loop converged in 3 passes. Resolved 4 check findings and 2 review findings. 1 scope-crossing architecture suggestion deferred to human review."
}
```

## Reconciliation Loop: The Pattern

This skill implements the **A11 RECONCILIATION LOOP** architectural pattern. Key properties:

- **Bounded retry:** Loop cap prevents runaway iterations.
- **Deterministic stop conditions:** Checks passing + review clean (facts that must be true), not subjective convergence.
- **Explicit scope boundary:** Findings outside the PR's purview are deferred, not forced into remediation.
- **Composition over embedding:** Builder and review-panel are spawned as subagents, not embedded. They maintain independent lifecycles.
- **State persistence:** Loop state (iteration count, findings ledger, prior context) is recorded across rounds.

## Workflow

**Loop flow (pseudocode):**

```
iteration = 0
state = new LoopState()

while iteration < max_iterations:
  iteration++
  state.record_iteration_start()

  # Phase 1: Deterministic checks
  check_results = run_deterministic_checks()
  
  if check_results.failed:
    state.record_check_findings(check_results.findings)
    remediate_findings(check_results.findings, "check", state)
    continue  # loop back
  
  # Phase 2: Code review (checks passed)
  review_results = invoke_review_panel(pr_number)
  state.record_review_findings(review_results.findings)
  
  if review_results.actionable_count == 0:
    # Convergence reached
    state.mark_converged()
    break  # exit loop
  
  # Phase 3: Remediation
  categorized = categorize_findings(review_results.findings, scope_bounds)
  remediate_findings(categorized.in_scope, "review", state)
  state.defer_findings(categorized.scope_crossing)

state.cap_check()
report = synthesize_summary(state)
return report
```

## Running the skill

Invoke directly on a PR:

```
Use the sdlc-driver skill on PR #42 to get a full quality checkpoint before merge.
```

The skill will:
1. Run deterministic checks immediately.
2. Invoke your builder and review-panel skills in a loop.
3. Persist loop state across iterations (visible in session logs).
4. Return a summary when done (converged or capped).

## Scope boundaries

The skill is designed to orchestrate **code-level remediation** (fixing linting errors, test failures, review findings about code style, correctness, test coverage). It explicitly defers:

- **Architectural decisions** ("consider a different pattern")
- **Design philosophy** ("this module violates our design principles")
- **Out-of-scope concerns** (performance, infrastructure, public API breaks)
- **Subjective taste** (naming conventions if not enforced by checks, code organization preferences)

Use `scope_bounds` to tune what counts as "scope-crossing" for your project. By default, architecture/design findings are deferred.

## Integration with builder and review-panel

The skill spawns both as subagents:

### Builder spawn brief

```
You are the builder. The sdlc-driver orchestrator has handed you 
actionable findings from [checks | review-panel].

[JSON findings list with category, severity, location, brief description]

Prior context from previous iterations (if any):
[What was already fixed; what builder attempted before]

Your job: implement the findings OR defer them if they are scope-crossing.

Output JSON receipt:
{
  "status": "success" | "deferred",
  "changes_made": ["list of code changes"],
  "deferred_reason": "string, if status is deferred"
}
```

### Review-panel spawn brief

```
You are the review panel. The PR has passed deterministic checks.

Run your normal review flow (multi-lens, synthesis) on this PR.

[Prior review reports, if any, so you can avoid re-flagging fixed issues]

Output JSON receipt:
{
  "findings": [
    { "category": "...", "severity": "...", "location": "...", "brief": "..." }
  ],
  "actionable_count": number,
  "summary": "text"
}
```

## Findings ledger

The skill maintains a findings ledger (stored in loop state) that tracks:

- Which findings were identified in each iteration.
- Which were handed to the builder.
- Which were remediated.
- Which were deferred (scope-crossing).
- Any builder feedback or deferral reason.

This ledger is persisted across iterations so each round can see the prior context.

## Cost implications

**Per typical PR:**

- Trivial (1 iteration, checks pass): ~500 tokens (orchestrator only).
- Known module (2-3 iterations): ~10k-15k tokens (orchestrator + 1-2 review invocations + 1-2 builder invocations).
- Complex (4-5 iterations): ~16k-25k tokens (multiple review + builder cycles).

Loop cap (default 5) enforces a cost boundary. Tone down to 3 for tighter budgets.

## References

Read these if you need detail on specific aspects:

- **Loop state and findings schema** -- `references/loop-state.md` (when you need to understand the state table structure or categorization rules).
- **Findings categorization** -- `references/findings-rules.md` (when you want to tune scope-crossing rules for your project).
- **Deterministic checks integration** -- See scripts/deterministic-checks.sh --help.

## Limitations and future work

- **Single-PR scope:** The skill drives one PR to a clean state. For batch PR processing, wrap the skill in a loop (delegated to caller).
- **Scope-crossing escalation:** Deferred findings are logged but not automatically escalated to a human inbox. Future version may integrate human checkpoint.
- **Check customization:** Currently assumes `npm run lint` and `npm run test`. Future versions may accept custom check commands.
- **Builder feedback loop:** The skill does not yet model "builder tried fix X but it failed"; each remediation round is fresh. Future version may add persistent fix attempts.

## Example execution trace

```
--- sdlc-driver invoked on PR #42 ---

Iteration 1/5
  Phase 1: Deterministic checks
    Running: npm run lint
    Running: npm run test --coverage
    Result: FAILED
    Findings: 3 ESLint errors, 1 missing test
  
  Handing findings to builder...
  Builder receipt: status=success, changes_made=[eslint fixes, added test]
  
  Loop back to checks.

Iteration 2/5
  Phase 1: Deterministic checks
    Running: npm run lint
    Running: npm run test --coverage
    Result: PASSED
  
  Phase 2: Code review
    Invoking review-panel...
    Review findings: 2 minor style issues, 1 refactoring suggestion
    Actionable in-scope: 1 (style issue)
    Deferred (scope-crossing): 1 (refactoring suggestion)
  
  Handing 1 in-scope finding to builder...
  Builder receipt: status=success, changes_made=[fixed style]
  
  Loop back to checks.

Iteration 3/5
  Phase 1: Deterministic checks
    Running: npm run lint
    Running: npm run test --coverage
    Result: PASSED
  
  Phase 2: Code review
    Invoking review-panel...
    Review findings: none
    Actionable count: 0
  
  CONVERGENCE REACHED.
  
--- Final Summary ---
Loop passes: 3
Status: converged
Findings resolved: 3 (checks) + 1 (review)
Findings deferred: 1 (refactoring suggestion)
Changes made:
  - Pass 1: ESLint + test fixes
  - Pass 2: Style fix
```
