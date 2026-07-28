# Roadmap Coach 与首个 Plan 入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让空学习集能够在 Pi 前端中恢复一个长期 Roadmap Coach Session、共同创建首个 Plan，并在已有 Plan 后把入口降级为主页上的低频“总览与规划”条目。

**Architecture:** 继续复用现有 Coach runtime，以 `ROADMAP.md` 和 `coach:@roadmap` 建立独立 Session owner scope；Roadmap scope 使用摘要优先的 Skill 和裁剪后的工具集，Plan Coach 与 Tutor 保持原样。前端增加 `/roadmap` 路由与双栏 Coach 页面，首页根据 Plan 数量切换规划入口的视觉权重；正式交接仍只依赖注册后的 Markdown Plan。

**Tech Stack:** TypeScript 7、Bun 1.3、React 19、Pi coding-agent 0.81、Vite 8、Playwright 1.61、Markdown/YAML

## Global Constraints

- 保持 Markdown-first；不得增加数据库、向量库、后台索引或 `study_context_get`。
- Agent 角色仍只有 Coach 与 Tutor；Roadmap 只是 Coach 的 owner scope。
- Roadmap Session 固定使用 `roadmap_coach_session`、`coach:@roadmap`、`ownerId: @roadmap` 和 `ownerPath: ROADMAP.md`。
- Roadmap scope 不暴露 `plan_update`、`lesson_prepare`、课堂写入或 Trace 写入工具。
- Roadmap Coach 只有在学生确认后才写 Roadmap 或全新 Plan；新 Plan 仍由 `plan_register` 校验并登记。
- Plan Coach、Tutor、题卡、Trace、能力投影与已有浏览器路由语义不得改变。
- 不为 Skill 或 Agent 文案写精确字符串测试；只测试工具、scope、持久化、API、路由和可见行为。
- 保留现有未跟踪文件，不提交 `.superpowers/`。

---

## File Structure

### New files

- `apps/pi-teaching-web/resources/agents/roadmap-coach.md`：同一 Coach runtime 在 Roadmap scope 下的职责上下文。
- `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`：摘要优先召回、首次规划和 Plan 注册流程。
- `apps/pi-teaching-web/src/client/components/RoadmapCoachShell.tsx`：独立 `/roadmap` 页面的学习集上下文与聊天布局。
- `apps/pi-teaching-web/tests/client/roadmap-coach-shell.test.tsx`：Roadmap 页面静态可见行为。
- `docs/audits/2026-07-28-roadmap-coach-first-plan-acceptance.md`：隔离学习集上的真实模型首次规划验收记录。

### Modified files

- `apps/pi-teaching-web/src/shared/contracts.ts`：Roadmap Session key、workspace snapshot 和 learning-set 事件。
- `apps/pi-teaching-web/src/study/read-workspace.ts`：从 `ROADMAP.md` 读取 Roadmap Coach 引用。
- `apps/pi-teaching-web/src/runtime/session-scope.ts`：Roadmap owner 常量、判别和上下文标签。
- `apps/pi-teaching-web/src/runtime/resource-loader.ts`：按 owner scope 选择 Agent context 与 Skills。
- `apps/pi-teaching-web/src/runtime/session-factory.ts`：按 owner scope 裁剪 active tools 与 custom tools。
- `apps/pi-teaching-web/src/runtime/workspace-registry.ts`：创建、恢复和缓存 Roadmap Coach Session。
- `apps/pi-teaching-web/src/server/app.ts`：Roadmap workspace API、统一 Session 打开和完成后的 Learning Set 刷新。
- `apps/pi-teaching-web/src/client/api.ts`：Roadmap workspace 请求。
- `apps/pi-teaching-web/src/client/routes.ts`：`/roadmap` 的解析与格式化。
- `apps/pi-teaching-web/src/client/App.tsx`：Roadmap 路由恢复、事件处理与独立页面渲染。
- `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`：空/非空学习集的自适应规划入口。
- `apps/pi-teaching-web/src/client/styles.css`：主页入口与 Roadmap 双栏页面样式。
- `apps/pi-teaching-web/tests/study/read-workspace.test.ts`：Roadmap workspace 读取。
- `apps/pi-teaching-web/tests/runtime/session-scope.test.ts`：Roadmap owner 判别与标签。
- `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`：scope 对应的 Skill 组合。
- `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`：Roadmap active tool 边界。
- `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`：Session 创建、写回和恢复。
- `apps/pi-teaching-web/tests/server/workspace-api.test.ts`：Roadmap API、消息路由和刷新事件。
- `apps/pi-teaching-web/tests/client/routes.test.ts`：`/roadmap` round-trip。
- `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`：主入口与低权重入口。
- `apps/pi-teaching-web/tests/e2e/fixture-server.ts`：Roadmap workspace E2E fixture。
- `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`：Roadmap 深链、刷新和返回主页。
- `examples/derivative-demo/learning-set/ROADMAP.md`：公开学习集显式声明空 Session 引用。
- `AGENTS.md`：当前 runtime 契约。
- `docs/zh-CN/完整说明书.md`：学生可见使用方式和职责边界。

---

### Task 1: Roadmap workspace 读取契约

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Test: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`

**Interfaces:**
- Produces: `ROADMAP_COACH_SESSION_KEY`
- Produces: `RoadmapWorkspaceSnapshot`
- Produces: `readRoadmapWorkspace(root: string): RoadmapWorkspaceSnapshot`
- Consumes: existing `readLearningSet(root)` and `readMarkdownFile(root, 'ROADMAP.md')`

- [ ] **Step 1: Write failing reader tests**

Add imports for `cpSync`, `mkdtempSync`, `tmpdir`, and `readRoadmapWorkspace`, then add:

```ts
test('reads the optional Roadmap Coach Session without inventing one', () => {
  expect(readRoadmapWorkspace(root)).toEqual({
    learningSet: readLearningSet(root),
    coach: {
      sessionKey: 'coach:@roadmap',
      sessionId: null,
    },
  });
});

