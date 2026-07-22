---
name: git-workflow-and-versioning
description: Structures git workflow practices. Use when making any code change. Use when committing, branching, resolving conflicts, or when you need to organize work across multiple parallel streams. Use when cutting a release, choosing a semantic version bump, tagging, or writing a changelog.
---

# Git Workflow and Versioning

## Overview

Git is your safety net. Treat commits as save points, branches as sandboxes, and history as documentation. With AI agents generating code at high speed, disciplined version control is the mechanism that keeps changes manageable, reviewable, and reversible.

## When to Use

Every code change flows through git. Load this skill whenever you are about to:

- Make a code change (any size, any scope)
- Commit, amend, or reword a commit message
- Create, merge, or delete a branch
- Resolve a merge or rebase conflict
- Cut a release, choose a semver bump, or write a changelog
- Diagnose which commit introduced a regression

## How to Use This Skill

This skill is the **single source of truth** for both generic git practice and the project's git policy. It is loaded by the AI-DLC orchestrator during **CONSTRUCTION** and **OPERATIONS**, and is referenced by `.agents/AGENTS.md` for the Git & Commit Policy. Do not duplicate its rules in other files.

### Loading order

1. Load this skill first — it contains both the generic git mechanics _and_ the mandatory project policy in the **AI-DLC Project Git Policy** section.
2. The AI-DLC orchestrator (`.agents/skills/ai-dlc/SKILL.md`) loads this skill automatically at the right stage; if you are operating outside the orchestrator, load it before any commit, branch, release, or recovery operation.
3. When this skill and any other file disagree, **this skill wins** for git policy. AI-DLC workflow rules in `.aidlc/aidlc-rules/...` still apply for phase transitions and checkpoints.

### Within the AI-DLC workflow

- **During CONSTRUCTION** (per `incremental-implementation`): use this skill's Save Point Pattern, atomic-commit discipline, and Pre-Commit Hygiene when staging each slice.
- **At the end of an SDD** (CONSTRUCTION close): follow the **Required sequence at end of every SDD** in the AI-DLC Project Git Policy section — `pnpm typecheck/lint/test/build`, update `aidlc-docs/audit.md` and `aidlc-docs/aidlc-state.md`, `git add -A`, conventional commit with SDD footer, `git log -1` confirmation.
- **During OPERATIONS** (releases, deprecations): use this skill's Release & Versioning section (semver, tagging, changelog). The release authorization and rollback policy remain with the human.

### What this skill guarantees

- Generic git mechanics: atomic commits, branch hygiene, semver, changelog, debugging toolkit.
- Pre-commit hygiene that catches secrets, formatting drift, and missing tests before they hit history.
- A debugging toolkit (`git bisect`, `git blame`, `git log --grep`) for finding regressions.
- A versioning contract (semver + tagged releases + curated changelog) for anything with consumers.
- The project's mandatory Git & Commit Policy: commit triggers, conventional format, allowed types/scopes, SDD footer, end-of-SDD sequence, hooks, out-of-scope rules, forbidden operations, recovery procedure.

### What this skill does NOT cover

- AI-DLC workflow phases, checkpoints, or audit/state files — see `.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md`.
- Code review or simplification — see `code-review-and-quality` and `code-simplification` skills.
- Deprecation planning or migration mechanics — see `deprecation-and-migration` skill.

## Core Principles

### Trunk-Based Development (Recommended)

Keep `main` always deployable. Work in short-lived feature branches that merge back within 1-3 days. Long-lived development branches are hidden costs — they diverge, create merge conflicts, and delay integration. DORA research consistently shows trunk-based development correlates with high-performing engineering teams.

```
main ──●──●──●──●──●──●──●──●──●──  (always deployable)
        ╲      ╱  ╲    ╱
         ●──●─╱    ●──╱    ← short-lived feature branches (1-3 days)
```

This is the recommended default. Teams using gitflow or long-lived branches can adapt the principles (atomic commits, small changes, descriptive messages) to their branching model — the commit discipline matters more than the specific branching strategy.

