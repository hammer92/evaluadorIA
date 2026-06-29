# AI-DLC Workflow Rules

This project follows the AI-Driven Development Life Cycle (AI-DLC) methodology.

## Instructions for the Assistant

1. **Core Workflow**: When executing or planning any software development task, you must read, follow, and adhere to the rules defined in:
   - [.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md](file:///.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md)
2. **Rule Details**: Load and apply the detailed rules referenced by the workflow, located in:
   - [.aidlc/aidlc-rules/aws-aidlc-rule-details/](file:///.aidlc/aidlc-rules/aws-aidlc-rule-details/)

3. **Mandatory Steps**:
   - Perform Workspace Detection at the start of any new software development request.
   - Strictly follow the required human-in-the-loop checkpoints and obtain explicit approval before proceeding to subsequent phases.
   - Maintain the audit log in `aidlc-docs/audit.md` and track progress in `aidlc-docs/aidlc-state.md` as specified in the workflow rules.
   - Avoid creating files or configurations for other IDEs (e.g. Cursor, Cline, Claude Code) unless requested.
