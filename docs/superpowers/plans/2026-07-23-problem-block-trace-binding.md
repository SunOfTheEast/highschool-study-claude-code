# Problem Block Trace Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Pi Tutor Trace for a `problem` Block inherit that Block's one authentic card binding, so the model can no longer omit or cross-bind `cardAlias`.

**Architecture:** Keep Lesson Markdown and Trace Markdown as the durable facts. Tighten both Blueprint compilation and first-start admission so every `problem` Block has exactly one `Uses` alias. Remove `cardAlias` from the Pi-only `trace_append` contract; at write time, read the Session-owned Lesson, resolve the selected `blockId` to its unique alias, and pass that alias to the existing core Trace writer, which freezes the real `cardPath`. Leave the public four-tool Claude MCP contract and cardless non-problem Trace behavior unchanged.

**Tech Stack:** TypeScript 7, Bun 1.3, TypeBox, Pi coding-agent custom tools, Markdown learning-set files, Bun test.

**Design:** `docs/superpowers/specs/2026-07-23-problem-block-trace-binding-design.md`

## Global Constraints

- Keep `lesson-xxx.md` as the owner of `Block -> Uses alias -> cardPath`; keep the appended Trace as the owner of the card actually used in that attempt.
- A `problem` Block has exactly one `Uses` alias. Multiple questions become multiple problem Blocks.
- `dialogue`, `material`, and `reflection` Trace may remain cardless.
- Keep `blockId` in the Pi tool because a later reflection may supersede an earlier problem attempt.
- Remove `cardAlias` only from the Pi Tutor tool. Do not change the public Claude MCP's four-tool surface or nullable `cardAlias`.
- Resolve the alias when writing and persist the real `cardPath`; never infer it later during reads.
- Keep method confirmation independent. A correctly bound card with `methodStatus: unmapped` still contributes no method evidence.
- Reuse the existing Markdown parser and core alias/card authenticity checks. Do not add a database, index, rule engine, migration, retry loop, compatibility branch, or new Agent.
- Do not rewrite historical cardless Trace.
- Do not write tests for Skill prose or exact documentation wording.
- Use TDD for executable changes: observe each focused test fail before production edits.
- Run real-model acceptance only against a copied learning set.

---

## File Structure

### Modified files

- `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
  - Rejects zero-card and multi-card `problem` Blocks before rendering.
- `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
  - Exposes the existing parsed Block shape and enforces the same constraint on hand-written or previously prepared Lesson source.
- `apps/pi-teaching-web/src/runtime/study-tools.ts`
  - Removes Pi `cardAlias` input and derives the unique problem-card alias from the Session-owned Lesson.
- `apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts`
  - Covers Blueprint and source-admission cardinality.
- `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
  - Proves malformed prepared Lessons do not start or create Tutor Sessions.
- `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
  - Covers the narrowed schema, automatic binding, cross-binding resistance, downstream reads, and cardless non-problem Trace.
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
  - States the one-card-per-problem authoring rule for Pi preparation.
- `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
  - States the same shared Lesson semantics for Claude Code preparation.
- `AGENTS.md`
  - Records the executable invariant and Pi-only derivation boundary.
- `docs/zh-CN/完整说明书.md`
  - Documents Block semantics, admission, Pi Trace binding, and the unchanged public MCP boundary.

### New files

- `docs/superpowers/reports/2026-07-23-problem-block-trace-binding-live.md`
  - Records the copied-learning-set real-model acceptance result.

---

### Task 1: Enforce one authentic card per problem Block

**Files:**
- Modify: `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
- Modify: `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
- Modify: `apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

**Interfaces:**

```ts
export type PreparedLessonIssue = {
  code:
    | 'LESSON_SECTION_MISSING'
    | 'LESSON_ALIAS_MISSING'
    | 'LESSON_ALIAS_INVALID'
    | 'LESSON_PROBLEM_CARD_COUNT'
    | 'LESSON_REFLECTION_COUNT';
  message: string;
};

export type PreparedLessonBlock = {
  id: string;
  kind: string;
  uses: string[];
};

export function readPreparedLessonBlocks(body: string): PreparedLessonBlock[];
```