test('reads a persisted Roadmap Coach Session ID', () => {
  const copy = mkdtempSync(join(tmpdir(), 'study-roadmap-workspace-'));
  try {
    cpSync(root, copy, { recursive: true });
    const path = join(copy, 'ROADMAP.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        'status: active',
        'status: active\nroadmap_coach_session: roadmap-session-001',
      ),
    );

    expect(readRoadmapWorkspace(copy).coach).toEqual({
      sessionKey: 'coach:@roadmap',
      sessionId: 'roadmap-session-001',
    });
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts
```

Expected: FAIL because `readRoadmapWorkspace` and `RoadmapWorkspaceSnapshot` do not exist.

- [ ] **Step 3: Add the shared contract**

In `src/shared/contracts.ts`, keep the existing `SessionKey` union and add:

```ts
export const ROADMAP_COACH_SESSION_KEY = 'coach:@roadmap' as const;

export type RoadmapWorkspaceSnapshot = {
  learningSet: LearningSetSnapshot;
  coach: {
    sessionKey: typeof ROADMAP_COACH_SESSION_KEY;
    sessionId: string | null;
  };
};
```

- [ ] **Step 4: Add the reader**

Import `ROADMAP_COACH_SESSION_KEY` and `RoadmapWorkspaceSnapshot` in
`src/study/read-workspace.ts`, then add:

```ts
export function readRoadmapWorkspace(root: string): RoadmapWorkspaceSnapshot {
  const roadmap = readMarkdownFile(root, 'ROADMAP.md');
  return {
    learningSet: readLearningSet(root),
    coach: {
      sessionKey: ROADMAP_COACH_SESSION_KEY,
      sessionId: scalar(roadmap.frontmatter, 'roadmap_coach_session'),
    },
  };
}
```

- [ ] **Step 5: Run the reader tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts
```

Expected: all tests in the file PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/read-workspace.ts \
  apps/pi-teaching-web/tests/study/read-workspace.test.ts
git commit -m "feat: read roadmap coach workspace"
```

---

### Task 2: Roadmap Coach 的 scope、工具和资源视图

**Files:**
- Create: `apps/pi-teaching-web/resources/agents/roadmap-coach.md`
- Create: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Test: `apps/pi-teaching-web/tests/runtime/session-scope.test.ts`
- Test: `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`
- Test: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`

**Interfaces:**
- Produces: `ROADMAP_COACH_SCOPE`
- Produces: `isRoadmapCoachScope(scope: StudySessionScope): boolean`
- Produces: `skillNamesForScope(scope: StudySessionScope): string[]`
- Produces: `scopeToolNames(scope: StudySessionScope): string[]`
- Consumes: `StudySessionScope`, existing `roleToolNames`, `plan_register`, and deep workflow

- [ ] **Step 1: Write failing scope and tool tests**

In `tests/runtime/session-scope.test.ts`, import the new exports and add:

```ts
test('recognizes the canonical Roadmap Coach owner only', () => {
  expect(ROADMAP_COACH_SCOPE).toEqual({
    role: 'coach',
    ownerId: '@roadmap',
    ownerPath: 'ROADMAP.md',
  });
  expect(isRoadmapCoachScope(ROADMAP_COACH_SCOPE)).toBe(true);
  expect(isRoadmapCoachScope({
    role: 'coach',
    ownerId: 'domain-integrity',
    ownerPath: 'plans/domain-integrity.md',
  })).toBe(false);
  expect(formatSessionOwnerContext('/set', ROADMAP_COACH_SCOPE))
    .toContain('Current Roadmap file: ROADMAP.md');
});
```

In `tests/runtime/resource-loader.test.ts`, extend the local function type to accept
`StudySessionScope`, then add:

```ts
type SkillNamesForScope = (scope: {
  role: 'coach' | 'tutor';
  ownerId: string;
  ownerPath: string;
}) => string[];

function skillNamesForScope(): SkillNamesForScope {
  const value = (resourceLoader as Record<string, unknown>).skillNamesForScope;
  expect(value).toBeFunction();
  return value as SkillNamesForScope;
}

test('loads Roadmap planning resources only for the Roadmap Coach scope', () => {
  expect(skillNamesForScope()({
    role: 'coach',
    ownerId: '@roadmap',
    ownerPath: 'ROADMAP.md',
  })).toEqual([
    'roadmap-study',
    'plan-next-cycle',
    'deep-workflow',
  ]);
  expect(skillNamesForScope()({
    role: 'coach',
    ownerId: 'domain-integrity',
    ownerPath: 'plans/domain-integrity.md',
  })).toEqual([
    'coach-study',
    'plan-next-cycle',
    'deep-workflow',
  ]);
});
```

In `tests/runtime/session-factory.test.ts`, import `scopeToolNames` and add:

```ts
test('keeps Roadmap Coach active tools global but non-instructional', () => {
  const tools = scopeToolNames({
    role: 'coach',
    ownerId: '@roadmap',
    ownerPath: 'ROADMAP.md',
  });
  expect(tools).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'write',
    'edit',
    'card_search',
    'trace_search',
    'source_resolve',
    'plan_register',
    'deep_workflow_propose',
  ]);
  expect(tools).not.toContain('plan_update');
  expect(tools).not.toContain('lesson_prepare');
  expect(tools).not.toContain('trace_append');
});
```

- [ ] **Step 2: Run the focused runtime tests and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-scope.test.ts \
  tests/runtime/resource-loader.test.ts \
  tests/runtime/session-factory.test.ts
```

Expected: FAIL on the missing scope-aware exports.

- [ ] **Step 3: Implement Roadmap scope identity**

Replace the owner-label branch in `src/runtime/session-scope.ts` with:

```ts
export const ROADMAP_COACH_SCOPE = {
  role: 'coach',
  ownerId: '@roadmap',
  ownerPath: 'ROADMAP.md',
} as const satisfies StudySessionScope;

export function isRoadmapCoachScope(scope: StudySessionScope): boolean {
  return scope.role === ROADMAP_COACH_SCOPE.role
    && scope.ownerId === ROADMAP_COACH_SCOPE.ownerId
    && scope.ownerPath === ROADMAP_COACH_SCOPE.ownerPath;
}

export function formatSessionOwnerContext(root: string, scope: StudySessionScope): string {
  const owner = isRoadmapCoachScope(scope)
    ? `Current Coach: ${scope.ownerId}\nCurrent Roadmap file: ${scope.ownerPath}`
    : scope.role === 'coach'
      ? `Current Coach: ${scope.ownerId}\nCurrent Plan file: ${scope.ownerPath}`
      : `Current Tutor: ${scope.ownerId}\nCurrent Lesson file: ${scope.ownerPath}`;
  return `Learning set root: ${root}\n${owner}`;
}
```

- [ ] **Step 4: Make resource selection scope-aware**

Keep `roleSkillNames` for existing callers, add this export to
`src/runtime/resource-loader.ts`, and make `createRoleResourceLoader` use it:

```ts
export function skillNamesForScope(scope: StudySessionScope): string[] {
  if (isRoadmapCoachScope(scope)) {
    return ['roadmap-study', 'plan-next-cycle', 'deep-workflow'];
  }
  return roleSkillNames(scope.role);
}
```

Select the role context file with:

```ts
const roleContextName = isRoadmapCoachScope(scope) ? 'roadmap-coach' : role;
const roleContext = readFileSync(
  join(resourceRoot, 'agents', `${roleContextName}.md`),
  'utf8',
);
```

Build `skillPaths` from `skillNamesForScope(scope)`.

- [ ] **Step 5: Add the Roadmap Agent context**

Create `resources/agents/roadmap-coach.md` with:

```markdown
# Coach · Roadmap scope

You own the learning set's Roadmap Session. Discuss the long-term direction, review
across Plans, and create a new student-approved Plan when a new cycle is warranted.
You do not own an existing Plan and do not prepare Lessons or teach Tutor content.

Use current Markdown facts and source-linked summaries. Before a global judgment,
reread ROADMAP.md and the compact current sections of relevant Plans. Keep private
retrieval, child artifacts, tool arguments and unrevealed card content out of the
student-facing reply.

Load `roadmap-study` for Roadmap work and `plan-next-cycle` when accumulated history
may change the next cycle. Complete required writes, registration and rereads before
sending one natural Chinese conclusion.
```

- [ ] **Step 6: Add the Roadmap planning Skill**

Create `resources/skills/roadmap-study/SKILL.md` with:

```markdown
---
name: roadmap-study
description: Use for first-cycle planning, learning-set overview, cross-Plan review, or creating a new student-approved Plan from the Roadmap Coach Session.
---

# Roadmap Study

Own the learning set direction, not any existing Plan's teaching work.

## Read compact current context

Before a direction judgment, read LEARNING_GUIDE.md when present, ROADMAP.md,
confirmed student and teaching profiles, and each relevant Plan's Planning Basis,
Current Position and Plan Summary. These summaries are retrieval indices. Do not
bulk-load Lessons, cards, complete Trace history or Planner Attention.

Open an original Lesson, active Trace, card or student statement only when it could
change the decision. When history is broad or conflicting and deep mode is enabled,
use one to three genuinely independent Evidence Scout questions. Child findings are
read-only inputs; the parent Coach decides and writes.

With no prior evidence, treat the student's account as an unverified starting point.
Agree on the long-term goal, constraints, observable capability standard and direct
test. Use a short diagnostic first Plan when the starting cause is unresolved. Never
infer a weakness from the method graph or available cards.

## Respect scope

Explain the learning set, compare cycles, revise Roadmap goals after student approval,
or propose a new Plan. If the decision changes an existing Plan's Current Position,
status, next Lesson or preparation, send the student to that Plan Coach. Do not edit
an existing Plan, prepare a Lesson, teach a Lesson or write classroom Trace.

## Publish a new cycle

Present one proposed Plan in student language and obtain explicit confirmation.
Then write a new plans/<plan-id>.md with frontmatter kind: plan, status: active and
coach_session: null. It must contain exactly one non-empty Goal, Observable Capability
Standard, Test, Planning Basis, Lesson Index, Current Position, Next Lesson Candidate
and Plan Summary section. Before a real Lesson exists, Lesson Index is only （暂无）.

Planning Basis states why this direction matters now, the student statements or exact
sources that changed the choice, and what later result would support or overturn it.
Call plan_register, reread the Plan and ROADMAP.md, and report only the persisted
state. Never announce an unregistered file as a Plan and never create a Tutor or
Lesson from this Session.
```

- [ ] **Step 7: Implement scope-aware active and custom tools**

In `src/runtime/session-factory.ts`, add:

```ts
export function scopeToolNames(scope: StudySessionScope): string[] {
  if (!isRoadmapCoachScope(scope)) return roleToolNames(scope.role);
  return [
    'read',
    'grep',
    'find',
    'ls',
    'write',
    'edit',
    'card_search',
    'trace_search',
    'source_resolve',
    'plan_register',
    'deep_workflow_propose',
  ];
}
```

Build Coach custom tools with:

```ts
const ownerTools: ToolDefinition[] = role === 'tutor'
  ? [
    createClassroomUpdateTool(root, ownerPath),
    createLessonCloseTool(root, ownerPath),
    createCardAlternativeAppendTool(root, ownerPath, now),
  ]
  : isRoadmapCoachScope(scope)
    ? [createPlanRegisterTool(root)]
    : [
      createLessonPrepareTool(root, ownerId, ownerPath),
      createPlanRegisterTool(root),
      createPlanUpdateTool(root, ownerPath),
    ];
```

Use `ownerTools` in `customTools` and pass `scopeToolNames(scope)` to
`createAgentSession`.

- [ ] **Step 8: Run the focused tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-scope.test.ts \
  tests/runtime/resource-loader.test.ts \
  tests/runtime/session-factory.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/pi-teaching-web/resources/agents/roadmap-coach.md \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/runtime/session-scope.test.ts \
  apps/pi-teaching-web/tests/runtime/resource-loader.test.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts
git commit -m "feat: scope coach tools to roadmap planning"
```

---

### Task 3: Roadmap Session 创建、写回与恢复

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Test: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

**Interfaces:**
- Consumes: `ROADMAP_COACH_SCOPE`, `ROADMAP_COACH_SESSION_KEY`
- Consumes: `readRoadmapWorkspace(root)`
- Produces: `roadmapSnapshot(): RoadmapWorkspaceSnapshot`
- Produces: `openRoadmapCoach(): Promise<StudySession>`
- Produces: public `openSession(key: SessionKey): Promise<StudySession>`

- [ ] **Step 1: Write failing persistence tests**

Add:

```ts
test('creates and persists one Roadmap Coach with the canonical owner scope', async () => {
  const root = fixture();
  const created: Array<StudySessionScope & { sessionFile: string | null }> = [];
  const factory: StudySessionFactory = async (input) => {
    created.push(input);
    return {
      sessionId: 'roadmap-session-001',
      sessionFile: '/tmp/roadmap-session-001.jsonl',
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  const opened = await registry.openRoadmapCoach();

  expect(opened.sessionId).toBe('roadmap-session-001');
  expect(created).toEqual([{
    role: 'coach',
    ownerId: '@roadmap',
    ownerPath: 'ROADMAP.md',
    sessionFile: null,
  }]);
  expect(readFileSync(join(root, 'ROADMAP.md'), 'utf8'))
    .toContain('roadmap_coach_session: roadmap-session-001');
  expect(registry.roadmapSnapshot().coach.sessionId).toBe('roadmap-session-001');
  expect(await registry.openSession('coach:@roadmap')).toBe(opened);
});

test('reuses a persisted Roadmap Session only after owner validation', async () => {
  const root = fixture();
  const roadmapPath = join(root, 'ROADMAP.md');
  writeFileSync(
    roadmapPath,
    readFileSync(roadmapPath, 'utf8').replace(
      'status: active',
      'status: active\nroadmap_coach_session: saved-roadmap-session',
    ),
  );
  const checked: Array<{ sessionId: string; expected: StudySessionScope }> = [];
  const opened: Array<string | null> = [];
  const factory: StudySessionFactory = async ({ sessionFile }) => {
    opened.push(sessionFile);
    return {
      sessionId: 'saved-roadmap-session',
      sessionFile: sessionFile ?? '/tmp/fresh-roadmap-session.jsonl',
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async (_root, sessionId, expected) => {
    checked.push({ sessionId, expected });
    return '/tmp/saved-roadmap-session.jsonl';
  });

  await registry.openRoadmapCoach();

  expect(checked).toEqual([{
    sessionId: 'saved-roadmap-session',
    expected: {
      role: 'coach',
      ownerId: '@roadmap',
      ownerPath: 'ROADMAP.md',
    },
  }]);
  expect(opened).toEqual(['/tmp/saved-roadmap-session.jsonl']);
});
```

- [ ] **Step 2: Run the registry test and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/workspace-registry.test.ts
```

Expected: FAIL because Roadmap registry methods do not exist.

- [ ] **Step 3: Implement Roadmap Session ownership**

Import the Roadmap contracts, reader and scope, then add to `WorkspaceRegistry`:

```ts
roadmapSnapshot(): RoadmapWorkspaceSnapshot {
  return readRoadmapWorkspace(this.root);
}

async openRoadmapCoach(): Promise<StudySession> {
  const cached = this.sessions.get(ROADMAP_COACH_SESSION_KEY);
  if (cached) return cached;
  const snapshot = this.roadmapSnapshot();
  const sessionFile = snapshot.coach.sessionId
    ? await this.lookup(this.root, snapshot.coach.sessionId, ROADMAP_COACH_SCOPE)
    : null;
  const session = await this.factory({
    ...ROADMAP_COACH_SCOPE,
    sessionFile,
  });
  this.sessions.set(ROADMAP_COACH_SESSION_KEY, session);
  setFrontmatterField(
    this.root,
    ROADMAP_COACH_SCOPE.ownerPath,
    'roadmap_coach_session',
    session.sessionId,
  );
  return session;
}
```

Make `openSession` public and dispatch the reserved key first:

```ts
async openSession(key: SessionKey): Promise<StudySession> {
  if (key === ROADMAP_COACH_SESSION_KEY) return this.openRoadmapCoach();
  return key.startsWith('coach:')
    ? this.openCoach(key.slice(6))
    : this.openTutor(key.slice(6));
}
```

Change `setPersona` to call `await this.openSession(key)` instead of duplicating role
dispatch. Existing deep-mode and workflow methods already route through `openSession`.

- [ ] **Step 4: Run registry tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/workspace-registry.test.ts
```

Expected: all registry tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts
git commit -m "feat: persist roadmap coach sessions"
```

---

### Task 4: Roadmap API、消息路由与 Learning Set 刷新

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Test: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Consumes: `WorkspaceRegistry.roadmapSnapshot()` and `.openSession(key)`
- Produces: `GET /api/workspaces/roadmap`
- Produces: `api.roadmapWorkspace(): Promise<RoadmapWorkspaceSnapshot>`
- Produces event: `{ type: 'learning-set'; value: LearningSetSnapshot }`

- [ ] **Step 1: Write failing API tests**

Define a `roadmapWorkspace` fixture beside `workspace`:

```ts
const roadmapWorkspace = {
  learningSet,
  coach: {
    sessionKey: 'coach:@roadmap',
    sessionId: 'roadmap-session-001',
  },
} as const;
```

Add:

```ts
test('returns the Roadmap Coach workspace', async () => {
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      roadmapSnapshot: () => roadmapWorkspace,
    } as never,
  });

  const response = await handler(new Request('http://local/api/workspaces/roadmap'));
  expect(response!.status).toBe(200);
  expect(await response!.json()).toEqual(roadmapWorkspace);
});

