---
name: ai-dlc
description: 'Triggers and guides the agent through the AI-Driven Development Life Cycle (AI-DLC) workflow for software development tasks.'
---

# AI-DLC Workflow Skill

When this skill is triggered by the user (or when starting a software development task), perform the following actions:

1. **Load Core Workflow**: Load and read the core workflow document from:
   - `.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md`

2. **Phase Implementation**:
   - Begin by displaying the **Welcome Message** defined in `.aidlc/aidlc-rules/aws-aidlc-rule-details/common/welcome-message.md`.
   - Run the **Workspace Detection** phase to check the status of the repository and initialize the state in `aidlc-docs/aidlc-state.md` and logging in `aidlc-docs/audit.md`.
   - Follow the adaptive workflow principles by dynamically selecting which phases (Inception, Construction, Operations) are required for the task.

3. **Checkpoints & Approval**:
   - Always stop and ask for human-in-the-loop approval at each mandatory checkpoint defined in the workflow (e.g., requirements analysis, workflow planning, functional design, code generation).
   - Only proceed to the next stage when explicit approval is provided.

## Skills by Phase

The following installed skills under `.agents/skills/<name>/SKILL.md` are available during each phase. When the active stage matches a skill's trigger, load that skill's `SKILL.md` and follow its process end-to-end.

### Inception (planning / requirements / design)

| Skill                      | When to invoke                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `interview-me`             | When the request is underspecified, conventional, or you find yourself guessing at requirements.           |
| `idea-refine`              | When the idea is still vague and needs divergent + convergent ideation before a spec exists.               |
| `context-engineering`      | When agent output quality is low, hallucinating APIs, or ignoring conventions. Curate what the agent sees. |
| `api-and-interface-design` | When designing REST/GraphQL endpoints, module boundaries, or public interfaces.                            |
| `documentation-and-adrs`   | When making an architectural decision worth recording as an ADR.                                           |

### Construction (build / code / verify / review)

| Skill                           | When to invoke                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `incremental-implementation`    | When implementing any multi-file change or a feature larger than ~100 lines. Build in thin vertical slices.      |
| `frontend-ui-engineering`       | When building or modifying UI components, pages, layouts, or accessibility.                                      |
| `api-and-interface-design`      | Reuse during code generation for any public surface — the contract must hold in the implementation.              |
| `browser-testing-with-devtools` | When verifying anything that runs in a browser: console, DOM, network, performance.                              |
| `debugging-and-error-recovery`  | When tests fail, builds break, or behavior doesn't match expectations.                                           |
| `code-review-and-quality`       | Before any merge or SDD close. Five-axis review (correctness, readability, architecture, security, performance). |
| `code-simplification`           | After a feature works but feels heavier than it needs to be. Preserve behavior exactly.                          |
| `security-and-hardening`        | When handling user input, auth, data storage, file uploads, webhooks, third-party APIs, or LLM features.         |

### Operations (ship / release / deprecate)

| Skill                         | When to invoke                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `git-workflow-and-versioning` | Every code change. Atomic commits, conventional messages, semver, tagged releases. Follow `.agents/AGENTS.md` Git & Commit Policy. |
| `documentation-and-adrs`      | Update README, ADRs, and inline gotchas as part of the same change that introduces them.                                           |
| `deprecation-and-migration`   | When removing an old API, library, or feature. Build the replacement first; expand/contract for schema changes.                    |
| `security-and-hardening`      | Continuous: audit dependencies on every release, treat model output as untrusted, rotate any committed secret.                     |

### Cross-cutting (any phase)

| Skill                | When to invoke                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `using-agent-skills` | At the start of any task to discover which skill applies, and whenever scope shifts between phases. |
