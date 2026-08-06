# Bounded Observable Material Scout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the material Scout perform canonical feature recall plus stem-level screening from a safe file sidecar, keep route-level verification in the Plan Coach, show students safe live progress, and export exact parent/child load metrics for A/B acceptance.

**Architecture:** Keep the existing Plan-only foreground `subagent` call and its persisted child Sessions. For problem cards, generate one deterministic compact TSV file that co-locates only safe canonical metadata and the public stem within the native grep tool's 500-character preview; Scout greps that ordinary file while non-card assets keep their free-text path. A focused projection module converts only safe progress facts into a dedicated `material-search` conversation item; the regular tool item remains unchanged for native file tools. The existing CoT exporter reads final parent `toolResult.details` for metrics and optionally follows persisted child Session paths for full local audit.

**Tech Stack:** Pi native Sessions and events, `pi-subagents@0.35.1`, TypeScript 7, React 19, Bun tests, Vite, Playwright, Markdown Agent/Skill resources.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/gentle-judgment-isomorphic-acceptance` on `codex/gentle-judgment-isomorphic-acceptance`.
- Preserve the current `thinking: medium`, Plan-only `subagent`, fresh foreground child Sessions, `concurrency: 3`, and the Scout tool allowlist `read, grep, find, ls`.
- Do not modify `pi-subagents`, Roadmap/Plan/Lesson schema, lifecycle, course Runtime, card format, graph format, or old Workflow Runtime.
- Add only the approved safe TSV card sidecar. Do not add a database, vector index, structured retrieval tool, hard timeout, tool budget, fixed search budget, or fixed candidate quota.
- Keep non-card material retrieval valid; a free-text-only video or reading task must not be forced through the problem-card graph vocabulary.
- Never send tokens, cost, model, task brief, search terms, paths, tool arguments, recent output, candidate content, child Session path, CoT, or raw errors to the student UI.
- Do not add exact-wording assertions for Agent or Skill prose. Use the preserved long-cycle Sessions as behavioral RED and real-model replay as GREEN.
- Test mutations and real-model runs use a copied learning set under `/tmp`; never mutate the public example or commit credentials, Session JSONL, copied cards, or full private CoT.
- The worktree already contains user-owned changes. Stage only the files named by the current task; `AGENTS.md` has pre-existing edits, so do not commit the whole file merely to capture this task's small guide update.

## Execution checkpoint

- Complete: shallow Scout/Coach responsibility split (`20b9d98`).
- Complete: safe native progress projection and UI (`2e50b5c`).
- Complete: child load and CoT export (`af59ab9`).
- Complete: deterministic suite before sidecar (82 tests, 401 assertions, typecheck and build) and one M0 Playwright cycle.
- Failed experiment: prompt-only B reduced the preserved five-call wall time from 933 to 704 seconds but used 164 tools versus A's 162; a current-format one-slot brief still took 137 seconds and read past the stem despite only 15 tools.
- Current: compact the sidecar after its first real run proved the safety boundary but exposed native grep's 500-character line truncation, then repeat the micro comparison before the longitudinal run.

---

### Task 1: Replace deep frontier search with shallow canonical recall

**Files:**
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md`
- Modify without staging unrelated hunks: `AGENTS.md:78-91`
- Verify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: one temporary material slot, optional canonical `goal`/`method`/`structure` terms, optional free-text terms, optional relaxation order, and the existing seven-field foreground `subagent` call.
- Produces: one unfenced JSON object with `slot`, shallow `candidates`, and structured `search_boundary: { query, matched, inspected }`.

- [x] **Step 1: Preserve the behavioral RED**

Record the existing evidence without adding a prose snapshot test:

```text
5 Scouts
162 tool calls = 88 read + 41 grep + 28 ls + 5 find
about 101,000 reasoning tokens
59 card reads, 41 unique cards
returned candidates first read 97–205 seconds before child completion
6 full card-directory listings
3 reads of stale graph/VOCABULARY.md
route-level risks and mathematics re-checked later by Coach
```

Run the unchanged mechanical boundary test before editing:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: PASS; this is a resource-packaging guard, while the saved real Sessions remain the behavioral RED.

- [ ] **Step 2: Rewrite the Scout around one bright-line sequence**

Keep the current frontmatter and literal-search safety, but replace the body with the following operative contract:

```text
读取当前素材类型的权威检索入口
→ 图谱题卡用 graph/vocabulary.yaml 与可选 graph/aliases.yaml 归一到规范词
→ 同一字段内 OR，不同字段间 AND
→ 只读取交集候选的 frontmatter、来源与题面
→ 排除题面可见的不适配项
→ 返回浅候选与 query/matched/inspected
```

The prompt must say explicitly:

```text
- never read graph/VOCABULARY.md;
- never list the whole cards directory before searching;
- do not read or re-derive candidate solutions, rubrics, full routes, hidden zeros,
  equality conditions, or whether every route goes through;
- do not widen beyond the requested feature slice unless the Coach supplied a
  relaxation order;
- return one candidate when it has no visible rejection risk; return one materially
  different reserve only when a concrete metadata/stem-visible risk exists;
- risk may be null and must never be invented;
- an empty result describes only this query's matched N and inspected M.
```