- **Dev branches are costs.** Every day a branch lives, it accumulates merge risk.
- **Release branches are acceptable.** When you need to stabilize a release while main moves forward.
- **Feature flags > long branches.** Prefer deploying incomplete work behind flags rather than keeping it on a branch for weeks.

### 1. Commit Early, Commit Often

Each successful increment gets its own commit. Don't accumulate large uncommitted changes.

```
Work pattern:
  Implement slice → Test → Verify → Commit → Next slice

Not this:
  Implement everything → Hope it works → Giant commit
```

Commits are save points. If the next change breaks something, you can revert to the last known-good state instantly.

### 2. Atomic Commits

Each commit does one logical thing:

```
# Good: Each commit is self-contained
git log --oneline
a1b2c3d Add task creation endpoint with validation
d4e5f6g Add task creation form component
h7i8j9k Connect form to API and add loading state
m1n2o3p Add task creation tests (unit + integration)

# Bad: Everything mixed together
git log --oneline
x1y2z3a Add task feature, fix sidebar, update deps, refactor utils
```

### 3. Descriptive Messages

Commit messages explain the _why_, not just the _what_:

```
# Good: Explains intent
feat: add email validation to registration endpoint

Prevents invalid email formats from reaching the database.
Uses Zod schema validation at the route handler level,
consistent with existing validation patterns in auth.ts.

# Bad: Describes what's obvious from the diff
update auth.ts
```

**Format (Conventional Commits):**

```
<type>(<scope>): <subject>

<body explaining why, not what>

<footer with refs / metrics>
```

The exact list of allowed `type` and `scope` values for _this_ repository is defined in the **AI-DLC Project Git Policy** section of this skill (below). The skill explains the shape here; the policy section defines the project's vocabulary.

### 4. Keep Concerns Separate

Don't combine formatting changes with behavior changes. Don't combine refactors with features. Each type of change should be a separate commit — and ideally a separate PR:

```
# Good: Separate concerns
git commit -m "refactor: extract validation logic to shared utility"
git commit -m "feat: add phone number validation to registration"

# Bad: Mixed concerns
git commit -m "refactor validation and add phone number field"
```

**Separate refactoring from feature work.** A refactoring change and a feature change are two different changes — submit them separately. This makes each change easier to review, revert, and understand in history. Small cleanups (renaming a variable) can be included in a feature commit at reviewer discretion.

### 5. Size Your Changes

Target ~100 lines per commit/PR. Changes over ~1000 lines should be split. See the splitting strategies in `code-review-and-quality` for how to break down large changes.

```
~100 lines  → Easy to review, easy to revert
~300 lines  → Acceptable for a single logical change
~1000 lines → Split into smaller changes
```

## AI-DLC Project Git Policy (mandatory)

The rules below are **non-negotiable** for any AI-DLC workflow in this repository. They are the single source of truth for git policy — `.agents/AGENTS.md` references this section and does not duplicate it.

### When to commit

Every AI-DLC workflow (each SDD or sprint) MUST end with a git commit. The commit is the closing artifact of the CONSTRUCTION phase and the natural audit checkpoint.

| Trigger                                         | Action                                               |
| ----------------------------------------------- | ---------------------------------------------------- |
| End of a SDD (e.g. SDD-01, SDD-02, SDD-03, ...) | **Required** commit at the end of CONSTRUCTION phase |
| End of a gap-closure / remediation sprint       | **Required**                                         |
| Compliance review that produces fixes           | **Required**                                         |
| Mid-sprint housekeeping (refactor only)         | Optional, but encouraged                             |
| Pure documentation update inside `aidlc-docs/`  | Optional                                             |

### Commit message format (Conventional Commits enforced by commitlint)

```text
<type>(<scope>): <subject>

<body explaining the SDD or sprint>

<footer with refs / metrics>
```

**Allowed types**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`, `style`.
**Allowed scopes**: `web`, `functions`, `shared`, `auth`, `users`, `orgs`, `audit`, `reports`, `tooling`, `ci`, `docs`, `deps`.

### Recommended commit footer for SDD-closing commits

```text
SDD-XX: <one-line summary>
Test results: typecheck PASS | lint PASS | test N/N | build PASS
AI-DLC: workflow closed at <stage>
```

Example full commit:

```text
feat(auth): add password reset endpoint with rate limiting

