# Deterministic Lesson Writes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unrestricted Lesson `edit/write` with two node-bound Pi tools that append classroom facts and safely mutate Block state or pending structure without corrupting Lesson Markdown.

**Architecture:** Lesson Markdown remains the only durable teaching fact. Pure source transforms operate on one parsed Lesson, a synchronous atomic file primitive validates before and after every write, and two custom tools expose only irreducible Tutor judgments while Runtime binds path, current Block, IDs, lifecycle, and persistence. Roadmap and Plan retain their existing tool surfaces.

**Tech Stack:** Bun 1.3, TypeScript 7 strict mode, TypeBox through `@earendil-works/pi-ai`, Pi Coding Agent 0.81, Bun test, React/Vite, Playwright.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/gentle-judgment-isomorphic-acceptance` on branch `codex/gentle-judgment-isomorphic-acceptance`.
- Preserve all unrelated dirty-worktree changes; stage and commit only files named by the current task.
- Lesson Markdown is the sole classroom-fact store; do not add Trace, Handoff, Route Change, projection, BKT, or another database.
- Lesson top-level `prepared → active → closed` remains student-UI-owned.
- Lesson Tutor keeps its read-side tools but loses native `edit/write`; Roadmap and Plan tools remain unchanged.
- Tools behave like native edit primitives, not a new teaching workflow: normal turns call neither tool.
- Use TDD for every behavior change and make no success claim without fresh verification output.

---

## File Structure

- `apps/pi-teaching-web/src/study/markdown.ts`: parse a candidate Lesson string without first writing it to disk.
- `apps/pi-teaching-web/src/study/lesson-mutations.ts`: pure/scoped Classroom Log and Block source transformations plus invariants.
- `apps/pi-teaching-web/src/runtime/atomic-document.ts`: path-bound, compare-before-commit, temporary-file atomic replacement.
- `apps/pi-teaching-web/src/runtime/frontmatter.ts`: route existing frontmatter writes through the atomic primitive and validate Lesson candidates.
- `apps/pi-teaching-web/src/runtime/lesson-tools.ts`: define `classroom_log_append` and `classroom_update` schemas, execution, and transient receipts.
- `apps/pi-teaching-web/src/runtime/session-scope.ts`: give Lesson Sessions read tools plus the two custom tool names, without `edit/write`.
- `apps/pi-teaching-web/src/runtime/session-factory.ts`: instantiate node-bound Lesson tools and pass them as Pi `customTools`.
- `apps/pi-teaching-web/src/server/app.ts`: invalidate Course after successful Lesson custom-tool writes.
- `apps/pi-teaching-web/resources/agents/lesson-node.md`: state the Lesson write authority once.
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`: replace direct-edit instructions with three natural tool triggers.
- `AGENTS.md`: document the actual role-specific tool surface.
- `apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts`: source mutation and invariant tests.
- `apps/pi-teaching-web/tests/m0/atomic-document.test.ts`: candidate validation, stale-source, and all-or-nothing tests.
- `apps/pi-teaching-web/tests/m0/lesson-tools.test.ts`: tool schema, runtime binding, receipts, and failure preservation.
- `apps/pi-teaching-web/tests/m0/native-session.test.ts`: role-specific tool/resource assembly.
- `apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts`: atomic Lesson lifecycle/frontmatter regression.
- `apps/pi-teaching-web/tests/m0/server-api.test.ts`: Course invalidation after custom tools.
- `docs/audits/2026-08-05-deterministic-lesson-writes-long-cycle.md`: final real-student long-cycle result.

---

### Task 1: Parse and Transform One Lesson Safely

**Files:**
- Modify: `apps/pi-teaching-web/src/study/markdown.ts`
- Create: `apps/pi-teaching-web/src/study/lesson-mutations.ts`
- Create: `apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts`

**Interfaces:**
- Produces: `parseLessonSource(path: string, raw: string): LessonDocument`.
- Produces: `LessonBlockDraft`, `ClassroomChange`, `ClassroomMutationReceipt`.
- Produces: `appendClassroomLogSource(path, source, note)` and `applyClassroomChange(root, path, source, change)`.

