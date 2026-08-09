# Parallel Plan Material Scout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failed single timed Plan material search with one foreground, three-lane, fresh-context Scout fan-out that preserves the parent Coach's final judgment and student-facing continuity.

**Architecture:** Keep the existing Plan-only `subagent` runtime and the single packaged read-only `study-material-scout`; change only its usage contract. One native parallel call runs graph-first, card-text-first, and teaching-fit-first copies with no StudyForge wall-clock deadline, waits for every lane to reach semantic convergence, then lets the parent deduplicate compact indexes and read only the selected asset set required by the agreed Lesson Blocks. No workflow store, background task, retry loop, fallback search, new persistence, or frontend projection is introduced.

**Tech Stack:** Pi native Sessions, `pi-subagents@0.35.1`, Markdown Agent/Skill resources, Bun tests, Playwright browser smoke tests.

## Global Constraints

- Preserve one long-lived Plan Session and direct parent reading of every earlier closed Lesson.
- Expose `subagent` only to Plan Sessions; Roadmap and Lesson retain the six native file tools.
- Use one foreground parallel call with `context: "fresh"`, `async: false`, `includeProgress: false`, `artifacts: false`, `agentScope: "user"`, and `concurrency: 3`.
- Omit `timeoutMs` and `maxRuntimeMs`; provider and network transport failures remain infrastructure errors.
- Run three copies of the same packaged read-only Scout: `graph-first`, `card-text-first`, and `teaching-fit-first`.
- Let each lane return a variable-length shortlist after semantic convergence; do not use a fixed candidate-count cap.
- The parent deduplicates by `asset_path`, derives the required material count from the agreed Lesson Blocks, and reads only those selected full assets. A multi-problem Lesson may therefore open several cards.
- A failed lane does not cancel successful siblings. If all lanes fail or yield no fit, create no Lesson, do not retry automatically, and do not fall back to inline bulk search.
- Do not add a workflow store, task rail, background monitor, Handoff, memory pool, index, vector store, database, or frontend safety projection.
- Do not add exact-wording tests for Skill prose. Validate mechanical resource assembly and use a fresh natural-language real-model Plan Session as the behavioral evaluation.
- Preserve unrelated user changes and never copy credentials or Session JSONL into git.

---