Use this exact output shape:

```json
{
  "slot": "slot-A",
  "candidates": [
    {
      "asset_path": "cards/derivative/example.card.yaml",
      "asset_kind": "problem-card",
      "metadata_fit": "structure 与 method 命中，题面工作量符合本槽位",
      "risk": null
    }
  ],
  "search_boundary": {
    "query": {
      "goal": ["求参数范围"],
      "method": ["参变量分离"],
      "structure": ["指对复合结构"],
      "text": ["恒成立"]
    },
    "matched": 5,
    "inspected": 2
  }
}
```

- [ ] **Step 3: Update the Coach-side material preparation reference**

Replace `search_start` and optional second-perspective frontier search with one Scout per material slot. The brief keeps the existing natural-language purpose, workload, avoid-list, student fit facts, Plan path, and linked closed-Lesson paths, and adds:

```text
建议检索词（可省略，只用于召回）：
- goal: 求参数范围
- method: 参变量分离
- structure: 三次/高次函数结构
- text: 绝对值

放宽顺序（仅在精确组合可能过窄时提供）：
1. 去掉 text
2. 放宽 method
```

Keep the existing seven top-level call fields and `acceptance.level: none`. Change the post-result sequence to:

```text
merge shallow candidates by asset_path
→ Coach selects the current primary
→ Coach fully reads and verifies mathematics, complete routes, hidden conditions,
  workload, exposure risk, and teaching role
→ only if primary fails, read the returned reserve
→ if no reserve works, issue at most one clearer or authorized-relaxation recall
→ never send route verification back to Scout and never auto-rerun a whole fan-out
```

- [ ] **Step 4: Align the repository guide without overwriting other work**

In the existing modified `AGENTS.md`, change only the Material Scout sentences from “decision-sufficient candidate frontier” to:

```markdown
Each Scout uses canonical feature fields and free text to recall a small shallow
candidate set, reads only metadata and the stem, and reports the feature slice it
matched and inspected. The parent chooses a primary, fully reads it, and owns every
mathematical, route-level, teaching-fit, and persistence decision.
```

Keep the surrounding Plan-only tool boundary, concurrency, no-timeout, no-auto-retry, and parent-write rules unchanged.

- [ ] **Step 5: Verify the resource boundary and commit only safe files**

Run:

```bash
git diff --check -- \
  AGENTS.md \
  apps/pi-teaching-web/resources/subagents/study-material-scout.md \
  apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: diff check passes; Scout remains read-only and the focused test passes. Stage the Scout and material reference only:

```bash
git add resources/subagents/study-material-scout.md \
  resources/skills/prepare-approved-lesson/references/material-preparation.md
git commit -m "fix: bound material scout to shallow recall"
```

Leave `AGENTS.md` unstaged because it contains pre-existing user changes.

### Task 2: Project native subagent updates into a safe conversation item

**Files:**
- Create: `apps/pi-teaching-web/src/projection/material-search.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Create: `apps/pi-teaching-web/tests/m0/material-search-projection.test.ts`

**Interfaces:**
- Consumes: native `tool_execution_start`, `tool_execution_update`, `tool_execution_end`, persisted assistant tool calls, and persisted tool results.
- Produces: `MaterialSearchConversationItem` with no raw `detail` field; exports `materialSearchStart`, `materialSearchUpdate`, `materialSearchEnd`, and `mergeMaterialSearchItem`.

- [ ] **Step 1: Write failing safe-projection tests**

Create fixtures containing deliberately unsafe values in `task`, `currentPath`, `currentToolArgs`, `recentOutput`, `sessionFile`, and final output. Assert start/update/end projection returns only this public shape:

```ts
type MaterialSearchConversationItem = {
  id: string;
  kind: 'material-search';
  status: 'running' | 'done' | 'error';
  phase: 'starting' | 'filtering' | 'inspecting' | 'comparing' | 'done' | 'adjusting';
  completed: number;
  total: number;
  toolCount: number;
  elapsedMs: number;
  at: string;
  updatedAt: string;
};
```

The tests must also assert:

```ts
expect(JSON.stringify(item)).not.toContain('cards/private.card.yaml');
expect(JSON.stringify(item)).not.toContain('绝对值 + 三次函数');
expect(JSON.stringify(item)).not.toContain('session-child.jsonl');
expect(JSON.stringify(item)).not.toContain('candidate output');
```

Add a persisted-history fixture where a `subagent` tool call starts at `10:00:00` and its result ends at `10:01:12`; assert the reconstructed final item has `elapsedMs: 72_000`. Add a reducer test asserting repeated updates preserve the original `at`, increase elapsed time, and update one item by id.

