# Slot-Scoped Material Scout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed three-lane whole-topic Scout fan-out with dynamic, Lesson-slot-scoped material recall that stops at a decision-sufficient candidate frontier.

**Architecture:** Keep the existing Plan-only native `subagent` boundary and packaged read-only Scout. The Plan Coach derives one temporary search slot for every Lesson Block that still needs material, launches one fresh Scout per slot, explicitly disables the generic software acceptance gate, then fully reads only the selected candidates. No Runtime, schema, index, database, frontend, or persistence layer changes are introduced.

**Tech Stack:** Pi native Sessions, `pi-subagents@0.35.1`, Markdown Agent/Skill resources, Bun tests, Playwright browser smoke, real-model StudyForge acceptance.

## Global Constraints

- Preserve Roadmap → Plan → Lesson → Block and direct parent reading of closed Lesson Markdown.
- Preserve Plan-only access to `subagent`; Roadmap and Lesson keep the six native file tools.
- Preserve `thinking: medium` for the first behavioral comparison.
- Preserve the current literal-search guidance already present in the dirty Scout file.
- Preserve unrelated modified and untracked files; stage only files named by the current task.
- Do not add a persistent index, vector store, database, Handoff, workflow store, timeout, turn budget, tool budget, candidate-count cap, or frontend projection.
- Do not add exact-wording tests for Skill prose.
- Run behavioral acceptance on a copied learning set and never commit credentials or Pi Session JSONL.

---

### Task 1: Replace fixed lanes with temporary material slots

**Files:**
- Modify: `AGENTS.md:62-89`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md:27-66`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md:42-98`
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md:1-50`

**Interfaces:**
- Consumes: the existing Plan-only `subagent` tool, `study-material-scout`, seven-field top-level parallel call, native file tools, and current public/private preparation boundary.
- Produces: variable task count by Lesson material slot; task items with `agent`, `task`, and explicit `acceptance`; Scout JSON with `slot`, `candidates`, and `search_boundary`.

- [ ] **Step 1: Preserve the observed RED baseline**

Use the already captured real Session facts as the behavioral failure case; do not add a wording test:

```text
two sequential preparations
→ fixed 3 Scouts each
→ 142 assistant turns
→ 287 tool calls
→ 168 card reads for 59 unique cards
→ 46 and 38 duplicate reads inside the two fan-outs
→ selected cards found minutes before all Scouts stopped
→ generic acceptance reports appended to read-only recall
```

- [ ] **Step 2: Update the repository-level contract**

Replace the fixed three-lane paragraph in `AGENTS.md` with these facts:

```markdown
A Plan Session additionally has `subagent` for fresh-context copies of one packaged
read-only `study-material-scout`. The Coach derives temporary material slots from the
agreed Lesson activities and normally launches one Scout per slot, with at most three
running concurrently. Each Scout returns only a decision-sufficient candidate
frontier for its slot. The parent chooses, fully reads, and verifies the selected
asset for every slot. Roadmap and Lesson Sessions do not receive `subagent`.
```

Keep the existing statements that Scouts cannot write teaching facts, the parent owns selection and persistence, StudyForge sets no Scout wall-clock deadline, and failed fan-outs are not automatically retried.

- [ ] **Step 3: Rewrite the Plan Agent search recipe**

In `apps/pi-teaching-web/resources/agents/plan-node.md`, keep diagnosis, direct child reading, no-spoiler preparation, Lesson writing authority, and post-class review unchanged. Replace the material-search section with this sequence:

```text
exact agreed path requiring no comparison → read directly
exploratory material need → derive one temporary slot per material-requiring Block
each slot → one fresh study-material-scout task
unclear single slot → optional second perspective only when a concrete unresolved
                       uncertainty is named