Implements POST /api/auth/reset-password per ADR-007.
Token expires after 1h; rate limit 5 req/15min per IP.

SDD-12: Password reset endpoint
Test results: typecheck PASS | lint PASS | test 142/142 | build PASS
AI-DLC: workflow closed at CONSTRUCTION
```

### Required sequence at end of every SDD

Run these steps in order. Do not skip any.

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and capture the results.
2. Update `aidlc-docs/audit.md` with the final interaction entry.
3. Update `aidlc-docs/aidlc-state.md` with the new stage progress and "Latest Activity" section.
4. `git add -A` and `git commit -m "<conventional message>"` using the format above.
5. Confirm `git log -1` shows the new commit before reporting completion.

### Hooks in effect

- **pre-commit**: `pnpm lint-staged` + `pnpm typecheck` (enforced by Husky v9).
- **commit-msg**: `pnpm commitlint --edit "$1"` (enforced by Husky v9).
- A commit that fails any of these is rejected automatically. **Do not bypass with `--no-verify`**.

### Out of scope for this policy

- **Force pushes, branch rebases, or amend of pushed commits** — never do these without explicit user request.
- **Auto-push to remote** — only commit locally unless the user asks to push.
- **Auto-creation of branches** — default to `main` unless the user asks for a feature branch.

### Forbidden git operations (mandatory from 2026-07-17)

The following operations are **forbidden** in any AI-DLC workflow because they are destructive and the agent cannot reliably recover from them mid-session.

| Operation                            | Reason                                                                                                                                                       | Read-only alternative                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `git stash` / `git stash pop`        | If the agent aborts the tool call mid-flight (timeout, user interrupt, error), the working tree is left in an undefined state and the stash ref can be lost. | `git log --oneline -N -- <path>`, `git show <commit>`, `git blame <path>` |
| `git stash apply` / `git stash drop` | Same risk as above; plus `drop` is irreversible without the reflog.                                                                                          | `git stash show -p stash@{N}` (read-only inspection)                      |
| `git reset --hard` (uncommitted)     | Discards uncommitted work without confirmation.                                                                                                              | `git diff` / `git diff --cached` (read-only)                              |
| `git checkout -- <path>`             | Discards uncommitted changes to a tracked file.                                                                                                              | `git diff -- <path>` (read-only)                                          |
| `git clean -fd`                      | Removes untracked files without confirmation.                                                                                                                | `git status --short` + manual confirmation by the user                    |

**Rule for pre-existing test failures:** When verifying whether a test failure is pre-existing (not caused by the current workflow), use read-only git operations only:

```bash
git log --oneline -5 -- <test-file>          # who/when last touched
git blame <test-file>                        # which lines
git show <commit> -- <test-file>             # what changed in a past commit
git stash list                               # list existing stashes (read-only)
```

If the agent must compare current vs. a previous state, run `pnpm test` / `pnpm typecheck` and report the results **without** stashing the in-progress work. If a hypothetical "clean" run is strictly necessary, **ask the user explicitly** before any destructive git operation. Never assume the user wants to lose work.

### Recovery procedure if `git stash` was already used

If the agent already executed `git stash` and the working tree was lost:

1. **Immediately** run `git stash list` to find the stash ref.
2. Run `git stash show -p stash@{N}` to confirm the contents match what was stashed.
3. Run `git stash pop` to restore.
4. Verify with `git status --short` that all expected files are back.
5. If `git stash pop` fails due to conflicts, **stop and ask the user** — do not force-resolve.

## Branching Strategy

### Feature Branches

```
main (always deployable)
  │
  ├── feature/task-creation    ← One feature per branch
  ├── feature/user-settings    ← Parallel work
  └── fix/duplicate-tasks      ← Bug fixes
```

- Branch from `main` (or the team's default branch)
- Keep branches short-lived (merge within 1-3 days) — long-lived branches are hidden costs
- Delete branches after merge
- Prefer feature flags over long-lived branches for incomplete features

### Branch Naming

```
feature/<short-description>   → feature/task-creation
fix/<short-description>       → fix/duplicate-tasks
chore/<short-description>     → chore/update-deps
refactor/<short-description>  → refactor/auth-module
```

## Working with Worktrees

For parallel AI agent work, use git worktrees to run multiple branches simultaneously:

```bash
# Create a worktree for a feature branch
git worktree add ../project-feature-a feature/task-creation
git worktree add ../project-feature-b feature/user-settings

