# Real Coach Card Recovery Pressure Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate four real Plan Coach sessions from fuzzy student memory through exact original-card recovery, deep Coach verification, and a linked prepared Lesson.

**Architecture:** Run four isolated copies of the derivative learning set behind the real `pi-teaching-web` server. Each copy starts from the same active empty Plan; student turns use the production Session endpoint, current Plan resources, native `subagent`, and committed sidecar. Preserve native evidence under `/tmp`, score each layer independently, and commit only a sanitized report.

**Tech Stack:** Bun, StudyForge `pi-teaching-web`, Pi 0.81.0, `deepseek/deepseek-v4-flash`, WebSocket events, native Pi Session JSONL, Markdown learning-set documents.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/gentle-judgment-isomorphic-acceptance` on `codex/gentle-judgment-isomorphic-acceptance`.
- Follow `docs/superpowers/specs/2026-08-05-real-coach-card-recovery-pressure-design.md` exactly.
- Use current dirty-worktree resources without editing Agent, Skill, Runtime, sidecar, card, or source learning-set files during acceptance.
- Provider/model is `deepseek/deepseek-v4-flash`; isolated settings request `high`, and parent/child Sessions must record effective `high`.
- Use fresh Plan Sessions and at most two concurrent scenarios.
- Student replies use only the approved opener and memory bank. Never inject hidden paths, IDs, graph terms, answers, rubrics, or decisive routes.
- Explicit student confirmation must precede template/material reads, Scout calls, and Lesson persistence.
- Do not retry with altered wording, substitute models, or repair product behavior during the run.
- Keep credentials, logs, Sessions, CoT, events, and temporary learning sets under one dedicated `/tmp` root.
- Preserve unrelated user changes and stage only this experiment's documents.

---

### Task 1: Verify baseline and freeze identity

**Files:**
- Inspect: `AGENTS.md`
- Inspect: the Phase 2 design, Plan Agent, Plan Skills, and Material Scout resources.

**Interfaces:**
- Consumes: current worktree and configured DeepSeek access.
- Produces: recorded source identity and a passing deterministic baseline.

- [ ] **Step 1: Record branch, commit, and dirty state**

Run `git branch --show-current`, `git rev-parse HEAD`, and `git status --short` from the worktree. Require the named feature branch and retain all unrelated dirty paths.

- [ ] **Step 2: Run package verification before model traffic**

From `apps/pi-teaching-web`, run:

```bash
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Require exit 0. A failure blocks the real-model run rather than being reclassified as model behavior.

- [ ] **Step 3: Recheck the hidden oracle**

Assert that all four target cards named in the design exist, have `quality.needs_review: false`, and occur exactly once in `graph/card-recall-index.tsv`. Print only paths and booleans, never answers.

### Task 2: Build four isolated Runtime roots

**Files:**
- Create under `/tmp/studyforge-real-coach-pressure-*`: `seed/`, `C1/`–`C4/`, `agent-C1/`–`agent-C4/`, `logs/`, `events/`, and `turns/`.
- Create in copied learning sets: `plans/plan-001.md`.
- Modify only copied `ROADMAP.md` files to link the Plan.

**Interfaces:**
- Consumes: `examples/derivative-m0/learning-set` and local Pi authentication.
- Produces: four active empty Plan nodes and isolated Pi Session roots.

- [ ] **Step 1: Create a validated dedicated temporary root**

Use `mktemp -d /tmp/studyforge-real-coach-pressure-XXXXXX`, require the exact prefix, and create the listed subdirectories. Record the resolved path in the report.

- [ ] **Step 2: Install the common Plan fixture in a seed copy**

Copy the public learning set. Replace only the copied Roadmap Plan Tree and Current Position, then create the active `plan-001` specified by the design: broad real-stoppoint Stage Goal, observable reconstruction standard, original-problem plus small-check Test, empty Lesson Tree, known derivative foundations, and an unformed Next Lesson Arrangement.

Validate the seed through the repository Markdown reader before cloning it.

- [ ] **Step 3: Clone C1–C4 and isolate model settings**

Each `agent-C*` receives a copied `auth.json` with mode `600` and this settings object:

```json
{
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-v4-flash",
  "defaultThinkingLevel": "high"
}
```

Never print credential content.

- [ ] **Step 4: Create a temporary turn driver**

Create a Bun helper under the experiment root with interface:

```text
bun send-turn.ts BASE_URL SESSION_KEY EVENT_LOG MESSAGE
```

It opens `/events`, posts to the production `/api/sessions/<key>/messages` endpoint, appends raw events to the named JSONL file, waits for the matching `session-run: idle`, fails on `session-error`, and finally prints sanitized Session history. It imposes no model deadline and never changes the message.

### Task 3: Launch and audit four real servers

**Files:**
- Create: four server logs and PID files under the experiment root.
- Inspect: health and initial course snapshots.

**Interfaces:**
- Consumes: C1–C4 learning sets and Pi agent dirs.
- Produces: four healthy product Runtime endpoints.

- [ ] **Step 1: Require ports 65271–65274 to be free**

Inspect exact listeners with `lsof`. If any port is occupied, choose another inspected four-port block; never kill an unrelated process.

- [ ] **Step 2: Start each server from `apps/pi-teaching-web`**

Launch `bun run src/server/index.ts --learning-set <C*> --port <port>` with scenario-specific `PI_CODING_AGENT_DIR` and empty `STUDY_PERSONA`. Redirect logs and record each PID.