- [ ] **Step 1: Write failing candidate-parser and safe-log tests**

```ts
test('parses a candidate Lesson source without touching disk', () => {
  const source = readFileSync(join(root, lessonPath), 'utf8');
  expect(parseLessonSource(lessonPath, source).blocks).toHaveLength(2);
});

test('appends multiline evidence inside one log item without swallowing the next Block', () => {
  const next = appendClassroomLogSource(lessonPath, source, [
    '学生首次没有识别结构。',
    '## Block injected',
    '- Status: completed',
  ].join('\n'));
  const lesson = parseLessonSource(lessonPath, next);
  expect(lesson.blocks.map((block) => block.id)).toEqual(['block-001', 'block-002']);
  expect(lesson.blocks[1]?.classroomLog).toHaveLength(1);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd apps/pi-teaching-web && bun test tests/m0/lesson-mutations.test.ts`

Expected: FAIL because `parseLessonSource` and `lesson-mutations.ts` do not exist.

- [ ] **Step 3: Refactor the Lesson parser to accept raw source**

Extract frontmatter parsing from `readSource` into a path-bound helper and make disk reads delegate to it:

```ts
function parseSource(path: string, raw: string) {
  // existing frontmatter/body parsing and StudyDocumentError behavior
}

export function parseLessonSource(path: string, raw: string): LessonDocument {
  const source = parseSource(path, raw);
  // existing readLesson validation and projection
}

export function readLesson(root: string, requestedPath: string): LessonDocument {
  const source = readSource(root, requestedPath);
  return parseLessonSource(source.path, source.raw);
}
```

- [ ] **Step 4: Implement structural spans and safe log rendering**

Define one source span per canonical Block and one safely indented list item:

```ts
export function appendClassroomLogSource(
  path: string,
  source: string,
  note: string,
): string {
  const lesson = parseLessonSource(path, source);
  const active = lesson.blocks.filter((block) => block.status === 'active');
  if (lesson.status !== 'active') throw new StudyDocumentError(path, 'Lesson must be active');
  if (active.length !== 1) throw new StudyDocumentError(path, 'expected exactly one active Block');
  const lines = note.trim().split(/\r?\n/);
  if (!lines[0]) throw new StudyDocumentError(path, 'classroom note cannot be empty');
  const rendered = [`- ${lines[0]}`, ...lines.slice(1).map((line) => `  ${line}`)].join('\n');
  return appendInsideExactClassroomLog(source, active[0]!.id, rendered);
}
```

- [ ] **Step 5: Add RED tests for every classroom command and invariant**

Cover `start`, atomic `advance`, `insert`, full `revise`, `move`, and `skip_pending`. Assert:

```ts
expect(() => applyClassroomChange(root, lessonPath, source, invalidChange))
  .toThrow(StudyDocumentError);
expect(source).toBe(before);
expect(parseLessonSource(lessonPath, valid.source).blocks.filter(
  (block) => block.status === 'active',
)).toHaveLength(1);
```

Also cover empty-log advance, unresolved dependencies, cycles, self anchors, immutable active/completed/skipped content, generated `block-003` IDs, exact placement, and `Uses` expansion beyond the current active Block.

- [ ] **Step 6: Implement the discriminated source changes**

```ts
export type LessonBlockDraft = {
  title: string;
  kind: ActivityKind;
  required: boolean;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
};

export type ClassroomChange =
  | { command: 'start'; blockId: string }
  | { command: 'advance'; outcome: 'completed' | 'skipped'; nextBlockId: string | null }
  | { command: 'insert'; placement: BlockPlacement; block: LessonBlockDraft }
  | { command: 'revise'; blockId: string; block: LessonBlockDraft }
  | { command: 'move'; blockId: string; placement: BlockPlacement }
  | { command: 'skip_pending'; blockId: string };

export function applyClassroomChange(
  root: string,
  path: string,
  source: string,
  change: ClassroomChange,
): ClassroomMutationReceipt {
  // parse current source, apply one scoped command, parse candidate,
  // compare immutable facts, validate dependencies/Uses, return source + cursor
}
```