test('opens the reserved Roadmap Session before returning history', async () => {
  const calls: string[] = [];
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    registry: {
      openSession: async (key: string) => {
        calls.push(`open:${key}`);
        return { sessionId: 'roadmap-session-001' };
      },
      history: () => {
        calls.push('history');
        return [];
      },
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const response = await handler(
    new Request('http://local/api/sessions/coach%3A%40roadmap/history'),
  );
  expect(response!.status).toBe(200);
  expect(calls).toEqual(['open:coach:@roadmap', 'history']);
});
```

Add a completion-event test:

```ts
test('publishes a fresh Learning Set after a Roadmap Coach turn', async () => {
  const events: unknown[] = [];
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const hub = new EventHub();
  hub.subscribe((event) => {
    events.push(event);
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    readLearningSet: () => learningSet,
    registry: {
      openSession: async () => ({ sessionId: 'roadmap-session-001' }),
      send: async () => {},
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const response = await handler(new Request(
    'http://local/api/sessions/coach%3A%40roadmap/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '建立第一个学习周期' }),
    },
  ));
  expect(response!.status).toBe(202);
  await idle;
  expect(events).toContainEqual({ type: 'learning-set', value: learningSet });
  expect(events.some((event) => (
    typeof event === 'object'
    && event !== null
    && 'type' in event
    && (event as { type: string }).type === 'snapshot'
  ))).toBe(false);
});
```

- [ ] **Step 2: Run the server tests and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts
```

Expected: FAIL because the Roadmap endpoint, unified open call and event do not exist.

- [ ] **Step 3: Add the Learning Set event contract**

Append this member to `StudyViewEvent` in `src/shared/contracts.ts`:

```ts
| { type: 'learning-set'; value: LearningSetSnapshot }
```

- [ ] **Step 4: Add the API endpoint and unified Session opening**

In `src/server/app.ts`, place this exact route before the generic Plan workspace regex:

```ts
if (request.method === 'GET' && url.pathname === '/api/workspaces/roadmap') {
  return json(deps.registry.roadmapSnapshot());
}
```

In both Session history and Session message handlers, replace prefix-based direct calls
with:

```ts
const session = await deps.registry.openSession(key);
```

The history handler only needs:

```ts
await deps.registry.openSession(key);
bind(key);
return json(deps.registry.history(key, projectionMode));
```

Use this completion branch in the message handler:

```ts
if (key === ROADMAP_COACH_SESSION_KEY) {
  deps.hub.publish({
    type: 'learning-set',
    value: learningSetReader(deps.root),
  });
  return;
}
const planId = key.startsWith('coach:')
  ? key.slice(6)
  : deps.registry.snapshot().plan.id;
deps.hub.publish({
  type: 'snapshot',
  workspace: deps.registry.snapshot(planId),
});
```

Import `ROADMAP_COACH_SESSION_KEY` from shared contracts.

- [ ] **Step 5: Add the client API**

Import `RoadmapWorkspaceSnapshot` and add to `src/client/api.ts`:

```ts
roadmapWorkspace: () => (
  json<RoadmapWorkspaceSnapshot>('/api/workspaces/roadmap')
),
```

- [ ] **Step 6: Update existing server mocks to the unified opener**

Every `workspace-api.test.ts` registry double exercised by a history or message request
must provide:

```ts
openSession: async (key: SessionKey) => ({
  sessionId: key.startsWith('tutor:') ? 'tutor-l1' : 'coach-p1',
}),
```

Remove the corresponding `openCoach`/`openTutor` mock methods from those test cases so
the tests prove the server uses the unified boundary.

- [ ] **Step 7: Run server tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts
```

Expected: all server API tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: expose roadmap coach workspace"
```

---

### Task 5: `/roadmap` 路由与独立 Coach 页面

**Files:**
- Create: `apps/pi-teaching-web/src/client/components/RoadmapCoachShell.tsx`
- Create: `apps/pi-teaching-web/tests/client/roadmap-coach-shell.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Test: `apps/pi-teaching-web/tests/client/routes.test.ts`

**Interfaces:**
- Consumes: `api.roadmapWorkspace()`, `ROADMAP_COACH_SESSION_KEY`, `ChatPanel`
- Produces: `BrowserRoute = { kind: 'roadmap' }`
- Produces: `RoadmapCoachShell`
- Preserves: existing `/`, `/plan/:id`, and `/plan/:id/lesson/:lessonId`

- [ ] **Step 1: Write failing route and shell tests**

Add `{ kind: 'roadmap' as const }` to the route round-trip list and add `/roadmap/` to
the rejected trailing-slash paths in `tests/client/routes.test.ts`.

Create `tests/client/roadmap-coach-shell.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoadmapCoachShell } from '../../src/client/components/RoadmapCoachShell';

test('shows compact learning-set context around the Roadmap chat', () => {
  const html = renderToStaticMarkup(
    <RoadmapCoachShell
      learningSet={{
        title: '导数高阶研习',
        overview: '学习集概述',
        learningPrinciples: '研习原则',
        goal: '建立可迁移的结构判断。',
        plans: [],
      }}
      onHome={() => {}}
    >
      <div>CHAT SLOT</div>
    </RoadmapCoachShell>,
  );

  expect(html).toContain('总览与规划');
  expect(html).toContain('导数高阶研习');
  expect(html).toContain('建立可迁移的结构判断');
  expect(html).toContain('尚未建立学习周期');
  expect(html).toContain('CHAT SLOT');
  expect(html).not.toContain('Lesson');
});
```

- [ ] **Step 2: Run the client tests and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/routes.test.ts \
  tests/client/roadmap-coach-shell.test.tsx
```

Expected: FAIL because the route and component do not exist.

- [ ] **Step 3: Add the browser route**

Extend `BrowserRoute` in `src/client/routes.ts`:

```ts
export type BrowserRoute =
  | { kind: 'home' }
  | { kind: 'roadmap' }
  | { kind: 'coach'; planId: string }
  | { kind: 'lesson'; planId: string; lessonId: string };
```

Parse and format it with:

```ts
if (pathname === '/roadmap') return { kind: 'roadmap' };
```

and:

```ts
if (route.kind === 'home') return '/';
if (route.kind === 'roadmap') return '/roadmap';
```

- [ ] **Step 4: Create the Roadmap shell**

Create `src/client/components/RoadmapCoachShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { LearningSetSnapshot } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function RoadmapCoachShell({
  learningSet,
  onHome,
  children,
}: {
  learningSet: LearningSetSnapshot;
  onHome(): void;
  children: ReactNode;
}) {
  return (
    <main className="roadmap-workspace">
      <aside className="roadmap-context">
        <button type="button" className="roadmap-home" onClick={onHome}>
          <span className="brand-mark">SF</span>
          <span><b>返回学习集</b><small>StudyForge</small></span>
        </button>
        <p className="section-label">总览与规划</p>
        <h1>{learningSet.title}</h1>
        <div className="roadmap-goal">
          <MarkdownView>{learningSet.goal}</MarkdownView>
        </div>
        <p className="roadmap-cycle-count">
          {learningSet.plans.length === 0
            ? '尚未建立学习周期'
            : `已建立 ${learningSet.plans.length} 个学习周期`}
        </p>
      </aside>
      {children}
    </main>
  );
}
```

- [ ] **Step 5: Add Roadmap page state and route loading**

In `src/client/App.tsx`:

1. Import `ROADMAP_COACH_SESSION_KEY`, `RoadmapWorkspaceSnapshot`, and
   `RoadmapCoachShell`.
2. Add:

```ts
const [roadmapWorkspace, setRoadmapWorkspace] =
  useState<RoadmapWorkspaceSnapshot | null>(null);
```

3. In `openRoute`, make the home branch call `setRoadmapWorkspace(null)`.
4. Before loading a Plan workspace, add:

```ts
if (route.kind === 'roadmap') {
  const workspace = await api.roadmapWorkspace();
  const selected = workspace.coach.sessionKey;
  const history = await api.history(selected);
  setLearningSet(workspace.learningSet);
  setRoadmapWorkspace(workspace);
  setClient({
    ...initialClientState,
    selected,
    messages: { [selected]: history },
  });
  if (navigation === 'push') {
    window.history.pushState(null, '', formatBrowserRoute(route));
  }
  if (navigation === 'replace') {
    window.history.replaceState(null, '', formatBrowserRoute(route));
  }
  return;
}
setRoadmapWorkspace(null);
```

5. In the WebSocket handler, process the new event before the reducer:

```ts
if (event.type === 'learning-set') {
  setLearningSet(event.value);
  setRoadmapWorkspace((current) => (
    current ? { ...current, learningSet: event.value } : current
  ));
  return;
}
```

- [ ] **Step 6: Render the dedicated Roadmap page**

Immediately before the existing home-only return, add:

```tsx
if (
  roadmapWorkspace
  && client.selected === ROADMAP_COACH_SESSION_KEY
) {
  const selected = ROADMAP_COACH_SESSION_KEY;
  const sessionBusy = Boolean(client.busy[selected]);
  return (
    <div
      className="app-root"
      data-theme="liubai-xinzhongshi"
      data-view="roadmap"
      data-persona={persona?.id ?? 'neutral-tutor'}
    >
      {connection !== 'open' && (
        <div className="connection-banner" role="status">
          <span />
          {connection === 'connecting'
            ? '正在连接规划事件流…'
            : '事件流已断开，正在重连…'}
        </div>
      )}
      {pageError && <div className="page-alert" role="alert">{pageError}</div>}
      <RoadmapCoachShell
        learningSet={roadmapWorkspace.learningSet}
        onHome={goHome}
      >
        <ChatPanel
          sessionKey={selected}
          messages={client.messages[selected] ?? []}
          work={client.work[selected] || client.busy[selected] || ''}
          error={client.errors[selected]}
          composerEnabled={!sessionBusy}
          persona={persona}
          deepMode={client.deepMode[selected] ?? false}
          workflows={client.workflows[selected] ?? []}
          workflowControlsEnabled
          gate={null}
          onSend={send}
          onPersona={changePersona}
          onDeepMode={changeDeepMode}
          onWorkflowAction={actOnWorkflow}
        />
      </RoadmapCoachShell>
    </div>
  );
}
```

- [ ] **Step 7: Add the two-column Roadmap styles**

Append to `src/client/styles.css`:

```css
.roadmap-workspace {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(260px, 34vw) minmax(430px, 1fr);
  border-top: 3px solid var(--ink);
  background: var(--paper);
  animation: page-in .42s ease-out both;
}

.roadmap-context {
  min-height: 100vh;
  padding: clamp(1.35rem, 4vw, 3.5rem);
  border-right: 1px solid var(--rule);
  background: var(--paper-deep);
}

.roadmap-home {
  width: 100%;
  display: flex;
  gap: .75rem;
  align-items: center;
  padding: 0 0 1.3rem;
  border: 0;
  border-bottom: 1px solid var(--rule);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.roadmap-home > span:last-child {
  display: grid;
  gap: .15rem;
}

.roadmap-home b {
  font-family: var(--font-display);
  font-size: .92rem;
}

.roadmap-home small,
.roadmap-cycle-count {
  color: var(--ink-faint);
  font-size: .65rem;
}

.roadmap-context h1 {
  margin: .8rem 0 1.2rem;
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4.2vw, 4.5rem);
  font-weight: 500;
  letter-spacing: -.045em;
  line-height: 1;
}

.roadmap-goal {
  color: var(--ink-soft);
  font-family: var(--font-reading);
  line-height: 1.8;
}

.roadmap-cycle-count {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
}

@media (max-width: 760px) {
  .roadmap-workspace { display: block; }
  .roadmap-context {
    min-height: auto;
    padding: 1rem;
    border-right: 0;
    border-bottom: 1px solid var(--rule);
  }
  .roadmap-context .section-label,
  .roadmap-goal,
  .roadmap-cycle-count { display: none; }
  .roadmap-context h1 { margin: 1rem 0 0; font-size: 1.6rem; }
}
```

- [ ] **Step 8: Run client tests and typecheck**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/routes.test.ts \
  tests/client/roadmap-coach-shell.test.tsx
bun run typecheck
```

Expected: focused tests PASS and TypeScript exits with code 0.

- [ ] **Step 9: Commit**

```bash
git add apps/pi-teaching-web/src/client/components/RoadmapCoachShell.tsx \
  apps/pi-teaching-web/src/client/routes.ts \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/client/routes.test.ts \
  apps/pi-teaching-web/tests/client/roadmap-coach-shell.test.tsx
git commit -m "feat: add roadmap coach page"
```

---

### Task 6: 首页自适应规划入口

**Files:**
- Modify: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Test: `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`

**Interfaces:**
- Produces: `LearningSetHome.onRoadmapOpen(): void`
- Preserves: `LearningSetHome.onOpen(planId)`
- Consumes: `value.plans.length`

- [ ] **Step 1: Write failing empty and non-empty home tests**

Change the test helper to accept Plans:

```ts
function learningSet(
  learningPrinciples: string,
  plans: LearningSetSnapshot['plans'] = [],
): LearningSetSnapshot {
  return {
    title: '测试学习集',
    overview: '学习集概述',
    learningPrinciples,
    goal: '学习目标',
    plans,
  };
}
```

Pass `onRoadmapOpen={() => {}}` to existing renders, then add:

```tsx
test('promotes Roadmap planning when no Plan exists', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome
      value={learningSet('')}
      onOpen={() => {}}
      onRoadmapOpen={() => {}}
    />,
  );

  expect(html).toContain('建立第一个学习周期');
  expect(html).toContain('roadmap-entry primary');
  expect(html).not.toContain('选择当前学习周期');
});