# Each worktree is a separate directory with its own branch
# Agents can work in parallel without interfering
ls ../
  project/              ← main branch
  project-feature-a/    ← task-creation branch
  project-feature-b/    ← user-settings branch

# When done, merge and clean up
git worktree remove ../project-feature-a
```

Benefits:

- Multiple agents can work on different features simultaneously
- No branch switching needed (each directory has its own branch)
- If one experiment fails, delete the worktree — nothing is lost
- Changes are isolated until explicitly merged

## The Save Point Pattern

```
Agent starts work
    │
    ├── Makes a change
    │   ├── Test passes? → Commit → Continue
    │   └── Test fails? → Revert to last commit → Investigate
    │
    ├── Makes another change
    │   ├── Test passes? → Commit → Continue
    │   └── Test fails? → Revert to last commit → Investigate
    │
    └── Feature complete → All commits form a clean history
```

This pattern means you never lose more than one increment of work. If an agent goes off the rails, `git reset --hard HEAD` takes you back to the last successful state.

## Change Summaries

After any modification, provide a structured summary. This makes review easier, documents scope discipline, and surfaces unintended changes:

```
CHANGES MADE:
- src/routes/tasks.ts: Added validation middleware to POST endpoint
- src/lib/validation.ts: Added TaskCreateSchema using Zod

THINGS I DIDN'T TOUCH (intentionally):
- src/routes/auth.ts: Has similar validation gap but out of scope
- src/middleware/error.ts: Error format could be improved (separate task)

POTENTIAL CONCERNS:
- The Zod schema is strict — rejects extra fields. Confirm this is desired.
- Added zod as a dependency (72KB gzipped) — already in package.json
```

This pattern catches wrong assumptions early and gives reviewers a clear map of the change. The "DIDN'T TOUCH" section is especially important — it shows you exercised scope discipline and didn't go on an unsolicited renovation.

## Pre-Commit Hygiene

Before every commit, run the project's standard checks:

```bash
# 1. Check what you're about to commit
git diff --staged

# 2. Ensure no secrets
git diff --staged | grep -i "password\|secret\|api_key\|token"

# 3. Run tests, lint, type check, and build
```

The exact commands (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`) and which Husky hooks enforce them live in the **AI-DLC Project Git Policy** section of this skill (below). This section recommends the _shape_ of the check; the policy section defines the _commands and hooks_ for this repo.

Automate this with git hooks where possible:

```json
// package.json (using lint-staged + husky)
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

If a hook fails, fix the underlying issue and re-commit. Do not bypass hooks unless the user explicitly asks.

## Handling Generated Files

- **Commit generated files** only if the project expects them (e.g., `package-lock.json`, Prisma migrations)
- **Don't commit** build output (`dist/`, `.next/`), environment files (`.env`), or IDE config (`.vscode/settings.json` unless shared)
- **Have a `.gitignore`** that covers: `node_modules/`, `dist/`, `.env`, `.env.local`, `*.pem`

## Using Git for Debugging

```bash
# Find which commit introduced a bug
git bisect start
git bisect bad HEAD
git bisect good <known-good-commit>
# Git checkouts midpoints; run your test at each to narrow down

# View what changed recently
git log --oneline -20
git diff HEAD~5..HEAD -- src/

# Find who last changed a specific line
git blame src/services/task.ts

# Search commit messages for a keyword
git log --grep="validation" --oneline
```

## Release & Versioning

Commits are how _you_ track change; a **version** is how your _consumers_ track it. The moment anything else depends on your code — another team, a published package, a deployed client — "latest on main" stops being a sufficient answer to "what am I running, and is it safe to upgrade?" A version number and a changelog are the contract that answers it.

### Semantic Versioning

For anything with consumers, version `MAJOR.MINOR.PATCH` and let the number carry meaning:

```
  MAJOR  breaking change — consumers must change their code to upgrade
  MINOR  new functionality, backward-compatible — safe to upgrade
  PATCH  bug fix, backward-compatible — safe to upgrade
