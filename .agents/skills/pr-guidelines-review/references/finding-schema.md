# Finding Schema

This schema defines the expected JSON output from each lens (Security, Architecture, Documentation).

## Security Lens Finding

```json
{
  "sev": "blocker|high|medium|low",
  "cwe": "CWE-NNN or null",
  "file": "src/path/to/file.py",
  "line": 42,
  "finding": "Brief description of the issue, <=100 chars"
}
```

**Fields:**
- `sev` (required): Severity level; blocker issues prevent merge, high are significant, medium/low are advisory
- `cwe` (optional): OWASP/CWE ID if applicable; omit if unknown
- `file` (required): Path to the affected file; "N/A" if not tied to a file
- `line` (optional): Line number in the file; null if not line-specific
- `finding` (required): 1-2 sentence description of the issue and why it matters

## Architecture Lens Finding

```json
{
  "sev": "blocker|high|medium|low",
  "category": "coupling|soc|circularity|layer|anti-pattern|extensibility|testability",
  "files": ["src/path/file1.py", "src/path/file2.py"],
  "finding": "Brief description of the architectural concern, <=100 chars"
}
```

**Fields:**
- `sev` (required): Severity level
- `category` (required): Type of architectural issue
- `files` (required): Array of affected files (one or more)
- `finding` (required): 1-2 sentence description of the concern

## Documentation Lens Finding

```json
{
  "sev": "blocker|high|medium|low",
  "category": "changelog|api-docs|breaking-changes|comments|config-docs|migration-guide|docstring-quality",
  "file": "src/path/to/file.py or CHANGELOG.md",
  "finding": "Brief description of the doc gap, <=100 chars"
}
```

**Fields:**
- `sev` (required): Severity level
- `category` (required): Type of documentation gap
- `file` (required): Affected file or "CHANGELOG.md" if changelog-related
- `finding` (required): 1-2 sentence description of the gap

## Validation Rules

1. Every finding must have `sev`, `file` or `files`, and `finding`
2. `sev` must be one of: blocker, high, medium, low
3. `file` or `files` must be non-empty string or array
4. If no findings: return empty array `[]`
5. Always output JSON (no preamble or prose)

## Example Output (All Clear)

```json
[]
```

## Example Output (With Findings)

```json
[
  {
    "sev": "blocker",
    "cwe": "CWE-89",
    "file": "src/db/query.py",
    "line": 15,
    "finding": "SQL query concatenates user input; use parameterized queries"
  },
  {
    "sev": "high",
    "cwe": null,
    "file": "src/auth/token.py",
    "line": 42,
    "finding": "Token secret hardcoded; should be read from environment or secrets manager"
  }
]
```