For inserted `Uses`, require a subset of current active `Uses`; for revised pending Blocks, allow the union of that Block's existing `Uses` and current active `Uses`. Require every referenced file to resolve inside the learning set and exist.

- [ ] **Step 7: Run Task 1 tests and commit**

Run: `cd apps/pi-teaching-web && bun test tests/m0/lesson-mutations.test.ts tests/m0/markdown-domain.test.ts`

Expected: PASS.

Commit:

```bash
git add apps/pi-teaching-web/src/study/markdown.ts \
  apps/pi-teaching-web/src/study/lesson-mutations.ts \
  apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts
git commit -m "feat: add safe lesson source mutations"
```

---

### Task 2: Make Lesson Writes Atomic

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/atomic-document.ts`
- Modify: `apps/pi-teaching-web/src/runtime/frontmatter.ts`
- Modify: `apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts`
- Create: `apps/pi-teaching-web/tests/m0/atomic-document.test.ts`

**Interfaces:**
- Consumes: `parseLessonSource(path, raw)` from Task 1.
- Produces: `mutateDocumentAtomically<T>(root, path, transform, validate): T`.
- Preserves: synchronous `setFrontmatterField(...)` and `transitionNode(...)` call sites.

- [ ] **Step 1: Write failing all-or-nothing tests**

```ts
test('does not replace the document when candidate validation fails', () => {
  const before = readFileSync(absolute, 'utf8');
  expect(() => mutateDocumentAtomically(root, path, () => ({
    source: before.replace('## Block block-002', ''),
    value: undefined,
  }), (candidate) => parseLessonSource(path, candidate))).toThrow();
  expect(readFileSync(absolute, 'utf8')).toBe(before);
});

