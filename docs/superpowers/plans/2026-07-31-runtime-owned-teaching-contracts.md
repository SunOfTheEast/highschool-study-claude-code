# Runtime-Owned Teaching Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove four recurring model-owned coordination errors by moving current-Session citation, problem-card binding, successful card resolution, and Block progression semantics into the smallest authoritative Runtime contracts.

**Architecture:** Keep Markdown and internal domain types unchanged. Narrow only the model-facing TypeBox inputs, compile them into existing `CandidateChange` and `LessonBlueprint` values, and keep one Session-local resolution ledger inside `NodeAccessPolicy`. Reuse existing Runtime transition guards and add no new tools, persistent fields, compatibility branch, or state machine.

**Tech Stack:** TypeScript 7, Bun 1.3, TypeBox, Pi coding-agent tools, Markdown domain fixtures.

## Global Constraints

- Preserve the four public Claude MCP tools exactly.
- Add no Agent, tool, database, persistent field, receipt ID, compatibility path, or Block state machine.
- Keep internal `LessonBlueprint.uses` and Lesson Markdown `Uses` unchanged.
- Do not add exact-text tests for Skill prose.
- Preserve unrelated untracked files in the worktree.

---

### Task 1: Make Candidate Session evidence Runtime-owned

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/node-access.ts`
- Modify: `apps/pi-teaching-web/src/runtime/tree-mutations.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/roadmap-update.ts`
- Test: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Test: `apps/pi-teaching-web/tests/runtime/roadmap-update.test.ts`

**Interfaces:**
- Produces: `NodeAccessPolicy.currentSessionSource(): string | null`.
- Produces: `withRuntimeCandidateSources(changes, policy): CandidateChange[]` that rejects model-supplied `session:` and appends the current Session to `add`/`revise` changes.
- Consumes: existing `CandidateSourcePolicy.allows()` and `updateParentDocument()`.

- [ ] **Step 1: Write failing Plan and Roadmap tests**

Add contract checks equivalent to:

```ts
expect(Check(tool.parameters, inputWithSessionSource)).toBeFalse();

await tool.execute('runtime-session', inputWithoutSessionSource as never, ...);
expect(readFileSync(ownerFile, 'utf8')).toContain('session:session-current');

await expect(tool.execute('manual-session', inputWithSessionSource as never, ...))
  .rejects.toThrow('NODE_CANDIDATE_SESSION_SOURCE_RUNTIME_OWNED');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/roadmap-update.test.ts tests/runtime/study-tools.test.ts
```

Expected: schema still accepts `session:` or persisted Candidate lacks the Runtime Session source.

- [ ] **Step 3: Implement the minimal source compilation**

Use a non-session model schema and compile before validation/write:

```ts
const candidateSource = Type.String({
  minLength: 1,
  pattern: '^(?!session:).+$',
});

export type CandidateSourcePolicy = {
  allows(source: string): boolean;
  allowedSources?(): readonly string[];
  currentSessionSource?(): string | null;
};

export function withRuntimeCandidateSources(
  changes: CandidateChange[],
  policy?: CandidateSourcePolicy,
): CandidateChange[] {
  // Reject any caller-supplied session source.
  // Append and deduplicate only policy.currentSessionSource().
}
```

Both update tools must use the compiled changes for `assertCandidateSourcesAllowed` and `updateParentDocument`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Task 1 command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/node-access.ts \
  apps/pi-teaching-web/src/runtime/tree-mutations.ts \
  apps/pi-teaching-web/src/runtime/plan-update.ts \
  apps/pi-teaching-web/src/runtime/roadmap-update.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/runtime/roadmap-update.test.ts
git commit -m "fix: make candidate session sources runtime-owned"
```

### Task 2: Compile `problem.cardAlias` and require resolved cards

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/node-access.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Test: `apps/pi-teaching-web/tests/runtime/node-access.test.ts`
- Test: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

**Interfaces:**
- Produces: `NodeAccessPolicy.recordResolution(resolution): void` and `wasResolved(source): boolean`.
- Produces: model-facing Lesson block union where only `problem` owns `cardAlias`.
- Consumes: existing internal `LessonBlueprint` with `uses: string[]`.

- [ ] **Step 1: Convert the Lesson test input and add failing schema tests**

The desired model input is:

```ts
{
  localAlias: 'attempt',
  kind: 'problem',
  required: true,
  dependsOn: [],
  cardAlias: 'Q-EX22',
  studentView: '请独立完成。',
  teacherControl: '首次采用 zero。',
}
```

