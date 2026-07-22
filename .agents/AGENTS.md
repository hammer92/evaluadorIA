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

4. **Engineering Skills**: A set of workflow skills is installed under `.agents/skills/`. Each skill lives at `.agents/skills/<name>/SKILL.md` and encodes a specific process (commit discipline, code review, debugging, API design, etc.). The orchestrator is [`.agents/skills/ai-dlc/SKILL.md`](file:///.agents/skills/ai-dlc/SKILL.md), which maps every installed skill to an AI-DLC phase (Inception / Construction / Operations). When the active stage matches a skill, load that skill's `SKILL.md` and follow its process end-to-end. Do not paraphrase or skip steps.

   Available skills (full registry in `.agents/skills/ai-dlc/SKILL.md`):

   - **Meta**: `using-agent-skills` (skill discovery), `ai-dlc` (workflow orchestrator)
   - **Inception**: `interview-me`, `idea-refine`, `context-engineering`, `api-and-interface-design`, `documentation-and-adrs`
   - **Construction**: `incremental-implementation`, `frontend-ui-engineering`, `browser-testing-with-devtools`, `debugging-and-error-recovery`, `code-review-and-quality`, `code-simplification`, `security-and-hardening`, `git-workflow-and-versioning`
   - **Operations**: `deprecation-and-migration`, `documentation-and-adrs`

## Git & Commit Policy

The full Git & Commit Policy for this project (commit triggers, conventional format, allowed types/scopes, SDD footer, end-of-SDD sequence, hooks, out-of-scope rules, forbidden operations, recovery procedure) lives in the **`git-workflow-and-versioning`** skill at [`.agents/skills/git-workflow-and-versioning/SKILL.md`](file:///.agents/skills/git-workflow-and-versioning/SKILL.md). Load it before making any commit, branch, release, or recovery operation. It is mandatory and overrides generic git guidance.

The `ai-dlc` orchestrator invokes this skill at the close of every SDD / CONSTRUCTION phase. The skill is the single source of truth for git policy in this repository — do not duplicate its rules in other files.
