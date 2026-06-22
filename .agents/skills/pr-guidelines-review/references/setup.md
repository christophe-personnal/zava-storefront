# Setup Guide

This skill requires your team to provide three custom guideline files that define your standards for Security, Architecture, and Documentation reviews.

## Step 1: Create Guideline Files

In your repository, create three markdown files that capture your team's review standards. Place them in a `docs/` folder or your preferred location.

### `docs/security-guidelines.md`

This file defines security threats and patterns your team cares about. Example structure:

```markdown
# Security Guidelines

## Threats We Care About
1. Secrets in code (API keys, tokens, passwords)
2. SQL injection and command injection
3. Unsafe deserialization
4. Weak cryptography (MD5, SHA1 for passwords)
5. Authentication/authorization bypasses
6. Cross-site scripting (XSS) in web handlers
7. Unvalidated dependencies

## Scanning Rules

### Secrets
- Scan for common secret patterns: API_KEY, SECRET, PASSWORD, TOKEN
- Use gitleaks or similar tool as baseline
- If found: severity = BLOCKER

### Injection
- String concatenation into SQL/shell commands = HIGH
- All queries must use parameterized statements
- All shell commands must use subprocess with array args, never shell=True

### Cryptography
- Passwords: Argon2id or bcrypt (cost >= 12) only
- Do not use: MD5, SHA1, or custom schemes
- Severity = HIGH if violated

## Trusted Dependencies
- Only npm packages from @company and verified open-source orgs
- Pin all versions; no floating semvers
```

### `docs/architecture-guidelines.md`

This file defines your system's layering, coupling rules, and design principles. Example:

```markdown
# Architecture Guidelines

## System Layers
1. **HTTP Handlers** (controllers) — accept requests, validate input, call services, return responses
2. **Services** (business logic) — domain logic, orchestration, no HTTP/database knowledge
3. **Data Access** (repos) — queries, schema, no business logic
4. **Models** (entities) — data structures, no logic

## Coupling Rules
- HTTP handlers MUST NOT import from other handlers
- Services MUST NOT import from other services' internals
- Data access MUST NOT import from services
- Circular imports = BLOCKER

## Separation of Concerns
- Auth logic in Auth service only
- Order logic in Order service only
- Logging as cross-cutting concern; no service calls logging service
- Configuration read once at startup; no re-reads per request

## Anti-Patterns
- God objects (>500 lines in a class)
- Services that bypass repos and query the database directly
- HTTP handlers that contain business logic
```

### `docs/documentation-guidelines.md`

This file defines changelog, docstring, and API documentation standards. Example:

```markdown
# Documentation Guidelines

## CHANGELOG Format
- One entry per user-facing change
- Sections: [Added], [Changed], [Fixed], [Deprecated], [Removed], [Security]
- Date format: YYYY-MM-DD
- Required for: new endpoints, API changes, breaking changes, security fixes

## Docstrings
- Every public function/method MUST have a docstring
- Format: Google-style (Parameters, Returns, Raises, Examples)
- Include examples for non-obvious functions
- Update docstrings when behavior changes

## Breaking Changes
- Must be documented in CHANGELOG under [BREAKING]
- Must include migration instructions
- Severity = BLOCKER if breaking change and no doc entry

## API Documentation
- Each endpoint documented with: method, path, parameters, response, example
- Status codes documented (200, 400, 404, 500)
```

## Step 2: Update the Script Paths (if needed)

By default, the skill looks for:
- `docs/security-guidelines.md`
- `docs/architecture-guidelines.md`
- `docs/documentation-guidelines.md`

If your files are elsewhere, edit `scripts/load-guidelines.sh` and update the DEFAULTS section:

```bash
# Defaults (customize for your repo)
SECURITY_GUIDELINE="${1:-path/to/your/security.md}"
ARCHITECTURE_GUIDELINE="${2:-path/to/your/architecture.md}"
DOCUMENTATION_GUIDELINE="${3:-path/to/your/documentation.md}"
```

## Step 3: Install GitHub CLI

The skill requires `gh` CLI to post comments. Install it:

```bash
# macOS
brew install gh

# Linux (Ubuntu/Debian)
sudo apt install gh

# Or download from https://cli.github.com
```

Then authenticate:

```bash
gh auth login
```

## Step 4: Test the Skill Locally

Before deploying to your CI/CD, test it locally on a real PR:

```bash
# In your repository
gh pr list --limit 1 --state open --json url --jq '.[0].url'

# Use that PR URL to test
# (The skill will read it and post a test comment)
```

## Step 5: Integrate with Your CI/CD (Optional)

If you want to run this skill automatically on every PR:

**GitHub Actions example:**

```yaml
name: PR Guidelines Review
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run guidelines review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Invoke the skill via your agent runner
          # (Integration with your agent harness goes here)
```

## Troubleshooting

**Q: "guideline file not found"**  
A: Check that the file paths in `load-guidelines.sh` match your repo.

**Q: "gh CLI not authenticated"**  
A: Run `gh auth login` and follow the prompts.

**Q: "Comment posted but has no findings"**  
A: The lenses may not have found issues, or they may have disagreed with the guideline file. Check the persona files and guideline files for misalignment.

**Q: "How do I add a new review dimension?"**  
A: That requires R1 SPLIT of this skill. File an issue instead of editing it directly.