Assert that `uses` is rejected, problem without `cardAlias` is rejected, and non-problem `cardAlias` is rejected. Assert the rendered Lesson still contains `- Uses: Q-EX22`.

- [ ] **Step 2: Add failing resolution-ledger tests**

Create one Plan `NodeAccessPolicy`, call the same `source_resolve` tool used by the model, and verify:

```ts
expect(policy.wasResolved(cardSource)).toBe(false);
await sourceResolve.execute('resolve-card', { source: cardSource }, ...);
expect(policy.wasResolved(cardSource)).toBe(true);
```

Then prove these three Lesson outcomes without file mutation on rejection:

1. searched but not resolved → `LESSON_CARD_NOT_RESOLVED`;
2. a different card resolved → same rejection;
3. selected card resolved → Lesson writes successfully.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/node-access.test.ts tests/runtime/study-tools.test.ts
```

Expected: `cardAlias` schema and resolution ledger assertions fail before implementation.

- [ ] **Step 4: Implement the model-input compiler and ledger**

Create a discriminated TypeBox block union. Compile before calling existing validators:

```ts
const blueprint: LessonBlueprint = {
  ...input.blueprint,
  adjustments: input.blueprint.adjustments ?? [],
  blocks: input.blueprint.blocks.map((block) => ({
    ...block,
    uses: block.kind === 'problem' ? [block.cardAlias] : [],
  })),
};
```

Do not expose `uses` in the model schema. Add a successful-resolution set to `NodeAccessPolicy`; only the `source_resolve` tool records a valid result. Before `materializeChild`, resolve each selected alias through `blueprint.cards` and require `card:<cardPath>` in that set. Wire the existing Plan Session `accessPolicy` into `createLessonPrepareTool`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 2 command. Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/node-access.ts \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/runtime/node-access.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "fix: require resolved problem cards for lesson preparation"
```

### Task 3: Clarify Trace and Block progression at the contract boundary

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Test: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

**Interfaces:**
- Produces: successful `trace_append` payload field `blockState: 'unchanged'`.
- Preserves: existing `classroom_update` actions and Runtime transition rules.

- [ ] **Step 1: Write the failing receipt test**

Extend an existing successful Trace assertion:

```ts
expect(appended.blockState).toBe('unchanged');
```

Do not add a Skill text snapshot test.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts -t "binds a Tutor Trace"
```

Expected: `blockState` is absent.

- [ ] **Step 3: Add only contract wording and the receipt fact**

Return `blockState: 'unchanged'` from `trace_append`; explain in both tool descriptions that Trace persistence never completes or activates a Block. State on `classroom_update.activate` that an existing active Block must be completed or skipped first.

In Coach Skill, use `problem.cardAlias` and make the pre-solve route protocol explicitly part of the same multi-turn problem Block. In Tutor Skill, state that a problem Block may span many turns and that `trace_append` leaves it active until an explicit classroom transition.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 3 command. Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/src/runtime/classroom-update.ts \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "fix: separate trace persistence from block progression"
```

### Task 4: Verify, integrate, and reinstall

**Files:**
- Modify: none unless verification exposes a defect in Tasks 1–3.

**Interfaces:**
- Consumes: all preceding contracts.
- Produces: one tested mainline and refreshed local Pi installation.

- [ ] **Step 1: Run whitespace and targeted checks**

```bash
git diff --check
cd apps/pi-teaching-web
bun test tests/runtime/node-access.test.ts tests/runtime/roadmap-update.test.ts tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts
```

- [ ] **Step 2: Run the complete Pi verification**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
```

Expected: typecheck, unit tests, production build, and Playwright all pass.

- [ ] **Step 3: Confirm scope and public MCP count**

```bash
git status --short
git diff --stat main...HEAD
cd plugins/highschool-study
bun run release:check
```

Expected: only named files plus this design/plan changed; plugin release check preserves four tools.

- [ ] **Step 4: Fast-forward local `main` and reinstall Pi**

From the primary checkout, fast-forward `main` to the verified feature branch. Then use the repository's documented local install command or script to refresh the Pi runtime from `main`; do not copy credentials or local Session files.

- [ ] **Step 5: Report exact evidence**

Report commit hashes, test counts, installed source commit, and the one intentional residual boundary: the Runtime enforces card identity and transitions, while natural multi-turn teaching inside one problem Block remains a Skill-level teaching judgment.