test('keeps Roadmap planning quiet after Plans exist', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome
      value={learningSet('', [{
        id: 'p1',
        title: '现有周期',
        path: 'plans/p1.md',
        status: 'active',
        goal: '目标',
        capabilityStandard: '标准',
        planningBasis: '依据',
      }])}
      onOpen={() => {}}
      onRoadmapOpen={() => {}}
    />,
  );

  expect(html).toContain('现有周期');
  expect(html).toContain('总览与规划');
  expect(html).toContain('roadmap-entry quiet');
  expect(html).toContain('选择当前学习周期');
});
```

- [ ] **Step 2: Run the home tests and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/learning-set-home.test.tsx
```

Expected: FAIL because the callback and adaptive entry do not exist.

- [ ] **Step 3: Implement the adaptive entry**

Extend `LearningSetHome` props with `onRoadmapOpen(): void`. Replace the `plan-list`
contents with:

```tsx
<section className="plan-list" aria-label="学习计划">
  <p className="section-label">
    {value.plans.length === 0 ? '从这里开始' : '选择当前学习周期'}
  </p>
  {value.plans.map((plan, index) => (
    <button key={plan.id} type="button" onClick={() => onOpen(plan.id)}>
      <span className="plan-number">{String(index + 1).padStart(2, '0')}</span>
      <span className="plan-copy">
        <small>{plan.status}</small>
        <strong>{plan.title}</strong>
        <span>{plan.capabilityStandard}</span>
      </span>
      <span className="plan-arrow" aria-hidden="true">↗</span>
    </button>
  ))}
  <button
    type="button"
    className={`roadmap-entry ${value.plans.length === 0 ? 'primary' : 'quiet'}`}
    onClick={onRoadmapOpen}
  >
    <span className="plan-number">{value.plans.length === 0 ? '始' : '策'}</span>
    <span className="plan-copy">
      <small>{value.plans.length === 0 ? '学习商议' : '学习集'}</small>
      <strong>
        {value.plans.length === 0 ? '建立第一个学习周期' : '总览与规划'}
      </strong>
      <span>
        {value.plans.length === 0
          ? '先说说你的目标、现状与时间安排。'
          : '回看全局 · 开启新的学习周期'}
      </span>
    </span>
    <span className="plan-arrow" aria-hidden="true">↗</span>
  </button>
</section>
```

