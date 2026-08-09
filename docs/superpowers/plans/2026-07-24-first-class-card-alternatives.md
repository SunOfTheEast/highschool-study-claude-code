# First-Class Card Alternatives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each card alternative an independent Markdown fact with its own method binding and support level, then project confirmed alternative methods through the existing attempt-level ability aggregation.

**Architecture:** Keep `*.alternatives.md` as the sole durable owner of alternatives. The runtime binds card, Lesson, Trace source, ID, and time; Tutor supplies only the verified route, question, student-confirmed method or null, and actual support. Ability projection joins alternatives back to their source Trace attempt and deduplicates by `lessonPath + blockId + cardPath + method`.

**Tech Stack:** TypeScript 7, Bun 1.3.14, TypeBox, Markdown sidecars, existing highschool-study shared domain and Pi runtime.

## Global Constraints

- Preserve the Markdown-first architecture; add no database, cache, background watcher, state machine, registry, or new Agent.
- Do not change Roadmap, Plan, Lesson, problem-card, or Trace schemas.
- Do not add or rename the four public MCP tools.
- `card_alternative_append` remains Pi Tutor-only and Session-bound.
- Runtime owns `id`, `cardPath`, Lesson path, source anchor, and timestamp.
- Tutor supplies `question`, `solution`, `method: string | null`, and `support`.
- A non-null method must resolve to one real canonical method node; no closest-match guessing.
- Source Trace is creation-time provenance only. Later supersession does not hide or remove an alternative.
- One method contributes at most once per attempt; `steady` still requires at least two distinct `cardPath` values.
- Do not add compatibility parsing for the old sidecar marker or old primary/secondary alternative fields.
- Do not write tests for Skill or Agent prose. Test executable tool, persistence, retrieval, projection, refresh, and drill-down behavior.

---

## File Structure

- Modify `plugins/highschool-study/server/src/alternatives.ts`
  - Own the new CardAlternative contract, validation, ID allocation, Markdown rendering, parsing, append, and unfiltered reads.
- Modify `plugins/highschool-study/server/src/domain.ts`
  - Export `readCardAlternatives` and the projection-aware append wrapper.
- Modify `plugins/highschool-study/server/src/cards.ts`
  - Attach all card alternatives without active-Trace filtering.
- Modify `plugins/highschool-study/server/src/trace-search.ts`
  - Return the same unfiltered alternatives during reverse lookup.
- Modify `plugins/highschool-study/server/src/method-signals.ts`
  - Join alternatives to source Trace attempts and merge per-method factors without duplicate counts.
- Modify `plugins/highschool-study/server/src/planner-attention.ts`
  - Rebuild Planner Attention after a successful alternative append.
- Modify `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`
  - Expose the minimal model contract with a dynamic method enum or null and invoke the projection-aware writer.
- Modify `apps/pi-teaching-web/src/study/ability.ts`
  - Allow evidence drill-down to resolve a superseded source Trace used by a durable alternative.
- Modify `apps/pi-teaching-web/src/server/app.ts`
  - Publish an ability snapshot after successful `card_alternative_append`.
- Modify executable tests under both packages.
- Modify `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`, `AGENTS.md`, `plugins/highschool-study/README.md`, `docs/zh-CN/完整说明书.md`, and the superseded design note.

---

### Task 1: Persist independent card alternatives

**Files:**
- Modify: `plugins/highschool-study/tests/integration/card-alternatives.test.ts`
- Modify: `plugins/highschool-study/tests/integration/bidirectional-search.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `plugins/highschool-study/server/src/alternatives.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Modify: `plugins/highschool-study/server/src/cards.ts`
- Modify: `plugins/highschool-study/server/src/trace-search.ts`
- Modify: `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`

**Interfaces:**
- Consumes: `resolveTraceMethods(root, { primary })`, `readActiveTraces(root, [lessonPath])`, and the existing card question resolver.
- Produces:

```ts
export type CardAlternative = {
  id: string;
  cardPath: string;
  sourceTrace: string;
  question: string;
  method: string | null;
  support: TraceSupport;
  solution: string;
  recordedAt: string;
};

export type CardAlternativeInput = {
  sourceTraceId: string;
  question: string;
  solution: string;
  method: string | null;
  support: TraceSupport;
};

export function appendCardAlternative(
  root: string,
  lessonPath: string,
  input: CardAlternativeInput,
  now: () => Date,
): CardAlternative;

export function readCardAlternatives(
  root: string,
  cardPath: string,
): CardAlternative[];
```