- [ ] **Step 2: Run the focused test and observe RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/material-search-projection.test.ts
```

Expected: FAIL because the `material-search` kind and projection helpers do not exist.

- [ ] **Step 3: Add the safe shared type and focused parser**

Add the exact type above to `src/shared/contracts.ts` and include it in `ConversationItem`. In `src/projection/material-search.ts`, implement:

```ts
export function materialSearchStart(
  id: string,
  args: unknown,
  at: string,
): MaterialSearchConversationItem | null;

export function materialSearchUpdate(
  id: string,
  args: unknown,
  partialResult: unknown,
  at: string,
): MaterialSearchConversationItem | null;

export function materialSearchEnd(
  id: string,
  result: unknown,
  isError: boolean,
  at: string,
  started?: MaterialSearchConversationItem,
): MaterialSearchConversationItem | null;

export function mergeMaterialSearchItem(
  existing: MaterialSearchConversationItem,
  incoming: MaterialSearchConversationItem,
): MaterialSearchConversationItem;
```

Recognition uses only `agent === "study-material-scout"` in top-level `tasks`, single-agent args, progress entries, or result entries. Aggregate only numeric `toolCount`; use `currentTool` only to map to a phase. Discard every other field. A failed or timed-out child counts as returned but makes the terminal phase `adjusting`.

- [ ] **Step 4: Wire live events, persisted history, and reducer reconciliation**

In `projectLiveSessionEvent`, add `tool_execution_update`. Use an optional injected timestamp for deterministic tests:

```ts
export function projectLiveSessionEvent(
  sessionKey: SessionKey,
  event: AgentSessionEvent,
  at = new Date().toISOString(),
): StudyEvent[];
```

For `subagent` start/update/end, emit a `material-search` item when recognized. For every other `subagent` activity, emit a generic tool item with `detail: null`; never forward raw subagent args or results. Keep native file-tool details unchanged.

In `projectConversationEntries`, remember the start item by tool-call id. When its persisted result arrives, pass the start item to `materialSearchEnd` so the final elapsed time is the parent wall-clock difference. In `reduceClientState`, use `mergeMaterialSearchItem` for repeated safe updates; if a recognized running item receives a sanitized generic subagent terminal event, retain the safe item and only finalize its status.

- [ ] **Step 5: Run GREEN and regression tests**

```bash
bun test \
  tests/m0/material-search-projection.test.ts \
  tests/m0/server-api.test.ts \
  tests/m0/course-ui.test.tsx
bun run typecheck
```

Expected: all tests and typecheck pass; native `read` history still exposes its existing collapsed detail while `subagent` never transports raw detail.

- [ ] **Step 6: Commit the projection unit**

```bash
git add src/shared/contracts.ts \
  src/projection/material-search.ts \
  src/projection/conversation.ts \
  src/client/state.ts \
  tests/m0/material-search-projection.test.ts
git commit -m "feat: project safe material search progress"
```

### Task 3: Render a quiet live material-search card

**Files:**
- Create: `apps/pi-teaching-web/src/client/components/MaterialSearchActivity.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/src/client/styles/responsive.css`
- Modify: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`

**Interfaces:**
- Consumes: `MaterialSearchConversationItem` from Task 2.
- Produces: one non-expandable student-safe progress row with phase copy, returned/total tasks, elapsed time, and tool operations.

- [ ] **Step 1: Write failing rendering tests**

Add one running material item and one done item. Assert the running markup contains:

```text
正在查看候选材料
1 / 2 个检索任务已返回
1分12秒
23 次操作
```

Assert it does not contain `<details`, raw task text, paths, tokens, candidate output, or the generic `老师正在思考…`. Keep the existing assertion that a native `read` tool remains collapsed and inspectable. Add a generic `subagent` item with unsafe `detail` and assert its detail is not rendered or expandable.

- [ ] **Step 2: Run the UI test and observe RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/course-ui.test.tsx
```

Expected: FAIL because `material-search` has no renderer and generic subagent details still render.

- [ ] **Step 3: Implement the focused component**

`MaterialSearchActivity.tsx` exports:

```ts
export function formatMaterialSearchElapsed(milliseconds: number): string;
export function MaterialSearchActivity({
  item,
}: {
  item: MaterialSearchConversationItem;
}): ReactElement;
```

Map phases exactly:

```ts
const phaseCopy = {
  starting: '正在启动材料检索',
  filtering: '正在筛选材料',
  inspecting: '正在查看候选材料',
  comparing: '正在比较候选',
  done: '材料检索已完成',
  adjusting: '材料检索遇到问题，老师正在调整',
} as const;
```

Initialize display time from `item.elapsedMs`; while status is `running`, increment locally once per second and reset to a newer projected base when the item updates. Render only the phase copy and three approved numbers.

- [ ] **Step 4: Specialize ChatPanel and styles**

Render `material-search` with `MaterialSearchActivity`. Render generic `subagent` as a non-expandable safe activity row with only `后台任务` and status. Continue to use `<details>` for other tools. Compute:

```ts
const materialSearchRunning = items.some(
  (item) => item.kind === 'material-search' && item.status === 'running',
);
```

Only show `老师正在思考…` when `running && !materialSearchRunning`. Add restrained dotted-rule styling aligned with existing tool rows, a small pulsing dot only while running, and the existing reduced-motion behavior. Do not add a modal, rail, toast, card stack, or workflow UI.

- [ ] **Step 5: Run GREEN and commit**

```bash
bun test tests/m0/course-ui.test.tsx
bun run typecheck
git add src/client/components/MaterialSearchActivity.tsx \
  src/client/components/ChatPanel.tsx \
  src/client/styles/course.css \
  src/client/styles/responsive.css \
  tests/m0/course-ui.test.tsx
