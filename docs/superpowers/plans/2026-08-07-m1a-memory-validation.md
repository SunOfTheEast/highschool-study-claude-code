# M1a Teacher-Notebook Memory Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible evidence harness and execute the approved M1a validation: bounded mechanism probes, one real-model M0/M1a two-Plan comparison, critical-decision replays, compaction/index stress, and a sanitized report whose final verdict remains with the project owner.

**Architecture:** Keep product behavior unchanged. Add a small Bun validation harness that prepares isolated arm roots, drives the existing HTTP/WebSocket surface, snapshots Markdown, and records timing without interpreting teaching semantics. Execute M0 at `fed2a01` and M1a at `17b7e9b` against the same static derivative corpus and frozen student policy; all raw evidence remains under one dedicated `/tmp` root.

**Tech Stack:** Bun 1.3.14, TypeScript 7, Pi 0.81.0, native Pi Session JSONL, StudyForge HTTP/WebSocket API, Markdown learning sets, Playwright smoke tests.

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-07-m1a-memory-validation-design.md` exactly.
- Work from `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/m1-teacher-notebook-memory` on `codex/m1-teacher-notebook-memory`; use a separate detached worktree for `fed2a01`.
- Do not change M1a product prompts, Runtime behavior, document schemas, models, student policy, or scoring criteria during a formal run.
- Main Sessions use `openai-codex/gpt-5.6-sol:high`; the isolated custom copy of each arm's packaged `study-material-scout` pins `openai-codex/gpt-5.6-terra:high` without editing the product resource.
- Use `examples/derivative-m0/learning-set` as the shared static corpus. M0 omits `memory/`; M1a begins with only the empty `memory/INDEX.md` shipped by the corpus.
- Keep credentials, raw Sessions, private tool payloads, CoT, event logs, temporary learning sets, and full snapshots under a dedicated `/tmp/studyforge-m1a-validation-*` root. Commit only protocols, deterministic harness code/tests, and a sanitized audit.
- The student driver reads only the current arm's student-visible history and its frozen hidden ledger. It never reads Teacher Control, memory files, native Session JSONL, CoT, answers, or the other arm's transcript while choosing a turn.
- No automatic evaluator owns the release decision. Reports may recommend `PASS / PARTIAL / FAIL`; the final decision block remains explicitly unfilled for the project owner.
- A provider/model error, invalid static corpus, lost Session, state corruption, serious leak, or need for manual course-file repair stops that formal observation and preserves the RED evidence.
- Preserve unrelated user changes. Never stage credentials or `/tmp` evidence.

---

### Task 1: Add a safe, tested validation harness

**Files:**
- Create: `apps/pi-teaching-web/scripts/m1a-validation/layout.ts`
- Create: `apps/pi-teaching-web/scripts/m1a-validation/turn-client.ts`
- Create: `apps/pi-teaching-web/scripts/m1a-validation/cli.ts`
- Modify: `apps/pi-teaching-web/package.json`
- Test: `apps/pi-teaching-web/tests/m1/m1a-validation-harness.test.ts`

**Interfaces:**
- Produces: `assertDedicatedRunRoot(path): string`.
- Produces: `prepareValidationRun(options): ValidationRunLayout` with isolated `m0` and `m1a` learning-set, agent, log, event, turn, and snapshot paths.
- Produces: `captureLearningSetSnapshot(layout, arm, label): SnapshotRecord` that never overwrites a label.
- Produces: `sendObservedTurn(options): Promise<ObservedTurn>` that waits for the matching `session-run: idle`, records projected WebSocket events, and returns student-safe history plus timestamps.
- Produces CLI: `bun run validate:m1a -- prepare|turn|snapshot ...`.

- [ ] **Step 1: Write failing layout and turn-client tests**

Add tests that require:

```ts
expect(() => assertDedicatedRunRoot('/tmp/not-owned')).toThrow();
expect(() => assertDedicatedRunRoot('/Users/yangrundong')).toThrow();

const layout = prepareValidationRun({
  runRoot,
  seedLearningSet,
  agentConfigSource,
  m0ScoutSource,
  m1aScoutSource,
});
expect(existsSync(join(layout.m0.learningSet, 'memory'))).toBe(false);
expect(readFileSync(join(layout.m1a.learningSet, 'memory/INDEX.md'), 'utf8'))
  .toContain('# Teacher Memory Index');
expect(statSync(join(layout.m0.agentDir, 'auth.json')).mode & 0o777).toBe(0o600);

