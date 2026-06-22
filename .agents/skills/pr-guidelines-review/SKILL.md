---
name: pr-guidelines-review
description: >-
  Use this skill to perform an automated multi-lens review of a pull request
  against your team's security, architecture, and documentation guidelines.
  Activate when a pull request is opened, reopened, synchronized, or marked
  ready for review; also activate when a maintainer says "review this PR",
  "run guidelines review", "check this PR against standards", or "audit this
  change". The skill reads the PR diff and three custom guideline documents
  (security, architecture, documentation), extracts findings per dimension, and
  posts one structured comment with merge/request-changes decision, reasoning,
  and findings sorted by criticality within each lens. The output structure is
  always consistent. Handles large PRs efficiently. Never approves, never edits
  code, never merges. Do not use for: fixing the issues, drafting PR
  descriptions, or automating merges.
---

# PR Guidelines Review Skill

This skill performs end-to-end, multi-lens PR review against your team's
custom guidelines. The output is a single structured comment posted to the PR,
always following the same format: recommendation → reasoning → findings per
dimension (Security, Architecture, Documentation), each sorted by criticality.

## Before You Start

1. **Identify the three guideline files** your team uses:
   - `security-guidelines.md` – security patterns, threats, scanning rules
   - `architecture-guidelines.md` – design patterns, coupling rules, SoC principles
   - `documentation-guidelines.md` – changelog conventions, docstring quality, API docs standards

   If files have different names or locations in your repo, update the
   `load-guidelines.sh` script at step 2.

2. **Load the guardrails rule** (`pr-review-guardrails.md`) — it auto-loads
   whenever this skill is active and enforces "never approve, never merge, never
   edit code". Do not remove it.

## The Process

### Step 1: Load Guideline Files

First, read your team's three custom guideline documents. These are the source
of truth for each review dimension.

```sh
load-guidelines.sh <pr_url>
```

This script emits structured data:
```json
{
  "security_guidelines": "<loaded text>",
  "architecture_guidelines": "<loaded text>",
  "documentation_guidelines": "<loaded text>"
}
```

### Step 2: Fetch PR Context

Pull the PR diff and metadata from GitHub. This is a FACT that must be true
before any lens can evaluate.

```sh
fetch_pr_context.sh <pr_url>
```

Emits:
```json
{
  "pr_number": 123,
  "pr_title": "...",
  "pr_description": "...",
  "files_changed": ["src/...", "tests/..."],
  "diff": "<full unified diff>",
  "changelog_file": "<CHANGELOG entry if present>"
}
```

### Step 3: Spawn Three Lens Threads (Fan-Out)

Each lens is an independent review thread with its own persona, running in a
fresh context window. They do NOT see each other's work. This isolation is
intentional — it prevents attention contamination and allows each lens to apply
its own standards.

**Security Lens** (persona: `pr-security-lens`):
- Loads: security guidelines, PR diff
- Looks for: unsafe patterns, secrets, injection vulnerabilities, unsafe deserialization, dependency risks
- Outputs: findings keyed by {file, line, severity}

```sh
task(
  prompt="SPAWN_BRIEF: security lens. Review the PR diff against the security guidelines. Find: unsafe patterns, secrets in code, SQL injection, SSRF, deserialization, unsafe deserialization, cryptographic weaknesses, dependency issues. Output JSON only: [{sev, cwe, file, line, finding}].",
  persona="pr-security-lens"
)
```

**Architecture Lens** (persona: `pr-architecture-lens`):
- Loads: architecture guidelines, PR diff, project structure
- Looks for: coupling violations, circular dependencies, SoC breaches, anti-patterns
- Outputs: findings keyed by {file(s), severity}

```sh
task(
  prompt="SPAWN_BRIEF: architecture lens. Review the PR against architecture guidelines. Find: coupling violations, SoC breaches, circular dependencies, anti-patterns, layer violations. Output JSON only: [{sev, category, files, finding}].",
  persona="pr-architecture-lens"
)
```

**Documentation Lens** (persona: `pr-documentation-lens`):
- Loads: documentation guidelines, PR diff, CHANGELOG
- Looks for: changelog gaps, API doc misalignment, docstring quality, breaking changes undocumented
- Outputs: findings keyed by {file, severity}

```sh
task(
  prompt="SPAWN_BRIEF: documentation lens. Review the PR against documentation guidelines. Find: changelog gaps for user-facing changes, docstring quality issues, API changes without docs, breaking changes undocumented. Output JSON only: [{sev, category, file, finding}].",
  persona="pr-documentation-lens"
)
```

### Step 4: Collect and Validate Findings

As each lens returns, collect its findings into a structured table. Before
synthesis, validate that each finding matches the expected schema:

```json
{
  "sev": "blocker|high|medium|low",
  "category": "<dimension-specific>",
  "file": "<path or 'N/A'>",
  "line": "<line number or 'N/A'>",
  "finding": "<brief description>"
}
```