- [x] **Step 1: Replace the integration expectations with the independent-fact contract**

Update `card-alternatives.test.ts` so the first successful append deliberately differs from its source Trace:

```ts
const alternative = appendCardAlternative(root, 'lessons/lesson-001.md', {
  sourceTraceId: 'event-001',
  question: '整题',
  solution: '先作代换，再从约束中消去参数。',
  method: '参数化与消元',
  support: 'external',
}, () => new Date('2026-07-21T02:05:00Z'));

expect(alternative).toMatchObject({
  id: 'alt-001',
  cardPath: 'cards/conics/freeze-variable-01.yaml',
  sourceTrace: 'lessons/lesson-001.md#trace-event-001',
  question: '整题',
  method: '参数化与消元',
  support: 'external',
});
```

Replace the overwrite/supersession test with two appends using the same source and question:

```ts
const first = appendCardAlternative(root, 'lessons/lesson-001.md', {
  sourceTraceId: 'event-001',
  question: '整题',
  solution: '第一条路线。',
  method: '冻结变量法',
  support: 'tutor',
}, now);
const second = appendCardAlternative(root, 'lessons/lesson-001.md', {
  sourceTraceId: 'event-001',
  question: '整题',
  solution: '第二条路线。',
  method: null,
  support: 'none',
}, now);

expect([first.id, second.id]).toEqual(['alt-001', 'alt-002']);
expect(readCardAlternatives(root, first.cardPath).map((item) => item.solution))
  .toEqual(['第一条路线。', '第二条路线。']);
```

After appending a superseding Trace, assert the same two alternatives remain visible. Add an invalid-method assertion:

```ts
expect(() => appendCardAlternative(root, 'lessons/lesson-001.md', {
  sourceTraceId: 'event-001',
  question: '整题',
  solution: '伪节点路线。',
  method: '不存在的方法',
  support: 'none',
}, now)).toThrow('INVALID_ALTERNATIVE: method is not a canonical graph node');
```

Update every existing append fixture in this test file to pass explicit `method` and `support`.

- [x] **Step 2: Update search and Pi tool contract tests**

In `bidirectional-search.test.ts`, append one alternative and assert both directions return its `id`, `method`, `support`, and source.

In `study-tools.test.ts`, change the expected parameter list to:

```ts
expect(Object.keys(properties)).toEqual([
  'sourceTraceId',
  'question',
  'solution',
  'method',
  'support',
]);
expect(JSON.stringify(tool.parameters)).not.toContain('cardPath');
expect(JSON.stringify(tool.parameters)).not.toContain('lessonPath');
expect(JSON.stringify(tool.parameters)).not.toContain('id');
```

Also assert the serialized schema contains one real derivative method name, `null`, and all three support literals.

- [x] **Step 3: Run the focused tests and verify RED**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/card-alternatives.test.ts tests/integration/bidirectional-search.test.ts
```

Expected: FAIL because the current alternative inherits Trace methods, overwrites the same source/question, and disappears after supersession.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
```

Expected: FAIL because `card_alternative_append` lacks `method` and `support`.

- [x] **Step 4: Implement the minimal sidecar contract**

In `alternatives.ts`:

1. Remove card method inheritance and the active-read dependency.
2. Import `resolveTraceMethods` and `TraceSupport`.
3. Validate support against:

```ts
const supports = new Set<TraceSupport>(['none', 'tutor', 'external']);
```

4. Resolve a non-null method with:

```ts
const methodResolution = input.method === null
  ? { methods: null, unresolved: [] }
  : resolveTraceMethods(root, { primary: input.method });
if (input.method !== null && methodResolution.methods === null) {
  throw new Error('INVALID_ALTERNATIVE: method is not a canonical graph node');
}
const method = methodResolution.methods?.primary ?? null;
```

5. Parse current new-format entries and allocate:

```ts
function nextAlternativeId(alternatives: CardAlternative[]): string {
  const max = alternatives.reduce((current, item) => {
    const value = /^alt-(\d+)$/.exec(item.id)?.[1];
    return value === undefined ? current : Math.max(current, Number(value));
  }, 0);
  return `alt-${String(max + 1).padStart(3, '0')}`;
}
```

6. Render markers by ID:

```md
<!-- studyforge-alternative id="alt-001" question="整题" -->
## alt-001 · 整题

- 来源 Trace: lessons/lesson-001.md#trace-event-001
- 记录时间: 2026-07-21T02:05:00.000Z
- 支持: external
- 方法: 参数化与消元
```

7. Append every successful entry; do not search for an existing source/question section.
8. Export `readCardAlternatives(root, cardPath)` with no active Trace argument or filter.
9. Parse only the new marker and fields. `未归类` becomes `method: null`.

- [x] **Step 5: Wire readers and the Pi schema**

Rename the shared export and update `cards.ts` plus `trace-search.ts` to use:

```ts
alternatives: readCardAlternatives(root, card.path)
```

In `card-alternative-append.ts`, import `listCanonicalMethodNames` and build:

```ts
const methodName = Type.Enum(listCanonicalMethodNames(root));

method: Type.Union([methodName, Type.Null()], {
  description: 'Pass one student-confirmed canonical node, or null when no exact node is confirmed.',
}),
support: Type.Union([
  Type.Literal('none'),
  Type.Literal('tutor'),
  Type.Literal('external'),
]),
```

Keep `sourceTraceId`, `question`, and `solution` unchanged and Session-bound.

- [x] **Step 6: Run focused tests and typechecks to verify GREEN**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/card-alternatives.test.ts tests/integration/bidirectional-search.test.ts
bun run typecheck
```

Expected: all selected tests pass and TypeScript exits 0.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: selected runtime tests pass and TypeScript exits 0.

- [x] **Step 7: Commit Task 1**

```bash
git add plugins/highschool-study/server/src/alternatives.ts \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/server/src/cards.ts \
  plugins/highschool-study/server/src/trace-search.ts \
  plugins/highschool-study/tests/integration/card-alternatives.test.ts \
  plugins/highschool-study/tests/integration/bidirectional-search.test.ts \
  apps/pi-teaching-web/src/runtime/card-alternative-append.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "feat: persist first-class card alternatives"
```

---

### Task 2: Project alternative methods through existing attempts

**Files:**
- Modify: `plugins/highschool-study/tests/integration/method-signals.test.ts`
- Modify: `plugins/highschool-study/tests/integration/card-alternatives.test.ts`
- Modify: `plugins/highschool-study/server/src/method-signals.ts`
- Modify: `plugins/highschool-study/server/src/planner-attention.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Modify: `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/src/study/ability.ts`
- Modify: `apps/pi-teaching-web/tests/study/ability.test.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Consumes: `readCardAlternatives`, `readTraceRecords`, `aggregateMethodSignals`, and Task 1's `CardAlternative`.
- Produces:

```ts
export function appendCardAlternativeWithProjection(
  root: string,
  lessonPath: string,
  input: CardAlternativeInput,
  now: () => Date,
): CardAlternative;
```

- Preserves `MethodSignal`, `AbilityProjection`, and the attempt key.

- [x] **Step 1: Add failing projection tests**

In `method-signals.test.ts`, create a correct source Trace whose method is `冻结变量法`, then append an alternative whose method is `参数化与消元`:

```ts
appendCardAlternative(root, lessonPath, {
  sourceTraceId: 'event-001',
  question: '整题',
  solution: '使用另一条完整路线。',
  method: '参数化与消元',
  support: 'none',
}, now);

expect(aggregateMethodSignals(root, readActiveTraces(root))).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      method: '参数化与消元',
      evidenceWeight: 2,
      earnedWeight: 2,
      attemptCount: 1,
      distinctCardCount: 1,
    }),
  ]),
);
```

Add a deduplication case with a Tutor-supported Trace and two same-method alternatives, one Tutor-supported and one unsupported. Assert one attempt, one distinct card, and the maximum factor:

```ts
expect(signal).toMatchObject({
  method: '冻结变量法',
  evidenceWeight: 2,
  earnedWeight: 2,
  score: 1,
  attemptCount: 1,
  distinctCardCount: 1,
});
```

Add a `method: null` case that does not create a signal. Add a supersession case showing a durable alternative still contributes after its source event is inactive.

- [x] **Step 2: Add failing rebuild, drill-down, and live-refresh tests**

In `card-alternatives.test.ts`, call the new projection-aware writer and assert `memory/planner-attention.md` contains the alternative method.

In `ability.test.ts`, supersede the alternative's source Trace, read the ability source, and assert:

```ts
expect(readEvidence(root, alternative.sourceTrace).trace.blockId).toBe('step-02');
```

In `workspace-api.test.ts`, parameterize the successful refresh test over:

```ts
for (const toolName of ['trace_append', 'card_alternative_append']) {
  // emit successful tool_execution_end and expect one ability-update
}
```

Keep failed `trace_append`, failed `card_alternative_append`, and successful unrelated tools in the no-refresh test.

In `study-tools.test.ts`, execute `card_alternative_append` against a temporary learning set and assert the Planner Attention file includes the separately supplied method.

- [x] **Step 3: Run focused tests and verify RED**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/method-signals.test.ts tests/integration/card-alternatives.test.ts
```