git commit -m "feat: show live material search activity"
```

Expected: tests and typecheck pass; the commit contains no projection, prompt, or exporter files.

### Task 4: Export parent wait, child load, and complete child transcripts

**Files:**
- Modify: `apps/pi-teaching-web/scripts/export-pi-cot.ts`
- Modify: `apps/pi-teaching-web/tests/m0/export-pi-cot.test.ts`

**Interfaces:**
- Consumes: selected parent turn JSONL, persisted `subagent` tool-result details, and optional child Session JSONL read by `sessionFile`.
- Produces: existing parent CoT output plus an optional `--with-subagents` report that distinguishes wall time from aggregate child compute.

- [ ] **Step 1: Write failing exporter tests**

Extend the fixture with a parent `subagent` tool call at `10:00:10`, a result at `10:01:22`, two child results, `totalChildUsage`, and injected child JSONL. Assert:

```text
Parent wall time: 1m 12s
Aggregate child compute: 2m 1s
Returned children: 2 / 2
Tool calls: 23
read: 8
grep: 4
Child 1 · study-material-scout
Child 2 · study-material-scout
```

Also assert default export omits this section, missing child files produce `Transcript: unavailable`, and no metric is inferred when absent.

- [ ] **Step 2: Run the exporter test and observe RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/export-pi-cot.test.ts
```

Expected: FAIL because `includeSubagents` and child reading do not exist.

- [ ] **Step 3: Add the optional report interface**

Extend options without changing default behavior:

```ts
export type PiTurnExportOptions = {
  turn: number;
  source?: string;
  includeToolResults?: boolean;
  includeSubagents?: boolean;
  readChildSession?: (path: string) => string | undefined;
};
```

Pair parent tool calls and results by `toolCallId`. Compute parent wall time from the two persisted entry timestamps. Sum child `progressSummary.durationMs` only for aggregate child compute and sum `toolCount` only for the tool total. Render recorded usage fields as recorded; use `not recorded` for absent values.

When a child file is available, count assistant tool calls by tool name and append `renderPiTurn(childJsonl, { turn: 1, source: sessionFile })`. Never recursively follow grandchildren. When unavailable or invalid, keep parent metrics and report transcript unavailability without aborting the whole parent export.

- [ ] **Step 4: Add CLI wiring and run GREEN**

Add `--with-subagents` to usage and argument parsing. The CLI reader uses `existsSync` and `readFileSync`; the pure renderer continues to accept an injected reader for tests.

```bash
bun test tests/m0/export-pi-cot.test.ts
bun run typecheck
```

Expected: PASS; the existing `--with-tool-results` behavior remains unchanged.

- [ ] **Step 5: Commit the audit exporter**

```bash
git add scripts/export-pi-cot.ts tests/m0/export-pi-cot.test.ts
git commit -m "feat: export subagent load metrics"
```

### Task 4A: Generate and consume a safe card recall sidecar

**Files:**
- Create: `apps/pi-teaching-web/scripts/build-card-recall-index.ts`
- Create: `apps/pi-teaching-web/tests/m0/card-recall-index.test.ts`
- Create: `examples/derivative-m0/learning-set/graph/card-recall-index.tsv`
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md`

**Interfaces:**
- Generator: `bun run scripts/build-card-recall-index.ts <learning-set-root> [output-path]`.
- TSV columns, in stable order: `path`, `goal`, `method`, `structure`, `choice_count`, `part_count`, `stem`; the three canonical arrays use JSON encoding inside their cells, while the public stem is plain text with internal newlines and tabs flattened to spaces.
- Scout: choose the most selective required field as the anchor, literal-`grep` each OR alternative in that field against `graph/card-recall-index.tsv` (normally one call), then perform the remaining AND/OR and stem screening in-line; no candidate card read before return.

- [ ] **Step 1: Write the failing index contract test**

Create a test that imports `buildCardRecallIndex`, generates from the example derivative learning set in memory, and asserts:

- output equals the committed sidecar byte-for-byte;
- 519 source cards produce 519 path-sorted JSON lines;
- every row has exactly the seven declared columns and a real card path;
- canonical arrays contain strings, `stem` is non-empty, and counts are non-negative integers;
- serialized rows contain no answer, rubric, solution, route, evidence, teacher conclusion, or source-solution field;
- representative choice and free-response cards retain their public stem and visible counts without leaking answers.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/card-recall-index.test.ts
```

