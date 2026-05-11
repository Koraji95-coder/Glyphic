# Biome User Manual and Org-Wide Correction Workflow

This manual explains how to use Biome in Glyphic and how to integrate it into an organization-wide correction action workflow.

## 1. Purpose

Use Biome to:

- enforce consistent formatting and lint rules
- catch accessibility and correctness issues early
- provide automatic, safe corrections where possible
- gate pull requests with predictable quality checks

In this repo, Biome is already wired into `package.json` scripts:

- `npm run lint` -> `biome check src`
- `npm run lint:fix` -> `biome check --write .`
- `npm run format` -> `biome format --write src`

## 2. Local Setup

1. Install dependencies:

```bash
npm install
```

1. Run lint checks:

```bash
npm run lint
```

1. Apply autofixes (safe write mode):

```bash
npm run lint:fix
```

1. Format source files:

```bash
npm run format
```

1. Re-validate before commit:

```bash
npm run lint && npm run build
```

## 3. Daily Developer Workflow

1. Write code normally.
1. Run `npm run lint` before opening a PR.
1. Run `npm run lint:fix` to apply auto-fixable changes.
1. Manually resolve non-fixable diagnostics.
1. Run `npm run build` to confirm type/build health.

## 4. Example: Weird or Non-Obvious Rule (noAutofocus)

Biome can enforce accessibility rules such as no autofocus.

Bad pattern:

```tsx
<input autoFocus />
```

Preferred pattern:

```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  inputRef.current?.focus();
}, []);

<input ref={inputRef} />
```

Reason:

- avoids unexpected focus stealing for keyboard and screen reader users
- gives your component explicit focus timing control

## 5. PR Policy

Suggested pull request policy:

- required status check: Biome lint
- required status check: TypeScript build
- block merge on lint errors
- allow warnings only when explicitly reviewed (or upgrade warnings to errors over time)

Recommended PR checklist:

- `npm run lint` passes
- `npm run build` passes
- any suppression has justification comment and tracking issue

## 6. Organization-Wide Correction Action Design

Target organization/repo model:

- org: `chamber-19`
- maintenance repo: `chamber-19/org-maintenance`

Use `org-maintenance` as the source of truth for reusable workflows and standards.

### 6.1 Repository Layout in org-maintenance

```text
org-maintenance/
  .github/
    workflows/
      biome-check.yml
      biome-autofix.yml
    actions/
      setup-node-biome/
        action.yml
  biome/
    biome.base.json
    biome.strict.json
  docs/
    biome-policy.md
```

### 6.2 Reusable Check Workflow (read-only gate)

Create `.github/workflows/biome-check.yml` in `org-maintenance`:

```yaml
name: biome-check

on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: "20"
      lint-target:
        required: false
        type: string
        default: "src"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: npm
      - run: npm ci
      - run: npx biome check ${{ inputs.lint-target }}
```

Then each product repo consumes it:

```yaml
name: quality
on: [pull_request]

jobs:
  biome:
    uses: chamber-19/org-maintenance/.github/workflows/biome-check.yml@main
    with:
      node-version: "20"
      lint-target: "src"
```

### 6.3 Scheduled Auto-Correction Workflow (write mode)

Create `.github/workflows/biome-autofix.yml` in each product repo or centralize with dispatch:

```yaml
name: biome-autofix

on:
  schedule:
    - cron: "0 3 * * 1"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  autofix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx biome check --write .
      - name: Create PR if changes exist
        uses: peter-evans/create-pull-request@v7
        with:
          branch: chore/biome-autofix
          title: "chore: biome autofix"
          commit-message: "chore: apply biome autofixes"
          body: |
            Automated Biome autofix run.
            - Applied safe lint/format fixes
            - Please review semantic-sensitive changes
```

Safety model:

- never push directly to `main`
- always create PR for review
- keep branch names stable for easy tracking

## 7. Baseline and Incremental Adoption Strategy

For legacy repos with many violations:

1. Start with check mode only.
1. Scope to critical directories first (for example `src`).
1. Enable autofix PR workflow after the initial cleanup.
1. Increase strictness in phases:

- phase A: formatting + obvious correctness
- phase B: accessibility and suspicious patterns
- phase C: stricter style/correctness

1. Track trend metrics weekly.

Practical goal function:

$$
\text{violations}(t+1) < \text{violations}(t)
$$

Use trend reduction as the primary KPI until near-zero steady state.

## 8. Rule Governance

Store shared rule sets in `chamber-19/org-maintenance/biome/`.

Recommended model:

- `biome.base.json`: org minimum standards
- `biome.strict.json`: opt-in stricter rules for mature repos

Per-repo policy:

- inherit from base
- allow narrow repo-specific overrides only with rationale
- document any temporary suppressions with owner and expiry target

## 9. Suppression Policy

If a rule must be bypassed temporarily:

- suppress the smallest possible scope
- include why it is necessary
- include a follow-up issue reference

Example:

```ts
// biome-ignore lint/a11y/noAutofocus: Temporary for kiosk-mode login flow. Track: ENG-1234
```

Never add broad or file-wide ignores without architecture review.

## 10. Recommended Branch Protections

For all production repos:

- require PR reviews
- require Biome check status to pass
- require build status to pass
- dismiss stale approvals on new commits

## 11. Troubleshooting

### 11.1 Biome passes locally, fails in CI

Check:

- Node version mismatch
- lockfile drift (`npm ci` in CI vs `npm install` locally)
- OS-specific line endings

Fix:

- pin Node version in workflow
- run `npm ci` locally to reproduce CI

### 11.2 Autofix PR keeps changing same files

Check:

- competing formatters in CI/editor
- inconsistent Biome config files

Fix:

- make Biome single source of truth for formatting
- remove overlapping formatter writes in CI

### 11.3 Accessibility rule broke UX flow

Fix path:

- prefer compliant implementation (for example controlled focus via refs)
- if suppression is required, add scoped ignore + tracking issue

## 12. Suggested Rollout Plan for chamber-19

1. Publish shared Biome policies and reusable workflows in `chamber-19/org-maintenance`.
1. Onboard 1-2 pilot repositories.
1. Measure violation trend and autofix PR noise.
1. Tune rules and suppression policy.
1. Roll out to all active repos with branch protection requirements.

## 13. Quick Command Reference

```bash
# Check lint rules
npm run lint

# Apply autofixes
npm run lint:fix

# Format source files
npm run format

# Validate lint + build before PR
npm run lint && npm run build
```

This gives teams a repeatable path: local quality checks, CI gate enforcement, and safe org-wide auto-correction through reviewable pull requests.