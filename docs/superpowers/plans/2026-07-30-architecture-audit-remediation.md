# StudyForge Architecture Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Trace 跨 Block 更正、课堂 Block 状态矛盾、普通来源未验证、Learning Review 失败不可恢复和跨周期过度归纳，同时保持 Markdown-first、两类 Agent、现有 Session 分层和四工具公共 MCP 不变。

**Architecture:** Trace 局部性由共享 domain 和 Pi attempt gate 双层保证；课堂写入通过一个纯字符串转换模块在单次 Lesson 写入中应用 Block 与 Route Change；来源和 Learning Review 候选复用现有 resolver 与 active Trace。教学归纳继续留在 Skill，云端权限、跨文件事务和 generic 工具 allowlist 不进入本轮。

**Tech Stack:** Bun 1.3.14、TypeScript 7、TypeBox 1.3、Pi 0.81、React 19、Markdown、Playwright 1.61、Claude Code plugin/MCP。

## Global Constraints

- 不增加数据库、向量库、后台索引、Route occurrence、持久 Blueprint、额外 Agent、自动 mastery 判决或通用状态机框架。
- Claude Code 插件公共 MCP 工具严格保持 `card_search`、`trace_search`、`trace_append`、`source_resolve` 四个。
- 不增加或迁移持久 schema 字段；现有 Roadmap、Plan、Lesson、Trace、profile 和 Session owner 结构保持不变。
- 模型只提交教学判断；runtime 绑定 owner path、当前 Lesson、真实 Block、card alias、active Trace 和来源资格。
- Route Changes 是可重放的路线决定，不升级为自动课堂调度器；Block status 仍是当前执行事实。
- 不测试 Agent / Skill 的逐字文案、标题或关键词；只测试可执行 schema、校验、写入、投影和组件行为。
- 所有 mutation 或真实模型验收使用 learning-set 副本，不能修改 `examples/derivative-demo/learning-set`。
- 每个任务只提交本任务列出的文件；保留现有 `.superpowers/` 和其他无关未跟踪文件。

---

## Task 1: 将 Trace supersede 限制在同一 Block active chain

**Files:**

- Modify: `plugins/highschool-study/server/src/traces.ts:285-313`
- Modify: `plugins/highschool-study/tests/integration/trace-records.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts:59-77`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts:518-590`

**Interfaces:**

- Consumes: `readTraceRecords(root, [lessonPath])`, `readActiveTraces(root, [lessonPath])`, canonical `cardPath` resolved by `appendTrace`.
- Produces: no new public export; `appendTrace()` rejects stale, cross-Block and cross-card supersede targets before file mutation; Pi `assertProblemAttemptBoundary()` requires the current Block's exact active event.

- [ ] **Step 1: Write failing shared-domain tests**

Add `copyFileSync` to the existing `node:fs` import, then add a helper near the top of
`trace-records.test.ts`. The helper must copy the second authentic card before registering its alias
and must insert the Block before `## Aliases`; the current fixture has no `## Lesson Summary`:

```ts
function addSecondProblemBlock(root: string): void {
  copyFileSync(
    join(
      import.meta.dir,
      '../../subject-packs/highschool-math/cards/conics/freeze-variable-transfer-02.yaml',
    ),
    join(root, 'cards/conics/freeze-variable-transfer-02.yaml'),
  );
  const lessonPath = join(root, 'lessons/lesson-001.md');
  const source = readFileSync(lessonPath, 'utf8')
    .replace(
      '- Q-FREEZE-01: ../cards/conics/freeze-variable-01.yaml',
      [
        '- Q-FREEZE-01: ../cards/conics/freeze-variable-01.yaml',
        '- Q-FREEZE-02: ../cards/conics/freeze-variable-transfer-02.yaml',
      ].join('\n'),
    )
    .replace(
      '## Aliases',
      `## Block step-03

### Node State

- Kind: problem
- Required: true
- Status: pending
- Depends on: step-02
- Uses: Q-FREEZE-02

### Student View

Complete the transfer problem.

### Teacher Control

Observe transfer.

## Aliases`,
    );
  writeFileSync(lessonPath, source);
}
```

Add three tests:

```ts
test('rejects superseding an active Trace from another Block', () => {
  const root = makeLearningSetWithLesson();
  addSecondProblemBlock(root);
  appendTrace(root, input, () => new Date('2026-07-30T00:00:00Z'));

  expect(() => appendTrace(root, {
    ...input,
    blockId: 'step-03',
    cardAlias: 'Q-FREEZE-02',
    cardStepId: null,
    supersedes: 'event-001',
  }, () => new Date('2026-07-30T00:05:00Z')))
    .toThrow(/INVALID_TRACE.*same Block/);
  expect(readTraceRecords(root)).toHaveLength(1);
});

test('rejects superseding an active Trace with another card binding', () => {
  const root = makeLearningSetWithLesson();
  addSecondProblemBlock(root);
  appendTrace(root, input, () => new Date('2026-07-30T00:00:00Z'));

  expect(() => appendTrace(root, {
    ...input,
    cardAlias: 'Q-FREEZE-02',
    cardStepId: null,
    supersedes: 'event-001',
  }, () => new Date('2026-07-30T00:05:00Z')))
    .toThrow(/INVALID_TRACE.*same card binding/);
  expect(readTraceRecords(root)).toHaveLength(1);
});

