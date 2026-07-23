# Tutor Tool Contract Wording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify the existing Trace confirmation and Lesson closure contracts so Tutor can call both tools without avoidable retries.

**Architecture:** Preserve every executable contract and change only the instructions presented to Tutor. Keep the Pi Skill and runtime tool descriptions consistent with the existing validators and writers.

**Tech Stack:** Markdown, TypeScript, TypeBox tool metadata, Bun.

## Global Constraints

- This is a wording-only change.
- Do not modify schemas, state transitions, persistence, tools, or retry behavior.
- Do not add tests for Skill, Agent, or tool-description prose.

---

### Task 1: Clarify the existing Tutor tool contracts

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-close.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`

**Interfaces:**
- Consumes: the existing `student_confirmed` runtime validation and `closeLesson` active-Reflection requirement.
- Produces: matching Tutor-facing descriptions; no executable interface changes.

- [x] **Step 1: Clarify the Tutor Skill closure sequence**

Replace the Closure paragraph with:

```markdown
After explicit closure, resolve any accepted correction first. Keep the reflection Block active and do not complete it with `classroom_update`. Call `lesson_close` once with the final Reflection and Lesson Summary; it completes the reflection Block and closes the Lesson atomically.
```

- [x] **Step 2: Clarify `lesson_close`**

Use this tool description:

```text
Close the current Lesson after student confirmation. Keep the reflection Block active and do not complete it first; this tool persists the final reflection and summary, completes that Block, and closes the Lesson atomically.
```

- [x] **Step 3: Clarify the confirmed-method parameter group**

Extend the `methodStatus` description to state:

```text
Use student_confirmed only after an explicit student confirmation turn. The same call must include methodPrimary, methodDecisiveStep and methodConfirmation; otherwise use unmapped.
```

- [x] **Step 4: Run existing executable verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: type checking, unit tests, and production build all pass.

- [x] **Step 5: Review and commit the minimal diff**

Run:

```bash
git diff --check
git diff -- apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/src/runtime/lesson-close.ts apps/pi-teaching-web/src/runtime/study-tools.ts
git add docs/superpowers/specs/2026-07-23-tutor-tool-contract-wording-design.md docs/superpowers/plans/2026-07-23-tutor-tool-contract-wording.md apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/src/runtime/lesson-close.ts apps/pi-teaching-web/src/runtime/study-tools.ts
git commit -m "docs: clarify tutor tool contracts"
```

Expected: one commit containing only the approved design record, plan, and three wording edits.
