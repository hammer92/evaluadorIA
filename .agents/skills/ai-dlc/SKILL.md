---
name: ai-dlc
description: 'Triggers and guides the agent through the AI-Driven Development Life Cycle (AI-DLC) workflow for software development tasks.'
---

# AI-DLC Workflow Skill

When this skill is triggered by the user (or when starting a software development task), perform the following actions IN ORDER:

## 0. Mandatory: Activate Discovery Skill

Before anything else, activate the `using-agent-skills` skill to establish discovery context. This is non-negotiable — it is the protocol that prevents skipping applicable skills (see "Mandatory Skill Activation Protocol" below).

```
skill: using-agent-skills
```

The discovery skill returns the canonical activation tree and confirms which skills apply to the user's stated intent.

## 1. Load Core Workflow

Load and read the core workflow document from:

- `.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md`

## 2. Phase Implementation

- Begin by displaying the **Welcome Message** defined in `.aidlc/aidlc-rules/aws-aidlc-rule-details/common/welcome-message.md`.
- Run the **Workspace Detection** phase to check the status of the repository and initialize the state in `aidlc-docs/aidlc-state.md` and logging in `aidlc-docs/audit.md`.
- Follow the adaptive workflow principles by dynamically selecting which phases (Inception, Construction, Operations) are required for the task.

## 3. Mandatory Skill Activation Protocol

**This section is non-optional.** Skill activation is not a hint — it is a workflow gate. Before starting each phase (or per-unit within a phase), the orchestrator MUST activate every skill marked REQUIRED in the matrix below by issuing the `skill:` tool call. The orchestrator MUST log the activation in `aidlc-docs/audit.md` with the timestamp and skill name.

### Activation Discipline

1. **Discovery first.** At workflow start, activate `using-agent-skills` (see Step 0). Re-activate it whenever scope shifts between phases — the discovery tree is the source of truth for "which skill applies now".
2. **Activate before work begins.** Skills listed as REQUIRED for a phase MUST be active before any code, doc, or config change in that phase. Loading the skill mid-phase to "justify a decision already made" is not activation — it is post-hoc rationalization.
3. **Follow end-to-end.** Loading `SKILL.md` and skimming is not enough. Apply the skill's full process (steps, checklists, decision trees). When the skill prescribes "before doing X, do Y", do Y before X.
4. **Log every activation.** Each activation gets one entry in `aidlc-docs/audit.md`:
   ```
   **Skill activated**: `<name>` — `<reason>` — `<timestamp>`
   ```
5. **Refuse to skip.** If a REQUIRED skill does not apply to the current context, log it explicitly as "loaded but not applied: <reason>". Hiding the requirement is worse than explicitly opting out.
6. **Re-activate on retry.** If the agent gets stuck (tests fail, build broken, CI red), re-activate `debugging-and-error-recovery` before continuing. Trial-and-error iteration without the skill is a process smell.

### Phase → Skill Activation Matrix

The matrix below maps every AI-DLC phase to the skills that MUST be active during it. Some skills are MANDATORY for any workflow that touches the corresponding area; others are CONDITIONAL based on context. The orchestrator activates MANDATORY skills unconditionally, and CONDITIONAL skills when the trigger applies.

#### INCEPTION PHASE

| Stage                      | MANDATORY skills                                                | CONDITIONAL skills (activate when trigger applies)                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace Detection        | `context-engineering` (always — for brownfield state awareness) | —                                                                                                                                                                                       |
| Reverse Engineering        | `context-engineering`                                           | —                                                                                                                                                                                       |
| Requirements Analysis      | —                                                               | `interview-me` (underspecified intent), `idea-refine` (vague idea), `api-and-interface-design` (touches API surface), `documentation-and-adrs` (architectural decision worth recording) |
| User Stories               | —                                                               | `interview-me` (multi-persona, complex)                                                                                                                                                 |
| Workflow Planning          | `incremental-implementation` (any multi-file change)            | `documentation-and-adrs` (new convention or process change)                                                                                                                             |
| Application Design         | `api-and-interface-design` (REST/GraphQL/module boundaries)     | `frontend-ui-engineering` (UI surface), `security-and-hardening` (auth, data model)                                                                                                     |
| **Workflow Plan Approval** | —                                                               | Pause for human-in-the-loop approval per core-workflow rules.                                                                                                                           |

#### CONSTRUCTION PHASE (per-unit loop)

| Stage                 | MANDATORY skills                                                                                                     | CONDITIONAL skills                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional Design     | `api-and-interface-design` (if function/method signature)                                                            | `frontend-ui-engineering` (if UI)                                                                                                                                                       |
| NFR Requirements      | `security-and-hardening` (auth, input, data)                                                                         | —                                                                                                                                                                                       |
| NFR Design            | `security-and-hardening`                                                                                             | —                                                                                                                                                                                       |
| Infrastructure Design | `security-and-hardening` (infra touches auth/data)                                                                   | —                                                                                                                                                                                       |
| **Code Generation**   | `code-review-and-quality` (review-as-you-go on every commit), `incremental-implementation` (decompose before coding) | `frontend-ui-engineering` (UI code), `api-and-interface-design` (API code), `browser-testing-with-devtools` (browser-runnable code), `security-and-hardening` (auth, input, data paths) |
| **Build and Test**    | `debugging-and-error-recovery` (when any check fails), `code-simplification` (after passing tests, before merge)     | —                                                                                                                                                                                       |
| **Pre-merge Review**  | `code-review-and-quality` (5-axis review of every PR before merge — non-optional)                                    | `security-and-hardening` (security-sensitive changes)                                                                                                                                   |

Per-unit loop note: each unit goes through the full loop. The skill activation discipline does not compress when units are small. If the unit is a single ~30-line change, at minimum `code-review-and-quality` and `git-workflow-and-versioning` still apply.

#### OPERATIONS PHASE

| Stage                      | MANDATORY skills                                        | CONDITIONAL skills                                     |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Release / Deploy           | `git-workflow-and-versioning`, `security-and-hardening` | `deprecation-and-migration` (removing old API/feature) |
| Post-release documentation | `documentation-and-adrs`                                | —                                                      |

#### CROSS-CUTTING (any phase, any change)

These skills apply to **every** commit, branch, push, merge, or recovery:

- `git-workflow-and-versioning` — atomic commits, conventional format, hooks, forbidden ops. MANDATORY before any git operation. See `.agents/skills/git-workflow-and-versioning/SKILL.md`.
- `using-agent-skills` — re-activate when scope shifts; this is the discovery tree of truth.
- `code-review-and-quality` — at minimum the "Review the Tests First" + "Verify the Verification" checklist applies to every change.

### Audit Log Format for Activations

Each skill activation is logged in `aidlc-docs/audit.md` immediately after the call:

```markdown
## Skills Activated — <Phase Name>

**Timestamp**: <ISO 8601>
**Skill activated**: `<skill-name>` — `<reason: which trigger applies>`
**Skill activated**: `<skill-name>` — `<reason>`
**Context**: <phase or unit name>
```

## 4. Checkpoints & Approval

- Always stop and ask for human-in-the-loop approval at each mandatory checkpoint defined in the workflow (e.g., requirements analysis, workflow planning, functional design, code generation).
- Only proceed to the next stage when explicit approval is provided.

## Skills by Phase (reference)

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