test('rejects superseding a stale event', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, input, () => new Date('2026-07-30T00:00:00Z'));
  appendTrace(root, {
    ...input,
    supersedes: 'event-001',
  }, () => new Date('2026-07-30T00:05:00Z'));

  expect(() => appendTrace(root, {
    ...input,
    supersedes: 'event-001',
  }, () => new Date('2026-07-30T00:10:00Z')))
    .toThrow(/INVALID_TRACE.*active/);
  expect(readTraceRecords(root)).toHaveLength(2);
});

test('accepts the exact active Trace from the same Block and card', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, input, () => new Date('2026-07-30T00:00:00Z'));
  expect(() => appendTrace(root, {
    ...input,
    assessment: 'correct',
    supersedes: 'event-001',
  }, () => new Date('2026-07-30T00:05:00Z'))).not.toThrow();
  expect(readActiveTraces(root).map((record) => record.eventId)).toEqual(['event-002']);
});
```

- [ ] **Step 2: Run the shared-domain tests and confirm the three new rejection cases fail**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/trace-records.test.ts
```

Expected: cross-Block, cross-card and stale-target tests fail because current code checks only that
the event exists in the Lesson; the existing same-Block supersede test passes.

- [ ] **Step 3: Add one local supersede validator to `traces.ts`**

Add:

```ts
function validateSupersedes(
  currentRecords: TraceRecord[],
  activeRecords: TraceRecord[],
  input: Pick<TraceAppendInput, 'blockId' | 'supersedes'>,
  cardPath: string | null,
): void {
  if (input.supersedes === null) return;
  const target = currentRecords.find((record) => record.eventId === input.supersedes);
  if (!target) traceError('Superseded event does not exist in this Lesson');
  if (!activeRecords.some((record) => record.eventId === target.eventId)) {
    traceError(`Superseded event must be active: ${target.eventId}`);
  }
  if (target.blockId !== input.blockId) {
    traceError(
      `Superseded event must belong to the same Block: `
      + `requested=${input.blockId}; target=${target.blockId}`,
    );
  }
  if (target.cardPath !== cardPath) {
    traceError(
      `Superseded event must keep the same card binding: `
      + `requested=${cardPath ?? '(none)'}; target=${target.cardPath ?? '(none)'}`,
    );
  }
}
```

Replace the existing existence-only check with:

```ts
const currentRecords = readTraceRecords(root, [lessonPath]);
validateSupersedes(
  currentRecords,
  readActiveTraces(root, [lessonPath]),
  input,
  cardPath,
);
```

Do not add a new exported graph, revision field or automatic summary rewrite.

- [ ] **Step 4: Add failing Pi attempt tests**

Extend the existing `rejects a second independent active Trace in the same problem Block` area with a separate test:

```ts
test('rejects a supersede target when the selected Block has no active attempt', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-cross-block-supersede-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-30T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const attempt = {
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成。',
    methodStatus: 'unmapped',
    methodRoute: '学生完成一条推理链。',
  };

  await trace.execute('first', {
    ...attempt,
    blockId: 'assessment-01',
  } as never, undefined, undefined, {} as never);
  await expect(trace.execute('cross-block', {
    ...attempt,
    blockId: 'assessment-02',
    supersedes: 'event-001',
  } as never, undefined, undefined, {} as never))
    .rejects.toThrow(/TRACE_SUPERSEDES_WITHOUT_ACTIVE_ATTEMPT.*assessment-02/);
  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md'])).toHaveLength(1);
});
```

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
```

Expected: the new test fails because `active.length === 0` currently permits any `supersedes`.

- [ ] **Step 5: Make the Pi gate require the exact current active event**

Replace `assertProblemAttemptBoundary()` with:

```ts
function assertProblemAttemptBoundary(
  root: string,
  lessonPath: string,
  blockId: string,
  cardAlias: string | null,
  supersedes: string | undefined,
): void {
  if (cardAlias === null) return;
  const active = readActiveTraces(root, [lessonPath])
    .filter((record) => record.blockId === blockId);
  if (active.length === 0) {
    if (supersedes !== undefined) {
      throw new Error(
        `TRACE_SUPERSEDES_WITHOUT_ACTIVE_ATTEMPT: block=${blockId}; `
        + `requested=${supersedes}`,
      );
    }
    return;
  }
  if (active.length > 1) {
    throw new Error(
      `TRACE_ATTEMPT_ACTIVE_CONFLICT: block=${blockId}; `
      + `active=${active.map((record) => record.eventId).join(',')}`,
    );
  }
  if (supersedes === active[0]!.eventId) return;
  throw new Error(
    `TRACE_ATTEMPT_ALREADY_ACTIVE: block=${blockId}; `
    + `active=${active[0]!.eventId}; `
    + '同一 problem Block 只表示一次独立作答。补全、更正或方法确认必须 '
    + 'supersede 当前 active Trace；另一题问需要新的 problem Block',
  );
}
```

- [ ] **Step 6: Run focused and package verification**

```bash
cd plugins/highschool-study
bun test tests/integration/trace-records.test.ts
bun run typecheck

cd ../../apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: all focused tests pass and both packages type-check.

- [ ] **Step 7: Commit Task 1**

```bash
git add plugins/highschool-study/server/src/traces.ts \
  plugins/highschool-study/tests/integration/trace-records.test.ts \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "fix: keep trace supersession within one block attempt"
```

---

## Task 2: Apply minimal classroom transitions in one Lesson write

**Files:**