- [ ] **Step 3: Audit initial product state**

For all four endpoints require healthy `pi-m0`, active Roadmap, active `plan-001`, empty Lesson Tree, and null Plan `session_id` before the first message.

### Task 4: Run C1 and C2 as one paired wave

**Files:**
- Create: turn/event logs and native parent/child Sessions.
- Modify through Coach tools only: copied Plan and Lesson Markdown.

**Interfaces:**
- Consumes: C1/C2 openers and approved memory banks.
- Produces: two complete or truthfully failed Coach chains.

- [ ] **Step 1: Send both openers concurrently and wait for idle**

Use the turn driver with `plan:plan-001`. Read sanitized public history after both runs settle.

- [ ] **Step 2: Continue diagnosis from public replies only**

Answer each Coach question with only the matching approved memory facts. If several relevant questions arrive together, answer them together naturally. Do not inspect private reasoning to steer the student.

- [ ] **Step 3: Apply the approval gate**

Confirm with `可以，就按这个来。` only when the public proposal identifies the deep bottleneck and states purpose, process, participation, workload, and completion signal without spoiling the route. If one material element is absent, ask about it once in ordinary student language.

- [ ] **Step 4: Preserve the full preparation turn**

After confirmation, provide no retrieval hints. Wait through Scout activity, parent verification, child-first Lesson write, Plan link, and final reply.

### Task 5: Run C3 and C4 as the second paired wave

**Files and interfaces:** Same isolation and evidence boundary as Task 4.

- [ ] **Step 1: Repeat the opener and natural-question protocol**

C3 replies preserve the `one fixed a` quantifier difficulty. C4 replies preserve the bridge from symmetric offset comparison to zero location.

- [ ] **Step 2: Confirm only a complete, non-spoiling proposal**

Accept semantic equivalents; do not demand administrator wording. A plan limited to sign classification, routine differentiation, or auxiliary-function calculation is not complete.

- [ ] **Step 3: Wait through both full preparation turns**

Keep provider errors, missing target cards, malformed writes, or leaks as evidence. Do not alter wording and rerun.

### Task 6: Audit diagnosis, briefs, recovery, and persistence

**Files:**
- Inspect: Plan/Lesson Markdown, parent/child Session JSONL, event logs, and sanitized histories.
- Create under `/tmp`: CoT exports and local scoring summaries.

**Interfaces:**
- Consumes: four persisted runs.
- Produces: layer scores and performance metrics.

- [ ] **Step 1: Verify run identity and student-message integrity**

Record provider, model, effective thinking, Session IDs, usage, and tools for every parent and Scout. Require no hidden path, ID, graph tag, answer, or unapproved memory fact in user messages.

- [ ] **Step 2: Reconstruct the approval boundary and private brief**

Locate the first complete proposal, explicit confirmation, first template/material read, first `subagent` call, and first Lesson write. Any preparation before confirmation fails the dialogue layer. Extract the brief only for private audit.

- [ ] **Step 3: Verify exact target recovery and Scout boundaries**

Require each hidden target among Scout candidates. A useful similar card is not exact recovery. Inspect vocabulary/sidecar use, formal-card reads, answer/rubric/solution search, directory enumeration, and exhaustion claims.

- [ ] **Step 4: Verify Coach deep reading and teaching understanding**

Require a complete parent read of the target. Inspect Lesson Goal, Block order, Teacher Control, prompt progression, completion check, and exact `Uses`. Score the core bottleneck from the design, not surface labels.

- [ ] **Step 5: Verify child-first persistence and student safety**

Require one valid prepared Lesson, exact Plan link, recorded approved arrangement, and parent/child rereads. Scan public history/events for briefs, paths, graph terms, answers, decisive routes, rejected candidates, raw errors, or private reasoning.

- [ ] **Step 6: Export load and timing evidence**

Run `export-pi-cot.ts` with `--with-subagents` for each parent Session. Record pre-confirmation dialogue time, confirmation-to-Scout time, Scout wall time, post-Scout verification/write time, total wall time, parent/child usage, and tools. Keep full exports under `/tmp`.

### Task 7: Report and commit sanitized evidence

**Files:**
- Create: `docs/audits/2026-08-05-real-coach-card-recovery-pressure-acceptance.md`.
- Verify: the Phase 2 design, plan, and report.

**Interfaces:**
- Consumes: Task 6 scores.
- Produces: a reviewable Phase 2 verdict without raw private evidence.

- [ ] **Step 1: Write result before performance**

For C1–C4 report `diagnosis / brief / exact recovery / deep verification / materialization` as `PASS / PARTIAL / FAIL / BLOCKED`, followed by timing and token observations. Include no full prompt, answer, CoT, or private brief.

- [ ] **Step 2: State conclusion boundaries**

Distinguish exact original-card recovery from a useful substitute, and retrieval success from deep teaching understanding. State whether first-hit approval behavior and actual student waiting are acceptable. Do not claim statistical reliability from four runs.

- [ ] **Step 3: Run document and leak checks**

Run `git diff --check` on the three experiment documents and scan them for secret values, raw Session paths, private prompts, and answers. Inspect the staged name list before committing.

- [ ] **Step 4: Commit only experiment documents**

Use focused `git add` paths and descriptive documentation commits. Leave the branch, worktree, and all user-owned dirty changes intact.
