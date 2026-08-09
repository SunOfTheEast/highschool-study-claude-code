# Teaching Skill Boundary Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the unverified Roadmap, Prepare, and Tutor Skill batch so only approved workflows are active, Tree-linked evidence is enforced before Skill loading, and every phase has one unambiguous route.

**Architecture:** Keep evidence-discovery invariants in the always-loaded Roadmap and Plan Agent prompts. Keep phase workflows in one self-contained reference apiece. Preserve the seven Tutor technique files as unshipped drafts by removing their runtime route until each technique receives its own design and RED/GREEN acceptance.

**Tech Stack:** Markdown Agent/Skill resources, Pi native sessions, Bun deterministic tests, Playwright lifecycle E2E.

## Global Constraints

- Work only in the selected worktree and preserve unrelated dirty changes.
- Do not commit without explicit user direction.
- Do not add runtime states, schemas, tools, Sessions, approval fields, or exact-wording tests.
- Child status comes only from the linked child frontmatter.
- Course evidence is reachable only through the current parent Tree; directory discovery and orphan files are never evidence.
- Treat the existing Flash CoT directory enumeration as RED evidence; do not reinterpret static assembly tests as behavioral GREEN.

---

### Task 1: Put evidence discovery in the always-loaded Agents

**Files:**
- Modify: `apps/pi-teaching-web/resources/agents/roadmap-node.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`

**Interfaces:**
- Roadmap consumes only Plans linked by `ROADMAP.md` and descends only through their linked Lesson Trees.
- Plan consumes only Lessons linked by the current Plan.
- Both read child lifecycle status from child frontmatter, never parent prose or directory contents.

- [x] Preserve the historical RED: `/tmp/studyforge-flash-first-turn-cot.txt` contains `ls plans/` and `ls lessons/` before the relevant evidence boundary was loaded.
- [x] Add the Tree-only, no-directory, no-orphan, child-frontmatter invariant to both Agent prompts.
- [x] Re-read both prompts and confirm the invariant is present before any instruction to review children.

### Task 2: Make Roadmap routing mutually exclusive

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/references/diagnosis/first-roadmap.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/references/next-plan.md`

**Interfaces:**
- Empty Plan Tree selects first Roadmap.
- Latest linked Plan `completed` selects next Plan.
- Latest linked Plan `prepared` or `active` blocks successor materialization; a requested turn first returns to the current Plan's closure path.
- Each selected phase reads one phase reference only.

- [x] Run a structural RED check proving `first-roadmap.md` currently routes into `next-plan.md` and the active/turn triggers overlap.
- [x] Replace the overlapping bullets with ordered, mutually exclusive eligibility based on linked child frontmatter.
- [x] Make first-Roadmap Plan formulation self-contained with one compact bright-line sequence; remove its `next-plan.md` dependency.
- [x] Restrict `next-plan.md` to a completed latest Plan and preserve the root approval gate.

### Task 3: Keep unapproved Tutor techniques out of runtime behavior

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/INDEX.md`
- Preserve as drafts: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/*.md`

**Interfaces:**
- Tutor uses the Lesson, Teacher Control, and core classroom loop only.
- Technique drafts are not routed to or loaded until individually designed and accepted.

- [x] Record the RED inconsistency: the design defers technique detail while the live Tutor routes into seven concrete files, one of which cascades into a second reference.
- [x] Remove the active technique route from `tutor-lesson/SKILL.md`.
- [x] Mark the INDEX as a non-runtime design draft and remove all instructions that invite Tutor loading.
- [x] Do not further refine or validate the seven technique bodies in this recovery.

### Task 4: Add Prepare-side Tree defense and synchronize the design

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Modify: `docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md`

**Interfaces:**
- Prepare reads earlier closed Lessons only through the current Plan's Lesson Tree.
- The design describes the implemented router and clearly labels Tutor techniques as deferred drafts.

- [x] Add the Tree-only qualifier to Prepare's evidence read without duplicating the full Agent invariant.
- [x] Update Roadmap routing and reference ownership in the design document.
- [x] Keep cross-Plan long-term memory and Tutor technique design in the deferred list.

### Task 5: Verify without overstating behavior

**Files:**
- Read only: all changed Agent, Skill, reference, and design files.

**Interfaces:**
- Produces deterministic assembly/lifecycle evidence and a separate behavioral status.

- [x] Check all Markdown relative links and run `git diff --check`.
- [x] Run `bun run check` from `apps/pi-teaching-web` and require zero failures.
- [x] Run `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts` and require one passing browser test.
- [x] Run isolated real-model scenarios for Tree-only evidence and Roadmap route eligibility when the configured provider is available; if skipped or blocked, report behavior as unverified rather than PASS.
- [x] Inspect the targeted diff only; do not stage or commit unrelated worktree changes.

## Verification Evidence

- Deterministic suite: 48 tests passed; typecheck and production build passed.
- Browser lifecycle: `m0-cycle.spec.ts` passed 1/1.
- Real-model empty Tree: read only Guide, Roadmap, root Skill, and `first-roadmap.md`; ignored an unlinked poison Plan.
- Real-model active Plan: read the linked active Plan, loaded no phase reference, and refused to create a successor.
- Real-model completed Plan: read the linked Plan and Lesson by root-relative Tree paths; all reads succeeded, with no directory search and no `Uses` asset read.