- Create: `apps/pi-teaching-web/src/study/classroom-transition.ts`
- Modify: `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts:20-52`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts:92-151`
- Modify: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Modify: `apps/pi-teaching-web/src/client/components/RouteMap.tsx`
- Create: `apps/pi-teaching-web/tests/study/classroom-transition.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts:737-785`
- Modify: `apps/pi-teaching-web/tests/client/context-stack.test.tsx`

**Interfaces:**

- Consumes: canonical Lesson Markdown, `readPreparedLessonBlocks()`, existing `RouteChangeInput`, dynamic `lessonBlockIdSchema()`.
- Produces:

```ts
export type ClassroomTransitionInput =
  | { action: 'activate' | 'complete' | 'skip'; blockId: string }
  | {
      action: 'route';
      routeAction: 'insert' | 'skip' | 'move' | 'repeat';
      blockId: string;
      before?: string;
      after?: string;
      reason: string;
      source: string;
    };

export function transitionClassroomSource(
  source: string,
  input: ClassroomTransitionInput,
): string;
```

`write-workspace.ts` adds `applyClassroomTransition(root, lessonPath, input): void`, which performs exactly one final file write.

- [ ] **Step 1: Extend the existing Block reader with state fields**

Update `PreparedLessonBlock`:

```ts
export type PreparedLessonBlock = {
  id: string;
  kind: string;
  required: boolean;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  dependsOn: string[];
  uses: string[];
};
```

In `readPreparedLessonBlocks()` parse the additional fields:

```ts
const status = field('Status');
return {
  id: heading[1]!,
  kind: field('Kind'),
  required: field('Required') !== 'false',
  status: ['pending', 'active', 'completed', 'skipped'].includes(status)
    ? status as PreparedLessonBlock['status']
    : 'pending',
  dependsOn: field('Depends on')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  uses: field('Uses')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
};
```

Run existing admission tests:

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts tests/runtime/lesson-tool-contracts.test.ts
```

Expected: existing tests remain green; the extended return shape is additive.

- [ ] **Step 2: Write failing pure-transition tests**

Create `classroom-transition.test.ts` with a local Lesson source containing:

- `orientation`: completed;
- `problem-a`: active, depends on orientation;
- `repair`: pending and optional, depends on problem-a;
- `problem-b`: pending, depends on repair.

Cover:

```ts
expect(() => transitionClassroomSource(source, {
  action: 'activate',
  blockId: 'repair',
})).toThrow('CLASSROOM_ACTIVE_BLOCK_EXISTS');

expect(() => transitionClassroomSource(source, {
  action: 'complete',
  blockId: 'repair',
})).toThrow('CLASSROOM_BLOCK_NOT_ACTIVE');

const completed = transitionClassroomSource(source, {
  action: 'complete',
  blockId: 'problem-a',
});
expect(completed).toContain('## Block problem-a');
expect(blockStatus(completed, 'problem-a')).toBe('completed');

expect(() => transitionClassroomSource(completed, {
  action: 'activate',
  blockId: 'problem-b',
})).toThrow('CLASSROOM_DEPENDENCY_UNRESOLVED');
```

Add route assertions:

```ts
const skipped = transitionClassroomSource(completed, {
  action: 'route',
  routeAction: 'skip',
  blockId: 'repair',
  reason: '学生已能独立完成。',
  source: '#trace-event-001',
});
expect(blockStatus(skipped, 'repair')).toBe('skipped');
expect(skipped).toContain('- Action: skip');

const inserted = transitionClassroomSource(skipped, {
  action: 'route',
  routeAction: 'insert',
  blockId: 'repair',
  after: 'problem-a',
  reason: '学生要求补一次迁移。',
  source: '#trace-event-002',
});
expect(blockStatus(inserted, 'repair')).toBe('pending');
expect(inserted).toContain('- Action: insert');
```

Also assert unknown target, unknown anchor, both `before` and `after`, self anchor, invalid move state and repeat of a pending Block all throw without changing the original string.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/classroom-transition.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure parsing and Block replacement**

In `classroom-transition.ts`, define the route fields directly. Do not intersect this union with
`RouteChangeInput`: that existing type already owns a property named `action`, while this public
transition uses `action: 'route'` and a separate `routeAction`.

