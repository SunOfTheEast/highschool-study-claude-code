# Tutor Closure Skill Clarification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Pi Tutor follow the single valid Lesson closure sequence without changing runtime behavior.

**Architecture:** Edit only the Tutor Skill's closure contract. Keep the Reflection Block active and assign both Reflection completion and Lesson closure to the existing `lesson_close` tool.

**Tech Stack:** Markdown Skill instructions; existing Pi `lesson_close` tool contract.

## Global Constraints

- Do not change schemas, runtime code, retries, frontend behavior, or persistent state.
- Do not add automated tests for Skill prose.
- Preserve unrelated dirty files.

---

### Task 1: Restore the explicit closure contract

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md:32`

**Interfaces:**
- Consumes: `lesson_close(reflection, summary)`, which completes the active Reflection Block and closes the Session-owned Lesson atomically.
- Produces: An unambiguous ordered instruction for Tutor closure.

- [ ] **Step 1: Replace the closure paragraph**

Use this exact semantic contract:

```markdown
Settle accepted corrections and evidence before leaving the current teaching Block. At closure, keep the Reflection Block active and derive Reflection and Lesson Summary from existing active evidence and direct sources. Call `lesson_close` once; it completes the active Reflection Block and closes the Lesson atomically. Only claim formal closure after its receipt has `ok: true`, the current `ownerPath`, and `status: closed`.
```

- [ ] **Step 2: Verify the focused difference**

Run:

```bash
git diff --check -- apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md
git diff -- apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md
```

Expected: no whitespace errors and only the `Transition and closure` paragraph changes.

- [ ] **Step 3: Check contract consistency**

Run:

```bash
rg -n "Reflection Block|lesson_close|status: closed|classroom_update" \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/src/runtime/lesson-close.ts
```

Expected: both Skill and tool assign Reflection completion to `lesson_close`; the Skill contains no instruction to complete Reflection with `classroom_update`.

- [ ] **Step 4: Commit the Skill change**

```bash
git add apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md
git commit -m "docs: clarify tutor lesson closure order"
```