- [ ] **Step 1: Write failing Blueprint cardinality tests**

Extend `tests/study/lesson-blueprint.test.ts` with two focused cases:

```ts
test.each([
  ['no card', []],
  ['multiple cards', ['Q-EX22', 'Q-EX16']],
] as const)('rejects a problem Block with %s', (_name, uses) => {
  const invalid: LessonBlueprint = {
    ...blueprint,
    blocks: blueprint.blocks.map((block) => (
      block.id === 'assessment-01' ? { ...block, uses: [...uses] } : block
    )),
  };

  expect(() => validateLessonBlueprint(root, context, invalid))
    .toThrow(/assessment-01.*恰好一张题卡/);
});
```

Also render a valid Blueprint, edit the prepared source so `assessment-01` has either
`Uses:` or `Uses: Q-EX22, Q-EX16`, and assert:

```ts
expect(() => validatePreparedLessonSource(root, context.lessonPath, invalidSource))
  .toThrow(/LESSON_PROBLEM_CARD_COUNT/);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts
```

Expected: FAIL because both validation paths currently accept zero-card or multi-card
problem Blocks.

- [ ] **Step 3: Add the narrow Blueprint and prepared-source checks**

In `validateLessonBlueprint`, add one issue for every problem Block whose
`uses.length !== 1`:

```ts
if (block.kind === 'problem' && block.uses.length !== 1) {
  issues.push(`Block ${block.id} 必须且只能 Uses 恰好一张题卡`);
}
```

In `validate-prepared-lesson.ts`:

1. rename/export the current `RawBlock` and `rawBlocks` as
   `PreparedLessonBlock` and `readPreparedLessonBlocks`;
2. keep its current explicit `Kind` and comma-separated `Uses` parsing;
3. append a `LESSON_PROBLEM_CARD_COUNT` issue for every parsed problem Block whose
   `uses.length !== 1`;
4. keep all existing section, alias authenticity, and reflection checks unchanged.

Do not turn this into a teaching-quality validator. It checks only the executable
one-attempt/one-card identity.

- [ ] **Step 4: Prove first-start admission rejects malformed prepared files**

Add two rows to the existing table in
`tests/runtime/workspace-registry.test.ts`:

```ts
[
  'a problem block has no card',
  (source: string) => source.replace(
    '- Uses: Q-DOMAIN-EX22',
    '- Uses:',
  ),
  'LESSON_PROBLEM_CARD_COUNT',
],
[
  'a problem block has multiple cards',
  (source: string) => source.replace(
    '- Uses: Q-DOMAIN-EX22',
    '- Uses: Q-DOMAIN-EX22, Q-DOMAIN-EX16',
  ),
  'LESSON_PROBLEM_CARD_COUNT',
],
```

The table's existing assertions must continue to prove:

- `startLesson` rejects;
- the Tutor factory is never called;
- the Lesson file remains byte-for-byte unchanged;
- status remains `prepared`.

- [ ] **Step 5: Run focused validation tests and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts tests/runtime/workspace-registry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the executable Lesson invariant**

```bash
git add apps/pi-teaching-web/src/study/lesson-blueprint.ts \
  apps/pi-teaching-web/src/study/validate-prepared-lesson.ts \
  apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts
git commit -m "fix: require one card per problem block"
```

---

### Task 2: Derive Pi Trace card identity from the selected Block

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

**Behavior:**

```text
Tutor Session ownerPath
  -> read exact Lesson
  -> parse Blocks
  -> find input.blockId
  -> problem: require one Uses alias and pass it to appendTraceWithProjection
  -> non-problem: pass null
  -> core resolves alias and freezes real cardPath
```

- [ ] **Step 1: Write failing schema and automatic-binding tests**

In `tests/runtime/study-tools.test.ts`:

1. extend `keeps runtime authority out of Tutor tool schemas`:

```ts
expect(JSON.stringify(trace.parameters)).not.toContain('cardAlias');
```