### Task 1: Replace the single-Scout teaching contract

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`

**Interfaces:**
- Consumes: the existing Plan-only `subagent` tool, explicit `pi-subagents` extension loading, and packaged `study-material-scout` path established by commits `c4cb712`, `59d9d3a`, and `143bff9`.
- Produces: one consistent three-lane parent-call recipe and one lane-aware compact Scout JSON result with `lane`, `candidates`, and `search_boundary`.

- [ ] **Step 1: Record and preserve the failing behavioral baseline**

Use the already observed fresh Plan Session as the RED evaluation. Its failure signature is:

```text
one study-material-scout
→ maxRuntimeMs: 180000
→ promising search reaches the StudyForge deadline
→ whole result is discarded
→ parent automatically retries
→ parent tells the student “Scout 超时了一次”
```

This is the failing pressure scenario required for a Skill edit. Do not create an exact-wording unit test for it.

- [ ] **Step 2: Update the repository contract**

Replace the single-Scout paragraph in `AGENTS.md` with the exact architectural facts below:

```markdown
A Plan Session additionally has `subagent` for three concurrent fresh-context copies
of one packaged read-only `study-material-scout`: graph-first, card-text-first, and
teaching-fit-first. The parent waits for all lanes, merges their compact indexes,
chooses the material set required by the agreed Lesson Blocks, and reads only those
selected full assets. Scouts use only `read`, `grep`, `find`, and `ls`; they cannot
write teaching facts. Roadmap and Lesson Sessions do not receive `subagent`.
```

Extend the Material Scout ownership paragraph to state that StudyForge sets no Scout wall-clock deadline, does not automatically retry a failed fan-out, and does not fall back to parent-side bulk asset search.

- [ ] **Step 3: Give the Plan role one positive parallel-call recipe**

In `apps/pi-teaching-web/resources/agents/plan-node.md`, replace the old `180-second` single search and corrected retry with this behavior:

```json
{
  "tasks": [
    {"agent": "study-material-scout", "task": "lane=graph-first; plan=plans/plan-002.md; closed_lessons=[lessons/lesson-007.md]; public_purpose=练习含参恒成立题的独立选路; asset_kind=problem_card; count=1; workload=one_attempt; avoid=[lesson-007 的来源与同族题]; preference=学生先独立做，明确求助后再提示"},
    {"agent": "study-material-scout", "task": "lane=card-text-first; plan=plans/plan-002.md; closed_lessons=[lessons/lesson-007.md]; public_purpose=练习含参恒成立题的独立选路; asset_kind=problem_card; count=1; workload=one_attempt; avoid=[lesson-007 的来源与同族题]; preference=学生先独立做，明确求助后再提示"},
    {"agent": "study-material-scout", "task": "lane=teaching-fit-first; plan=plans/plan-002.md; closed_lessons=[lessons/lesson-007.md]; public_purpose=练习含参恒成立题的独立选路; asset_kind=problem_card; count=1; workload=one_attempt; avoid=[lesson-007 的来源与同族题]; preference=学生先独立做，明确求助后再提示"}
  ],
  "concurrency": 3,
  "context": "fresh",
  "async": false,
  "includeProgress": false,
  "artifacts": false,
  "agentScope": "user"
}
```

The surrounding prose must say: call `subagent(action: "list")` only on first use if discovery is needed; send the same Plan path, closed Lesson paths, public purpose, activity/count/workload constraints, avoid-list, and relevant student preferences to all lanes; wait for all three to settle; let each lane return a variable-length shortlist after semantic convergence; merge and deduplicate by `asset_path`; derive the selected asset count from the agreed Lesson Blocks; read every selected full asset and no rejected one; tolerate one failed lane when siblings can still fill the agreed Lesson; create no Lesson if the merged result cannot do so. During the whole private preparation turn, emit tool calls only and never narrate lane progress or failure to the student.

- [ ] **Step 4: Make the Coach Skill match the same contract**

In `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`, replace the old numbered single-Scout section with the same call shape and a short decision recipe:

```text
exact agreed path → parent reads directly
exploratory comparison → one three-task foreground fan-out
all lanes settle → parent deduplicates compact indexes
fit exists → parent reads the selected full asset set required by the Lesson and verifies it
no fit → no Lesson, no automatic retry, no inline bulk search
```

Keep post-class review explicitly parent-owned. Keep the public preparation summary unchanged: public purpose, source/problem number when useful, activity count, workload, and interaction form only.

- [ ] **Step 5: Make the packaged Scout lane-aware and compact**

In `apps/pi-teaching-web/resources/subagents/study-material-scout.md`, require the task to contain exactly one of the three lane names and define the search starts:

```text
graph-first        → graph vocabulary, aliases, method metadata, then a few cards
card-text-first    → card stems and solution metadata for task shape/formulas/activity
teaching-fit-first → Plan and named closed Lessons, used/avoid boundary, then novel fit
```

Change the result contract to:

```json
{
  "lane": "graph-first",
  "candidates": [
    {
      "asset_path": "cards/derivative/example.card.yaml",
      "asset_kind": "card",
      "source": "2020 · 某校月考 T21",
      "fit": "自然暴露零点换序后的判号执行",
      "novelty": "当前 Plan 尚未使用同族材料",
      "risks": ["提前展示导数会污染诊断"]
    }
  ],
  "search_boundary": "只检索了允许目录和任务点名的教学文档"
}
```

Let each lane return a variable-length stable shortlist. Define convergence semantically: stop when further searching from that lane is no longer producing materially different candidates relevant to the brief. Do not use a fixed candidate count or a StudyForge wall-clock cutoff, and do not enumerate the corpus merely for completeness. Preserve the current read-only tool list and prohibitions on invented assets, full stems, answers, decisive transformations, rejected-card contents, search transcript, student judgment, or persistence decisions.

- [ ] **Step 6: Review the edited resources as one assembled behavior contract**

Run:

```bash
git diff --check
git diff -- AGENTS.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/subagents/study-material-scout.md
```

Expected: no whitespace errors; all four files agree on three lanes, `concurrency: 3`, semantic convergence without a fixed candidate cap, no StudyForge deadline, no automatic retry, no inline fallback, and parent selection of the material set required by the Lesson.

- [ ] **Step 7: Commit the contract change**

```bash
git add AGENTS.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/subagents/study-material-scout.md
git commit -m "feat: parallelize plan material scouting"
```

### Task 2: Verify the existing runtime boundary remains intact

**Files:**
- Inspect: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Inspect: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`
- Inspect: `apps/pi-teaching-web/tests/m0/subagent-path.test.ts`
- Inspect: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Inspect: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Inspect: `apps/pi-teaching-web/src/runtime/subagent-path.ts`

**Interfaces:**
- Consumes: the unchanged Plan resource assembly and extension allowlist.
- Produces: evidence that only Plan Sessions expose the packaged read-only Scout and that no runtime regression was introduced by the contract edit.