In `App.tsx`, pass:

```tsx
onRoadmapOpen={() => void openRoute({ kind: 'roadmap' }, 'push')}
```

- [ ] **Step 4: Style primary and quiet states**

Append:

```css
.plan-list > .roadmap-entry.primary {
  margin-top: .35rem;
  padding: 1.5rem 1.25rem;
  color: var(--paper);
  background: var(--accent-deep);
}

.plan-list > .roadmap-entry.primary .plan-number,
.plan-list > .roadmap-entry.primary .plan-copy small,
.plan-list > .roadmap-entry.primary .plan-copy > span {
  color: color-mix(in srgb, var(--paper) 72%, transparent);
}

.plan-list > .roadmap-entry.primary:hover {
  padding-left: 1.7rem;
  color: var(--paper);
}

.plan-list > .roadmap-entry.quiet {
  margin-top: 1rem;
  color: var(--ink-soft);
  border-top: 1px solid var(--ink);
}

.plan-list > .roadmap-entry.quiet strong {
  font-size: 1.05rem;
}
```

- [ ] **Step 5: Run home tests and build**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/learning-set-home.test.tsx
bun run build
```

Expected: tests PASS and Vite build exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/client/components/LearningSetHome.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/client/learning-set-home.test.tsx
git commit -m "feat: add adaptive roadmap planning entry"
```