all slot tasks settle → merge frontiers and deduplicate by asset_path
each slot → fully read and verify its current selected asset
selected asset fails → read the next existing frontier item, without a new fan-out
any slot remains unfilled → no Lesson and no silent activity-count reduction
```

Require each task to have exactly this shape:

```json
{
  "agent": "study-material-scout",
  "task": "slot=slot-A; search_start=graph-first; plan=plans/plan-002.md; closed_lessons=[lessons/lesson-007.md,lessons/lesson-008.md]; purpose=observe whether the student compares routes on an unfamiliar common-tangent shell; asset_kind=problem-card; workload=one light-to-medium attempt; avoid=[assets used in lesson-007 and lesson-008,famous direct clones]; preference=student works independently and requests help before hints",
  "acceptance": {
    "level": "none",
    "reason": "read-only candidate recall"
  }
}
```

Keep the seven top-level fields `tasks`, `concurrency`, `context`, `async`, `includeProgress`, `artifacts`, and `agentScope`. Use `concurrency: 3` as a maximum, `context: "fresh"`, `async: false`, `includeProgress: false`, `artifacts: false`, and `agentScope: "user"`; omit timeout and output fields.

- [ ] **Step 4: Make the Coach Skill own slot derivation and fit judgment**

In `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`, replace the fixed `graph-first`, `card-text-first`, and `teaching-fit-first` fan-out with the same slot recipe. State explicitly:

```text
The Coach already owns student conversation, Plan, and closed-Lesson context.
It packages fit-changing preferences and exclusions into each slot brief.
There is no teaching-fit-first Scout.
```

Define a slot as a temporary preparation need, not a persisted object. One problem Block normally produces one problem-card slot; a video or reading Block may produce its own material slot; discussion or reflection Blocks that need no external material produce no slot.

- [ ] **Step 5: Make the Scout return a decision frontier**

In `apps/pi-teaching-web/resources/subagents/study-material-scout.md`:

1. Keep the current frontmatter, tool allowlist, fresh replacement prompt, and literal `grep` guidance.
2. Replace the mandatory lane with a mandatory `slot` and a `search_start` hint of `graph-first` or `card-text-first`.
3. Require the Scout to remain inside its slot rather than widening into the complete topic.
4. Keep a candidate only when it fills a missing hard condition, provides a materially different structure or shell, creates a real source/workload/teaching trade-off, or serves as a useful reserve.
5. Exclude dominated, known-ineligible, over-heavy, and wrong-slot cards from `candidates`; summarize excluded families only in `search_boundary`.
6. After the first qualifying candidate, continue only when the Scout can name a concrete uncertainty capable of changing the Coach's selection.
7. Return one unfenced JSON object with `slot`, `candidates`, and `search_boundary`; candidate fields are `asset_path`, `asset_kind`, `source`, `fit`, `distinction`, and `risks`.
8. Forbid full stems, full answers, decisive transformations, search transcripts, rejected-card lists, chain-of-thought, and software acceptance reports.

- [ ] **Step 6: Inspect the assembled resource change**

Run:

```bash
git diff --check -- \
  AGENTS.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/subagents/study-material-scout.md

git diff -- \
  AGENTS.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/subagents/study-material-scout.md
```

Expected: all four resources agree on slot-scoped dynamic tasks, decision-frontier convergence, explicit `acceptance.level: none`, no fixed three-lane search, no timeout, no automatic retry, and parent-owned final verification. The existing literal `grep` paragraph remains present.

- [ ] **Step 7: Commit the resource contract**

```bash
git add AGENTS.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/subagents/study-material-scout.md
git commit -m "fix: scope material scouts by lesson slots"
```

### Task 2: Verify the unchanged mechanical boundary

**Files:**
- Inspect: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Inspect: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`
- Inspect: `apps/pi-teaching-web/tests/m0/subagent-path.test.ts`
- Inspect: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`

**Interfaces:**
- Consumes: the resource-only Task 1 change.
- Produces: fresh evidence that Plan-only subagent loading, the Scout read-only allowlist, parsing, build, and browser lifecycle remain intact.

- [ ] **Step 1: Confirm no deterministic test needs modification**

Read the existing tests and verify they assert mechanical contracts only: Plan tool availability, explicit extension loading, Scout tool allowlist, Session identity, document lifecycle, and browser closure. Do not add assertions for individual Skill sentences.

- [ ] **Step 2: Install the pinned workspace**

Run:

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
```

Expected: exit code 0 with the existing lockfile unchanged.

- [ ] **Step 3: Run focused resource-boundary tests**

Run:

```bash
bun test \
  tests/m0/native-session.test.ts \
  tests/m0/public-surface.test.ts \
  tests/m0/subagent-path.test.ts
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 4: Run the complete deterministic check**

Run:

```bash
bun run check
```

Expected: typecheck, complete Bun test suite, and production build pass.

- [ ] **Step 5: Run the deterministic browser cycle**

Run:

```bash
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: the M0 browser cycle passes.

### Task 3: Run a real two-slot preparation acceptance

**Files:**
- Create: `docs/audits/2026-08-03-slot-scoped-material-scout-acceptance.md`
- Inspect only: copied learning-set Markdown and Pi Session JSONL outside the repository

**Interfaces:**
- Consumes: committed Task 1 resources and verified Task 2 runtime.
- Produces: real-model evidence comparing slot-scoped retrieval with the 142-turn, 287-call, 168-read baseline.

- [ ] **Step 1: Create an isolated acceptance learning set**

Copy the completed derivative longitudinal learning set to a fresh temporary directory:

```bash
ACCEPTANCE_ROOT=$(mktemp -d /tmp/studyforge-slot-scout-acceptance-XXXXXX)
cp -R "/Users/yangrundong/Documents/StudyForge/Workspaces/derivative-longitudinal-2026-08-03/learning-set" "$ACCEPTANCE_ROOT/learning-set"
```

In the copy only, restore `plan-002` to the point immediately after its second closed Lesson:

- set frontmatter `session_id: null` and `status: active`;
- remove the `lesson-009` entry from `Lesson Tree` but keep `lesson-007` and `lesson-008`;
- keep `Current Position` through the paragraph beginning `第二节后的缺口更新` and remove the later third-lesson and completion claims;
- replace `Next Lesson Arrangement` with exactly:

```markdown
## Next Lesson Arrangement

lesson-007 与 lesson-008 已关闭。下一节内容尚未决定；先和学生确认要用几道题、
分别想观察什么，再根据已关闭课堂记录选择材料。不得提前写入方法、题面或答案。
```

Delete the copied `lessons/lesson-009.md` so the course snapshot contains no stale third child. Preserve `lesson-007.md` and `lesson-008.md` as the parent Coach's source history. Do not modify the source learning set.

- [ ] **Step 2: Start a fresh server with existing local provider configuration**

Create a separate Pi directory by copying only the existing local configuration files without displaying their contents:

```bash
mkdir -p "$ACCEPTANCE_ROOT/pi-agent"
cp "/Users/yangrundong/Documents/StudyForge/Workspaces/derivative-longitudinal-2026-08-03/pi-agent/settings.json" "$ACCEPTANCE_ROOT/pi-agent/settings.json"
cp "/Users/yangrundong/Documents/StudyForge/Workspaces/derivative-longitudinal-2026-08-03/pi-agent/models-store.json" "$ACCEPTANCE_ROOT/pi-agent/models-store.json"
cp "/Users/yangrundong/Documents/StudyForge/Workspaces/derivative-longitudinal-2026-08-03/pi-agent/auth.json" "$ACCEPTANCE_ROOT/pi-agent/auth.json"
```

From `apps/pi-teaching-web`, run on an unused port with that separate Pi Session directory. Never print or commit credentials:

```bash
STUDY_LEARNING_SET="$ACCEPTANCE_ROOT/learning-set" \
PI_CODING_AGENT_DIR="$ACCEPTANCE_ROOT/pi-agent" \
STUDY_WEB_PORT=65531 \
bun run start
```

If 65531 is occupied, choose the next free localhost port and record it in the audit.

- [ ] **Step 3: Ask naturally for a two-problem next Lesson**

Open the copied `plan-002` and send one natural student request that specifies the desired classroom experience without mentioning slots, Scout lanes, candidate counts, tool mechanics, or the target implementation:

```text
上一节我已经做完了。下一节想用两道不同外壳的题再练一次：第一道先看我会不会
主动比较路线，第二道换个外壳看能不能迁移。两道都别太重，也别提前告诉我方法。
```

Wait for the foreground preparation turn to settle without imposing a StudyForge deadline.

- [ ] **Step 4: Inspect parent and child facts**

From the copied Plan Session and child Session JSONL, verify:

```text
Coach reads Plan and both closed Lessons
→ one subagent call contains two material-slot tasks
→ each task has acceptance.level=none
→ no Acceptance Contract appears in either child prompt
→ Scouts search distinct teaching purposes and return candidate frontiers
→ Coach fully reads one selected card for each slot
→ Coach writes and rereads one two-problem prepared Lesson
→ Coach updates and rereads plan-002
→ final student message reports only public purpose, workload, count, and interaction
```

Record assistant turns, tool calls, card reads, unique cards, cross-Scout duplicate card reads, final output size, Scout wall time, selected-card discovery time, and total Plan-turn time. Compare them directly with the recorded baseline; do not invent a hard timeout pass condition.

- [ ] **Step 5: Run one browser smoke on the prepared Lesson**

Confirm the Course page remains readable, the new Lesson is linked under `plan-002`, it contains exactly two problem Blocks backed by two real cards, and its public summary does not expose either solution route or answer. Do not run the full teaching session in this acceptance.

- [ ] **Step 6: Write and commit the acceptance report**

Create `docs/audits/2026-08-03-slot-scoped-material-scout-acceptance.md` containing environment, observed call shape, selected assets, quality assessment, performance comparison, failures or residual risks, and an explicit verdict. Do not include credentials, full student Session transcripts, or copied JSONL.

```bash
git add docs/audits/2026-08-03-slot-scoped-material-scout-acceptance.md
git commit -m "docs: validate slot-scoped material scouting"
```

### Task 4: Final verification and handoff

**Files:**
- Inspect: all files committed by Tasks 1 and 3
- Inspect: repository status for unrelated user changes

**Interfaces:**
- Consumes: the implementation and behavioral audit.
- Produces: a verified handoff with exact commits, test results, observed performance, and remaining work.

- [ ] **Step 1: Run final repository checks**

From `apps/pi-teaching-web`:

```bash
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Verify commit scope and preserve user changes**

Run:

```bash
git log -3 --oneline --decorate
git show --stat --oneline HEAD~1
git show --stat --oneline HEAD
git status --short
```

Expected: implementation and audit commits contain only their named files; all pre-existing modified and untracked files remain present and unstaged unless one of the four resource files was intentionally part of Task 1.

- [ ] **Step 3: Report the result**

State the exact deterministic test counts, real Scout metrics, selected-card quality, commit hashes, and any remaining limitation. Do not claim the speed problem is solved unless the new raw Session facts show the expected structural reduction.