- [ ] **Step 1: Install the pinned workspace exactly**

Run:

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
```

Expected: exit code 0 with `pi-subagents@0.35.1` resolved from the lockfile.

- [ ] **Step 2: Run the focused mechanical boundary tests**

Run:

```bash
bun test \
  tests/m0/native-session.test.ts \
  tests/m0/public-surface.test.ts \
  tests/m0/subagent-path.test.ts
```

Expected: all tests pass. These tests cover Plan-only `subagent`, explicit extension loading, appended agent paths, and the Scout's read-only tool allowlist; they do not assert Skill sentences.

- [ ] **Step 3: Run the full deterministic check**

Run:

```bash
bun run check
```

Expected: unit tests, typecheck, and production build all pass with exit code 0.

- [ ] **Step 4: Run the deterministic browser cycle**

Run:

```bash
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: the M0 browser cycle passes with exit code 0.

### Task 3: Run a fresh natural-language Plan acceptance

**Files:**
- Create: `docs/audits/2026-08-03-parallel-material-scout-acceptance.md`
- Inspect only: copied learning-set Markdown, copied Pi Session JSONL, and child Scout Session JSONL under `/tmp`

**Interfaces:**
- Consumes: the revised resources from Task 1 and the verified runtime from Task 2.
- Produces: real-model evidence that a new Plan Session performs one three-lane foreground search without a StudyForge deadline, keeps disposable search outside the parent, and completes the normal Lesson/Plan write path.

- [ ] **Step 1: Create an isolated acceptance root**

Copy a known derivative learning set into a new `/tmp/studyforge-parallel-scout-acceptance-*` directory. Reset the target Plan's `session_id` to `null`, remove any unstarted next Lesson, and preserve at least one closed Lesson for direct parent review. Use a separate `PI_CODING_AGENT_DIR`; reuse local provider configuration without printing, copying into git, or recording credentials.

- [ ] **Step 2: Start the worktree server and create a genuinely new Plan Session**

Start `apps/pi-teaching-web` against the copied learning set on an unused localhost port. Open the Plan page and send exactly this natural student request:

```text
上一节结束了，接下来你安排吧。我还是想先自己做，卡住了我再说。
```

Do not mention Scout lanes, diagnostic hypotheses, card families, timeout behavior, or tool mechanics.

- [ ] **Step 3: Observe the full foreground run without imposing a StudyForge deadline**

Wait for the Plan turn to finish. Do not interrupt merely because the three searches take several minutes. Record each lane's settled status, total wall time, and the parent Session token/context growth. A provider/network failure is recorded as a lane failure; it must not be converted into a material-quality timeout.

- [ ] **Step 4: Inspect the parent and child Session facts**

Confirm this sequence from raw Session history and learning-set files:

```text
read Plan and every relevant closed Lesson
→ optional first-use subagent(action: list)
→ one subagent call with three tasks, concurrency 3, fresh context, no timeout fields
→ all three lane results settle
→ parent deduplicates indexes and derives the required material count from the agreed Lesson Blocks
→ parent reads every selected full asset and no rejected one
→ parent writes and rereads one prepared Lesson
→ parent updates and rereads the Plan
→ one ordinary student-visible preparation summary
```

Acceptance fails if the parent performs exploratory bulk card search, opens rejected candidates, starts a second full fan-out automatically, falls back to inline search, exposes child progress/failure in assistant prose, uses an old pre-feature Session, or if a Scout mutates a learning-set file.

- [ ] **Step 5: Write the sanitized acceptance report**

Create `docs/audits/2026-08-03-parallel-material-scout-acceptance.md` with:

```markdown
# Parallel Material Scout Acceptance

## Setup
- branch and commit
- model/provider name without credentials
- copied learning-set root basename
- proof that the Plan Session was new

## Observed sequence
- parent read/review sequence
- three lane names and settled status
- agreed problem/activity count and selected asset paths
- Lesson and Plan write/reread result

## Isolation and latency
- total wall time
- parent context growth
- whether rejected full assets entered the parent
- whether any StudyForge deadline, retry, fallback, or student-visible internal narration occurred

## Verdict
- pass or fail
- remaining concrete issue, if any
```

Do not include credentials, raw chain-of-thought, or full Session transcripts.

- [ ] **Step 6: Run final verification after the report**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
cd ../..
git diff --check
git status --short
```

Expected: both verification commands pass; the only uncommitted file is the new sanitized audit report.

- [ ] **Step 7: Commit the acceptance evidence**

```bash
git add docs/audits/2026-08-03-parallel-material-scout-acceptance.md
git commit -m "docs: record parallel material scout acceptance"
```