```ts
import { readPreparedLessonBlocks } from './validate-prepared-lesson';

export type ClassroomTransitionInput =
  | { action: 'activate' | 'complete' | 'skip'; blockId: string }
  | {
      action: 'route';
      routeAction: 'insert' | 'skip' | 'move' | 'repeat';
      blockId: string;
      before?: string;
      after?: string;
      reason: string;
      source: string;
    };

function lessonStatus(source: string): string | null {
  return /^status:\s*(.+?)\s*$/m.exec(source)?.[1] ?? null;
}

function replaceBlockStatus(
  source: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): string {
  const heading = new RegExp(`^## Block ${blockId}(?:（[^）]+）)?\\s*$`, 'm');
  const match = heading.exec(source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(match.index, end);
  const state = /### Node State\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)/.exec(block);
  if (!state || !/^- Status:.*$/m.test(state[0])) {
    throw new Error(`CLASSROOM_NODE_STATE_INVALID: ${blockId}`);
  }
  const replacement = block.replace(
    state[0],
    state[0].replace(/^- Status:.*$/m, `- Status: ${status}`),
  );
  return source.slice(0, match.index) + replacement + source.slice(end);
}
```

Move the existing Route Change string rendering into a pure helper that returns a new source string
and allocates the next `route-NNN` from existing headings. When rendering, map
`input.routeAction` to the persisted `- Action:` value. Export the pure helper so the retained
low-level `appendRouteChange()` can call the same renderer with its existing `RouteChangeInput`
shape; do not keep two string formats. The helper must not write files.

- [ ] **Step 4: Implement the minimal transition rules**

Inside `transitionClassroomSource()`:

```ts
export function transitionClassroomSource(
  source: string,
  input: ClassroomTransitionInput,
): string {
  if (lessonStatus(source) !== 'active') {
    throw new Error(`CLASSROOM_LESSON_NOT_ACTIVE: ${lessonStatus(source) ?? '(missing)'}`);
  }
  const blocks = readPreparedLessonBlocks(source);
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const active = blocks.filter((block) => block.status === 'active');
  if (active.length > 1) {
    throw new Error(
      `CLASSROOM_ACTIVE_BLOCK_CONFLICT: ${active.map((block) => block.id).join(',')}`,
    );
  }
  const block = byId.get(input.blockId);
  if (!block) throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);

  if (input.action === 'activate') {
    if (active.length > 0) {
      throw new Error(`CLASSROOM_ACTIVE_BLOCK_EXISTS: ${active[0]!.id}`);
    }
    if (block.status !== 'pending') {
      throw new Error(`CLASSROOM_ACTIVATE_REQUIRES_PENDING: ${block.id}`);
    }
    const unresolved = block.dependsOn.filter((id) => {
      const dependency = byId.get(id);
      return !dependency || !['completed', 'skipped'].includes(dependency.status);
    });
    if (unresolved.length > 0) {
      throw new Error(
        `CLASSROOM_DEPENDENCY_UNRESOLVED: block=${block.id}; `
        + `dependsOn=${unresolved.join(',')}`,
      );
    }
    return replaceBlockStatus(source, block.id, 'active');
  }

  if (input.action === 'complete' || input.action === 'skip') {
    if (active.length !== 1 || active[0]!.id !== block.id) {
      throw new Error(
        `CLASSROOM_BLOCK_NOT_ACTIVE: requested=${block.id}; `
        + `active=${active[0]?.id ?? '(none)'}`,
      );
    }
    return replaceBlockStatus(
      source,
      block.id,
      input.action === 'complete' ? 'completed' : 'skipped',
    );
  }

  return applyRouteTransition(source, blocks, input);
}
```

`applyRouteTransition()` enforces:

```ts
if (input.before && input.after) throw new Error('ROUTE_PLACEMENT_AMBIGUOUS');
for (const anchor of [input.before, input.after].filter(Boolean)) {
  if (!byId.has(anchor!)) throw new Error(`ROUTE_ANCHOR_NOT_FOUND: ${anchor}`);
  if (anchor === input.blockId) throw new Error(`ROUTE_SELF_ANCHOR: ${anchor}`);
}

const expected = {
  move: ['pending'],
  skip: ['pending'],
  insert: ['skipped'],
  repeat: ['completed', 'skipped'],
}[input.routeAction];
if (!expected.includes(block.status)) {
  throw new Error(
    `ROUTE_BLOCK_STATUS_INVALID: action=${input.routeAction}; `
    + `block=${block.id}; status=${block.status}`,
  );
}
if (input.routeAction === 'repeat' && active.length > 0) {
  throw new Error(`ROUTE_REPEAT_WHILE_ACTIVE: ${active[0]!.id}`);
}
```

Apply status and route text in memory, then return one final string:

- `move`: unchanged status;
- `skip`: pending → skipped;
- `insert`: skipped → pending;
- `repeat`: completed / skipped → pending.

- [ ] **Step 5: Add one-write IO and keep fixture helpers**

In `write-workspace.ts`, import both the value and input type:

```ts
import {
  transitionClassroomSource,
  type ClassroomTransitionInput,
} from './classroom-transition';
```

Add:

```ts
export function applyClassroomTransition(
  root: string,
  lessonPath: string,
  input: ClassroomTransitionInput,
): void {
  const document = read(root, lessonPath);
  const next = transitionClassroomSource(document.source, input);
  write(document.absolute, next);
}
```

Keep `setBlockStatus()` and `appendRouteChange()` as low-level fixture and migration helpers, but remove them from the production `classroom_update` call path. Do not silently add the new validation to fixture setup calls.

- [ ] **Step 6: Replace the optional-field tool schema with an action union**

In `classroom-update.ts`, build the current Lesson's dynamic Block schema once:

```ts
const blockId = lessonBlockIdSchema(root, ownerPath);
const parameters = Type.Union([
  Type.Object({
    action: Type.Literal('pause'),
  }, { additionalProperties: false }),
  Type.Object({
    action: Type.Union([
      Type.Literal('activate'),
      Type.Literal('complete'),
      Type.Literal('skip'),
    ]),
    blockId,
  }, { additionalProperties: false }),
  Type.Object({
    action: Type.Literal('route'),
    routeAction: Type.Union([
      Type.Literal('insert'),
      Type.Literal('skip'),
      Type.Literal('move'),
      Type.Literal('repeat'),
    ]),
    blockId,
    before: Type.Optional(blockId),
    after: Type.Optional(blockId),
    reason: Type.String({ minLength: 1 }),
    source: Type.String({ minLength: 1 }),
  }, { additionalProperties: false }),
]);
```

Execution becomes:

```ts
if (input.action === 'pause') {
  const lesson = readMarkdownFile(root, ownerPath);
  if (lesson.frontmatter.status !== 'active') {
    throw new Error(`CLASSROOM_LESSON_NOT_ACTIVE: ${lesson.frontmatter.status}`);
  }
  setFrontmatterField(root, ownerPath, 'status', 'paused');
} else {
  applyClassroomTransition(root, ownerPath, input);
}
```

Return the existing minimal receipt. Do not add `lessonPath` to model parameters.

- [ ] **Step 7: Test schema and tool-level no-write behavior**

In `study-tools.test.ts`, assert:

```ts
expect(Check(classroom.parameters, { action: 'pause' })).toBe(true);
expect(Check(classroom.parameters, {
  action: 'activate',
  blockId: 'assessment-01',
})).toBe(true);
expect(Check(classroom.parameters, {
  action: 'route',
  routeAction: 'move',
  blockId: 'assessment-02',
  before: 'reflection',
  reason: '学生决定先做迁移。',
  source: '#trace-event-001',
})).toBe(true);
expect(Check(classroom.parameters, {
  action: 'route',
  blockId: 'assessment-02',
})).toBe(false);
```

On a temporary Lesson, activate one Block, snapshot the file, then attempt to activate a second Block. Assert the error contains `CLASSROOM_ACTIVE_BLOCK_EXISTS` and the file is byte-identical to the snapshot.

- [ ] **Step 8: Correct the Replay label**

In `RouteMap.tsx`, change:

```tsx
<RouteRow label="实际" values={replay.route.effective} accent />
```

to:

```tsx
<RouteRow label="调整后" values={replay.route.effective} accent />
```

Update `context-stack.test.tsx` to assert `调整后` is present and `实际` is absent. This is a component behavior assertion, not a Skill prose test.

- [ ] **Step 9: Run focused verification**

```bash
cd apps/pi-teaching-web
bun test \
  tests/study/classroom-transition.test.ts \
  tests/study/lesson-blueprint.test.ts \
  tests/runtime/lesson-tool-contracts.test.ts \
  tests/runtime/study-tools.test.ts \
  tests/study/routes-and-replay.test.ts \
  tests/client/context-stack.test.tsx