2. remove `cardAlias` from the input in
   `binds a Tutor Trace to its Lesson and refreshes planner attention`;
3. keep the existing expected persisted path:

```ts
cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml'
```

4. import `readEvidence` and assert the same Trace resolves to that card:

```ts
expect(readEvidence(
  temporaryRoot,
  'lessons/lesson-003.md#trace-event-001',
).card?.path).toBe('cards/derivative/mst_p0032_ex22.card.yaml');
```

5. pass an extra stale `cardAlias: 'Q-DOMAIN-EX16'` directly to `execute` and assert
   it is ignored: `assessment-01` still persists `Q-DOMAIN-EX22`'s path. This proves
   that even an old or manually constructed caller cannot cross-bind Block A to Block B.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
```

Expected failures:

- `cardAlias` is still exposed in the schema;
- omitting it writes `cardPath: null`;
- the Evidence View has no card;
- a stale explicit alias can still cross-bind the attempt.

- [ ] **Step 3: Remove the Pi argument and derive it at execution time**

In `study-tools.ts`:

1. import `readMarkdownFile` from `highschool-study-markdown/study-domain`;
2. import `readPreparedLessonBlocks` from
   `../study/validate-prepared-lesson`;
3. delete `cardAlias` from the TypeBox parameter object;
4. add a small local helper:

```ts
function cardAliasForBlock(
  root: string,
  lessonPath: string,
  blockId: string,
): string | null {
  const lesson = readMarkdownFile(root, lessonPath);
  const block = readPreparedLessonBlocks(lesson.body)
    .find((candidate) => candidate.id === blockId);
  if (block?.kind !== 'problem') return null;
  if (block.uses.length !== 1) {
    throw new Error(
      `LESSON_PROBLEM_CARD_COUNT: block=${blockId}; count=${block.uses.length}; `
      + '请返回 Coach 修正源文件',
    );
  }
  return block.uses[0]!;
}
```

5. pass the derived value to the unchanged core write:

```ts
cardAlias: cardAliasForBlock(root, context.ownerPath, input.blockId),
```

Do not read the previous `source_resolve` call, recent model text, card title, or
Trace history to guess the card. Do not change `appendTraceWithProjection` or the
public MCP input.

- [ ] **Step 4: Reframe alias-structure tests around the Lesson source**

The current `reports missing and invalid Lesson aliases...` test makes the model
choose the bad alias. Change it so the tool input has no `cardAlias` and the Lesson
itself is malformed:

- missing case: replace `assessment-01`'s `Uses` value with `Q-MISSING`;
- invalid case: restore `Uses: Q-DOMAIN-EX22` and change that alias target to the
  nonexistent card path;
- retain the existing non-retryable `LESSON_ALIAS_MISSING` and
  `LESSON_ALIAS_INVALID` assertions.

Remove `cardAlias` from every other Pi `trace_append` test input. Do not change tests
of the public plugin MCP.

- [ ] **Step 5: Preserve cardless non-problem Trace**

Add a test that appends against a real `dialogue` or `reflection` Block with no
`cardAlias` argument and then asserts:

```ts
expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']).at(-1))
  .toEqual(expect.objectContaining({
    blockId: 'reflection',
    cardPath: null,
  }));
```

Use `methodStatus: 'unmapped'`; this test is about card identity, not mastery.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts \
  tests/study/lesson-blueprint.test.ts \
  tests/runtime/workspace-registry.test.ts
```

Expected: PASS. The problem Trace, `card_search`, `trace_search`, and Evidence View
all point to the Block's one authentic card, while the non-problem Trace remains
cardless.

- [ ] **Step 7: Commit the Pi contract reduction**

```bash
git add apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "fix: bind pi traces from problem blocks"
```

---

### Task 3: Align preparation guidance and current documentation

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `docs/zh-CN/完整说明书.md`

- [ ] **Step 1: Update Coach preparation semantics**

In both preparation Skills, state the same compact rule:

- every card attempt is a separate `problem` Block;
- every problem Block has exactly one real alias in `Uses`;
- a set of questions becomes multiple problem Blocks;
- comparison happens afterward in dialogue/reflection;
- missing cards become material/dialogue or a reported content gap, never a
  fabricated alias.