test('does not overwrite a source changed during the mutation', () => {
  expect(() => mutateDocumentAtomically(root, path, (before) => {
    writeFileSync(absolute, before.replace('真实停点问诊', '外部新版本'));
    return { source: before.replace('真实停点问诊', '候选版本'), value: undefined };
  }, (candidate) => parseLessonSource(path, candidate))).toThrow('SOURCE_STALE');
  expect(readFileSync(absolute, 'utf8')).toContain('外部新版本');
});
```

- [ ] **Step 2: Confirm RED**

Run: `cd apps/pi-teaching-web && bun test tests/m0/atomic-document.test.ts`

Expected: FAIL because `atomic-document.ts` does not exist.

- [ ] **Step 3: Implement same-directory atomic replacement**

```ts
export function mutateDocumentAtomically<T>(
  root: string,
  path: string,
  transform: (source: string) => { source: string; value: T },
  validate: (source: string) => unknown = () => undefined,
): T {
  const absolute = resolveDocumentPath(root, path);
  const before = readFileSync(absolute, 'utf8');
  validate(before);
  const candidate = transform(before);
  validate(candidate.source);
  const temporary = join(dirname(absolute), `.${basename(absolute)}.${randomUUID()}.tmp`);
  writeFileSync(temporary, candidate.source, { encoding: 'utf8', flag: 'wx' });
  try {
    if (readFileSync(absolute, 'utf8') !== before) {
      throw new StudyDocumentError(path, 'SOURCE_STALE');
    }
    renameSync(temporary, absolute);
    return candidate.value;
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
```

Keep every filesystem operation synchronous so UI lifecycle and tool execution cannot interleave within the single Bun server process.

- [ ] **Step 4: Route frontmatter writes through the primitive**

Keep the existing public signature, extract a pure frontmatter replacement, and validate both sides whenever `path.startsWith('lessons/')`:

```ts
const validate = path.startsWith('lessons/')
  ? (source: string) => parseLessonSource(path, source)
  : () => undefined;
mutateDocumentAtomically(root, path, (source) => ({
  source: replaceFrontmatterField(source, path, field, value, expected),
  value: undefined,
}), validate);
```

- [ ] **Step 5: Verify lifecycle and session-ID writes preserve Lesson structure**

Extend `node-lifecycle.test.ts` to compare all Block bodies before and after start/close and to verify a failed expected status leaves the complete file byte-identical.

- [ ] **Step 6: Run Task 2 tests and commit**

Run: `cd apps/pi-teaching-web && bun test tests/m0/atomic-document.test.ts tests/m0/node-lifecycle.test.ts tests/m0/native-session.test.ts`

Expected: PASS.

Commit:

```bash
git add apps/pi-teaching-web/src/runtime/atomic-document.ts \
  apps/pi-teaching-web/src/runtime/frontmatter.ts \
  apps/pi-teaching-web/tests/m0/atomic-document.test.ts \
  apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts
git commit -m "feat: make lesson writes atomic"
```

---

### Task 3: Define the Two Node-Bound Pi Tools

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Create: `apps/pi-teaching-web/tests/m0/lesson-tools.test.ts`

**Interfaces:**
- Consumes: Task 1 source transformations and Task 2 atomic writer.
- Produces: `createLessonTools(root: string, lessonPath: string)` returning exactly `classroom_log_append` and `classroom_update`.

- [ ] **Step 1: Write failing schema-boundary tests**

```ts
const tools = createLessonTools(root, lessonPath);
expect(tools.map((tool) => tool.name)).toEqual([
  'classroom_log_append',
  'classroom_update',
]);
const schemas = JSON.stringify(tools.map((tool) => tool.parameters));
for (const forbidden of ['lessonPath', 'sessionId', 'timestamp', 'currentBlockId']) {
  expect(schemas).not.toContain(forbidden);
}
expect((tools[1]!.parameters as { type?: string }).type).toBe('object');
```

- [ ] **Step 2: Write failing execution and preservation tests**

Call each tool through its five-argument Pi `execute` signature. Assert the log tool safely appends to the active Block, every update branch returns the current cursor, and invalid input leaves the source byte-identical.

- [ ] **Step 3: Confirm RED**

Run: `cd apps/pi-teaching-web && bun test tests/m0/lesson-tools.test.ts`

Expected: FAIL because `createLessonTools` does not exist.

- [ ] **Step 4: Implement a top-level object schema with discriminated nested changes**

```ts
const parameters = Type.Object({
  change: Type.Union([
    Type.Object({ command: Type.Literal('start'), blockId }),
    Type.Object({
      command: Type.Literal('advance'),
      outcome: Type.Union([Type.Literal('completed'), Type.Literal('skipped')]),
      nextBlockId: Type.Union([blockId, Type.Null()]),
    }),
    insertSchema,
    reviseSchema,
    moveSchema,
    Type.Object({ command: Type.Literal('skip_pending'), blockId }),
  ]),
}, { additionalProperties: false });
```

The object wrapper avoids the provider failure mode of a top-level union while preserving branch-specific required fields.

- [ ] **Step 5: Bind executions and return transient JSON receipts**

```ts
export function createLessonTools(root: string, lessonPath: string) {
  return [
    defineTool({
      name: 'classroom_log_append',
      parameters: Type.Object({ note: Type.String({ minLength: 1 }) }),
      execute: async (_id, { note }) => receipt(mutateDocumentAtomically(
        root,
        lessonPath,
        (source) => appendLogMutation(lessonPath, source, note),
        (source) => parseLessonSource(lessonPath, source),
      )),
    }),
    defineTool({
      name: 'classroom_update',
      parameters,
      execute: async (_id, { change }) => receipt(mutateDocumentAtomically(
        root,
        lessonPath,
        (source) => applyClassroomChange(root, lessonPath, source, change),
        (source) => parseLessonSource(lessonPath, source),
      )),
    }),
  ];
}
```

- [ ] **Step 6: Run Task 3 tests and commit**

Run: `cd apps/pi-teaching-web && bun test tests/m0/lesson-tools.test.ts tests/m0/lesson-mutations.test.ts`

Expected: PASS.

Commit:

```bash
git add apps/pi-teaching-web/src/runtime/lesson-tools.ts \
  apps/pi-teaching-web/tests/m0/lesson-tools.test.ts
git commit -m "feat: add deterministic lesson tools"
```

---

### Task 4: Wire Tools into Lesson Sessions and UI Invalidation

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/server-api.test.ts`

**Interfaces:**
- Consumes: `createLessonTools(root, scope.nodePath)`.
- Produces: Lesson model tool list `read, grep, find, ls, classroom_log_append, classroom_update`.

- [ ] **Step 1: Change assembly expectations first**

```ts
expect(loadStaticNodeResources(root, lessonScope).tools).toEqual([
  'read', 'grep', 'find', 'ls', 'classroom_log_append', 'classroom_update',
]);
expect(loadStaticNodeResources(root, roadmapScope).tools).toEqual([
  'read', 'grep', 'find', 'ls', 'edit', 'write',
]);
```

Add a server event test proving a successful `classroom_log_append` or `classroom_update` emits `course-invalidated`, while a failed tool result emits none.

- [ ] **Step 2: Confirm RED**

Run: `cd apps/pi-teaching-web && bun test tests/m0/native-session.test.ts tests/m0/server-api.test.ts`

Expected: FAIL because Lesson still receives native `edit/write` and the server ignores custom tool names.

- [ ] **Step 3: Add the Lesson-specific tool allowlist**

```ts
export const LESSON_MODEL_TOOLS = [
  'read', 'grep', 'find', 'ls', 'classroom_log_append', 'classroom_update',
] as const;

export function modelToolsForNode(kind: NodeKind): readonly string[] {
  if (kind === 'lesson') return LESSON_MODEL_TOOLS;
  return kind === 'plan' ? PLAN_MODEL_TOOLS : M0_MODEL_TOOLS;
}
```

- [ ] **Step 4: Register only the tools bound to the current Lesson scope**

```ts
const customTools = scope.nodeKind === 'lesson'
  ? createLessonTools(root, scope.nodePath)
  : [];
const { session } = await createAgentSession({
  // existing inputs
  customTools,
  tools: [...modelToolsForNode(scope.nodeKind)],
});
```

- [ ] **Step 5: Refresh Course only after successful custom writes**

Extend the existing `tool_execution_end` handler so the two Lesson custom tool names publish `course-invalidated`; do not publish `knowledge-invalidated` because neither tool changes static knowledge.

- [ ] **Step 6: Run Task 4 tests and commit**

Run: `cd apps/pi-teaching-web && bun test tests/m0/native-session.test.ts tests/m0/server-api.test.ts tests/m0/lesson-tools.test.ts`

Expected: PASS.

Commit:

```bash
git add apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/tests/m0/native-session.test.ts \
  apps/pi-teaching-web/tests/m0/server-api.test.ts
git commit -m "feat: bind lesson sessions to safe writes"
```

---

### Task 5: Make the Tool Boundary Minimal in Agent and Skill Resources

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: the two tool names and commands from Tasks 3–4.
- Produces: three bright-line triggers with no duplicated tool schema or state-machine tutorial.

- [ ] **Step 1: Add boundary-level resource assertions**

Assert assembled Lesson resources name both structured write tools, contain no instruction to use a narrow native `edit`, retain UI-owned top-level lifecycle, and do not copy the six command schemas into both Agent and Skill.

- [ ] **Step 2: Confirm RED**

Run: `cd apps/pi-teaching-web && bun test tests/m0/native-session.test.ts`

Expected: FAIL because current Lesson resources still instruct the Tutor to use `edit`.

- [ ] **Step 3: Replace only the write instructions**

Keep teaching judgment unchanged and express the tool route once:

```text
影响后续判断的事实 → classroom_log_append
活动真正开始、结束或切换 → classroom_update
现有 pending 路线不再适合 → classroom_update 的适应命令
其余教学轮次 → 不调用写入工具
```

The Agent owns permission and lifecycle; the Skill owns when evidence or a real Block boundary exists. Parameter details remain in tool schemas.

- [ ] **Step 4: Update the repository guide**

Document that Roadmap and Plan retain native writes, while Lesson has read-side native tools plus the two node-bound custom writes. Do not describe Trace or a new persistence layer.

- [ ] **Step 5: Run resource tests and commit**

Run: `cd apps/pi-teaching-web && bun test tests/m0/native-session.test.ts`

Expected: PASS.

Commit only these resource changes together with their focused test:

```bash
git add AGENTS.md \
  apps/pi-teaching-web/resources/agents/lesson-node.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/tests/m0/native-session.test.ts
git commit -m "docs: teach lesson agents safe write triggers"
```

---

### Task 6: Verify Deterministic Runtime and Browser Closure

**Files:**
- Modify only if a discovered defect requires an in-scope fix.

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: a clean deterministic verification record.

- [ ] **Step 1: Run all focused tests together**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/lesson-mutations.test.ts \
  tests/m0/atomic-document.test.ts \
  tests/m0/lesson-tools.test.ts \
  tests/m0/node-lifecycle.test.ts \
  tests/m0/native-session.test.ts \
  tests/m0/server-api.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run the full application check**

Run: `cd apps/pi-teaching-web && bun run check`

Expected: TypeScript, all non-E2E Bun tests, and Vite build pass.

- [ ] **Step 3: Run deterministic browser closure**

Run: `cd apps/pi-teaching-web && bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`

Expected: PASS; student lifecycle still starts and closes Lesson/Plan through the UI.

- [ ] **Step 4: Review the final diff for scope and accidental writes**

Run: `git diff --check && git status --short && git log --oneline -8`

Expected: no whitespace errors; unrelated pre-existing changes remain preserved.

---

### Task 7: Run the Real-Student Long-Cycle Acceptance

**Files:**
- Create: `docs/audits/2026-08-05-deterministic-lesson-writes-long-cycle.md`
- Reuse: `apps/pi-teaching-web/scripts/export-pi-cot.ts`

**Interfaces:**
- Consumes: the verified local App and existing Pi model configuration.
- Produces: preserved clean learning-set root, Session JSONL/CoT paths, artifact verdict, and failure localization if applicable.

- [ ] **Step 1: Create a fresh copied learning set and start an isolated App**

Use `mktemp -d` for the exact run root, copy the public M0 learning set into it, record the resolved path, and launch the server on a free localhost port. Never reuse or repair the failed `/tmp/studyforge-long-cycle.nBlcpH` source.

- [ ] **Step 2: Simulate one genuinely uncertain student from Roadmap through Plan completion**

The student must discuss and explicitly confirm the Roadmap and first Plan, collaborate on each next Lesson, use the UI for activation/closure, and respond according to a stable but imperfect learner profile. Lesson count remains dynamic. Do not remind the model about tools, fix Markdown, or steer it around an invalid state.

- [ ] **Step 3: Exercise the safe-write boundary naturally**

Require ordinary evidence logging and Block progression in every Lesson. Include at least one authentic response that makes the prepared pending route inappropriate so `insert`, `revise`, `move`, or `skip_pending` can arise from teaching need rather than a synthetic tool command.

- [ ] **Step 4: Validate artifacts after every lifecycle boundary**

Fetch `/api/course`, directly parse `ROADMAP.md`, every linked Plan, and every linked Lesson, and verify no orphan or duplicate Tree entry. Stop immediately at the first failed invariant and preserve the workspace unchanged.

- [ ] **Step 5: Export CoT and write the evidence-based audit**

Record:

- whether every tool call succeeded on first hit;
- whether any normal teaching turn called a write tool unnecessarily;
- whether the Tutor exposed state-management chatter;
- whether logs distinguish first performance, help, and post-help performance;
- whether every linked Lesson closed and the first Plan completed;
- exact workspace, Session, CoT, and artifact paths.

Write the verdict to `docs/audits/2026-08-05-deterministic-lesson-writes-long-cycle.md` and commit only the audit file if the run finishes.

---

## Plan Self-Review Record

- Spec coverage: both tools, all six update branches, Runtime binding, atomic persistence, lifecycle concurrency, Session wiring, minimal Agent/Skill exposure, deterministic tests, browser closure, and real long-cycle acceptance are mapped to tasks.
- Placeholder scan: no deferred implementation placeholders; future modules such as cross-Plan memory remain outside scope.
- Type consistency: `ClassroomChange`, `LessonBlockDraft`, `ClassroomMutationReceipt`, `parseLessonSource`, `mutateDocumentAtomically`, and `createLessonTools` have one spelling and owner throughout the plan.