Expected: FAIL because the generator and committed sidecar do not exist.

- [ ] **Step 2: Implement the deterministic generator**

Parse `cards/**/*.card.yaml` with the existing `yaml` dependency. Preserve primary-before-secondary order while deduplicating `goal`, `method`, and `structure`; include part-level goals but exclude method subroutes and structure evidence. Read the public top-level `stem`, visible choice/part counts, path, and content revision only. Sort by relative path and emit one `JSON.stringify` result per line with a final newline. Refuse malformed cards rather than silently emitting partial rows.

The CLI defaults its output to `<learning-set-root>/graph/card-recall-index.tsv`; creating the parent directory is allowed. Importing the module in tests must not execute the CLI. Keep the metadata prefix below 233 characters and report test statistics proving that at least 496 of 519 full rows fit the native grep tool's 500-character line preview.

- [ ] **Step 3: Generate the example sidecar and reach GREEN**

```bash
cd apps/pi-teaching-web
bun run scripts/build-card-recall-index.ts ../../examples/derivative-m0/learning-set
bun test tests/m0/card-recall-index.test.ts
```

Expected: 519 deterministic safe rows and PASS. Re-run the generator and use `git diff --exit-code` on the sidecar to prove idempotence.

- [ ] **Step 4: Switch problem-card recall to the sidecar**

Update the Scout bright line:

```text
read graph/vocabulary.yaml (and aliases only when needed)
→ choose the most selective required field and literal grep each of its OR terms in graph/card-recall-index.tsv
→ evaluate every remaining requested field, stem term, avoid item, and visible workload on returned complete rows
→ collect qualifying candidates in index order and stop when the Coach-requested count is met; report visible risk without ranking the accepted candidates
→ return unfenced JSON with honest matched / inspected
```

Do not open candidate card files, list directories, grep answers, infer routes, or add synonyms not supplied by the brief/alias map. If the index is missing, retain the bounded direct-field `grep` plus first-six-lines fallback. Keep non-card material on the existing free-text path. Add one sentence to the Coach material reference making the sidecar a recall aid, never final evidence.

- [ ] **Step 5: Verify and commit the sidecar slice**

```bash
cd apps/pi-teaching-web
bun test tests/m0/card-recall-index.test.ts tests/m0/native-session.test.ts
bun run typecheck
git diff --check -- \
  scripts/build-card-recall-index.ts \
  tests/m0/card-recall-index.test.ts \
  resources/subagents/study-material-scout.md \
  resources/skills/prepare-approved-lesson/references/material-preparation.md \
  ../../examples/derivative-m0/learning-set/graph/card-recall-index.tsv
```

Stage only those five paths and commit `feat: add safe card recall index`.

- [ ] **Step 6: Re-run the current-format diagnostic before the five-brief B**

Copy the generated sidecar into the existing temporary A/B learning-set snapshots. Re-run the same current-format absolute-value slot brief and export the child transcript. Require structural GREEN before continuing: no `ls`/`find`, no card/answer/rubric read, no stale vocabulary, unfenced JSON, and a scoped empty result or a real metadata/stem match. Record wall time, usage, and tool distribution without inventing a fixed speed threshold.

### Task 4B: Replace candidate optimization with satisficing recall

**Files:**
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md`
- Modify: `docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md`
- Modify: `docs/superpowers/plans/2026-08-05-bounded-observable-material-scout.md`

**Interfaces:**
- Consumes: the existing ordered sidecar rows, Coach brief query, direct exclusions, and visible-risk field.
- Produces: exactly one first-fit shallow candidate, or an empty candidate array for the current query slice; Coach remains responsible for deep verification and any later retry.

- [x] **Step 1: Preserve the behavioral RED**

Use the archived teaching-action counterfactual run as the failing baseline. It found qualifying
`mst_p0123_power_construct_ex01`, `ex02`, and `ex03` near one another, but still inspected all 31
full-query matches and spent 127.7 seconds before returning two candidates. The failure is continued
optimization after a usable candidate, not failed recall.

- [x] **Step 2: Write the minimal satisficing rule**

State why the Scout stops: selecting material is repeatable, and later calls can exclude material already
used. For the current slot it only needs one adequate candidate, not the best candidate in the inventory.
Screen returned rows in order; the first row that satisfies the brief and misses every direct exclusion is
returned immediately. A visible soft risk is reported in `risk` and does not trigger comparison, backup
search, or inspection of later rows.

- [x] **Step 3: Remove contradictory backup semantics**

Delete the old “visible risk permits one distinct reserve” rule from the Scout, Coach material reference,
and authoritative design. If Coach deep verification rejects the returned item, a later bounded query may
exclude that exact path and continue; Scout does not precompute alternatives.

- [x] **Step 4: Verify text consistency and focused packaging**

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
! rg -n '只有.*风险.*继续找|才读取 Scout 已返回的备用|stop at the first no-risk|one genuinely distinct reserve' \
  resources/subagents/study-material-scout.md \
  resources/skills/prepare-approved-lesson/references/material-preparation.md \
  ../../docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md
```