bun run typecheck
```

Expected: transition, route replay, dynamic schema and component tests pass; type checking reports zero errors.

- [ ] **Step 10: Commit Task 2**

```bash
git add apps/pi-teaching-web/src/study/classroom-transition.ts \
  apps/pi-teaching-web/src/study/validate-prepared-lesson.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/src/runtime/classroom-update.ts \
  apps/pi-teaching-web/src/client/components/RouteMap.tsx \
  apps/pi-teaching-web/tests/study/classroom-transition.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/client/context-stack.test.tsx
git commit -m "fix: enforce local classroom transitions"
```

---

## Task 3: Validate non-card Lesson sources before preparation

**Files:**

- Modify: `apps/pi-teaching-web/src/study/lesson-blueprint.ts:1-115`
- Modify: `apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts:120-245`

**Interfaces:**

- Consumes: `sourceResolve(root, { fromPath, target })`, canonical `LessonSource.target`.
- Produces: no new persistent field; `validateLessonBlueprint()` includes missing, outside-root and missing-fragment issues before rendering or writing.

- [ ] **Step 1: Add a real local material fixture inside the test copy**

Change `lesson-blueprint.test.ts` to use a per-test temporary copy instead of mutating the public
demo. Add `afterEach`, `beforeEach`, `cpSync`, `mkdtempSync`, `rmSync`, `writeFileSync` and
`tmpdir` imports. Replace the constant `root` with:

```ts
const fixtureRoot = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');
let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lesson-blueprint-'));
  cpSync(fixtureRoot, root, { recursive: true });
  writeFileSync(
    join(root, 'materials/blueprint-source.md'),
    '# Blueprint Source\n\n## Local fact\n\nA locatable teaching fact.\n',
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});
```

Use this valid Blueprint source in the source-specific tests:

```ts
sources: [{
  label: '本地材料',
  target: 'materials/blueprint-source.md#local-fact',
  note: '支持本课的本地判断。',
}],
```

- [ ] **Step 2: Write failing source-resolution tests**

Add:

```ts
test.each([
  ['missing file', 'materials/missing.md', 'MISSING_FILE'],
  ['outside learning set', '../../private.md', 'OUTSIDE_LEARNING_SET'],
  ['missing fragment', 'materials/blueprint-source.md#missing', 'MISSING_FRAGMENT'],
] as const)('rejects %s in Lesson sources', (_name, target, error) => {
  const value: LessonBlueprint = {
    ...blueprint,
    sources: [{ label: '无效来源', target, note: '测试。' }],
  };
  expect(() => validateLessonBlueprint(root, context, value))
    .toThrow(new RegExp(`来源.*${error}`));
});

test('accepts a syntactically valid external source without fetching it', () => {
  const value: LessonBlueprint = {
    ...blueprint,
    sources: [{
      label: '外部视频',
      target: 'https://example.com/lesson/video',
      note: '课堂中播放。',
    }],
  };
  expect(() => validateLessonBlueprint(root, context, value)).not.toThrow();
  expect(renderPreparedLesson(context, value))
    .toContain('(https://example.com/lesson/video)');
});

test('rejects a malformed external URL', () => {
  const value: LessonBlueprint = {
    ...blueprint,
    sources: [{
      label: '错误链接',
      target: 'https://',
      note: '不能解析。',
    }],
  };
  expect(() => validateLessonBlueprint(root, context, value))
    .toThrow(/外部来源 URL 非法/);
});
```

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts
```

Expected: missing/outside/fragment tests currently pass through and therefore fail their assertions.

- [ ] **Step 3: Reuse `sourceResolve()` from an existing real file**

Import:

```ts
import {
  readCard,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
```

Add:

