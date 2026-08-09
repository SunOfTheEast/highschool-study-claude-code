# Session-Specific Teaching Skill Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three overlapping StudyForge teaching Skill entry points with a five-Skill skeleton scoped to the Roadmap, Plan, and Lesson Sessions.

**Architecture:** Roadmap and Plan each receive one public-dialogue Skill and one post-approval preparation Skill. Lesson keeps one live-teaching Skill. Existing Plan-cycle and Lesson-template references move under the new ownership boundaries without changing their teaching content.

**Tech Stack:** Markdown Skill resources, TypeScript resource assembly, Bun tests.

## Global Constraints

- Work only in the selected worktree and preserve unrelated dirty changes.
- Do not commit without explicit user direction.
- Do not add runtime states, schemas, tools, Sessions, or approval fields.
- Do not refine diagnosis or explanation techniques in this skeleton task.
- Use the current Markdown document contract and lifecycle ownership unchanged.

---

### Task 1: Lock the node-specific Skill assembly

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: `loadStaticNodeResources(root, scope)`.
- Produces: exact expected Skill basenames for each node kind.

- [x] Add a test expecting Roadmap to load `roadmap-dialogue` and `prepare-approved-plan`, Plan to load `plan-dialogue` and `prepare-approved-lesson`, and Lesson to load only `tutor-lesson`.
- [x] Update packaged-reference paths to their new owners.
- [x] Run the focused test and confirm it fails against the old assembly.

### Task 2: Create the five-Skill skeleton

**Files:**
- Create: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/SKILL.md`
- Create: `apps/pi-teaching-web/resources/skills/prepare-approved-plan/SKILL.md`
- Create: `apps/pi-teaching-web/resources/skills/plan-dialogue/SKILL.md`
- Create: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Preserve: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`

**Interfaces:**
- Roadmap dialogue produces a student-approved Plan design; Plan preparation materializes it.
- Plan dialogue produces a student-approved Lesson design; Lesson preparation materializes it.
- Tutor consumes the prepared Lesson and writes classroom facts.

- [x] Write concise Chinese Skill bodies containing only scope, approval boundary, handoff, and progressive-disclosure links.
- [x] Add empty-but-valid reference indexes for future Roadmap diagnosis and Tutor explanation techniques.
- [x] Remove obsolete monolithic Skill entry files after their reusable references have moved.

### Task 3: Move reusable references and switch Runtime assembly

**Files:**
- Move: Plan-cycle references to `apps/pi-teaching-web/resources/skills/references/plan-cycles/`
- Move: Lesson templates and material preparation to `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/AGENTS.md` or repository `AGENTS.md` when it owns these paths.
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md` only to remove obsolete Skill names and keep the role as a short router.

**Interfaces:**
- `roleSkills.roadmap = ['roadmap-dialogue', 'prepare-approved-plan']`
- `roleSkills.plan = ['plan-dialogue', 'prepare-approved-lesson']`
- `roleSkills.lesson = ['tutor-lesson']`

- [x] Move references without duplicating their content.
- [x] Update node Skill assembly and current repository guidance.
- [x] Update current role resources so no live prompt routes to retired Skill names.

### Task 4: Verify the skeleton

**Files:**
- Read only: changed resources and tests.

**Interfaces:**
- Produces: deterministic evidence that the new skeleton is loadable and existing runtime contracts remain intact.

- [x] Run `bun test tests/m0/native-session.test.ts`.
- [x] Run `bun run check`.
- [x] Run `git diff --check` and inspect the complete resource diff.
- [x] Do not run real-model teaching acceptance until individual Skill behavior has been designed.