Expected: the focused packaging test passes, and the search finds no Scout/Coach instruction to optimize
or prefetch a backup candidate.

- [x] **Step 5: Re-run one preserved pressure scenario**

Run the same model, learning set, query, and `high` thinking level as the archived counterfactual. Require
the Scout to return one first-fit candidate without inspecting later full-query matches. Record the raw
Session, elapsed time, tool count, reasoning tokens, candidate path, `matched`, and `inspected`. Do not
change the wording again during this verification run.

**Observed result (2026-08-05):** with the same learning set, brief, model, and `high` thinking level,
the Scout returned only `mst_p0123_power_construct_ex01` with `matched: 1` and `inspected: 1`. It did
not mention the adjacent `ex02` or `ex03`. Wall time fell from 127.7 seconds to 49.5 seconds and reasoning
from 14,087 to 4,096 tokens; both runs used four tool calls. This verifies the satisficing stop behavior,
not the whole query-discipline contract: the GREEN run still used two field greps plus one exact-path grep.
The wording also overconstrained every slot to one candidate and is superseded by Task 4C; the performance
observation remains evidence for stopping once the requested quantity has been satisfied.

### Task 4C: Return the quantity requested by the Coach without ranking

**Files:**
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md`
- Modify: `docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md`
- Modify: `docs/superpowers/plans/2026-08-05-bounded-observable-material-scout.md`

**Interfaces:**
- Consumes: one natural-language candidate-count request in the Coach brief, plus the existing ordered sidecar rows, query, direct exclusions, and visible-risk field.
- Produces: candidates in index order until the quantity target is reached; an omitted count defaults to one, an exact count uses that number, and a range uses its lower bound.

- [x] **Step 1: Preserve the quantity-ownership RED**

Record that the current Scout says candidate quantity is owned by its own contract, the Coach material
reference forbids briefs from requesting a count, and the stopping rationale says every slot needs one card.
This contradicts Lessons that legitimately need two or three distinct materials in one slot.

- [x] **Step 2: Put the quantity request in the Coach brief**

Allow one natural-language quantity request such as `需要 1 个` or `需要 2–3 个`. If it is omitted,
the target is one. An exact number is the target; a range uses its lower bound, so `2–3 个` stops at two.
Do not add a schema, Runtime field, or structured retrieval tool.

- [x] **Step 3: Generalize satisficing from one candidate to N candidates**

Resolve the brief's quantity request: omitted means one, an exact count uses that count, and a range uses
its lower bound. Screen rows in index order and collect each candidate that satisfies the brief and misses
every direct exclusion. Once the target is met, return without starting extra retrieval, deep reading, or
comparison merely to find a better candidate. Report each visible soft risk without ranking or replacing
accepted candidates. If the current query slice ends early, return however many qualifying candidates were
found; only zero findings produce an empty array.

- [x] **Step 4: Verify text consistency and focused packaging**

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
! rg -n '候选数量、读取深度.*本契约决定|brief 不要求候选数量|一张足够合适|首个合格即停止' \
  resources/subagents/study-material-scout.md \
  resources/skills/prepare-approved-lesson/references/material-preparation.md \
  ../../docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md
```

Expected: the focused packaging test passes, and no active instruction fixes every slot to one candidate or
removes quantity ownership from the Coach.

- [x] **Step 5: Run the default-one and range-two pressure pair**

Use the same learning set, model, `high` thinking level, and teaching-action brief in both arms. Arm A omits
the quantity request and must return one candidate. Arm B adds `所需候选数量：2–3 个` and must return
the first two qualifying candidates, then stop without continuing an optimization or search cycle for a
better third candidate.
Record raw Sessions, wall time, tools, reasoning tokens, returned paths, `matched`, and `inspected`.

**Observed result (2026-08-05):** the omitted-count arm returned one candidate; the `2–3` arm returned the
first two candidates. The range arm shallowly noticed the adjacent third row already present in its result,
but did not return it or enter another optimization/search cycle. This is accepted as harmless model jitter:
the behavioral requirement is bounded satisficing, not perfect ignorance of adjacent tool output.

### Task 5: Run deterministic verification and a live UI smoke

**Files:**
- Verify: all files from Tasks 1–4A
- Do not create tracked browser artifacts

**Interfaces:**
- Consumes: safe sidecar, revised prompt, safe projection, UI component, and exporter.
- Produces: deterministic proof that the normal Course lifecycle and build still work, plus one live check that native progress reaches the browser without leaks.

- [ ] **Step 1: Run the focused suite**