---

### Task 7: 浏览器级恢复验收

**Files:**
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`

**Interfaces:**
- Consumes: `readRoadmapWorkspace`, `ROADMAP_COACH_SESSION_KEY`
- Verifies: homepage → `/roadmap` → same history after refresh → homepage
- Verifies: existing Plan remains the primary normal learning path

- [ ] **Step 1: Extend the E2E registry fixture**

Import `ROADMAP_COACH_SESSION_KEY` and `readRoadmapWorkspace`, define:

```ts
const roadmapKey: SessionKey = ROADMAP_COACH_SESSION_KEY;
```

After `fixtureHistory` is created, seed one safe Coach message:

```ts
fixtureHistory.set(roadmapKey, [{
  id: 'fixture-roadmap-message',
  role: 'coach',
  text: '这里用于回看整个学习集，并在你确认后开启新的学习周期。',
  complete: true,
}]);
```

Add these methods to the fixture registry:

```ts
roadmapSnapshot: () => readRoadmapWorkspace(root),
openSession: async (key: SessionKey) => ({
  sessionId: key === roadmapKey ? 'fixture-roadmap-coach' : `fixture-${key}`,
}),
```

Keep `openCoach` and `openTutor` only if another direct fixture call still consumes them;
the HTTP history and message paths must use `openSession`.

- [ ] **Step 2: Write the failing E2E**

Add to `tests/e2e/workspace.spec.ts`:

```ts
test('keeps global planning available without turning it into the home workspace', async ({ page }) => {
  await page.goto('/');

  const entry = page.getByRole('button', { name: /总览与规划/ });
  await expect(entry).toBeVisible();
  await expect(entry).toHaveClass(/quiet/);
  await expect(page.getByRole('button', { name: /定义域完整性的系统加固/ }))
    .toBeVisible();

  await entry.click();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'roadmap');
  await expect(page.getByText('这里用于回看整个学习集')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(page.getByText('这里用于回看整个学习集')).toBeVisible();

  await page.getByRole('button', { name: /返回学习集/ }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: /定义域完整性的系统加固/ }))
    .toBeVisible();
});
```

- [ ] **Step 3: Run the focused E2E and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bunx playwright test tests/e2e/workspace.spec.ts \
  --grep "keeps global planning available"
```

