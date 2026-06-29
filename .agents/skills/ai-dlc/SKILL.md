---
name: ai-dlc
description: 'Triggers and guides the agent through the AI-Driven Development Life Cycle (AI-DLC) workflow for software development tasks.'
---

# AI-DLC Workflow Skill

When this skill is triggered by the user (or when starting a software development task), perform the following actions:

1. **Load Core Workflow**: Load and read the core workflow document from:
   - `file:///home/hammer/evaluador/.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md`

2. **Phase Implementation**:
   - Begin by displaying the **Welcome Message** defined in `file:///home/hammer/evaluador/.aidlc/aidlc-rules/aws-aidlc-rule-details/common/welcome-message.md`.
   - Run the **Workspace Detection** phase to check the status of the repository and initialize the state in `aidlc-docs/aidlc-state.md` and logging in `aidlc-docs/audit.md`.
   - Follow the adaptive workflow principles by dynamically selecting which phases (Inception, Construction, Operations) are required for the task.

3. **Checkpoints & Approval**:
   - Always stop and ask for human-in-the-loop approval at each mandatory checkpoint defined in the workflow (e.g., requirements analysis, workflow planning, functional design, code generation).
   - Only proceed to the next stage when explicit approval is provided.