If a finding does not match, log a warning and normalize it.

### Step 5: Spawn Arbiter for Synthesis (Synthesizer)

The arbiter synthesizes one structured decision from the three lens reports.
It is NOT a re-review; it reads the summaries and produces the verdict.

```sh
task(
  prompt="SPAWN_BRIEF: arbiter. You have three lens reports (security, architecture, documentation) with findings per dimension. Synthesize ONE recommendation: 'ADVISE_MERGE' if no blockers in any dimension, 'REQUEST_CHANGES' if any blocker exists, 'ADVISE_CONDITIONAL' if high severity but no blockers. Provide: (1) recommendation, (2) reasoning in 2-3 sentences, (3) key findings per dimension sorted by severity (list only HIGH and BLOCKER if present; omit LOW/MEDIUM unless they are critical to the decision). Output JSON only: {recommendation, reasoning, findings_security, findings_architecture, findings_documentation}.",
  persona="pr-review-arbiter"
)
```

### Step 6: Post One Comment

Using the arbiter's synthesis, construct one structured GitHub comment. Do NOT
post multiple comments; do NOT post individual lens findings. One comment, one
format, one output.

```sh
post_review_comment.sh <pr_url> <arbiter_synthesis>
```

This script:
1. Formats the JSON synthesis into markdown
2. Posts it as a single comment on the PR
3. Returns the comment URL and ID

### Step 7: Verify the Comment Was Posted

FACT check: confirm the comment exists on GitHub. This is S7 DETERMINISTIC TOOL
BRIDGE — the arbiter never "posted" anything; it only composed text. The tool
posted. Verify.

```sh
verify_comment_posted.sh <pr_url> <comment_id>
```

Returns: `{posted: true, url: "..."}` or fails with reason.

---

## Output Format (Always Consistent)

The posted comment always follows this structure:

```markdown
## Automated PR Review (Security, Architecture, Documentation)

**Recommendation:** [ADVISE_MERGE | REQUEST_CHANGES | ADVISE_CONDITIONAL]

**Reasoning:**
<2-3 sentence explanation of the decision>

**Key Findings (by criticality):**

### Security
- BLOCKER: [finding 1]
- HIGH: [finding 2]
- ...
(omit if no BLOCKER/HIGH)

### Architecture
- BLOCKER: [finding 1]
- HIGH: [finding 2]
- ...
(omit if no BLOCKER/HIGH)

### Documentation
- BLOCKER: [finding 1]
- HIGH: [finding 2]
- ...
(omit if no BLOCKER/HIGH)

---
*Review generated by multi-lens guidelines automation. Findings are advisory — final merge decision is human-driven.*
```

---

## Loading Guideline Files at Runtime

The `load-guidelines.sh` script reads your three guideline files. By default it
looks for:
- `docs/security-guidelines.md`
- `docs/architecture-guidelines.md`
- `docs/documentation-guidelines.md`

If your files are elsewhere, edit the script or pass paths as arguments:

```sh
./scripts/load-guidelines.sh \
  path/to/security.md \
  path/to/architecture.md \
  path/to/documentation.md
```

---

## Handling Large PRs

For PRs with >100 files or >5000 lines changed:
- Each lens runs in parallel; no sequential bottleneck
- Findings are batched before synthesis; no line-by-line output
- The arbiter sees summaries, not raw line data; it synthesizes efficiently
- Expected latency: ~30–60 seconds for a large PR

---

## Guardrails (Scope-Attached Rule)

The file `pr-review-guardrails.md` enforces:
- ✗ Never vote APPROVE via GitHub API
- ✗ Never vote REQUEST_CHANGES via GitHub API
- ✗ Never auto-merge
- ✗ Never edit code or push commits
- ✗ Only post one comment per PR

These constraints are non-negotiable and loaded automatically.

---

## References

- `references/finding-schema.md` — expected JSON output from each lens
- `references/comment-template.md` — markdown template for posted comment
- `references/trusted-sources.md` — (optional) allowlist of trusted dependency sources
- `references/secret-patterns.md` — (optional) secret detection patterns beyond standard OWASP

---

## Troubleshooting

**Q: The skill says "guideline file not found"**
A: Edit `scripts/load-guidelines.sh` to point to the correct paths, or pass paths
   as arguments.

**Q: The comment has extra MEDIUM findings, but I only want BLOCKER/HIGH**
A: The arbiter's threshold is baked in; edit `pr-review-arbiter` persona to
   change severity filtering.

**Q: I want to add a 4th lens (e.g., performance)**
A: This requires R1 SPLIT. File an issue; do not edit this skill directly.

**Q: Can I approve/merge from this comment?**
A: No. The guardrails rule prohibits it. This skill is advisory only.

---

## Version & Attribution

**Version:** 1.0 (post-genesis design run)

Generated by genesis design discipline (Step 6 handoff packet → Step 7b natural-language drafting).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