Expected: FAIL before the fixture and page integration are complete.

- [ ] **Step 4: Run the focused and full E2E suites**

Run:

```bash
cd apps/pi-teaching-web
bunx playwright test tests/e2e/workspace.spec.ts \
  --grep "keeps global planning available"
bun run test:e2e
```

Expected: the focused test PASSes; the full Playwright suite reports zero failures.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/tests/e2e/fixture-server.ts \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts
git commit -m "test: verify roadmap coach navigation"
```

---

### Task 8: 当前契约文档、公开示例与自动验证

**Files:**
- Modify: `examples/derivative-demo/learning-set/ROADMAP.md`
- Modify: `AGENTS.md`
- Modify: `docs/zh-CN/完整说明书.md`

**Interfaces:**
- Documents: one Roadmap Coach Session per learning set
- Documents: adaptive homepage entry and `/roadmap`
- Documents: Roadmap/Plan Coach authority split
- Preserves: four public Claude MCP tools

- [ ] **Step 1: Make the public Roadmap Session slot explicit**

Add below `status: active` in the derivative demo:

```yaml
roadmap_coach_session: null
```

- [ ] **Step 2: Update the repository runtime contract**

In `AGENTS.md`, change the Pi role summary to:

```markdown
The web runtime has two durable Agent roles:

- one Roadmap-scoped Coach Session per learning set;
- one Plan-scoped Coach Session per entered Plan;
- one Tutor Session per started Lesson.

Roadmap Coach owns global direction, cross-Plan review and creation of a new
student-approved Plan. It may register a new Plan but does not receive
`plan_update` or `lesson_prepare`. Plan Coach owns the current Plan and may use
`lesson_prepare`, `plan_register`, and `plan_update`; Tutor owns the current
Lesson and classroom fact tools.
```

Add the Roadmap owner triple and persisted field beside the existing owner rule:

```markdown
The Roadmap Coach uses `role: coach`, `ownerId: @roadmap`,
`ownerPath: ROADMAP.md`, and persists its Session ID as
`roadmap_coach_session`.
```

- [ ] **Step 3: Update the Chinese user manual**

In `docs/zh-CN/完整说明书.md`:

1. Replace the Pi runtime overview paragraph with:

```markdown
**Pi 教学前端**适合连续课堂体验。每个学习集可以拥有一个低频使用的
Roadmap Coach Session，每个进入过的 Plan 拥有自己的 Coach Session，每个已开始
Lesson 拥有一个独立 Tutor Session。学生在同一网页中切换，各 Session 的历史不互相
复制，只通过 Roadmap、Plan、Lesson、active Trace 和带来源摘要交接。
```

2. Add this paragraph to the Roadmap section:

```markdown
Pi 首页在尚无 Plan 时把“建立第一个学习周期”作为主要入口；已有 Plan
后，同一入口退到列表末尾并显示为“总览与规划”。它打开独立的
`/roadmap` Coach Session，用于首次目标商议、跨 Plan 回顾和开启新周期。
Roadmap Coach 不备 Lesson，也不修改已有 Plan；进入具体 Plan 后，日常复盘
和备课仍由该 Plan 的 Coach 完成。
```

3. Extend the Session identity section with:

```markdown
Roadmap Coach 的 Session ID 写在 `ROADMAP.md / roadmap_coach_session`。
它与各 Plan Coach 的历史互不复制，新 Plan 只通过注册后的 Markdown 和
`Planning Basis` 交接。
```

4. Add this paragraph to the Pi browser flow:

```markdown
浏览器也保存 `/roadmap` 位置。刷新、后退、前进或直接打开该地址时，前端根据
`ROADMAP.md` 中的 Session 引用和 owner 元数据恢复同一个总览规划对话；返回首页时
重新读取 Plan Graph。Roadmap Coach 暂时不可用不会阻止任何已注册 Plan 或 Lesson。
```

- [ ] **Step 4: Run full verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e

cd ../../plugins/highschool-study
bun run release:check
```