```bash
cd apps/pi-teaching-web
bun test \
  tests/m0/native-session.test.ts \
  tests/m0/material-search-projection.test.ts \
  tests/m0/server-api.test.ts \
  tests/m0/course-ui.test.tsx \
  tests/m0/export-pi-cot.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run the full deterministic release checks**

```bash
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: typecheck, all Bun tests, production build, and deterministic browser cycle pass. Record any existing non-fatal Vite chunk warning separately.

- [ ] **Step 3: Inspect the live progress card on a copied learning set**

Create a fresh copy and isolated Pi configuration without printing credentials:

```bash
LIVE_ROOT="$(mktemp -d /tmp/studyforge-material-progress-XXXXXX)"
mkdir -p "$LIVE_ROOT/learning-set" "$LIVE_ROOT/pi-agent"
cp -R ../../examples/derivative-m0/learning-set/. "$LIVE_ROOT/learning-set/"
cp /Users/yangrundong/.pi/agent/auth.json "$LIVE_ROOT/pi-agent/auth.json"
cp /Users/yangrundong/.pi/agent/models-store.json "$LIVE_ROOT/pi-agent/models-store.json"
cp /Users/yangrundong/.pi/agent/settings.json "$LIVE_ROOT/pi-agent/settings.json"
chmod 700 "$LIVE_ROOT/pi-agent"
chmod 600 "$LIVE_ROOT/pi-agent/auth.json"
```

If the local Pi filenames differ, resolve them with `ls` only; never print their contents. Start the App on an unused localhost port, reach one approved-Lesson preparation naturally, and verify during the foreground Scout run:

```text
activity phrase changes while tools run
returned/total, elapsed, and operation count update in place
generic thinking indicator is hidden during material search
no task brief, path, currentToolArgs, recentOutput, token count, child output, or raw error is visible
refresh after completion reconstructs the final safe row
```

### Task 6: Run the controlled retrieval comparison and longitudinal acceptance

**Files:**
- Create: `docs/audits/2026-08-05-bounded-observable-material-scout-acceptance.md`
- Inspect only: parent and child Session JSONL under `/tmp`

**Interfaces:**
- Consumes: the five preserved RED Scout briefs, the revised packaged Scout, exact exporter metrics, and the normal Roadmap/Plan/Lesson App.
- Produces: a truthful A/B table and one natural Roadmap-to-first-Plan verdict.

- [ ] **Step 1: Establish whether the saved A baseline is controlled**

Use the parent and child Sessions recorded by `docs/audits/2026-08-05-deterministic-lesson-writes-long-cycle.md`. Confirm model, thinking level, learning-set snapshot, five task briefs, and prompt version. If all are recoverable, use those five runs as A. If any variable cannot be established, rerun the old prompt from its Git parent in a separate copied worktree or mark the comparison observational rather than controlled; never label unlike prompts/models as controlled A/B.

- [ ] **Step 2: Replay the same five briefs against B**

Use the same model, thinking level, learning-set copy, task briefs, concurrency, foreground options, and the generated sidecar. Do not add a timeout or expected card to the prompt. Export every parent invocation with:

```bash
RED_SESSION_ROOT=/tmp/studyforge-deterministic-long-cycle.oQ3sv0/pi-agent/sessions/--tmp-studyforge-deterministic-long-cycle.oQ3sv0-learning-set--
PARENT_SESSION="$(find "$RED_SESSION_ROOT" -maxdepth 1 -type f -name '*.jsonl' -exec rg -l '"name":"subagent"' {} + | head -1)"
test -n "$PARENT_SESSION"
EVIDENCE_DIR="$(mktemp -d /tmp/studyforge-material-scout-evidence-XXXXXX)"
for TURN in 2 4 6; do
  bun scripts/export-pi-cot.ts "$PARENT_SESSION" \
    --turn "$TURN" \
    --with-subagents \
    --output "$EVIDENCE_DIR/turn-$TURN.md"
done
```

Keep evidence under `/tmp` and record only aggregate facts in Git.

- [ ] **Step 3: Compare behavior and result quality**

For each of five tasks record parent wall time, aggregate child compute, reasoning usage, total tools, tool distribution, card reads, full-directory listings, stale-vocabulary reads, `matched/inspected`, time and calls after the returned candidate was first read, and Scout/Coach path overlap. Separately verify the Coach-selected card's mathematics, full route, hidden conditions, workload, exposure risk, and teaching purpose.

B passes the micro comparison only if:

```text
no full cards-directory inventory
no graph/VOCABULARY.md read
no routine Scout answer/rubric deep read
empty results stay scoped to query + matched/inspected
at least 3 of 5 tasks shorten wait or call chain
aggregate wall time, tool calls, and reasoning load are below A
Coach-selected material quality does not visibly regress
```

- [ ] **Step 4: Run one natural Roadmap-to-first-Plan cycle after micro GREEN**

Use a fresh copy of `examples/derivative-m0/learning-set` and the same real-model tier. Simulate a student who genuinely does not know how to study; do not tell any Agent which Plan, Lesson count, material, method, card, tool, or file operation to choose. Continue through Roadmap diagnosis, student-confirmed first Plan, dynamically many student-confirmed Lessons, teaching and closing each Lesson, and Plan completion. Do not hard-code five or six Lessons.