Expected: FAIL because alternatives are not consumed by `aggregateMethodSignals` and alternative writes do not rebuild Planner Attention.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/ability.test.ts tests/runtime/study-tools.test.ts tests/server/workspace-api.test.ts
```

Expected: FAIL because inactive source Trace drill-down and post-alternative ability refresh are not implemented.

- [x] **Step 4: Extend the attempt accumulator without adding a new domain layer**

In `method-signals.ts`, keep Trace factors and method roles separate:

```ts
type CardAttempt = {
  cardPath: string;
  traceFactors: number[];
  traceMethods: Map<string, 'primary' | 'secondary'>;
  alternativeFactors: Map<string, number>;
  sourceRefs: string[];
};
```

Build active Trace attempts exactly as today. Then:

1. Collect the unique Lesson paths from the supplied active Trace list.
2. Read all Trace records for only those Lessons.
3. Index them by `sourceAnchor`.
4. Read alternatives for the unique card paths used by those records.
5. Skip an alternative with `method === null`, a missing source Trace, or a card/source mismatch.
6. Merge its factor:

```ts
const factor = supportFactor[alternative.support];
attempt.alternativeFactors.set(
  alternative.method,
  Math.max(attempt.alternativeFactors.get(alternative.method) ?? 0, factor),
);
```

When emitting each method for an attempt:

```ts
const traceFactor = attempt.traceFactors.length === 0
  ? null
  : attempt.traceFactors.reduce((sum, value) => sum + value, 0)
    / attempt.traceFactors.length;
const alternativeFactor = attempt.alternativeFactors.get(methodName) ?? null;
const factor = Math.max(traceFactor ?? 0, alternativeFactor ?? 0);
const role = alternativeFactor !== null
  || attempt.traceMethods.get(methodName) === 'primary'
  ? 'primary'
  : 'secondary';
```

Use the existing role weights, signal counts, card sets, sorting, and source reference rendering. Attempts without alternatives retain byte-for-byte equivalent signal values.

- [x] **Step 5: Rebuild projections after alternative writes**

In `planner-attention.ts`, add:

```ts
export function appendCardAlternativeWithProjection(
  root: string,
  lessonPath: string,
  input: CardAlternativeInput,
  now: () => Date,
) {
  const result = appendCardAlternative(root, lessonPath, input, now);
  rebuildPlannerAttention(root);
  return result;
}
```

Export it from `domain.ts`. Change the Pi runtime tool to call this wrapper.

- [x] **Step 6: Restore evidence drill-down and live ability refresh**

In `ability.ts`, change only the evidence source lookup:

```ts
const trace = readTraceRecords(root).find((item) => item.sourceAnchor === sourceAnchor);
```

Keep the current safe card projection.

In `server/app.ts`, refresh after either fact writer succeeds:

```ts
const abilityWriters = new Set(['trace_append', 'card_alternative_append']);

if (
  event.type === 'tool_execution_end'
  && abilityWriters.has(event.toolName)
  && !event.isError
) {
  deps.hub.publish({
    type: 'ability-update',
    projection: abilityReader(deps.root),
  });
}
```

- [x] **Step 7: Run focused tests and typechecks to verify GREEN**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/method-signals.test.ts tests/integration/card-alternatives.test.ts
bun run typecheck
```

Expected: selected tests pass and TypeScript exits 0.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/ability.test.ts tests/runtime/study-tools.test.ts tests/server/workspace-api.test.ts
bun run typecheck
```

Expected: selected tests pass and TypeScript exits 0.

- [x] **Step 8: Commit Task 2**

```bash
git add plugins/highschool-study/server/src/method-signals.ts \
  plugins/highschool-study/server/src/planner-attention.ts \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/tests/integration/method-signals.test.ts \
  plugins/highschool-study/tests/integration/card-alternatives.test.ts \
  apps/pi-teaching-web/src/runtime/card-alternative-append.ts \
  apps/pi-teaching-web/src/study/ability.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/study/ability.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: project confirmed alternative methods"