Expected:

- `bun run check`: typecheck, unit tests and Vite production build all exit 0;
- `bun run test:e2e`: zero Playwright failures;
- `bun run release:check`: strict plugin validation succeeds and public MCP count remains 4.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only the files named by this plan are modified, while
pre-existing `.superpowers/` and unrelated untracked files remain unstaged.

- [ ] **Step 6: Commit**

```bash
git add examples/derivative-demo/learning-set/ROADMAP.md \
  AGENTS.md \
  docs/zh-CN/完整说明书.md
git commit -m "docs: describe roadmap coach planning"
```

- [ ] **Step 7: Record automatic verification evidence**

Run:

```bash
git status --short
git log -8 --oneline
```

Expected: the eight feature commits are visible in order; only pre-existing unrelated
untracked files remain.

---

### Task 9: 隔离学习集上的真实模型首次规划验收

**Files:**
- Create: `docs/audits/2026-07-28-roadmap-coach-first-plan-acceptance.md`

**Interfaces:**
- Consumes: built Pi web runtime and configured local Pi provider
- Verifies: empty-home entry, Roadmap history recovery, student confirmation, strict Plan registration, separate Plan Coach Session
- Does not mutate: `examples/derivative-demo/learning-set`

- [ ] **Step 1: Create an isolated acceptance copy**

Run:

```bash
export ACCEPTANCE_ROOT="$(mktemp -d /tmp/studyforge-roadmap-coach-acceptance-XXXXXX)"
cp -R examples/derivative-demo/learning-set "$ACCEPTANCE_ROOT/learning-set"
rg --files "$ACCEPTANCE_ROOT/learning-set/plans" || true
```

Expected: the copied learning set exists; the source example remains untouched. If the
copy contains a Plan file not linked by the empty `Plan Graph`, leave it unlinked and
record the filename in the audit.

- [ ] **Step 2: Start the production build against the copy**

Run from the repository root:

```bash
cd apps/pi-teaching-web
bun run build
STUDY_LEARNING_SET="$ACCEPTANCE_ROOT/learning-set" \
  STUDY_WEB_PORT=65320 \
  bun run start >"$ACCEPTANCE_ROOT/server.log" 2>&1 &
echo $! >"$ACCEPTANCE_ROOT/server.pid"
for attempt in {1..30}; do
  curl -fsS http://127.0.0.1:65320/api/health && break
  sleep 1
done
```

Expected: health returns `{"ok":true,"runtime":"pi"}` within 30 seconds.

- [ ] **Step 3: Verify empty-home and Session recovery in a real browser**

Use the browser against `http://127.0.0.1:65320/` and perform exactly this flow:

1. Confirm the primary action is “建立第一个学习周期”.
2. Click it and confirm the URL is `/roadmap`.
3. Send:

```text
我想用这个学习集提高导数综合题的结构判断。每周学习三次，每次约 45 分钟。先和我讨论第一个学习周期，不要直接写文件。
```

4. Answer any necessary goal question naturally, but do not confirm a Plan yet.
5. Refresh `/roadmap` and confirm the preceding conversation is still visible.
6. Inspect the copied `ROADMAP.md` and confirm `roadmap_coach_session` is a non-null
   Session ID while `Plan Graph` is still empty.

- [ ] **Step 4: Confirm and register one real Plan**

Continue the same Roadmap Session with:

```text
我确认采用你刚才提出的第一个 Plan。现在请写入并注册；完成后重读 ROADMAP 和 Plan，只告诉我真正写入后的结果。
```

After the turn becomes idle, inspect the copy:

```bash
cd "$ACCEPTANCE_ROOT/learning-set"
rg -n "^roadmap_coach_session:|^## Plan Graph|\\]\\(plans/" ROADMAP.md
rg -n "^id:|^kind:|^status:|^coach_session:|^## (Goal|Observable Capability Standard|Test|Planning Basis|Lesson Index|Current Position|Next Lesson Candidate|Plan Summary)$|（暂无）" plans/*.md
```

Expected:

- exactly one new Plan is linked under `ROADMAP.md / Plan Graph`;
- its frontmatter has `kind: plan`, `status: active`, and `coach_session: null`;
- all eight strict sections appear exactly once and are non-empty;
- `Lesson Index` contains only `（暂无）`;
- `Planning Basis` contains the student context or real source that changed the choice;
- no Lesson file or Tutor Session is created.

- [ ] **Step 5: Verify the separate Plan Coach handoff**

Return to the homepage, click the newly registered Plan, and verify:

1. the URL matches `/plan/[a-z0-9-]+`;
2. the Plan page opens a Coach Session;
3. the Plan's `coach_session` becomes non-null;
4. that ID differs from `ROADMAP.md / roadmap_coach_session`;
5. the Roadmap conversation is not copied into the Plan chat;
6. returning to `/roadmap` restores the original Roadmap conversation.

- [ ] **Step 6: Write the acceptance report**

Create `docs/audits/2026-07-28-roadmap-coach-first-plan-acceptance.md`. Under
“环境”, record the exact expanded acceptance learning-set path, the provider and
model names from Session metadata, `http://127.0.0.1:65320`, and the fact that the
source example remained unchanged. Then use this fixed structure:

```markdown
# Roadmap Coach 首次规划真实模型验收

日期：2026-07-28

## 环境

## 结果

| 验收项 | 结果 | 来源 |
| --- | --- | --- |

## 观察

只记录会影响首次规划或交接的真实问题。不要粘贴凭据、完整系统提示词、私密推理或逐字对话。

## 结论
```

The result table must contain exactly these seven rows with an observed `PASS` or
`FAIL`: 空学习集主入口、Roadmap Session 写回、刷新恢复同一历史、确认前不注册
Plan、严格 Plan 注册、不预建 Lesson、Plan Coach 独立 Session。Use the concrete
page/URL, Roadmap frontmatter, Plan Graph, Plan Markdown, lessons directory, or two
Session references as the corresponding source. The final conclusion is
`ROADMAP_COACH_ACCEPTED` only when all seven rows pass; otherwise it is
`ROADMAP_COACH_BLOCKED`.

- [ ] **Step 7: Stop the isolated server**

Run:

```bash
kill "$(cat "$ACCEPTANCE_ROOT/server.pid")"
```

Expected: the server exits; the isolated learning set and log remain under
`$ACCEPTANCE_ROOT` for local inspection and are not staged.

- [ ] **Step 8: Commit the acceptance record**

```bash
git add docs/audits/2026-07-28-roadmap-coach-first-plan-acceptance.md
git commit -m "test: accept roadmap coach first plan flow"
```

- [ ] **Step 9: Verify final repository state**

Run:

```bash
git status --short
git log -9 --oneline
```

Expected: all nine implementation commits are visible; only the pre-existing
unrelated untracked files remain.