The final cycle must preserve the existing approval, Tree evidence, document parsing, classroom-log honesty, and UI-owned lifecycle gates while every long material search shows the new safe progress. Do not repair Markdown or remind the model of hidden contracts during the run.

- [ ] **Step 5: Write and commit the truthful acceptance report**

The report must separate deterministic results, UI observation, A/B metrics, selected-material quality, full-cycle teaching outcome, failures, and residual risk. If only the implementation and deterministic checks finish, say so and leave real-model acceptance pending; do not convert missing evidence into PASS.

```bash
git add docs/audits/2026-08-05-bounded-observable-material-scout-acceptance.md
git commit -m "docs: validate bounded material scouting"
```

### Task 7: Final verification and handoff

**Files:**
- Inspect: commits and working-tree status
- Preserve: all unrelated user-owned changes

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: exact verification evidence, commit list, performance verdict, and a clear statement of any remaining real-model work.

- [ ] **Step 1: Re-run final checks from the resulting tree**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Audit scope and secrets**

```bash
cd ../..
git diff --check
git status --short
git log --oneline --decorate -8
git diff --cached --name-only
```

Confirm no `/tmp` artifact, Session JSONL, provider config, credential file, copied learning set, or raw CoT is tracked. Confirm pre-existing user changes still exist and were not accidentally bundled into task commits.

- [ ] **Step 3: Report the outcome**

Lead with whether the implementation is complete and which verification layers passed. Report student-visible behavior, exact deterministic test results, A/B load changes when available, the natural long-cycle verdict when available, commits created, and remaining risks. Do not claim sidecar, thinking-level, or structured-retrieval conclusions without the A/B evidence defined above.

### Task 8: Route unbound learning-set assets before candidate discovery

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md`
- Verify only: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: an approved Block design and its chosen material provenance.
- Produces: one deterministic routing decision: student-held material, Coach-authored inline material, bound learning-set asset, or unbound learning-set asset.

- [x] **Step 1: Preserve the real-model RED**

Use the saved C1–C4 parent Session traces under
`/tmp/studyforge-real-coach-pressure-enngsv` as the baseline. Record that C1 called no Scout but listed
the card inventory, searched the method graph, and opened a card; C2 and C3 accepted reconstructed
materials but still performed parent-side discovery operations; C4 created an unbound learning-set
asset slot for its short check and did call Scout. Do not reinterpret the absence of original-card recall
as failure when the student selected a reconstruction or retained the original personally.

- [x] **Step 2: Put the observable routing predicate in the always-read Prepare Skill**

Replace “known path versus exploratory comparison” with material provenance plus asset binding. Define
candidate discovery as any collection-, index-, pattern-, or candidate-file operation whose purpose is
to obtain asset paths. Require unbound learning-set assets to enter `material-preparation.md` before any
parent `ls`, `find`, `grep`, or candidate read. Preserve direct verification of one already-bound path and
preserve non-library student-held and independently authored materials.

- [x] **Step 3: Make the on-demand reference consume only the unbound-asset state**

Change the reference entry condition to “the approved Block uses a learning-set asset and has no exact
bound path.” Keep slot briefs, fresh Scout execution, shallow output, parent deep verification, empty-result
handling, free-text non-card support, and the existing seven-field `subagent` call unchanged.

- [x] **Step 4: Run deterministic verification**

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
bun run check
cd ../..
git diff --check -- \
  docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md \
  docs/superpowers/plans/2026-08-05-bounded-observable-material-scout.md \
  apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md \
  apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md
```

Expected: all commands pass; no schema, Runtime state, tool, Scout output shape, or student approval rule
changes.

- [x] **Step 5: Run the routing GREEN pressure pair**

Use the same real Plan Coach configuration for two approved Lessons. In A, the original is student-held
and the short check is explicitly Coach-authored: require zero Scout calls and zero parent-side learning-set
candidate discovery. In B, the short check must be an existing learning-set asset but no path is supplied:
require one Scout route before any parent candidate discovery, followed by a full read of only the returned
primary. Judge the routing and final teaching quality separately from exact hidden-card recovery.

**Observed result (2026-08-05):** the routing predicate passed in both arms. Arm A used the student-held
original plus a Coach-authored inline check, made no Scout call, and performed no learning-set candidate
discovery. Arm B routed the unbound learning-set check to a fresh Scout before any parent candidate
discovery; the parent then fully read only the returned primary and correctly rejected it on mathematical
and teaching-fit grounds. The end-to-end B arm is not a performance GREEN: the first Scout spent 436.8 s
on a broad 69-line anchor result, and the one permitted refined recall spent 241.3 s while violating the
single-anchor boundary and scanning the full index. Coach did not substitute the bad card or create a
Lesson. Treat caller routing as verified and Scout query discipline/latency as a separate unresolved
failure; do not fold that failure into another provenance rule.