```

The number is a promise, so make the code match it. A "patch" that changes behavior consumers relied on is a major change wearing a disguise (Hyrum's Law — see the `api-and-interface-design` skill). When unsure whether a change is breaking, assume it is; a surprise major is far cheaper than a broken consumer.

### Tag the release, and let the tag be the source of truth

A release is an immutable point in history, not a moving branch. Tag it so it can always be reproduced:

```bash
git tag -a v1.4.0 -m "Release 1.4.0"
git push origin v1.4.0
```

Derive the version from the tag rather than hand-editing it in scattered files, so the artifact, the tag, and the changelog can never disagree.

### Keep a changelog written for humans

A changelog is not `git log`. It's the curated, consumer-facing answer to "what changed and do I care?" — grouped by `Added / Changed / Fixed / Deprecated / Removed / Security`, newest on top, every entry phrased around user impact, not internal mechanics.

```markdown
## [1.4.0] - 2025-06-12

### Added

- Bulk task import via CSV

### Fixed

- Timezone drift in recurring task due dates

### Deprecated

- `GET /v1/tasks/all` — use the paginated `GET /v1/tasks` (removal in 2.0)
```

Write the entry in the same change that makes the change, while the impact is fresh — not reconstructed from commit archaeology at release time. Breaking changes get a migration note and a deprecation window (follow the `deprecation-and-migration` skill); shipping the actual release is the `shipping-and-launch` skill's job — this section is the versioning contract that feeds it.

## Common Rationalizations

| Rationalization                             | Reality                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| "I'll commit when the feature is done"      | One giant commit is impossible to review, debug, or revert. Commit each slice.                                                          |
| "The message doesn't matter"                | Messages are documentation. Future you (and future agents) will need to understand what changed and why.                                |
| "I'll squash it all later"                  | Squashing destroys the development narrative. Prefer clean incremental commits from the start.                                          |
| "Branches add overhead"                     | Short-lived branches are free and prevent conflicting work from colliding. Long-lived branches are the problem — merge within 1-3 days. |
| "I'll split this change later"              | Large changes are harder to review, riskier to deploy, and harder to revert. Split before submitting, not after.                        |
| "I don't need a .gitignore"                 | Until `.env` with production secrets gets committed. Set it up immediately.                                                             |
| "It's just a small fix, bump the patch"     | Check what consumers can observe. A behavior change they relied on is a major, whatever the diff size.                                  |
| "The changelog is just the commit log"      | Commits are for you; the changelog is for consumers, curated by impact. Generating one from raw commits buries what matters.            |
| "We'll write the changelog at release time" | By then the impact is reconstructed from memory and half of it is missing. Write the entry with the change.                             |

## Red Flags

- Large uncommitted changes accumulating
- Commit messages like "fix", "update", "misc"
- Formatting changes mixed with behavior changes
- No `.gitignore` in the project
- Committing `node_modules/`, `.env`, or build artifacts
- Long-lived branches that diverge significantly from main
- Force-pushing to shared branches
- A breaking change shipped under a minor or patch version bump
- A release with no tag, or a version number hand-edited out of sync with the tag
- A user-facing release with no changelog entry, or a changelog that's just dumped commit messages

## Verification

For every commit (generic checks this skill enforces):

- [ ] Commit does one logical thing
- [ ] Message explains the why, not just the what
- [ ] Tests pass before committing
- [ ] No secrets in the diff
- [ ] No formatting-only changes mixed with behavior changes
- [ ] `.gitignore` covers standard exclusions

For project-specific commit checks (allowed types/scopes, hooks, package manager commands, SDD footer, etc.) and the end-of-SDD closing sequence, see the **AI-DLC Project Git Policy** section of this skill. Those rules are mandatory and apply on top of the generic checks above.

For every release (anything with consumers):

- [ ] The version bump matches the change: breaking → major, additive → minor, fix → patch
- [ ] The release is tagged, and the version is derived from the tag, not hand-edited out of sync
- [ ] The changelog has a curated, human-readable entry grouped by impact for this version