const first = captureLearningSetSnapshot(layout, 'm1a', 'after-lesson-001');
expect(first.label).toBe('after-lesson-001');
expect(() => captureLearningSetSnapshot(layout, 'm1a', 'after-lesson-001')).toThrow();
```

Use a real local Bun HTTP/WebSocket fixture to verify that `sendObservedTurn`:

```ts
const result = await sendObservedTurn({
  baseUrl,
  sessionKey: 'roadmap:roadmap',
  message: '简单的还行，复杂一点我就乱了。',
  eventLogPath,
});
expect(result.firstVisibleAt).not.toBeNull();
expect(result.settledAt).toBeGreaterThanOrEqual(result.startedAt);
expect(result.history).toContainEqual({
  id: 'assistant-1',
  kind: 'assistant',
  text: '先说一道最近卡住的题。',
  at: expect.any(String),
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/m1a-validation-harness.test.ts
```

Expected: FAIL because the three harness modules and package script do not exist.

- [ ] **Step 3: Implement the minimal layout module**

Implement these types and functions:

```ts
export type ValidationArm = 'm0' | 'm1a';

export type ArmLayout = {
  learningSet: string;
  agentDir: string;
  logs: string;
  events: string;
  turns: string;
  snapshots: string;
};

export type ValidationRunLayout = {
  root: string;
  manifestPath: string;
  m0: ArmLayout;
  m1a: ArmLayout;
};

export type SnapshotRecord = {
  arm: ValidationArm;
  label: string;
  path: string;
  capturedAt: string;
  treeHash: string;
};

export function assertDedicatedRunRoot(path: string): string;
export function prepareValidationRun(options: {
  runRoot: string;
  seedLearningSet: string;
  agentConfigSource: string;
  m0ScoutSource: string;
  m1aScoutSource: string;
}): ValidationRunLayout;
export function captureLearningSetSnapshot(
  layout: ValidationRunLayout,
  arm: ValidationArm,
  label: string,
): SnapshotRecord;
```

`assertDedicatedRunRoot` must accept only an absolute path whose canonical parent equals `realpathSync('/tmp')`, whose basename begins `studyforge-m1a-validation-`, and which is neither a symlink nor an existing non-empty directory. It accepts the empty directory returned by `mktemp -d` as well as a not-yet-created leaf. `prepareValidationRun` creates new arm directories, copies the seed with a filter that excludes `memory/` only for M0, copies `auth.json` and optional `models-store.json` from `agentConfigSource` without printing their contents, writes mode-`0600` settings with Sol/high, and installs an isolated `agents/study-material-scout.md` copied from each arm source with only `model` and `thinking` frontmatter pinned to Terra/high. It writes a manifest containing paths and SHA-256 hashes but no credential content.

- [ ] **Step 4: Implement the observed-turn client and CLI**

Implement:

```ts
export type ObservedTurn = {
  sessionKey: string;
  startedAt: number;
  firstVisibleAt: number | null;
  settledAt: number;
  events: unknown[];
  history: unknown[];
};

export async function sendObservedTurn(options: {
  baseUrl: string;
  sessionKey: string;
  message: string;
  eventLogPath: string;
}): Promise<ObservedTurn>;
```

The client opens `/events` before posting, accepts only loopback `http://127.0.0.1:<port>`, appends each projected event as one JSONL row, binds completion to the requested Session key, rejects `session-error`, uses no model wall-clock timeout, fetches `/history` after idle, and records the first projected assistant/tool/progress event as `firstVisibleAt`.

The CLI accepts explicit named flags and prints only the resulting manifest, snapshot record, or student-safe history JSON. It must never accept a credential body on the command line.

Add to `package.json`:

```json
"validate:m1a": "bun run scripts/m1a-validation/cli.ts"
```

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/m1a-validation-harness.test.ts
bun run typecheck
```

Expected: all harness tests and typecheck pass.

Commit:

```bash
git add apps/pi-teaching-web/package.json \
  apps/pi-teaching-web/scripts/m1a-validation \
  apps/pi-teaching-web/tests/m1/m1a-validation-harness.test.ts
git commit -m "test: add M1a validation harness"
```

---

### Task 2: Freeze the student protocol, scorecard, and directed cases

**Files:**
- Create: `apps/pi-teaching-web/validation/m1a/student-protocol.md`
- Create: `apps/pi-teaching-web/validation/m1a/state-ledger-template.md`
- Create: `apps/pi-teaching-web/validation/m1a/scorecard.md`
- Create: `apps/pi-teaching-web/validation/m1a/directed-cases.md`
- Test: `apps/pi-teaching-web/tests/m1/m1a-validation-protocol.test.ts`

**Interfaces:**
- The student protocol is the only behavioral input supplied to an arm driver.
- The state ledger records `stable / fragile / unseen`, the visible evidence that changed it, current confidence/fatigue, and reality constraints.
- The scorecard separates mechanical gates, semantic results, performance, executed evidence, and the owner's unfilled final decision.
- The directed-case file freezes the seven probes in design §7 without prescribing teacher tool calls.

- [ ] **Step 1: Write failing protocol-structure tests**

Require all five semantic categories, student-visibility isolation, M1b exclusion, M0/M1a commit IDs, four replay points, three-run stability thresholds, and this exact final-ownership statement:

```text
自动审计只能给出建议；M1a 的最终判断权属于项目负责人。
```

Also require that the student opener contains no `同构`, `结构识别`, `能力假设`, `对象记忆`, or other diagnosis label.

- [ ] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m1/m1a-validation-protocol.test.ts
```

Expected: FAIL because the protocol files do not exist.

- [ ] **Step 3: Write the four frozen protocol files**

The student opener is:

```text
简单的还行，复杂一点我就乱了，学过的方法也想不起来。我也不知道该怎么学。
```

The ledger must never predict a fixed Lesson number for a stumble. The directed cases must include: one multi-object Trace, correction append, interrupted consolidation recovery, relevant/irrelevant recall pair, same-object versus cross-object capability evidence, large routed INDEX, and real compaction recovery. The scorecard must preserve dissenting findings and leave `## 项目负责人最终判断` as `尚未填写`.

- [ ] **Step 4: Verify GREEN and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m1/m1a-validation-protocol.test.ts
git add apps/pi-teaching-web/validation/m1a apps/pi-teaching-web/tests/m1/m1a-validation-protocol.test.ts
git commit -m "test: freeze M1a validation protocol"
```

---

### Task 3: Establish both product baselines and the isolated run

**Files:**
- Create outside Git: detached worktree `.worktrees/m1a-memory-m0-control` at `fed2a01`.
- Create outside Git: `/tmp/studyforge-m1a-validation-*/` through the harness.
- Inspect only: both worktrees, model settings, health, course snapshot, and generated manifests.

**Interfaces:**
- Consumes: Task 1 harness and local `/Users/yangrundong/.pi/agent/auth.json`.
- Produces: two verified product servers and one immutable run identity.

- [ ] **Step 1: Create or validate the M0 detached worktree**

From the repository root, inspect the exact target first. If absent:

```bash
git worktree add --detach \
  /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/m1a-memory-m0-control \
  fed2a01
```

Require `git rev-parse HEAD` to equal the full hash of `fed2a01`. Do not reuse a worktree at another commit.

- [ ] **Step 2: Run fresh deterministic baselines in both apps**

In each worktree's `apps/pi-teaching-web`:

```bash
bun install --frozen-lockfile
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: exit 0 in both. A failure blocks model traffic and is not reclassified as model behavior.

- [ ] **Step 3: Create and prepare one dedicated run root**

Create the root with `mktemp -d /tmp/studyforge-m1a-validation-XXXXXX`, verify its resolved prefix immediately, then call `prepare` with:

- seed: current M1a `examples/derivative-m0/learning-set`;
- auth source: `/Users/yangrundong/.pi/agent`;
- M0 and M1a packaged Scout source paths from their respective worktrees.

Record the exact root only in local evidence and the eventual sanitized report; never print auth content.

- [ ] **Step 4: Launch and audit both servers**

Inspect two free loopback ports. Launch each server from its own app worktree with the matching arm `PI_CODING_AGENT_DIR`, learning-set path, empty `STUDY_PERSONA`, redirected log, and recorded PID. Require:

- M0 health reports `pi-m0` and M1a reports `pi-m1`;
- both Roadmaps are active with empty Plan Trees and null Session IDs;
- M0 has no memory directory;
- M1a has only the empty INDEX;
- effective parent model/thinking and any invoked Scout model/thinking are verified from native JSONL, not inferred from settings.

Capture `initial` snapshots for both arms.

---

### Task 4: Run the bounded mechanism probes before the expensive cycles

**Files:**
- Create outside Git: probe-specific learning sets, Pi roots, event logs, Session JSONL, snapshots, and local result tables under the run root.
- Inspect: current product source only for failure localization; do not edit it.

**Interfaces:**
- Consumes: `tests/fixtures/m0-learning-set`, the frozen directed cases, and the M1a product server.
- Produces: first-hit evidence for consolidation/correction, recall contrast, capability boundary, and partial recovery.

- [ ] **Step 1: Run consolidation and correction on a copied active Lesson fixture**

Drive the current active problem naturally to a stage ending. Let Tutor perform its one reflection and consolidation. After the public summary, send the correction only when its wording overstates independence:

```text
补充一下，刚才找入口那一步其实是你提醒之后我才想到的，不是我自己一开始就看出来的。
```

Audit that the old Log/Trace bytes remain, a new correction fact is appended, current object judgment is revised, no capability is written, and the Session does not reread its new memory.

- [ ] **Step 2: Run the relevant/irrelevant recall pair in fresh Lesson Sessions**

Create two validated copies of the same current Lesson and the same routed memory. In the positive case, the current error shares the old decision-relevant pattern; in the negative case, only the surface form matches. Student messages describe only current work. Require progressive reads in the positive case and no stale-memory override in the negative case.

- [ ] **Step 3: Run same-object and cross-object capability cases in fresh Plan Sessions**

The first copy contains repeated evidence from one object and must not create `memory/capabilities/`. The second adds one distinct object with the same learning pattern and may create a scoped working hypothesis. A third current-success turn must calibrate rather than erase the history.

- [ ] **Step 4: Run interrupted-consolidation recovery**

Start from a validated fixture where the source Trace already exists but its object route is missing. Ask the fresh Tutor to finish the natural close state without telling it a path or file name. Require no duplicate Trace and only local repair of the affected object/INDEX.

- [ ] **Step 5: Stop on any bearing failure**

For each case record `PASS / PARTIAL / FAIL / BLOCKED`, first visible response, final response, reads/writes, and exact before/after hashes. Do not fix the product inside this acceptance run. A bearing failure pauses the expensive A/B and becomes the next evidence-backed implementation task.

---

### Task 5: Execute the complete M0 control arm

**Files:**
- Modify through product behavior only: the M0 copied learning set.
- Create outside Git: M0 student ledger, events, histories, native Sessions, snapshots, and timing table.

**Interfaces:**
- Consumes: the frozen student protocol and M0 endpoint.
- Produces: one complete or truthfully stopped two-Plan M0 baseline.

- [ ] **Step 1: Start with the frozen ordinary-language opener**

Use the Roadmap Session and answer only from visible questions plus the M0 ledger. Do not force a diagnosis, Plan title, Lesson count, card, or method.

- [ ] **Step 2: Complete Plan 1 naturally**

For every cycle require public discussion, explicit confirmation, parent write, child preparation, UI-owned start, live Lesson, student-owned close, and parent review. Maintain `stable / fragile / unseen` from visible performance. Introduce reality constraints only when workload actually reaches them.

- [ ] **Step 3: Complete Plan 2 and return to Roadmap**

Let Roadmap use only its supported M0 Tree evidence. Complete Plan 2 according to its own observable standard, then return to Roadmap for the final longitudinal discussion. Do not create Plan 3.

- [ ] **Step 4: Snapshot every settled boundary**

Capture at minimum: each Lesson prepared, each Lesson closed, each Plan completed, Plan 2 prepared, and final Roadmap return. If the arm stops, capture `final-stop-<reason>` before inspecting private evidence.

---

### Task 6: Execute the complete M1a treatment arm

**Files:**
- Modify through product behavior only: the M1a copied learning set and memory files.
- Create outside Git: M1a ledger, events, Sessions, snapshots, timing, retrieval, and memory-diff tables.

**Interfaces:**
- Consumes: the same frozen student protocol and the M1a endpoint.
- Produces: one complete or truthfully stopped two-Plan M1a treatment.

- [ ] **Step 1: Repeat the same student-policy protocol from a fresh context**

Do not copy M0 teacher text, plans, answers, or transcript. Only the frozen portrait and state-transition policy are shared.

- [ ] **Step 2: Complete Plan 1 while recording every memory checkpoint**

After each Lesson closes, snapshot before reading private files. Then audit one reflection, Trace append, object/preference updates, INDEX routing, no Tutor capability write, and no same-Session readback.

- [ ] **Step 3: Complete Plan 2 with current-evidence priority**

When a genuinely related unplanned error occurs, judge Tutor recall from actual tool reads. Later provide the portrait-consistent independent route change and observe whether current evidence revises the old scope. Do not tell Tutor that this is a memory test.

- [ ] **Step 4: Return to Roadmap for cross-Plan calibration**

Require Plan summary → INDEX → relevant L1 → only necessary Trace/Log reads, calibration of the same capability chain, and no Plan 3 materialization. Snapshot before private audit.

- [ ] **Step 5: Build the paired decision table without forcing comparability**

For every memory-relevant M1a decision, identify what was unavailable in the current node context, what was actually read, what changed in the teaching action, and the nearest M0 behavior. Mark incomparable course paths rather than manufacturing a win.

---

### Task 7: Replay critical decisions and run scale/recovery pressure

**Files:**
- Create outside Git: twelve replay roots, one INDEX-growth root, and one compaction root.
- Inspect only: replay inputs, outputs, native Sessions, and snapshots.

**Interfaces:**
- Consumes: settled snapshots from Tasks 4 and 6.
- Produces: four `3/3`, `2/3`, or `0–1/3` stability rows plus scale/compaction evidence.

- [ ] **Step 1: Freeze four replay snapshots before reading outcomes**

Select: recall/no-recall, cross-object threshold, current evidence versus old judgment, and final Roadmap calibration. Each replay receives the same node state, memory files, student-visible history boundary, model, thinking, and user message.

- [ ] **Step 2: Run three fresh Sessions per checkpoint**

Never resume a sibling replay Session or alter wording after a failure. Record the first action and full final result for all twelve runs.

- [ ] **Step 3: Run INDEX-growth pressure**

Populate a separate fixture with enough routed object history to require bucket use. Add one current-frontier update through the owning role. Report root bytes/tokens, bucket count, direct-entry count, files read, route correctness, and whether the root became a historical dump.

- [ ] **Step 4: Run real compaction recovery**

Use a dedicated Plan Session whose real context is brought just below 200,000 tokens with student-safe, non-course-changing history. A successful Lesson Markdown write triggers production compaction. On the next turn require a fresh INDEX read and only necessary evidence expansion. Record the native compaction entry and ensure the natural A/B roots were untouched.

- [ ] **Step 5: Apply the frozen stability thresholds**

For each checkpoint report `3/3 = PASS`, `2/3 = PARTIAL`, or `0–1/3 = FAIL`. Do not average a bearing violation away with other quality scores.

---

### Task 8: Audit, verify, and publish only the sanitized decision report

**Files:**
- Create: `docs/audits/2026-08-07-m1a-memory-validation.md`
- Inspect: all raw evidence under the dedicated run root.
- Verify: design, plan, protocol, harness, report, branch status, and exact product commits.

**Interfaces:**
- Consumes: executed evidence from Tasks 3–7.
- Produces: a traceable recommendation and an explicitly unfilled owner verdict.

- [ ] **Step 1: Audit mechanical facts before teaching quality**

Re-run Markdown parsing on every settled snapshot. Verify append-only Log/Trace hashes, stable links, ownership, no duplicate Trace IDs, memory routing, lifecycle state, actual model/thinking, and no private payload in student-visible history.

- [ ] **Step 2: Audit semantic memory against the hidden ledger**

For each persisted assertion classify it as direct trace, object judgment, cross-object capability hypothesis, explicit preference, or misplaced teaching todo. Report unsupported strengthening, missing uncertainty, stale-memory override, useful recall, and negative transfer.

- [ ] **Step 3: Report exact performance and provenance**

Include arm commits, run IDs, completed/skipped layers, first-feedback/final latency, token and tool totals, read depth, INDEX growth, compaction evidence, longest blank wait, and prior M0 baseline context. Separate executed evidence from planned or blocked rows.

- [ ] **Step 4: Write recommendation without taking the owner's decision**

The report must end with:

```markdown
## 审计建议

建议：PASS / PARTIAL / FAIL / BLOCKED

## 项目负责人最终判断

尚未填写。最终判断权属于项目负责人。
```

Preserve dissenting evidence and explain every incomparable A/B row.

- [ ] **Step 5: Run final verification**

```bash
cd apps/pi-teaching-web
bun test tests/m1
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
cd ../..
git diff --check
git status --short
```

Scan staged files for credentials, raw Session IDs/paths, private prompts, answer bodies, and CoT. Expected: only the sanitized report and intentional harness/protocol work are staged.

- [ ] **Step 6: Commit the sanitized evidence**

```bash
git add docs/audits/2026-08-07-m1a-memory-validation.md
git commit -m "docs: report M1a memory validation"
```

Keep the feature worktree and raw `/tmp` run root intact until the project owner reviews the report.