```

---

### Task 3: Align Tutor behavior and functional documentation

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `plugins/highschool-study/README.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Modify: `docs/superpowers/specs/2026-07-22-multiple-solution-method-evidence-design.md`

**Interfaces:**
- Consumes: the implemented Task 1 tool contract and Task 2 projection semantics.
- Produces: one consistent current rule across operational instructions and functional docs.

- [x] **Step 1: Update the Tutor Skill without prose tests**

Replace the final alternative paragraph in `tutor-lesson/SKILL.md` with:

```md
A genuine alternative changes the complete core route of at least one whole question or part: its entry, decisive reasoning and closing chain differ from the reference and stored alternatives. Notation changes, reordered equivalent steps and local tricks are not alternatives. After the correct active Trace exists, propose at most one canonical method node for the alternative in plain language and ask whether it fits. Wait for the student's answer: pass the confirmed node, or `null` after rejection, deferral or no exact match. Then call `card_alternative_append` with the route's actual support. Say it was saved only after a successful receipt. Stored alternatives remain private unless the student asks to compare methods.
```

- [x] **Step 2: Update architecture and user-facing docs**

Apply the same facts to all current docs:

- CardAlternative has its own `alt-NNN`, method or null, support, solution, and source Trace.
- Source Trace is provenance, not lifecycle authority.
- Supersession does not hide the alternative.
- A bound method joins the source attempt; one card remains one distinct card.
- Manual alternative correction/deletion is a direct Markdown edit followed by the existing Planner Attention rebuild command.

In `AGENTS.md`, replace the old “ignore until rebound” invariant.

In `README.md` and `完整说明书.md`, replace every statement that alternatives are filtered by active Trace. Update the ability section to explain the per-method maximum within one attempt.

At the top of the 2026-07-22 design, add:

```md
> CardAlternative 的身份、方法来源、生命周期和能力投影已由
> `2026-07-24-first-class-card-alternative-design.md` 修订；Trace 实际方法与题问级另解判断部分仍有效。
```

- [x] **Step 3: Scan for stale active-Trace lifecycle wording**

Run:

```bash
rg -n "另解.*active Trace|active Trace.*另解|ignore the old alternative|重新绑定|自动隐藏旧" \
  AGENTS.md plugins/highschool-study/README.md docs/zh-CN/完整说明书.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md
```

Expected: no stale statement says supersession hides or invalidates an alternative. References to requiring a correct active Trace at creation are allowed.

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [x] **Step 4: Commit Task 3**

```bash
git add AGENTS.md \
  plugins/highschool-study/README.md \
  docs/zh-CN/完整说明书.md \
  docs/superpowers/specs/2026-07-22-multiple-solution-method-evidence-design.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md
git commit -m "docs: align alternative evidence lifecycle"
```

---

### Task 4: Full verification

**Files:**
- Verify all files changed in Tasks 1–3.

**Interfaces:**
- Consumes: the complete implementation.
- Produces: fresh evidence that both packages typecheck, all non-browser tests pass, and the Web production build succeeds.

- [x] **Step 1: Run the complete shared plugin check**

Run:

```bash
cd plugins/highschool-study
bun run check
```

Expected: TypeScript exits 0 and all plugin tests pass with 0 failures.

- [x] **Step 2: Run the complete Pi Web check**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript exits 0, all non-E2E Web tests pass with 0 failures, and Vite production build exits 0.

- [x] **Step 3: Verify repository state and requirement coverage**

Run:

```bash
git diff --check
git status --short
git log --oneline -5
```

Expected: no unstaged implementation changes, no whitespace errors, and commits exist for the plan, persistence, projection, and docs.

Check the implementation against the design acceptance list:

- independent IDs;
- no Trace method inheritance;
- null method accepted;
- canonical method fence;
- multiple same-source alternatives append;
- supersession preserves reads;
- card and Trace reverse search agree;
- bound method projects once per attempt;
- different card count remains unchanged;
- Planner Attention rebuilds;
- live ability refresh publishes;
- inactive source Trace drill-down works;
- Tutor asks the student before binding.