```ts
function validateLessonSource(
  root: string,
  context: LessonRenderContext,
  source: LessonSource,
): string | null {
  if (/^https?:/i.test(source.target)) {
    if (!/^https?:\/\//i.test(source.target)) {
      return `外部来源 URL 非法：${source.target}`;
    }
    try {
      const url = new URL(source.target);
      return ['http:', 'https:'].includes(url.protocol) && Boolean(url.host)
        ? null
        : `外部来源 URL 非法：${source.target}`;
    } catch {
      return `外部来源 URL 非法：${source.target}`;
    }
  }
  const target = posix.relative(posix.dirname(context.planPath), source.target);
  const resolved = sourceResolve(root, {
    fromPath: context.planPath,
    target,
  });
  const declaredPath = source.target.split('#', 1)[0]!;
  return resolved.valid && resolved.path === declaredPath
    ? null
    : `来源无法定位：${source.target}（${resolved.error}）`;
}
```

Make `relativeTarget()` use the same case-insensitive `^https?://` recognition so every URL accepted
by validation is rendered unchanged.

Use the real `context` parameter instead of `_context`:

```ts
for (const source of blueprint.sources) {
  if (!nonempty(source.label) || !nonempty(source.target) || !nonempty(source.note)) {
    issues.push('来源 label、target 与 note 均不能为空');
    continue;
  }
  const issue = validateLessonSource(root, context, source);
  if (issue) issues.push(issue);
}
```

Do not fetch external URLs or infer their teaching quality.

- [ ] **Step 4: Add a tool-level no-write assertion**

In `study-tools.test.ts`, copy the learning set, call `lesson_prepare` with:

```ts
sources: [{
  label: '不存在材料',
  target: 'materials/missing.md#missing',
  note: '不应写入。',
}],
```

Assert:

```ts
await expect(tool.execute(
  'prepare-invalid-source',
  input as never,
  undefined,
  undefined,
  {} as never,
)).rejects.toThrow(/LESSON_BLUEPRINT_INVALID.*MISSING_FILE/);
expect(existsSync(join(temporaryRoot, 'lessons/lesson-blueprint-source.md')))
  .toBe(false);
expect(readFileSync(join(temporaryRoot, 'plans/domain-integrity.md'), 'utf8'))
  .toBe(planBefore);
```

- [ ] **Step 5: Run focused verification**

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: all local/external source cases pass; invalid preparation leaves Lesson and Plan unchanged.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/pi-teaching-web/src/study/lesson-blueprint.ts \
  apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "fix: validate lesson material sources"
```

---

## Task 4: Make Learning Review evidence errors recoverable

**Files:**

- Modify: `apps/pi-teaching-web/src/study/learning-review.ts:180-249`
- Modify: `apps/pi-teaching-web/src/runtime/plan-update.ts:6-32`
- Modify: `apps/pi-teaching-web/tests/study/learning-review.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts:910-970`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`

**Interfaces:**

- Produces:

```ts
export function listEligibleKeyEvidence(
  root: string,
  planPath: string,
): string[];
```

- `validateLearningReviewSources()` uses the same function and preserves existing stable error-code prefixes.
- Tool errors append `source=...; reason=...; eligible=...` but still throw; they never return
  `{ ok: true }`.

- [ ] **Step 1: Write failing eligibility-list tests**

Extend the local `LearningReviewModule` test type with
`listEligibleKeyEvidence(root, planPath): string[]`. Reuse the existing `tracedFixture()` helper;
do not introduce a nonexistent fixture builder:

```ts
test('lists only active independent correct assessment problem Traces', async () => {
  const value = await moduleUnderTest();
  expect(value).not.toBeNull();
  if (!value) return;
  const root = tracedFixture();

  expect(value.listEligibleKeyEvidence(root, 'plans/domain-integrity.md'))
    .toEqual(['lessons/lesson-003.md#trace-event-001']);
});
```

Use small variants of `tracedFixture()` to cover excluded cases:

- the existing event-002 proves correct + `support: tutor` is excluded;
- parameterize event-001's assessment to prove incorrect + `support: none` is excluded;
- change the copied Lesson's Primary template to `deliberate-practice` and expect no candidates;
- supersede event-001, then assert event-001 disappears and the active eligible revision appears;
- retain the existing foreign-Lesson validation test to prove another Plan cannot contribute.

Assert none appear.

- [ ] **Step 2: Write failing recoverable-error tests**

Use the existing supported event as an invalid key while event-001 remains an eligible recovery
candidate:

```ts
expect(() => value.validateLearningReviewSources(
  root,
  'plans/domain-integrity.md',
  {
    ...review(),
    keyEvidence: [{
      claim: '错误地把提示后表现作为关键证据。',
      source: 'lessons/lesson-003.md#trace-event-002',
    }],
    supportingEvidence: [],
  },
))
  .toThrow(
    /LEARNING_REVIEW_KEY_SUPPORT_REQUIRED_NONE: .*reason=support:tutor; eligible=lessons\/lesson-003\.md#trace-event-001/,
  );
```

Then change the copied Lesson's Primary template from `assessment` to `deliberate-practice` and
reuse event-001 as the key source:

```ts
expect(() => value.validateLearningReviewSources(
  root,
  'plans/domain-integrity.md',
  review(),
)).toThrow(
  /LEARNING_REVIEW_KEY_NOT_ASSESSMENT: .*reason=template:deliberate-practice.*eligible=\(none\)/,
);
```

At the tool level, copy the fixture, append event-001 with `support:none` and event-002 with
`support:tutor`, snapshot the Plan and Roadmap, then call `plan_update(complete)` with event-002 as
the only key source:

```ts
await expect(tool.execute(
  'complete-invalid-key',
  completeInput as never,
  undefined,
  undefined,
  {} as never,
)).rejects.toThrow(/eligible=lessons\/lesson-003\.md#trace-event-001/);
expect(readFileSync(planAbsolute, 'utf8')).toBe(planBefore);
expect(readFileSync(roadmapAbsolute, 'utf8')).toBe(roadmapBefore);
```

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/learning-review.test.ts tests/runtime/study-tools.test.ts
```

Expected: the helper is missing and current errors contain no eligible anchors.

- [ ] **Step 3: Extract one eligibility function**

Add:

```ts
export function listEligibleKeyEvidence(
  root: string,
  planPath: string,
): string[] {
  const plan = readMarkdownFile(root, planPath);
  const workspace = readPlanWorkspace(root, plan.id);
  if (plan.frontmatter.kind !== 'plan' || workspace.plan.path !== planPath) {
    throw new Error('LEARNING_REVIEW_OWNER_MISMATCH');
  }
  const lessons = new Map(workspace.lessons.map((lesson) => [
    lesson.path,
    readMarkdownFile(root, lesson.path),
  ]));
  return readActiveTraces(root, workspace.lessons.map((lesson) => lesson.path))
    .filter((trace) => {
      if (trace.support !== 'none' || trace.assessment !== 'correct') return false;
      const lesson = lessons.get(trace.lessonPath);
      if (!lesson || primaryTemplate(lesson.body) !== 'assessment') return false;
      return readPreparedLessonBlocks(lesson.body)
        .some((block) => block.id === trace.blockId && block.kind === 'problem');
    })
    .map((trace) => trace.sourceAnchor)
    .sort();
}
```

Do not calculate mastery, stability or representativeness.

- [ ] **Step 4: Centralize key-source errors**

Add:

```ts
function keyEvidenceError(
  code: string,
  source: string | null,
  reason: string,
  eligible: string[],
): never {
  const candidates = eligible.slice(0, 5).join(',') || '(none)';
  throw new Error(
    `${code}: source=${source ?? '(none)'}; reason=${reason}; eligible=${candidates}`,
  );
}
```

After validating Plan ownership in `validateLearningReviewSources()`:

```ts
const eligible = listEligibleKeyEvidence(root, planPath);
const eligibleSet = new Set(eligible);
if (review.keyEvidence.length === 0) {
  keyEvidenceError(
    'LEARNING_REVIEW_KEY_EVIDENCE_REQUIRED',
    null,
    'at least one key source is required',
    eligible,
  );
}
```

For every key-tier failure, call `keyEvidenceError()` with the existing error-code prefix. For a
key source that passes general ownership and active checks but is not in `eligibleSet`, preserve
the most specific current reason in both the error code and `reason` field:

- support is not none → `LEARNING_REVIEW_KEY_SUPPORT_REQUIRED_NONE`, for example
  `reason=support:tutor`;
- assessment is not correct → `LEARNING_REVIEW_KEY_CORRECT_REQUIRED`, for example
  `reason=assessment:incorrect`;
- template / Block kind mismatch → `LEARNING_REVIEW_KEY_NOT_ASSESSMENT`, for example
  `reason=template:review,block-kind:problem`.

Invalid syntax, outside-Plan and stale key sources use their current error-code prefixes with
`reason=invalid-format`, `reason=outside-plan` or `reason=not-active`. This keeps the existing
machine-readable prefix while making one failed call sufficient for Coach recovery.

Supporting-tier failures retain their current errors and do not need the key candidate list.

- [ ] **Step 5: Put the objective qualification in the tool schema**

In `plan-update.ts`, replace the key source's generic `text` schema with:

```ts
source: Type.String({
  minLength: 1,
  description: 'Exact active Trace anchor from this Plan. Key evidence must be '
    + 'correct, support:none, and belong to a problem Block in an assessment Lesson. '
    + 'This is objective eligibility, not an automatic completion verdict.',
}),
```

Do not add another plan tool or a model-selected evidence ID field.

- [ ] **Step 6: Add one concise Coach recovery instruction**

In `coach-study/SKILL.md`, immediately before the first-completion Scout paragraph, add:

```markdown
Before calling `plan_update(complete)`, separate sources into key, supporting and open
questions. A key source must be an active correct `support:none` Trace from a problem
Block in an assessment Lesson. If the tool rejects a key source, use the returned
eligible anchors to reconsider the evidence once; do not mechanically rotate sources
or treat eligibility as proof of completion.
```

Do not copy error-code lists, TypeBox fields or candidate formatting into the Skill.

- [ ] **Step 7: Run focused verification**

```bash
cd apps/pi-teaching-web
bun test tests/study/learning-review.test.ts tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: candidate filtering and tool error tests pass; type checking reports zero errors.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/pi-teaching-web/src/study/learning-review.ts \
  apps/pi-teaching-web/src/runtime/plan-update.ts \
  apps/pi-teaching-web/tests/study/learning-review.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