Keep this as teaching guidance, not a parameter tutorial. Do not add an exact-string
test.

- [ ] **Step 2: Update repository and user-facing contracts**

In `AGENTS.md`, record:

- one problem Block equals one card attempt;
- Pi `trace_append` derives card identity from Session-owned Lesson + `blockId`;
- public MCP remains explicit because it has no Pi Session owner.

In `docs/zh-CN/完整说明书.md`, update:

- ActivityBlock examples and first-start admission;
- the Pi subsection of `trace_append`;
- bidirectional card/Trace lookup;
- the distinction between card binding and student-confirmed method evidence.

Remove any sentence claiming Pi Tutor manually supplies a card alias. Keep the public
MCP description accurate.

- [ ] **Step 3: Review documentation scope**

Run:

```bash
rg -n "cardAlias|每个.*problem|problem.*Uses|trace_append" \
  AGENTS.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  docs/zh-CN/完整说明书.md
```

Expected: no contradiction between Pi-derived binding and public-MCP explicit
binding; no promise that malformed historical Trace is migrated.

- [ ] **Step 4: Commit the shared semantics**

```bash
git add AGENTS.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  docs/zh-CN/完整说明书.md
git commit -m "docs: define one-card problem blocks"
```

---

### Task 4: Verify the complete chain and run one real short Lesson

**Files:**
- Create: `docs/superpowers/reports/2026-07-23-problem-block-trace-binding-live.md`

- [ ] **Step 1: Run full automated verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript, all non-E2E Bun tests, and the production Vite build pass.

Run:

```bash
cd ../../plugins/highschool-study
bun run release:check
```

Expected: MCP bundle, typecheck, Bun tests, and strict Claude plugin validation pass;
the public plugin still exposes exactly:

```text
card_search
trace_search
trace_append
source_resolve
```

- [ ] **Step 2: Start from a copied derivative learning set**

Create a temporary copy of `examples/derivative-demo/learning-set`, point the local
Pi runtime at that copy, and start one short Lesson containing:

- one `problem` Block with one real card alias;
- one `reflection` Block;
- no manually supplied `cardAlias` in Tutor tool calls.

Do not run acceptance against the repository fixture in place.

- [ ] **Step 3: Inspect raw and projected facts**

After the student attempt, verify all of the following:

1. raw Pi tool input contains `blockId` and no `cardAlias`;
2. appended Trace contains the exact real `Card:` path from that Block's `Uses`;
3. `card_search` returns the new active Trace in that card's `traceHistory`;
4. `trace_search` returns the Trace and the card in `cardsByPath`;
5. `/api/evidence?source=<trace-anchor>` returns non-null card metadata;
6. planner attention/ability only changes when method evidence is independently
   student-confirmed;
7. a reflection Trace, if written, remains cardless.

- [ ] **Step 4: Record the acceptance result**

Write `docs/superpowers/reports/2026-07-23-problem-block-trace-binding-live.md`
with:

- temporary learning-set path and model/provider name, but no credentials;
- exact Lesson, Block, alias, frozen card path, and Trace anchor;
- `card_search`, `trace_search`, and Evidence View results;
- automated command results;
- any remaining issue, clearly separated from this fix.

- [ ] **Step 5: Commit the acceptance report**

```bash
git add docs/superpowers/reports/2026-07-23-problem-block-trace-binding-live.md
git commit -m "docs: verify problem trace card binding"
```

---

## Completion Criteria

- Every newly compiled or first-started `problem` Block has exactly one authentic
  card alias.
- Pi Tutor cannot choose, omit, or cross-bind a problem card through
  `trace_append`.
- A problem Trace freezes the card path derived from its selected Block.
- Card search, Trace reverse lookup, and Evidence View all resolve the same card.
- Non-problem Trace remains cardless.
- Method evidence remains independently confirmed or unmapped.
- Public Claude MCP behavior and its four-tool surface remain unchanged.
- Full automated checks and one copied-learning-set real-model Lesson pass.
