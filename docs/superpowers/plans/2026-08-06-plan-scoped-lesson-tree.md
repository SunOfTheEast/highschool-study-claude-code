# Plan-Scoped Lesson Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Plan a physical directory whose Lessons use Plan-local IDs, then resume the stopped M0 run and complete Plan 002 without cross-Plan file or Session collisions.

**Architecture:** A Plan lives at `plans/<plan-id>/PLAN.md`; its Lessons live at `plans/<plan-id>/lessons/<lesson-id>.md`. Plan IDs remain Roadmap-global, while Lesson IDs are unique only within their parent Plan. Runtime identifies a Lesson by `(planId, lessonId)` and exposes the composite Session key `lesson:<plan-id>:<lesson-id>`; the Markdown Tree remains the authority for ownership and discovery.

**Tech Stack:** TypeScript 7, Bun test, React 19, Markdown/YAML documents, native Pi Sessions.

## Global Constraints

- Preserve the current dirty worktree and do not commit unrelated user changes.
- Do not add a compatibility reader, database, background index, memory store, or global Lesson allocator.
- Evidence remains reachable only through Roadmap `Plan Tree` and each Plan's `Lesson Tree`.
- Model-facing paths are learning-set-root-relative even though files are physically nested.
- The stopped `/tmp/studyforge-m0-final-DvRDPv` evidence remains intact; continuation is labeled as a repaired continuation.
- Implement inline in the current session because the user explicitly requested uninterrupted completion.

---

### Task 1: Lock the hierarchical identity contract

**Files:**
- Modify: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/ROADMAP.md`
- Move: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/plans/plan-001.md` → `apps/pi-teaching-web/tests/fixtures/m0-learning-set/plans/plan-001/PLAN.md`
- Move: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/lessons/lesson-001.md` → `apps/pi-teaching-web/tests/fixtures/m0-learning-set/plans/plan-001/lessons/lesson-001.md`
- Test: `apps/pi-teaching-web/tests/m0/markdown-domain.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`

**Interfaces:**
- Consumes: existing `readCourseTree()`, `readWorkspace()`, and `sessionKeyForNode()`.
- Produces: executable expectations for `plans/plan-001/PLAN.md`, `plans/plan-001/lessons/lesson-001.md`, and `lesson:plan-001:lesson-001`.

- [x] Add a second Plan fixture whose local Lesson is also `lesson-001` and assert both nodes parse with distinct paths and Session keys.
- [x] Change the public Session-key test to expect `lesson:<plan-id>:<lesson-id>`.
- [x] Run `bun test tests/m0/markdown-domain.test.ts tests/m0/public-surface.test.ts` and verify RED because the current parser rejects duplicate global Lesson IDs and emits the old key.

### Task 2: Make identity and lifecycle Plan-scoped

**Files:**
- Create: `apps/pi-teaching-web/src/study/node-paths.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/markdown.ts`
- Modify: `apps/pi-teaching-web/src/study/workspace.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/runtime/node-lifecycle.ts`
- Modify: `apps/pi-teaching-web/src/runtime/frontmatter.ts`
- Test: `apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Produces: `planNodePath(planId)`, `lessonNodePath(planId, lessonId)`, `lessonSessionKey(planId, lessonId)`, and path-kind predicates.
- Produces: `NodeLifecycleService.startLesson(planId, lessonId)` and `closeLesson(planId, lessonId)`.
- Preserves: Plan Session keys `plan:<plan-id>` and Roadmap Session key `roadmap:roadmap`.

- [x] Add RED tests showing two Plans can each open `lesson-001` without sharing Session objects.
- [x] Implement canonical nested-path validation and sibling-scoped Lesson uniqueness.
- [x] Resolve Registry owners by the tree's exact `sessionKey`, not by a globally searched Lesson ID.
- [x] Bind lifecycle actions to the exact parent Plan and child Lesson, and validate Lesson Markdown during frontmatter mutation at nested paths.
- [x] Run the targeted domain, registry, and lifecycle tests to GREEN.

### Task 3: Carry the composite identity through HTTP and React

**Files:**
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Test: `apps/pi-teaching-web/tests/m0/server-api.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Test: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`

**Interfaces:**
- Produces: `POST /api/plans/:planId/lessons/:lessonId/start` and `/close`.
- Consumes: the selected tree node's canonical `sessionKey`; React must not reconstruct Lesson keys from `document.id`.

- [x] Add RED API tests for two same-named Lessons under different Plans and rejection of a mismatched parent.
- [x] Accept composite Lesson Session keys in session history/message routes.
- [x] Pass both IDs through lifecycle buttons and use the selected tree node's key for chat state.
- [x] Remove the old global `/api/lessons/:lessonId/*` surface rather than retaining a compatibility path.
- [x] Run API, UI, and browser-cycle tests to GREEN.

### Task 4: Teach authors and examples the new physical tree

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/resources/contracts/m0-document-contract.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/agents/roadmap-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-plan/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Modify: affected M0 tests containing canonical fixture paths
- Modify: `examples/derivative-m0/learning-set/ROADMAP.md` only if its empty-tree wording requires clarification

**Interfaces:**
- Produces: one canonical authoring rule: a new Plan creates its own directory and `PLAN.md`; a Lesson ID/path is derived only inside the current Plan directory.
- Preserves: child-first writes, explicit student approval, and no directory enumeration for course evidence.

- [x] Update examples and assembled-resource assertions without adding teaching constraints.
- [x] Mechanically update test paths, then run `bun run typecheck` and all M0 tests.
- [x] Run `bun run build` and `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`.

### Task 5: Migrate and resume the stopped real-model run

**Files:**
- Modify only inside: `/tmp/studyforge-m0-final-DvRDPv/learning-set`
- Append: `docs/audits/2026-08-06-m0-final-long-cycle-acceptance.md`

**Interfaces:**
- Consumes: Plan 001's three closed Lessons, active Plan 002, and existing Pi Session files.
- Produces: two closed, Plan-local Lessons, a user-confirmed completed Plan 002, Roadmap parent handoff, and a continuation evidence section.

- [x] Snapshot the pre-migration tree and stop only the server bound to port `65527`.
- [x] Move each Plan and its linked Lessons into canonical nested paths; update Tree links, `parent_path`, and persisted Session-owner paths without altering dialogue or classroom content.
- [x] Restart the same app against the same isolated Pi configuration and verify health, course parsing, and Plan 002 Session restoration.
- [x] Send a natural continuation turn, let the Coach prepare Plan 002 Lesson 001, then start, teach, and close it through HTTP lifecycle actions.
- [x] Let the Coach review and prepare Plan 002 Lesson 002, then start, teach, and close it; per the user's later instruction, also complete Plan 002 after evidence review and explicit confirmation.
- [x] Audit both Lesson files, distinct composite Session keys, parent ownership, classroom logs, response timing, and absence of Plan Session reads outside Plan 002's Lesson Tree.
- [x] Append the repaired-continuation result to the original report without erasing the first failure.