git commit -m "fix: make plan evidence errors recoverable"
```

---

## Task 5: Tighten cross-cycle evidence language and current-contract documentation

**Files:**

- Modify: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Modify: `docs/design/architecture.zh-CN.md:1-12`
- Modify: `AGENTS.md`

**Interfaces:**

- No executable interface or persistent schema changes.
- The current repository guide records the runtime invariant so future edits do not remove it.

- [ ] **Step 1: Add the same compact evidence check to both Pi Skills**

In `roadmap-study/SKILL.md`, after the paragraph that resolves conflicting sources, and in
`plan-next-cycle/SKILL.md`, after the paragraph that says active Trace owns attempt outcome, add:

```markdown
Before describing a pattern as stable, repeated, usual or mastered, check its observed
count, final support, whether the behavior actually occurred, and the exact active-Trace
method name. If any part is missing, state it as one occurrence, supported, not observed,
or needing replication. Do not improve a source-linked fact into a stronger narrative.
```

Keep this as an internal judgment check. Do not add a fixed table, score, threshold or runtime
natural-language validator.

- [ ] **Step 2: Mark the old architecture document as historical**

Directly below the title in `docs/design/architecture.zh-CN.md`, add:

```markdown
> 本文记录 Claude Code 插件的原始 Markdown-first 重写原则。当前 Pi 运行时、
> Session-bound 写入与学生前端契约以 `AGENTS.md`、`docs/zh-CN/完整说明书.md`
> 和可执行 runtime 为准；本文不是 Pi 的逐项技术契约。
```

- [ ] **Step 3: Record the new runtime invariants in `AGENTS.md`**

In the Trace paragraph under Runtime boundaries, add:

```markdown
A superseding Trace must replace the current active event from the same Block and
canonical card binding; a stale or cross-Block event is never a valid correction target.
```

In the classroom paragraph, add:

```markdown
`classroom_update` permits at most one active Block, enforces declared dependencies and
legal local status transitions, and applies a route decision plus its deterministic Block
status effect in one Lesson write. Route Changes remain an auditable adjusted-route
projection, not an automatic scheduler or a second Block state.
```

Do not reproduce error codes or TypeBox schema in the guide.

- [ ] **Step 4: Review prose without exact-language tests**

Run:

```bash
git diff --check -- \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  docs/design/architecture.zh-CN.md \
  AGENTS.md
```

Expected: no whitespace errors. Manually confirm each Skill contains one compact check and does not
repeat the same rule elsewhere in that file. Do not add snapshot, regex or keyword tests for prose.

- [ ] **Step 5: Commit Task 5**

```bash
git add apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  docs/design/architecture.zh-CN.md \
  AGENTS.md
git commit -m "docs: align evidence and classroom authority"
```

---

## Task 6: Run full verification and one copied-learning-set smoke

**Files:**

- Create: `docs/audits/2026-07-30-architecture-audit-remediation-acceptance.md`
- Do not modify: `examples/derivative-demo/learning-set/**`

**Interfaces:**

- Consumes all prior task commits.
- Produces release-check evidence and a factual smoke report; it does not introduce another fix unless a preceding task's acceptance criterion fails.

- [ ] **Step 1: Run the Claude plugin release gate**

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

Expected:

- build succeeds;
- type checking and tests pass;
- strict plugin validation passes;
- the public MCP tool count remains four.

- [ ] **Step 2: Run the Pi application gate**

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
```

Expected: type checking, unit tests, production build and Playwright E2E all pass.

- [ ] **Step 3: Prepare a disposable real-course copy**

```bash
smoke_root="$(mktemp -d /tmp/studyforge-audit-remediation-XXXXXX)"
cp -R examples/derivative-demo/learning-set "$smoke_root/learning-set"
```

Start the local Pi application against `"$smoke_root/learning-set"` using the repository's current
documented provider configuration. Do not copy provider credentials into the learning set or report.

- [ ] **Step 4: Exercise the accepted write path**

In one short Lesson:

1. activate and complete one ordinary Block;
2. route-skip one pending optional Block and verify the same Lesson write contains both the Route
   Change and `Status: skipped`;
3. route-insert the same Block and verify it returns to `pending`;
4. activate it only after dependencies are resolved;
5. append one Trace, then append a same-Block correction with the exact active `supersedes`;
6. close the Lesson and return to Coach;
7. attempt a Plan completion with one ineligible key source and verify the error names at least one
   eligible anchor or `(none)`.

The student's conversation may vary. Judge only tool receipts, persisted Markdown, safe projection
and error recovery.

- [ ] **Step 5: Exercise rejected writes on the copy**

Using direct tool calls or the existing test harness, verify:

- Block B cannot supersede Block A's event;
- stale Trace cannot be superseded;
- a second Block cannot become active while one is active;
- a Block with unresolved dependencies cannot become active;
- missing local Lesson source prevents Lesson creation;
- failed operations leave Lesson / Plan bytes unchanged.

- [ ] **Step 6: Write the acceptance report**

Create `docs/audits/2026-07-30-architecture-audit-remediation-acceptance.md`. The report must record
only observed values under these sections:

- **Baseline:** exact output of `git rev-parse HEAD`, disposable learning-set path class (not a
  private absolute path), and `safe` projection;
- **Automated Gates:** the three executed commands and their actual pass/fail results;
- **Accepted Writes:** persisted classroom transition facts, source anchors, same-Block Trace chain
  and Learning Review recovery result;
- **Rejected Writes:** exact error codes and byte-comparison results for every rejected mutation;
- **Remaining Boundaries:** local raw Workspace API tradeoff, multi-user cloud release blockers and
  the still-unverified generic Pi file-tool authority.

Do not include credentials, raw private classroom transcript, instructional placeholders or
unverified conclusions.

- [ ] **Step 7: Commit the acceptance report**

```bash
git add docs/audits/2026-07-30-architecture-audit-remediation-acceptance.md
git commit -m "docs: record architecture remediation acceptance"
```

---

## Deferred Release Gates

These are explicitly outside this implementation plan:

1. **Multi-user cloud:** authentication, learning-set ownership, role authorization and student-only
   projection DTOs require a separate design before any shared deployment.
2. **Cross-file transactions:** add temp / rename / rollback only after fault injection or a real
   Plan / Roadmap split-write is observed.
3. **Generic Pi file tools:** first reproduce an owner-bound bypass on a disposable learning set;
   only then design a Roadmap `write/edit` allowlist.

No task in this plan may add speculative code for these three items.
