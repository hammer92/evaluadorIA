# AI-DLC Workflow Rules

This project follows the AI-Driven Development Life Cycle (AI-DLC) methodology.

## Instructions for the Assistant

1. **Core Workflow**: When executing or planning any software development task, you must read, follow, and adhere to the rules defined in:
   - [.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md](file:///.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md)
2. **Rule Details**: Load and apply the detailed rules referenced by the workflow, located in:
   - [.aidlc/aidlc-rules/aws-aidlc-rule-details/](file:///.aidlc/aidlc-rule-details/)

3. **Mandatory Steps**:
   - Perform Workspace Detection at the start of any new software development request.
   - Strictly follow the required human-in-the-loop checkpoints and obtain explicit approval before proceeding to subsequent phases.
   - Maintain the audit log in `aidlc-docs/audit.md` and track progress in `aidlc-docs/aidlc-state.md` as specified in the workflow rules.
   - Avoid creating files or configurations for other IDEs (e.g. Cursor, Cline, Claude Code) unless requested.

## Git & Commit Policy (mandatory from 2026-06-28)

**Every AI-DLC workflow (each SDD or sprint) MUST end with a git commit** that closes that workflow. The commit is the closing artifact of the CONSTRUCTION phase and the natural audit checkpoint.

### When to commit

| Trigger                                         | Action                                           |
| ----------------------------------------------- | ------------------------------------------------ |
| End of a SDD (e.g. SDD-01, SDD-02, SDD-03, ...) | Required commit at the end of CONSTRUCTION phase |
| End of a gap-closure / remediation sprint       | Required commit                                  |
| Compliance review that produces fixes           | Required commit                                  |
| Mid-sprint housekeeping (refactor only)         | Optional, but encouraged                         |
| Pure documentation update inside `aidlc-docs/`  | Optional                                         |

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

### Required sequence at end of every SDD

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and capture the results.
2. Update `aidlc-docs/audit.md` with the final interaction entry.
3. Update `aidlc-docs/aidlc-state.md` with the new stage progress and "Latest Activity" section.
4. `git add -A` and `git commit -m "<conventional message>"` using the format above.
5. Confirm `git log -1` shows the new commit before reporting completion.

### Hooks in effect

- **pre-commit**: `pnpm lint-staged` + `pnpm typecheck` (enforced by Husky v9).
- **commit-msg**: `pnpm commitlint --edit "$1"` (enforced by Husky v9).
- A commit that fails any of these is rejected automatically. Do not bypass with `--no-verify`.

### Out of scope for this policy

- Force pushes, branch rebases, or amend of pushed commits — never do these without explicit user request.
- Auto-push to remote — only commit locally unless the user asks to push.
- Auto-creation of branches — default to `main` unless the user asks for a feature branch.

### Forbidden git operations (mandatory from 2026-07-17)

The following operations are **forbidden** in any AI-DLC workflow because they
are destructive and the agent cannot reliably recover from them mid-session.

| Operation                            | Reason                                                                                                                                                       | Read-only alternative                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `git stash` / `git stash pop`        | If the agent aborts the tool call mid-flight (timeout, user interrupt, error), the working tree is left in an undefined state and the stash ref can be lost. | `git log --oneline -N -- <path>`, `git show <commit>`, `git blame <path>` |
| `git stash apply` / `git stash drop` | Same risk as above; plus `drop` is irreversible without the reflog.                                                                                          | `git stash show -p stash@{N}` (read-only inspection)                      |
| `git reset --hard` (uncommitted)     | Discards uncommitted work without confirmation.                                                                                                              | `git diff` / `git diff --cached` (read-only)                              |
| `git checkout -- <path>`             | Discards uncommitted changes to a tracked file.                                                                                                              | `git diff -- <path>` (read-only)                                          |
| `git clean -fd`                      | Removes untracked files without confirmation.                                                                                                                | `git status --short` + manual confirmation by the user                    |

**Rule**: When verifying whether a test failure is pre-existing (i.e. not caused
by the current workflow), use read-only git operations only:

```bash
git log --oneline -5 -- <test-file>          # who/when last touched
git blame <test-file>                        # which lines
git show <commit> -- <test-file>             # what changed in a past commit
git stash list                               # list existing stashes (read-only)
```

If the agent must compare current vs. a previous state, run `pnpm test` /
`pnpm typecheck` and report the results **without** stashing the in-progress work.
If a hypothetical "clean" run is strictly necessary, **ask the user explicitly**
before any destructive git operation. Never assume the user wants to lose work.

### Recovery procedure if `git stash` was already used

If the agent already executed `git stash` and the working tree was lost:

1. **Immediately** run `git stash list` to find the stash ref.
2. Run `git stash show -p stash@{N}` to confirm the contents match what was stashed.
3. Run `git stash pop` to restore.
4. Verify with `git status --short` that all expected files are back.
5. If `git stash pop` fails due to conflicts, **stop and ask the user** — do not force-resolve.
