# Pi 教学 Web 前端核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前仓库中增加一个 Pi 驱动的本地 Web 前端，让学生从学习集首页进入 Plan 工作区，在 Coach 根 Session 与 Lesson Tutor 子 Session 之间完成备课、上课、暂停、重备、关闭、证据查看和回放。

**Architecture:** 新建 `apps/pi-teaching-web/`，使用 Pi `AgentSession` SDK、Bun HTTP/WebSocket 服务和 React/Vite 客户端。Markdown learning set 仍是唯一教学事实源，Pi JSONL 仍是唯一会话记录；前端只投影两者。现有四工具领域实现通过 `highschool-study-markdown/study-domain` 共享，深度模式由独立计划接入，不混入本计划。

**Tech Stack:** Bun 1.3.14、TypeScript 7.0.2、`@earendil-works/pi-coding-agent` 0.81.0、React 19.2.8、Vite 8.1.5、TypeBox 1.3.6、YAML 2.9.0、KaTeX 0.18.1、`bun:test`、Playwright 1.61.1。

**Design spec:** [`docs/superpowers/specs/2026-07-21-pi-teaching-web-frontend-design.md`](../specs/2026-07-21-pi-teaching-web-frontend-design.md)

## Global Constraints

- 首版只支持本地单学生、单进程和 Pi，不抽象 Claude Code/OpenCode runtime。
- 只保留 Coach 和 Tutor 两类用户可见 Agent；Coach 每个 Plan 一个 Session，Tutor 每个正式开始的 Lesson 一个 Session。
- Plan 的 `Lesson Index` 决定侧边栏节点；父子关系只用于归属和导航，不复制 transcript。
- Roadmap、Plan、Lesson、画像、题卡、Trace 和材料继续保存在 learning set；不增加数据库、ORM、事件总线服务或第二份学习状态。
- Pi Session JSONL 保存对话；Lesson 保存课堂节点、Route Changes、Reflection、Lesson Summary 和 Trace。
- 题卡和 Trace 继续使用现有四个领域操作：`card_search`、`trace_search`、`trace_append`、`source_resolve`。
- Student View 必须在服务端投影；浏览器不得收到 Teacher Control、题卡答案、rubric、未揭示提示或 Pi thinking。
- `prepared` Lesson 可以原地重备；学生确认开课后，重备必须冻结旧 Lesson 为 `abandoned` 并创建新 Lesson。
- 学生拥有暂停和结束课程的主动权；Task/Block 完成不自动等于能力达标或 Lesson 关闭。
- 首版只处理阻塞正常试用的失败：缺模型/凭据、缺学习集文件、Lesson 无法解析、连接中断和真实题卡为空。
- 首版不增加账号、鉴权、加密、审计后台、schema migration、兼容读取器、复杂重试、崩溃事务日志、通用规则引擎或插件化渲染框架；公开分发前另开 hardening 计划。
- 本计划不实现深度模式、临时 Subagent 或工作流任务轨道；它们由 `2026-07-22-pi-deep-workflow-mode.md` 实现。
- 每个任务先写失败测试，再写最小实现；每个任务独立提交。

## File Responsibility Map

| Responsibility | Files |
|---|---|
| 共享四工具领域导出 | `plugins/highschool-study/server/src/domain.ts` |
| App 构建与启动 | `apps/pi-teaching-web/package.json`、`vite.config.ts`、`src/server/index.ts` |
| Web/Agent 公共契约 | `apps/pi-teaching-web/src/shared/contracts.ts` |
| Roadmap/Plan/Lesson 读取 | `apps/pi-teaching-web/src/study/read-workspace.ts` |
| Session ID 与 Lesson 状态写入 | `apps/pi-teaching-web/src/study/write-workspace.ts` |
| Pi 四工具与课堂工具 | `apps/pi-teaching-web/src/runtime/study-tools.ts`、`classroom-update.ts` |
| Coach/Tutor 资源 | `apps/pi-teaching-web/resources/agents/`、`resources/skills/` |
| Pi Session 创建与导航 | `apps/pi-teaching-web/src/runtime/session-factory.ts`、`workspace-registry.ts` |
| 安全事件投影 | `apps/pi-teaching-web/src/projection/projector.ts` |
| HTTP/WebSocket | `apps/pi-teaching-web/src/server/app.ts`、`event-hub.ts` |
| React 页面与课堂组件 | `apps/pi-teaching-web/src/client/` |
| 能力证据与回放 | `apps/pi-teaching-web/src/study/ability.ts`、`replay.ts` |
| 端到端试用 | `apps/pi-teaching-web/tests/e2e/`、`examples/derivative-demo/` |

---

### Task 1: Expose the existing study domain as one package entry

**Files:**

- Modify: `plugins/highschool-study/package.json`
- Create: `plugins/highschool-study/server/src/domain.ts`
- Create: `plugins/highschool-study/tests/contract/domain-export.test.ts`

**Interfaces:**

- Produces: package entry `highschool-study-markdown/study-domain`.
- Produces: `searchCards`, `searchTraces`, `appendTrace`, `sourceResolve`, `readActiveTraces`, `aggregateMethodSignals`, `readMarkdownFile`, `resolveInsideRoot` and their public types.
- Consumers: all later Pi runtime and projection tasks.

- [ ] **Step 1: Write the failing self-reference export test**

Create `plugins/highschool-study/tests/contract/domain-export.test.ts`:

```ts
import { expect, test } from 'bun:test';

test('exports one shared study-domain entry for non-MCP runtimes', async () => {
  const domain = await import('highschool-study-markdown/study-domain');
  for (const name of [
    'searchCards',
    'searchTraces',
    'appendTrace',
    'sourceResolve',
    'readActiveTraces',
    'aggregateMethodSignals',
    'readMarkdownFile',
    'resolveInsideRoot',
  ]) expect(domain[name as keyof typeof domain]).toBeFunction();
});
```

- [ ] **Step 2: Run the test and verify the package entry is missing**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/domain-export.test.ts
```

Expected: FAIL because `highschool-study-markdown/study-domain` is not exported.

- [ ] **Step 3: Add the package export and barrel**

Add to `plugins/highschool-study/package.json`:

```json
"exports": {
  "./study-domain": "./server/src/domain.ts"
}
```

Create `plugins/highschool-study/server/src/domain.ts`:

```ts
export {
  createCardSearcher,
  readCard,
  searchCards,
  type ActiveTraceReader,
  type CardContent,
  type CardHit,
  type CardSearchInput,
} from './cards';
export {
  aggregateMethodSignals,
  type MethodSignal,
} from './method-signals';
export {
  readMarkdownFile,
  type MarkdownDocument,
} from './markdown';
export { resolveInsideRoot } from './learning-set';
export {
  sourceResolve,
  type SourceResolution,
} from './sources';
export {
  searchTraces,
  type TraceSearchInput,
  type TraceSearchResult,
} from './trace-search';
export {
  appendTrace,
  readActiveTraces,
  readTraceRecords,
  type TraceAppendInput,
  type TraceAssessment,
  type TraceRecord,
  type TraceSupport,
} from './traces';
```

- [ ] **Step 4: Run the focused and full plugin checks**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/domain-export.test.ts
bun run check
```

Expected: the focused test and the existing plugin check both PASS.

- [ ] **Step 5: Commit the shared entry**

```bash
git add plugins/highschool-study/package.json \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/tests/contract/domain-export.test.ts
git commit -m "refactor: expose shared study domain"
```

---

### Task 2: Scaffold the Pi Web package and health route

**Files:**

- Create: `apps/pi-teaching-web/package.json`
- Create: `apps/pi-teaching-web/tsconfig.json`
- Create: `apps/pi-teaching-web/vite.config.ts`
- Create: `apps/pi-teaching-web/index.html`
- Create: `apps/pi-teaching-web/src/server/app.ts`
- Create: `apps/pi-teaching-web/src/server/index.ts`
- Create: `apps/pi-teaching-web/src/client/main.tsx`
- Create: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/server/health.test.ts`

**Interfaces:**

- Produces: `createRequestHandler(): (request: Request) => Response | Promise<Response>`.
- Produces: local server defaulting to `127.0.0.1:65000` and Vite client build.
- No Pi Session or learning-set logic enters this task.

- [ ] **Step 1: Write the failing health-route test**

Create `apps/pi-teaching-web/tests/server/health.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { createRequestHandler } from '../../src/server/app';

test('answers the local health endpoint', async () => {
  const response = await createRequestHandler()(new Request('http://local/api/health'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, runtime: 'pi' });
});
```

- [ ] **Step 2: Create the package manifest and install exact dependencies**

Create `apps/pi-teaching-web/package.json`:

```json
{
  "name": "studyforge-pi-teaching-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.14",
  "scripts": {
    "dev:server": "bun --watch src/server/index.ts",
    "dev:client": "vite",
    "dev": "bun run --parallel dev:server dev:client",
    "start": "bun run src/server/index.ts",
    "build": "vite build",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "check": "bun run typecheck && bun test && bun run build"
  },
  "dependencies": {
    "@earendil-works/pi-ai": "0.81.0",
    "@earendil-works/pi-coding-agent": "0.81.0",
    "highschool-study-markdown": "file:../../plugins/highschool-study",
    "katex": "0.18.1",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-markdown": "10.1.0",
    "rehype-katex": "7.0.1",
    "remark-math": "6.0.0",
    "typebox": "1.3.6",
    "yaml": "2.9.0"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@types/bun": "1.3.14",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "typescript": "7.0.2",
    "vite": "8.1.5"
  }
}
```

Create `apps/pi-teaching-web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "types": ["bun", "vite/client"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "vite.config.ts"]
}
```

Run:

```bash
cd apps/pi-teaching-web
bun install
```

Expected: `bun.lock` is created without dependency resolution errors.

- [ ] **Step 3: Add the minimal request handler and server entry**

Create `apps/pi-teaching-web/src/server/app.ts`:

```ts
export function createRequestHandler() {
  return (request: Request): Response => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({ ok: true, runtime: 'pi' });
    }
    return new Response('Not found', { status: 404 });
  };
}
```

Create `apps/pi-teaching-web/src/server/index.ts`:

```ts
import { createRequestHandler } from './app';

const port = Number.parseInt(process.env.STUDY_WEB_PORT ?? '65000', 10);
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch: createRequestHandler(),
});

console.log(`StudyForge Pi Web: http://${server.hostname}:${server.port}`);
```

- [ ] **Step 4: Add the Vite client shell**

Create `apps/pi-teaching-web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 65001,
    proxy: { '/api': 'http://127.0.0.1:65000', '/events': { target: 'ws://127.0.0.1:65000', ws: true } },
  },
});
```

Create `apps/pi-teaching-web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>StudyForge</title></head>
  <body><div id="root"></div><script type="module" src="/src/client/main.tsx"></script></body>
</html>
```

Create `apps/pi-teaching-web/src/client/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return <main className="boot"><p>StudyForge</p><h1>你的学习工作区</h1></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

Create `apps/pi-teaching-web/src/client/styles.css`:

```css
:root { color: #1d2433; background: #f5f1e8; font-family: Inter, "Noto Sans SC", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
.boot { min-height: 100vh; display: grid; place-content: center; padding: 2rem; }
.boot p { margin: 0; color: #7a5d3d; letter-spacing: .16em; text-transform: uppercase; }
.boot h1 { margin: .4rem 0 0; font-family: Georgia, "Noto Serif SC", serif; font-size: clamp(2.4rem, 8vw, 6rem); }
```

- [ ] **Step 5: Run the health test, typecheck, and client build**

```bash
cd apps/pi-teaching-web
bun test tests/server/health.test.ts
bun run typecheck
bun run build
```

Expected: all commands exit 0 and Vite writes `dist/`.

- [ ] **Step 6: Commit the app scaffold**

```bash
git add apps/pi-teaching-web
git commit -m "feat: scaffold Pi teaching web app"
```

---

### Task 3: Parse the learning set into a Plan workspace snapshot

**Files:**

- Create: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Create: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`

**Interfaces:**

- Produces: `readLearningSet(root): LearningSetSnapshot`.
- Produces: `readPlanWorkspace(root, planId): PlanWorkspaceSnapshot`.
- Produces stable `SessionKey = coach:<planId> | tutor:<lessonId>` values for later routing.

- [ ] **Step 1: Define the public snapshot contracts**

Create `apps/pi-teaching-web/src/shared/contracts.ts`:

```ts
export type LessonStatus = 'prepared' | 'active' | 'paused' | 'closed' | 'abandoned';
export type BlockStatus = 'pending' | 'active' | 'completed' | 'skipped';
export type ActivityKind = 'dialogue' | 'problem' | 'material' | 'reflection';
export type SessionKey = `coach:${string}` | `tutor:${string}`;

export type ActivityBlock = {
  id: string;
  title: string;
  kind: ActivityKind;
  required: boolean;
  status: BlockStatus;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  evidence: string[];
};

export type LessonNode = {
  id: string;
  title: string;
  path: string;
  planId: string;
  status: LessonStatus;
  sessionKey: SessionKey;
  tutorSessionId: string | null;
  blocks: ActivityBlock[];
};

export type PlanSummary = {
  id: string;
  title: string;
  path: string;
  status: string;
  goal: string;
  capabilityStandard: string;
};

export type LearningSetSnapshot = {
  title: string;
  overview: string;
  goal: string;
  plans: PlanSummary[];
};

export type PlanWorkspaceSnapshot = {
  learningSet: LearningSetSnapshot;
  plan: PlanSummary;
  coach: { sessionKey: SessionKey; sessionId: string | null };
  lessons: LessonNode[];
};
```

- [ ] **Step 2: Write the failing derivative-demo parser test**

Create `apps/pi-teaching-web/tests/study/read-workspace.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readLearningSet, readPlanWorkspace } from '../../src/study/read-workspace';

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');

test('reads the derivative Roadmap and Plan lesson index', () => {
  const learningSet = readLearningSet(root);
  expect(learningSet.title).toBe('导数学习 Roadmap');
  expect(learningSet.overview).toContain('把定义域、同构变形和参数分离');
  expect(learningSet.plans.map((plan) => plan.id)).toEqual(['domain-integrity']);

  const workspace = readPlanWorkspace(root, 'domain-integrity');
  expect(workspace.coach.sessionKey).toBe('coach:domain-integrity');
  expect(workspace.lessons.map((lesson) => [lesson.id, lesson.status])).toEqual([
    ['lesson-001', 'closed'],
    ['lesson-002', 'closed'],
    ['lesson-003', 'prepared'],
  ]);
  expect(workspace.lessons[2]?.blocks.map((block) => block.id)).toEqual([
    'orientation', 'assessment-01', 'repair-optional', 'assessment-02', 'reflection',
  ]);
  expect(workspace.lessons[2]?.blocks[1]?.studentView).toContain('Q-DOMAIN-EX22');
});
```

- [ ] **Step 3: Implement the focused Markdown reader**

Create `apps/pi-teaching-web/src/study/read-workspace.ts`:

```ts
import { dirname, relative, resolve } from 'node:path';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import type {
  ActivityBlock,
  ActivityKind,
  BlockStatus,
  LearningSetSnapshot,
  LessonNode,
  LessonStatus,
  PlanSummary,
  PlanWorkspaceSnapshot,
} from '../shared/contracts';

function section(body: string, heading: string, level = 2): string {
  const lines = body.split(/\r?\n/);
  const marker = `${'#'.repeat(level)} ${heading}`;
  const start = lines.findIndex((line) => line.trimEnd() === marker);
  if (start < 0) return '';
  const boundary = new RegExp(`^#{1,${level}}\\s`);
  let end = start + 1;
  while (end < lines.length && !boundary.test(lines[end]!)) end += 1;
  return lines.slice(start + 1, end).join('\n').trim();
}

function title(body: string): string {
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? '';
}

function canonical(root: string, absolute: string): string {
  return relative(resolve(root), absolute).replaceAll('\\', '/');
}

function scalar(frontmatter: Record<string, unknown>, key: string): string | null {
  return typeof frontmatter[key] === 'string' ? frontmatter[key] as string : null;
}

function planSummary(root: string, planPath: string): PlanSummary {
  const document = readMarkdownFile(root, planPath);
  return {
    id: document.id,
    title: title(document.body).replace(/^Plan[:：]\s*/, ''),
    path: planPath,
    status: scalar(document.frontmatter, 'status') ?? 'unknown',
    goal: section(document.body, 'Goal'),
    capabilityStandard: section(document.body, 'Observable Capability Standard'),
  };
}

function nodeState(source: string): {
  kind: ActivityKind;
  required: boolean;
  status: BlockStatus;
  dependsOn: string[];
  uses: string[];
} {
  const field = (name: string) => new RegExp(`^- ${name}:\\s*(.*?)\\s*$`, 'm').exec(source)?.[1]?.trim();
  const kind = field('Kind');
  const status = field('Status');
  return {
    kind: ['dialogue', 'problem', 'material', 'reflection'].includes(kind ?? '')
      ? kind as ActivityKind : 'dialogue',
    required: field('Required') !== 'false',
    status: ['pending', 'active', 'completed', 'skipped'].includes(status ?? '')
      ? status as BlockStatus : 'pending',
    dependsOn: (field('Depends on') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    uses: (field('Uses') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  };
}

function lessonBlocks(body: string): ActivityBlock[] {
  const matches = [...body.matchAll(/^## Block ([^（\s]+)(?:（([^）]+)）)?\s*$/gm)];
  return matches.map((match, index) => {
    const source = body.slice(match.index! + match[0].length, matches[index + 1]?.index);
    const state = nodeState(section(`# x\n${source}`, 'Node State', 3));
    const inferredKind: ActivityKind = match[1] === 'reflection' ? 'reflection' : state.kind;
    return {
      id: match[1]!,
      title: match[1]!,
      ...state,
      kind: inferredKind,
      required: match[2]?.includes('可选') ? false : state.required,
      studentView: section(`# x\n${source}`, 'Student View', 3),
      evidence: [...section(`# x\n${source}`, 'Evidence', 3).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((item) => item[1]!),
    };
  });
}

function lessonNode(root: string, planPath: string, linkedPath: string): LessonNode {
  const lessonPath = canonical(root, resolve(dirname(resolve(root, planPath)), linkedPath));
  const document = readMarkdownFile(root, lessonPath);
  const status = scalar(document.frontmatter, 'status');
  if (!['prepared', 'active', 'paused', 'closed', 'abandoned'].includes(status ?? '')) {
    throw new Error(`INVALID_LESSON_STATUS: ${lessonPath}`);
  }
  return {
    id: document.id,
    title: title(document.body),
    path: lessonPath,
    planId: scalar(document.frontmatter, 'plan_id') ?? '',
    status: status as LessonStatus,
    sessionKey: `tutor:${document.id}`,
    tutorSessionId: scalar(document.frontmatter, 'tutor_session'),
    blocks: lessonBlocks(document.body),
  };
}

export function readLearningSet(root: string): LearningSetSnapshot {
  const roadmap = readMarkdownFile(root, 'ROADMAP.md');
  const planPaths = [...section(roadmap.body, 'Plan Graph').matchAll(/\[[^\]]+\]\((plans\/[^)#]+\.md)\)/g)]
    .map((match) => match[1]!);
  return {
    title: title(roadmap.body),
    overview: section(roadmap.body, 'Learning Set Overview'),
    goal: section(roadmap.body, 'Goal'),
    plans: planPaths.map((path) => planSummary(root, path)),
  };
}

export function readPlanWorkspace(root: string, planId: string): PlanWorkspaceSnapshot {
  const learningSet = readLearningSet(root);
  const plan = learningSet.plans.find((candidate) => candidate.id === planId);
  if (!plan) throw new Error(`PLAN_NOT_FOUND: ${planId}`);
  const document = readMarkdownFile(root, plan.path);
  const lessonPaths = [...section(document.body, 'Lesson Index').matchAll(/\[[^\]]+\]\(([^)#]+\.md)\)/g)]
    .map((match) => match[1]!);
  return {
    learningSet,
    plan,
    coach: {
      sessionKey: `coach:${plan.id}`,
      sessionId: scalar(document.frontmatter, 'coach_session'),
    },
    lessons: lessonPaths.map((path) => lessonNode(root, plan.path, path)),
  };
}
```

- [ ] **Step 4: Run the parser test and typecheck**

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts
bun run typecheck
```

Expected: PASS and the derivative demo produces one Plan with three Lesson nodes.

- [ ] **Step 5: Commit the workspace reader**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/read-workspace.ts \
  apps/pi-teaching-web/tests/study/read-workspace.test.ts
git commit -m "feat: project learning set workspace"
```

---

### Task 4: Add minimal Markdown writes for runtime-owned fields and classroom state

**Files:**

- Create: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Create: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `plugins/highschool-study/server/src/traces.ts`
- Modify: `plugins/highschool-study/tests/integration/trace-records.test.ts`

**Interfaces:**

- Produces: `setFrontmatterField(root, path, key, value)`.
- Produces: `setBlockStatus(root, lessonPath, blockId, status)`.
- Produces: `appendRouteChange(root, lessonPath, input)` and `closeLesson(root, lessonPath, input)`.
- These functions edit only one real learning-set file and do not create a transaction or journal layer.

- [ ] **Step 1: Write failing mutation tests against a temporary Lesson**

Create `apps/pi-teaching-web/tests/study/write-workspace.test.ts`:

```ts
import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendRouteChange, closeLesson, setBlockStatus, setFrontmatterField } from '../../src/study/write-workspace';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), 'study-web-'));
  roots.push(root);
  const path = join(root, 'lesson.md');
  writeFileSync(path, `---\nid: lesson\nkind: lesson\nstatus: prepared\n---\n# Lesson\n\n## Block orientation\n\n### Student View\n\n开始。\n\n## Reflection\n\n（课堂结束后填写）\n\n## Lesson Summary\n\n（课堂结束后填写）\n`);
  return { root, path: 'lesson.md' };
}

test('updates one frontmatter field and one block state', () => {
  const { root, path } = fixture();
  setFrontmatterField(root, path, 'tutor_session', 'session-1');
  setBlockStatus(root, path, 'orientation', 'active');
  const source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('tutor_session: session-1');
  expect(source).toContain('- Status: active');
});

test('appends a sourced route change and closes the lesson', () => {
  const { root, path } = fixture();
  appendRouteChange(root, path, {
    action: 'skip', blockId: 'orientation', reason: '学生已完成诊断。', source: '#trace-event-001',
  });
  closeLesson(root, path, { reflection: '我会先检查定义域。', summary: '独立完成诊断。' });
  const source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('### Route change route-001');
  expect(source).toContain('- Source: #trace-event-001');
  expect(source).toContain('status: closed');
  expect(source).toContain('我会先检查定义域。');
  expect(source).toContain('独立完成诊断。');
});
```

- [ ] **Step 2: Implement direct, focused Markdown mutations**

Create `apps/pi-teaching-web/src/study/write-workspace.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';

export type RouteChangeInput = {
  action: 'insert' | 'skip' | 'move' | 'repeat';
  blockId: string;
  reason: string;
  source: string;
  before?: string;
  after?: string;
};

function read(root: string, path: string): { absolute: string; source: string } {
  const absolute = resolveInsideRoot(root, path);
  return { absolute, source: readFileSync(absolute, 'utf8') };
}

function write(absolute: string, source: string): void {
  writeFileSync(absolute, source.endsWith('\n') ? source : `${source}\n`);
}

export function setFrontmatterField(root: string, path: string, key: string, value: string): void {
  const document = read(root, path);
  const match = /^(---\s*\n)([\s\S]*?)(\n---\s*\n)/.exec(document.source);
  if (!match) throw new Error(`FRONTMATTER_REQUIRED: ${path}`);
  const line = new RegExp(`^${key}:.*$`, 'm');
  const body = line.test(match[2]!)
    ? match[2]!.replace(line, `${key}: ${value}`)
    : `${match[2]}\n${key}: ${value}`;
  write(document.absolute, document.source.replace(match[0], `${match[1]}${body}${match[3]}`));
}

export function setBlockStatus(
  root: string,
  lessonPath: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): void {
  const document = read(root, lessonPath);
  const heading = new RegExp(`^## Block ${blockId}(?:（[^）]+）)?\\s*$`, 'm');
  const match = heading.exec(document.source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = document.source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? document.source.length : next;
  const block = document.source.slice(match.index, end);
  const state = /### Node State\s*\n([\s\S]*?)(?=\n### |\n## |$)/.exec(block);
  const replacement = state
    ? block.replace(state[0], state[0].replace(/^- Status:.*$/m, `- Status: ${status}`))
    : block.replace(match[0], `${match[0]}\n\n### Node State\n\n- Kind: dialogue\n- Required: true\n- Status: ${status}\n- Depends on:\n- Uses:`);
  write(document.absolute, document.source.slice(0, match.index) + replacement + document.source.slice(end));
}

export function appendRouteChange(root: string, lessonPath: string, input: RouteChangeInput): void {
  const document = read(root, lessonPath);
  if (!document.source.includes(`## Block ${input.blockId}`)) throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);
  const ids = [...document.source.matchAll(/^### Route change route-(\d+)$/gm)].map((match) => Number(match[1]));
  const id = `route-${String((Math.max(0, ...ids) + 1)).padStart(3, '0')}`;
  const heading = document.source.includes('\n## Route Changes\n') ? '' : '\n## Route Changes\n';
  const placement = input.before ? `\n- Before: ${input.before}` : input.after ? `\n- After: ${input.after}` : '';
  write(document.absolute, `${document.source.trimEnd()}${heading}\n### Route change ${id}\n\n- Action: ${input.action}\n- Block: ${input.blockId}${placement}\n- Reason: ${input.reason}\n- Source: ${input.source}\n`);
}

function replaceSection(source: string, heading: string, value: string): string {
  const pattern = new RegExp(`(^## ${heading}\\s*$\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  if (!pattern.test(source)) throw new Error(`SECTION_NOT_FOUND: ${heading}`);
  return source.replace(pattern, `$1\n${value.trim()}\n\n`);
}

export function closeLesson(
  root: string,
  lessonPath: string,
  input: { reflection: string; summary: string },
): void {
  const document = read(root, lessonPath);
  let source = replaceSection(document.source, 'Reflection', input.reflection);
  source = replaceSection(source, 'Lesson Summary', input.summary);
  write(document.absolute, source);
  setFrontmatterField(root, lessonPath, 'status', 'closed');
}
```

- [ ] **Step 3: Let Trace bind to flexible, real ActivityBlock IDs**

The current domain accepts only `step-NN`, which blocks the confirmed composable IDs such as `assessment-01` and `repair-optional`. In `plugins/highschool-study/server/src/traces.ts`, change only the ID check inside `hasExactBlock`:

```ts
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blockId)) return false;
```

Keep the existing line-by-line fenced-code handling and exact `## Block ${blockId}` comparison. In `trace-records.test.ts`, retain the invalid H3 and linked-heading cases, replace the old “`step-2` is invalid” assertion with an unsafe/space-containing ID, and add a positive case that renames the fixture heading to `## Block assessment-01` and successfully appends a Trace to `assessment-01`.

- [ ] **Step 4: Run mutation tests, Trace tests and typecheck**

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts
bun run typecheck
cd ../../plugins/highschool-study
bun test tests/integration/trace-records.test.ts
```

Expected: PASS; mutations touch only the requested temporary Lesson, and Trace accepts a real flexible Block ID only when that exact H2 exists.

- [ ] **Step 5: Commit the Markdown writer and ActivityBlock Trace binding**

```bash
git add apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts \
  plugins/highschool-study/server/src/traces.ts \
  plugins/highschool-study/tests/integration/trace-records.test.ts
git commit -m "feat: write classroom state to Markdown"
```

---

### Task 5: Register the four study tools and one Tutor classroom tool

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Create: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Create: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

**Interfaces:**

- Produces: `createStudyTools(root, now): ToolDefinition[]` with exact names `card_search`, `trace_search`, `trace_append`, `source_resolve`.
- Produces: `createClassroomUpdateTool(root): ToolDefinition` with exact name `classroom_update`.
- Tool `details` remain server-side and feed the projector; raw details are never sent directly to the browser.

- [ ] **Step 1: Write failing tool-name and write-path tests**

Create `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createClassroomUpdateTool } from '../../src/runtime/classroom-update';
import { createStudyTools } from '../../src/runtime/study-tools';

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');

test('registers the existing four domain contracts without renaming them', () => {
  expect(createStudyTools(root, () => new Date('2026-07-22T00:00:00Z')).map((tool) => tool.name)).toEqual([
    'card_search', 'trace_search', 'trace_append', 'source_resolve',
  ]);
});

test('registers classroom_update separately from the public study tools', () => {
  expect(createClassroomUpdateTool(root).name).toBe('classroom_update');
});
```

- [ ] **Step 2: Implement the four thin Pi tool adapters**

Create `apps/pi-teaching-web/src/runtime/study-tools.ts`:

```ts
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  appendTrace,
  searchCards,
  searchTraces,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';

function result(kind: string, value: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind, value },
  };
}

export function createStudyTools(root: string, now: () => Date): ToolDefinition[] {
  return [
    defineTool({
      name: 'card_search',
      label: '搜索真实题卡',
      description: 'Search real problem cards and include every card\'s complete active Trace history.',
      parameters: Type.Object({ query: Type.String(), limit: Type.Integer({ minimum: 1, maximum: 20 }) }),
      execute: async (_id, input) => result('card-search', searchCards(root, input)),
    }),
    defineTool({
      name: 'trace_search',
      label: '搜索课堂 Trace',
      description: 'Search active Trace and reverse-resolve unique real cards.',
      parameters: Type.Object({
        query: Type.Optional(Type.String()),
        planId: Type.Optional(Type.String()),
        lessonId: Type.Optional(Type.String()),
        cardPath: Type.Optional(Type.String()),
        limit: Type.Integer({ minimum: 1, maximum: 100 }),
      }),
      execute: async (_id, input) => result('trace-search', searchTraces(root, {
        query: input.query ?? null,
        planId: input.planId ?? null,
        lessonId: input.lessonId ?? null,
        cardPath: input.cardPath ?? null,
        limit: input.limit,
      })),
    }),
    defineTool({
      name: 'trace_append',
      label: '记录课堂证据',
      description: 'Append one validated Trace to its owning Lesson.',
      parameters: Type.Object({
        lessonPath: Type.String(),
        blockId: Type.String(),
        cardAlias: Type.Union([Type.String(), Type.Null()]),
        cardStepId: Type.Union([Type.String(), Type.Null()]),
        materialPath: Type.Union([Type.String(), Type.Null()]),
        assessment: Type.Union(['correct', 'partially_correct', 'incorrect', 'incomplete'].map((value) => Type.Literal(value))),
        support: Type.Union(['none', 'tutor', 'external'].map((value) => Type.Literal(value))),
        note: Type.String(),
        supersedes: Type.Union([Type.String(), Type.Null()]),
      }),
      execute: async (_id, input) => result('trace-append', appendTrace(root, input, now)),
    }),
    defineTool({
      name: 'source_resolve',
      label: '核验来源',
      description: 'Resolve a learning-set-local source and optional fragment.',
      parameters: Type.Object({ fromPath: Type.String(), target: Type.String() }),
      execute: async (_id, input) => result('source-resolve', sourceResolve(root, input)),
    }),
  ];
}
```

- [ ] **Step 3: Implement the Tutor-only classroom mutation tool**

Create `apps/pi-teaching-web/src/runtime/classroom-update.ts`:

```ts
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { appendRouteChange, closeLesson, setBlockStatus, setFrontmatterField } from '../study/write-workspace';

const action = Type.Union([
  Type.Literal('activate'), Type.Literal('complete'), Type.Literal('skip'),
  Type.Literal('route'), Type.Literal('pause'), Type.Literal('close'),
]);

export function createClassroomUpdateTool(root: string) {
  return defineTool({
    name: 'classroom_update',
    label: '推进课堂节点',
    description: 'Update the current Lesson block, route, pause state, or student-confirmed closure.',
    parameters: Type.Object({
      action,
      lessonPath: Type.String(),
      blockId: Type.Optional(Type.String()),
      routeAction: Type.Optional(Type.Union([
        Type.Literal('insert'), Type.Literal('skip'), Type.Literal('move'), Type.Literal('repeat'),
      ])),
      before: Type.Optional(Type.String()),
      after: Type.Optional(Type.String()),
      reason: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      reflection: Type.Optional(Type.String()),
      summary: Type.Optional(Type.String()),
    }),
    execute: async (_id, input) => {
      if (input.action === 'pause') setFrontmatterField(root, input.lessonPath, 'status', 'paused');
      else if (input.action === 'close') {
        if (!input.reflection || !input.summary) throw new Error('CLOSE_REQUIRES_REFLECTION_AND_SUMMARY');
        closeLesson(root, input.lessonPath, { reflection: input.reflection, summary: input.summary });
      } else if (input.action === 'route') {
        if (!input.blockId || !input.routeAction || !input.reason || !input.source) throw new Error('ROUTE_FIELDS_REQUIRED');
        appendRouteChange(root, input.lessonPath, {
          action: input.routeAction,
          blockId: input.blockId,
          reason: input.reason,
          source: input.source,
          ...(input.before ? { before: input.before } : {}),
          ...(input.after ? { after: input.after } : {}),
        });
      } else {
        if (!input.blockId) throw new Error('BLOCK_ID_REQUIRED');
        const status = input.action === 'activate' ? 'active'
          : input.action === 'complete' ? 'completed' : 'skipped';
        setBlockStatus(root, input.lessonPath, input.blockId, status);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, action: input.action }) }],
        details: { kind: 'classroom-update', lessonPath: input.lessonPath, action: input.action },
      };
    },
  });
}
```

- [ ] **Step 4: Run the focused tests and typecheck**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: PASS with exactly four public study tools and one separate classroom tool.

- [ ] **Step 5: Commit the Pi tool adapters**

```bash
git add apps/pi-teaching-web/src/runtime apps/pi-teaching-web/tests/runtime
git commit -m "feat: register Pi study tools"
```

---

### Task 6: Define Coach/Tutor resources and construct Pi sessions

**Files:**

- Create: `apps/pi-teaching-web/resources/agents/coach.md`
- Create: `apps/pi-teaching-web/resources/agents/tutor.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Create: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Create: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Create: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Create: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`

**Interfaces:**

- Produces: `SessionRole = 'coach' | 'tutor'`.
- Produces: `StudySession` interface consumed by the registry and server.
- Produces: `createPiSessionFactory(root, now)`; Coach and Tutor receive different tools, agent context and skills.

- [ ] **Step 1: Write the failing role-boundary test**

Create `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { roleToolNames } from '../../src/runtime/session-factory';

const resources = join(import.meta.dir, '../../resources');

test('keeps Coach and Tutor tool boundaries distinct', () => {
  expect(roleToolNames('coach')).toEqual([
    'read', 'grep', 'find', 'ls', 'write', 'edit', 'card_search', 'trace_search', 'source_resolve',
  ]);
  expect(roleToolNames('tutor')).toEqual([
    'read', 'grep', 'find', 'ls', 'card_search', 'trace_search', 'trace_append', 'source_resolve', 'classroom_update',
  ]);
  expect(readFileSync(join(resources, 'agents/coach.md'), 'utf8')).toContain('one Plan');
  expect(readFileSync(join(resources, 'agents/tutor.md'), 'utf8')).toContain('one Lesson');
});
```

- [ ] **Step 2: Create the compact role contexts**

Create `resources/agents/coach.md`:

```markdown
# Coach

You own one Plan conversation: direction, progress explanation, post-Lesson reflection and preparation. Read the real Roadmap, current Plan, confirmed profiles and source-linked prior summaries. Load `coach-study` when preparing or reviewing. Search authentic cards and their bound Trace; if search is empty, say so and adjust the lesson instead of inventing a card. You may write a prepared Lesson, but never teach inside a Tutor Session, fabricate a session ID, append classroom Trace or mark capability attainment from task completion.
```

Create `resources/agents/tutor.md`:

```markdown
# Tutor

You own one Lesson conversation. Read only the current Lesson, confirmed profiles and sources needed by its current block. Load `tutor-lesson`; show only the current Student View, never Teacher Control, card answers, rubric or unrevealed hints. Use `trace_append` only after an evidence-bearing student attempt and `classroom_update` for block or route state. Pause immediately on request. Close only after the student confirms; do not edit Roadmap, Plan or long-term profiles.
```

Create `resources/skills/coach-study/SKILL.md`:

```markdown
---
name: coach-study
description: Recall one Plan, review a finished Lesson, and prepare or revise the next source-grounded Lesson.
---

1. Read `ROADMAP.md`, the current Plan, both confirmed profiles and source-linked earlier Lesson summaries. Read `memory/planner-attention.md` only during preparation.
2. Search several authentic card candidates with `card_search`; every hit already includes its active Trace. Use `trace_search` only for a cross-card question.
3. Agree on the next Lesson direction with the student. Write a flexible sequence of dialogue, problem, material and reflection Blocks with Node State, Student View, Teacher Control and real aliases.
4. Show only a no-spoiler outline. A `prepared` Lesson may be revised in place. Never overwrite an `active`, `paused`, `closed` or `abandoned` Lesson.
5. After a Lesson closes, read its Lesson Summary and sources before discussing the next step. Long-term profile changes happen only after Plan completion and student confirmation.
```

Create `resources/skills/tutor-lesson/SKILL.md`:

```markdown
---
name: tutor-lesson
description: Run one Lesson block by block, record evidence, adapt its route, and return closure control to the student.
---

1. Read the current Lesson and both confirmed profiles. Present only the active Block's Student View.
2. For `zero`, wait for an unsupported attempt. For `ladder`, reveal at most one student-approved hint level per turn. A worked example must use a different authentic card from the student target.
3. After an evidence-bearing response, append one honest Trace with its exact Block, card alias, support and concise observation.
4. Use `classroom_update` to activate, complete, skip or route Blocks. Every route change includes a student-safe reason and real source.
5. Pause on request. After the student confirms closure, write Reflection and Lesson Summary through `classroom_update`, then stop.
```

- [ ] **Step 3: Implement role-specific ResourceLoader creation**

Create `apps/pi-teaching-web/src/runtime/resource-loader.ts`:

```ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultResourceLoader, type Skill } from '@earendil-works/pi-coding-agent';

export type SessionRole = 'coach' | 'tutor';

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

export async function createRoleResourceLoader(
  root: string,
  role: SessionRole,
  ownerId: string,
) {
  const skillName = role === 'coach' ? 'coach-study' : 'tutor-lesson';
  const skillPath = join(resourceRoot, 'skills', skillName, 'SKILL.md');
  const skill: Skill = {
    name: skillName,
    description: role === 'coach' ? 'Plan coaching and preparation' : 'Lesson tutoring and closure',
    filePath: skillPath,
    baseDir: dirname(skillPath),
    source: 'custom',
  };
  const roleContext = readFileSync(join(resourceRoot, 'agents', `${role}.md`), 'utf8');
  const loader = new DefaultResourceLoader({
    cwd: root,
    skillsOverride: (current) => ({ skills: [...current.skills, skill], diagnostics: current.diagnostics }),
    agentsFilesOverride: (current) => ({
      agentsFiles: [
        ...current.agentsFiles,
        { path: `/virtual/studyforge-${role}.md`, content: `${roleContext}\n\nCurrent ${role}: ${ownerId}\nLearning set: ${root}` },
      ],
    }),
  });
  await loader.reload();
  return loader;
}
```

- [ ] **Step 4: Implement the testable Pi Session factory**

Create `apps/pi-teaching-web/src/runtime/session-factory.ts`:

```ts
import type { AgentSessionEvent, ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type { ImageContent } from '@earendil-works/pi-ai';
import { createClassroomUpdateTool } from './classroom-update';
import { createRoleResourceLoader, type SessionRole } from './resource-loader';
import { createStudyTools } from './study-tools';

export interface StudySession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: readonly unknown[];
  readonly isStreaming: boolean;
  prompt(text: string, images?: ImageContent[]): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  dispose(): void;
}

export type SessionFactoryInput = {
  role: SessionRole;
  ownerId: string;
  sessionFile: string | null;
};

export type StudySessionFactory = (input: SessionFactoryInput) => Promise<StudySession>;

export function roleToolNames(role: SessionRole): string[] {
  return role === 'coach'
    ? ['read', 'grep', 'find', 'ls', 'write', 'edit', 'card_search', 'trace_search', 'source_resolve']
    : ['read', 'grep', 'find', 'ls', 'card_search', 'trace_search', 'trace_append', 'source_resolve', 'classroom_update'];
}

export async function createPiSessionFactory(root: string, now: () => Date): Promise<StudySessionFactory> {
  const modelRuntime = await ModelRuntime.create();
  return async ({ role, ownerId, sessionFile }) => {
    const manager = sessionFile ? SessionManager.open(sessionFile, undefined, root) : SessionManager.create(root);
    if (!sessionFile) manager.appendSessionInfo(`${role === 'coach' ? 'Coach' : 'Tutor'} · ${ownerId}`);
    const loader = await createRoleResourceLoader(root, role, ownerId);
    const tools: ToolDefinition[] = [
      ...createStudyTools(root, now),
      ...(role === 'tutor' ? [createClassroomUpdateTool(root)] : []),
    ];
    const { session } = await createAgentSession({
      cwd: root,
      modelRuntime,
      resourceLoader: loader,
      sessionManager: manager,
      customTools: tools,
      tools: roleToolNames(role),
    });
    return {
      get sessionId() { return session.sessionId; },
      get sessionFile() { return session.sessionFile; },
      get messages() { return session.messages; },
      get isStreaming() { return session.isStreaming; },
      prompt: (text, images = []) => session.prompt(text, { images }),
      abort: () => session.abort(),
      subscribe: (listener) => session.subscribe(listener),
      dispose: () => session.dispose(),
    };
  };
}
```

- [ ] **Step 5: Run role tests and typecheck**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
bun run typecheck
```

Expected: PASS; the test does not contact a model.

- [ ] **Step 6: Commit Agent resources and Session factory**

```bash
git add apps/pi-teaching-web/resources apps/pi-teaching-web/src/runtime \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts
git commit -m "feat: create Coach and Tutor Pi sessions"
```

---

### Task 7: Build the Plan workspace Session registry and re-preparation lifecycle

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Create: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

**Interfaces:**

- Produces: `WorkspaceRegistry.openCoach(planId)`, `startLesson(lessonId)`, `openTutor(lessonId)`, `pauseLesson(lessonId)`, `abandonForReprepare(lessonId)`, `send(sessionKey, text, images)`.
- Persists only real `coach_session` and `tutor_session` IDs in Plan/Lesson frontmatter.
- Does not create Tutor Session when the student only previews a prepared Lesson.

- [ ] **Step 1: Write failing lifecycle tests using a fake Session factory**

Create `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts` with a copied derivative-demo temporary fixture and a fake factory:

```ts
import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import type { StudySession, StudySessionFactory } from '../../src/runtime/session-factory';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'study-registry-'));
  roots.push(root);
  cpSync(join(import.meta.dir, '../../../../examples/derivative-demo/learning-set'), root, { recursive: true });
  return root;
}

test('creates Coach eagerly and Tutor only after start', async () => {
  const created: string[] = [];
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    created.push(`${role}:${ownerId}`);
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [], isStreaming: false,
      prompt: async () => {}, abort: async () => {}, subscribe: () => () => {}, dispose: () => {},
    } satisfies StudySession;
  };
  const registry = new WorkspaceRegistry(fixture(), factory, async () => null);
  await registry.openCoach('domain-integrity');
  expect(created).toEqual(['coach:domain-integrity']);
  expect(registry.snapshot('domain-integrity').lessons[2]?.tutorSessionId).toBeNull();

  await registry.startLesson('lesson-003');
  expect(created).toEqual(['coach:domain-integrity', 'tutor:lesson-003']);
  expect(registry.snapshot('domain-integrity').lessons[2]?.status).toBe('active');
});

test('abandons an already-started Lesson before asking Coach to reprepare', async () => {
  const root = fixture();
  const factory: StudySessionFactory = async ({ role, ownerId }) => ({
    sessionId: `${role}-${ownerId}`, sessionFile: `/tmp/${role}-${ownerId}.jsonl`, messages: [], isStreaming: false,
    prompt: async () => {}, abort: async () => {}, subscribe: () => () => {}, dispose: () => {},
  });
  const registry = new WorkspaceRegistry(root, factory, async () => null);
  await registry.startLesson('lesson-003');
  await registry.abandonForReprepare('lesson-003');
  expect(readFileSync(join(root, 'lessons/lesson-003.md'), 'utf8')).toContain('status: abandoned');
});
```

- [ ] **Step 2: Implement session lookup by real Pi Session ID**

Use this production lookup signature in `workspace-registry.ts`:

```ts
export type SessionFileLookup = (root: string, sessionId: string) => Promise<string | null>;

export const findPiSessionFile: SessionFileLookup = async (root, sessionId) => {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  return (await SessionManager.list(root)).find((item) => item.id === sessionId)?.path ?? null;
};
```

- [ ] **Step 3: Implement the minimal registry**

Create `WorkspaceRegistry` with these exact state rules:

```ts
export class WorkspaceRegistry {
  private readonly sessions = new Map<string, StudySession>();
  private planId: string | null = null;

  constructor(
    private readonly root: string,
    private readonly factory: StudySessionFactory,
    private readonly lookup: SessionFileLookup = findPiSessionFile,
  ) {}

  snapshot(planId: string | null = this.planId): PlanWorkspaceSnapshot {
    if (!planId) throw new Error('PLAN_NOT_SELECTED');
    this.planId = planId;
    return readPlanWorkspace(this.root, planId);
  }

  private workspaceForLesson(lessonId: string): PlanWorkspaceSnapshot {
    for (const plan of readLearningSet(this.root).plans) {
      const workspace = readPlanWorkspace(this.root, plan.id);
      if (workspace.lessons.some((lesson) => lesson.id === lessonId)) {
        this.planId = plan.id;
        return workspace;
      }
    }
    throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
  }

  async openCoach(planId: string): Promise<StudySession> {
    this.planId = planId;
    const key = `coach:${planId}`;
    const cached = this.sessions.get(key);
    if (cached) return cached;
    const snapshot = readPlanWorkspace(this.root, planId);
    const sessionFile = snapshot.coach.sessionId ? await this.lookup(this.root, snapshot.coach.sessionId) : null;
    const session = await this.factory({ role: 'coach', ownerId: planId, sessionFile });
    this.sessions.set(key, session);
    setFrontmatterField(this.root, snapshot.plan.path, 'coach_session', session.sessionId);
    return session;
  }

  async startLesson(lessonId: string): Promise<StudySession> {
    const workspace = this.workspaceForLesson(lessonId);
    const lesson = workspace.lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    if (lesson.status === 'prepared' || lesson.status === 'paused') {
      setFrontmatterField(this.root, lesson.path, 'status', 'active');
    }
    return this.openTutor(lessonId);
  }

  async openTutor(lessonId: string): Promise<StudySession> {
    const key = `tutor:${lessonId}`;
    const lesson = this.workspaceForLesson(lessonId).lessons.find((item) => item.id === lessonId);
    if (!lesson || !['active', 'paused'].includes(lesson.status)) throw new Error(`LESSON_NOT_OPEN: ${lessonId}`);
    const cached = this.sessions.get(key);
    if (cached) return cached;
    const sessionFile = lesson.tutorSessionId ? await this.lookup(this.root, lesson.tutorSessionId) : null;
    const session = await this.factory({ role: 'tutor', ownerId: lessonId, sessionFile });
    this.sessions.set(key, session);
    setFrontmatterField(this.root, lesson.path, 'tutor_session', session.sessionId);
    return session;
  }

  async send(key: SessionKey, text: string, images: ImageContent[] = []): Promise<void> {
    const session = key.startsWith('coach:')
      ? await this.openCoach(key.slice(6))
      : await this.openTutor(key.slice(6));
    await session.prompt(text, images);
  }

  async pauseLesson(lessonId: string): Promise<void> {
    const lesson = this.workspaceForLesson(lessonId).lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    const tutor = this.sessions.get(`tutor:${lessonId}`);
    if (tutor?.isStreaming) await tutor.abort();
    setFrontmatterField(this.root, lesson.path, 'status', 'paused');
  }

  async abandonForReprepare(lessonId: string): Promise<void> {
    const lesson = this.workspaceForLesson(lessonId).lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    const coach = await this.openCoach(lesson.planId);
    if (lesson.status === 'prepared') {
      await coach.prompt(`学生要求重新备课。Tutor 尚未开始；请在学生确认方向后原地修改 ${lesson.path}，保持 Lesson ID 不变。`);
      return;
    }
    setFrontmatterField(this.root, lesson.path, 'status', 'abandoned');
    const tutor = this.sessions.get(`tutor:${lessonId}`);
    if (tutor) {
      await tutor.abort();
      tutor.dispose();
      this.sessions.delete(`tutor:${lessonId}`);
    }
    await coach.prompt(`学生要求重新备课。保留 ${lesson.path}，使用新的 Lesson ID 准备替代课程，并追加到 Plan Lesson Index。`);
  }

  get(key: SessionKey): StudySession | undefined { return this.sessions.get(key); }
  dispose(): void { for (const session of this.sessions.values()) session.dispose(); this.sessions.clear(); }
}
```

Add the imports for `ImageContent`, `PlanWorkspaceSnapshot`, `SessionKey`, `readLearningSet`, `readPlanWorkspace`, `setFrontmatterField`, and Session factory types at the top of the file.

- [ ] **Step 4: Run registry tests and typecheck**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/workspace-registry.test.ts
bun run typecheck
```

Expected: PASS; preview creates no Tutor Session, start does, and re-preparation preserves the old file.

- [ ] **Step 5: Commit the Plan registry**

```bash
git add apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts
git commit -m "feat: manage Plan Coach and Lesson Tutor sessions"
```

---

### Task 8: Project Pi, Lesson and tool events into student-safe events

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/projection/projector.ts`
- Create: `apps/pi-teaching-web/src/server/event-hub.ts`
- Create: `apps/pi-teaching-web/tests/projection/projector.test.ts`

**Interfaces:**

- Produces: `StudyViewEvent` union used by WebSocket and React reducer.
- Produces: `projectSessionEvent(sessionKey, event): StudyViewEvent[]`.
- Produces: `EventHub.publish(event)` and `EventHub.subscribe(listener)`.
- Never projects thinking deltas or raw tool results.

- [ ] **Step 1: Add the safe event union**

Append to `src/shared/contracts.ts`:

```ts
export type ChatMessage = { id: string; role: 'student' | 'coach' | 'tutor'; text: string; complete: boolean };

export type StudyViewEvent =
  | { type: 'snapshot'; workspace: PlanWorkspaceSnapshot }
  | { type: 'message'; sessionKey: SessionKey; message: ChatMessage }
  | { type: 'message-delta'; sessionKey: SessionKey; messageId: string; delta: string }
  | { type: 'phase'; sessionKey: SessionKey; phase: 'planning' | 'preparing' | 'waiting' | 'teaching' | 'paused' | 'reviewing' }
  | { type: 'work-status'; sessionKey: SessionKey; tool: string; status: 'running' | 'done' | 'failed'; label: string }
  | { type: 'activity'; lessonId: string; block: ActivityBlock }
  | { type: 'route-change'; lessonId: string; action: 'insert' | 'skip' | 'move' | 'repeat'; blockId: string; reason: string }
  | { type: 'ability-update'; methods: Array<{ method: string; state: 'unobserved' | 'unstable' | 'steady'; evidence: number; sources: string[] }> }
  | { type: 'session-error'; sessionKey: SessionKey; message: string };
```

- [ ] **Step 2: Write failing projection tests**

Create `tests/projection/projector.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { projectSessionEvent } from '../../src/projection/projector';

test('projects text deltas and hides thinking deltas', () => {
  expect(projectSessionEvent('coach:plan', {
    type: 'message_update',
    message: { role: 'assistant', timestamp: 123 },
    assistantMessageEvent: { type: 'text_delta', delta: '下一课' },
  } as never)).toEqual([{ type: 'message-delta', sessionKey: 'coach:plan', messageId: 'coach:plan:123', delta: '下一课' }]);

  expect(projectSessionEvent('coach:plan', {
    type: 'message_update',
    message: { role: 'assistant', timestamp: 123 },
    assistantMessageEvent: { type: 'thinking_delta', delta: 'private reasoning' },
  } as never)).toEqual([]);
});

test('projects tool names as status without raw arguments or answers', () => {
  const events = projectSessionEvent('tutor:lesson', {
    type: 'tool_execution_start', toolName: 'card_search', toolCallId: 'tool-1', args: { query: 'answer' },
  } as never);
  expect(events).toEqual([{
    type: 'work-status', sessionKey: 'tutor:lesson', tool: 'card_search', status: 'running', label: '正在查找真实题卡',
  }]);
  expect(JSON.stringify(events)).not.toContain('answer');
});
```

- [ ] **Step 3: Implement deterministic event projection**

Create `src/projection/projector.ts`:

```ts
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import type { SessionKey, StudyViewEvent } from '../shared/contracts';

const labels: Record<string, string> = {
  card_search: '正在查找真实题卡',
  trace_search: '正在核对课堂证据',
  trace_append: '正在记录课堂证据',
  source_resolve: '正在核验来源',
  classroom_update: '正在更新课堂节点',
};

export function projectSessionEvent(sessionKey: SessionKey, event: AgentSessionEvent): StudyViewEvent[] {
  if (event.type === 'message_update') {
    return event.assistantMessageEvent.type === 'text_delta'
      ? [{ type: 'message-delta', sessionKey, messageId: `${sessionKey}:${event.message.timestamp}`, delta: event.assistantMessageEvent.delta }]
      : [];
  }
  if (event.type === 'message_end' && event.message.role === 'assistant') {
    const text = event.message.content.flatMap((part) => part.type === 'text' ? [part.text] : []).join('');
    return text ? [{
      type: 'message', sessionKey,
      message: {
        id: `${sessionKey}:${event.message.timestamp}`,
        role: sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
        text,
        complete: true,
      },
    }] : [];
  }
  if (event.type === 'tool_execution_start') return [{
    type: 'work-status', sessionKey, tool: event.toolName, status: 'running', label: labels[event.toolName] ?? '正在处理',
  }];
  if (event.type === 'tool_execution_end') return [{
    type: 'work-status', sessionKey, tool: event.toolName, status: event.isError ? 'failed' : 'done',
    label: labels[event.toolName] ?? '处理完成',
  }];
  return [];
}
```

Create `src/server/event-hub.ts`:

```ts
import type { StudyViewEvent } from '../shared/contracts';

export class EventHub {
  private readonly listeners = new Set<(event: StudyViewEvent) => void>();
  publish(event: StudyViewEvent): void { for (const listener of this.listeners) listener(event); }
  subscribe(listener: (event: StudyViewEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
```

- [ ] **Step 4: Run projection tests and the current app suite**

```bash
cd apps/pi-teaching-web
bun test tests/projection/projector.test.ts
bun test
bun run typecheck
```

Expected: PASS and no projected event contains thinking or raw tool payloads.

- [ ] **Step 5: Commit the event projection**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/projection apps/pi-teaching-web/src/server/event-hub.ts \
  apps/pi-teaching-web/tests/projection
git commit -m "feat: project student-safe study events"
```

---

### Task 9: Expose the workspace over HTTP and WebSocket

**Files:**

- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Create: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**

- `GET /api/learning-set` returns `LearningSetSnapshot`.
- `GET /api/workspaces/:planId` returns `PlanWorkspaceSnapshot`.
- `GET /api/sessions/:sessionKey/history` returns safe student/assistant messages.
- `POST /api/sessions/:sessionKey/messages` sends one text prompt.
- `POST /api/lessons/:lessonId/start|pause|reprepare` applies the matching registry transition.
- `GET /events` upgrades to WebSocket and streams `StudyViewEvent` JSON.

- [ ] **Step 1: Write failing API tests with a fake registry**

Create `tests/server/workspace-api.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';

const learningSet = { title: 'Demo', overview: 'Overview', goal: 'Goal', plans: [] };
const workspace = {
  learningSet,
  plan: { id: 'p1', title: 'Plan', path: 'plans/p1.md', status: 'active', goal: 'Goal', capabilityStandard: 'Can do' },
  coach: { sessionKey: 'coach:p1', sessionId: null },
  lessons: [],
} as const;

test('returns learning-set and Plan snapshots', async () => {
  const handler = createRequestHandler({
    root: '/tmp/demo', authoring: false, hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      snapshot: () => workspace,
      send: async () => {}, startLesson: async () => ({}), pauseLesson: async () => {}, abandonForReprepare: async () => {},
      history: () => [], subscribe: () => () => {},
    } as never,
  });
  expect(await (await handler(new Request('http://local/api/learning-set')))!.json()).toEqual(learningSet);
  expect(await (await handler(new Request('http://local/api/workspaces/p1')))!.json()).toEqual(workspace);
});

test('routes a message to the selected Session key', async () => {
  const sent: unknown[] = [];
  const handler = createRequestHandler({
    root: '/tmp/demo', authoring: false, hub: new EventHub(), readLearningSet: () => learningSet,
    registry: {
      snapshot: () => workspace,
      send: async (...args: unknown[]) => { sent.push(args); }, startLesson: async () => ({}), pauseLesson: async () => {}, abandonForReprepare: async () => {},
      openCoach: async () => ({ sessionId: 'coach-p1' }), openTutor: async () => ({ sessionId: 'tutor-l1' }),
      history: () => [], subscribe: () => () => {},
    } as never,
  });
  const response = await handler(new Request('http://local/api/sessions/coach%3Ap1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '继续学习' }),
  }));
  expect(response.status).toBe(202);
  expect(sent).toEqual([['coach:p1', '继续学习', []]]);
});
```

- [ ] **Step 2: Add safe history projection and Session subscription binding**

Add to `workspace-registry.ts`:

```ts
history(key: SessionKey): ChatMessage[] {
  const session = this.sessions.get(key);
  if (!session) return [];
  return session.messages.flatMap((raw, index) => {
    const message = raw as { role?: string; content?: unknown };
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    const text = typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? message.content.flatMap((part) => typeof part === 'object' && part !== null && (part as { type?: string }).type === 'text'
          ? [String((part as { text?: unknown }).text ?? '')] : []).join('')
        : '';
    return text ? [{
      id: `${key}:${index}`,
      role: message.role === 'user' ? 'student' as const : key.startsWith('coach:') ? 'coach' as const : 'tutor' as const,
      text,
      complete: true,
    }] : [];
  });
}

subscribe(key: SessionKey, listener: Parameters<StudySession['subscribe']>[0]): () => void {
  const session = this.sessions.get(key);
  if (!session) throw new Error(`SESSION_NOT_OPEN: ${key}`);
  return session.subscribe(listener);
}
```

Add imports for `ChatMessage` and `AgentSessionEvent` types as required by TypeScript.

- [ ] **Step 3: Implement the API request handler**

Replace `src/server/app.ts` with a handler whose dependency interface is:

```ts
import type { Server } from 'bun';
import type { ImageContent } from '@earendil-works/pi-ai';
import { readLearningSet } from '../study/read-workspace';
import type { SessionKey, StudyViewEvent } from '../shared/contracts';
import { projectSessionEvent } from '../projection/projector';
import type { WorkspaceRegistry } from '../runtime/workspace-registry';
import type { EventHub } from './event-hub';

export type AppDependencies = {
  root: string;
  authoring: boolean;
  registry: WorkspaceRegistry;
  hub: EventHub;
  readLearningSet?: typeof readLearningSet;
};

const json = (value: unknown, status = 200) => Response.json(value, { status });

export function createRequestHandler(deps?: AppDependencies) {
  const bound = new Set<SessionKey>();

  return async (request: Request, server?: Server<unknown>): Promise<Response | undefined> => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, runtime: 'pi' });
    if (!deps) return new Response('Not found', { status: 404 });
    const learningSetReader = deps.readLearningSet ?? readLearningSet;
    const bind = (key: SessionKey) => {
      if (bound.has(key)) return;
      deps.registry.subscribe(key, (event) => {
        for (const projected of projectSessionEvent(key, event)) deps.hub.publish(projected);
      });
      bound.add(key);
    };
    if (request.method === 'GET' && url.pathname === '/api/learning-set') return json(learningSetReader(deps.root));

    const workspace = /^\/api\/workspaces\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'GET' && workspace) return json(deps.registry.snapshot(decodeURIComponent(workspace[1]!)));

    const history = /^\/api\/sessions\/([^/]+)\/history$/.exec(url.pathname);
    if (request.method === 'GET' && history) return json(deps.registry.history(decodeURIComponent(history[1]!) as SessionKey));

    const messages = /^\/api\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
    if (request.method === 'POST' && messages) {
      const key = decodeURIComponent(messages[1]!) as SessionKey;
      const input = await request.json() as { text: string };
      const session = key.startsWith('coach:')
        ? await deps.registry.openCoach(key.slice(6))
        : await deps.registry.openTutor(key.slice(6));
      bind(key);
      deps.hub.publish({
        type: 'message', sessionKey: key,
        message: { id: `${key}:student:${Date.now()}`, role: 'student', text: input.text, complete: true },
      });
      void deps.registry.send(key, input.text, [] as ImageContent[]).then(() => {
        const planId = key.startsWith('coach:') ? key.slice(6) : deps.registry.snapshot().plan.id;
        deps.hub.publish({ type: 'snapshot', workspace: deps.registry.snapshot(planId) });
      }).catch(() => deps.hub.publish({
        type: 'session-error', sessionKey: key,
        message: '模型调用失败，请检查 Pi 的模型与凭据配置后重试。',
      }));
      return json({ accepted: true, sessionId: session.sessionId }, 202);
    }

    const lessonAction = /^\/api\/lessons\/([^/]+)\/(start|pause|reprepare)$/.exec(url.pathname);
    if (request.method === 'POST' && lessonAction) {
      const lessonId = decodeURIComponent(lessonAction[1]!);
      if (lessonAction[2] === 'start') { await deps.registry.startLesson(lessonId); bind(`tutor:${lessonId}`); }
      if (lessonAction[2] === 'pause') await deps.registry.pauseLesson(lessonId);
      if (lessonAction[2] === 'reprepare') await deps.registry.abandonForReprepare(lessonId);
      const snapshot = deps.registry.snapshot();
      deps.hub.publish({ type: 'snapshot', workspace: snapshot });
      return json(snapshot);
    }

    if (url.pathname === '/events' && server?.upgrade(request)) return;
    return new Response('Not found', { status: 404 });
  };
}
```

- [ ] **Step 4: Wire Bun WebSocket broadcast and CLI arguments**

Replace `src/server/index.ts` with:

```ts
import { resolve } from 'node:path';
import { createPiSessionFactory } from '../runtime/session-factory';
import { WorkspaceRegistry, findPiSessionFile } from '../runtime/workspace-registry';
import { createRequestHandler } from './app';
import { EventHub } from './event-hub';

const args = new Set(process.argv.slice(2));
const valueAfter = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const root = resolve(valueAfter('--learning-set') ?? process.env.STUDY_LEARNING_SET ?? 'learning-set');
const authoring = args.has('--authoring');
const port = Number.parseInt(valueAfter('--port') ?? process.env.STUDY_WEB_PORT ?? '65000', 10);
const hub = new EventHub();
const factory = await createPiSessionFactory(root, () => new Date());
const registry = new WorkspaceRegistry(root, factory, findPiSessionFile);
const clients = new Set<{ send(data: string): void }>();
hub.subscribe((event) => { const data = JSON.stringify(event); for (const client of clients) client.send(data); });
const fetch = createRequestHandler({ root, authoring, registry, hub });

const server = Bun.serve({
  hostname: '127.0.0.1', port,
  fetch,
  websocket: {
    open(socket) { clients.add(socket); },
    close(socket) { clients.delete(socket); },
    message() {},
  },
});

console.log(`StudyForge Pi Web: http://${server.hostname}:${server.port}`);
```

- [ ] **Step 5: Run API tests, typecheck, and current suite**

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts
bun test
bun run typecheck
```

Expected: PASS; API tests use no real model.

- [ ] **Step 6: Commit the local API**

```bash
git add apps/pi-teaching-web/src/server apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: expose Plan workspace API"
```

---

### Task 10: Build the learning-set home and Plan Session workspace

**Files:**

- Create: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/src/client/state.ts`
- Create: `apps/pi-teaching-web/src/client/App.tsx`
- Create: `apps/pi-teaching-web/src/client/components/MarkdownView.tsx`
- Create: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Create: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Create: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Create: `apps/pi-teaching-web/src/client/components/ActivityDrawer.tsx`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/client/state.test.ts`

**Interfaces:**

- Produces: one browser shell with Home and Plan workspace views.
- Produces: `reduceClientState(state, event)` used by WebSocket events.
- Selected sidebar node controls the only Session receiving the input; switching nodes never merges histories.

- [ ] **Step 1: Write the failing reducer test**

Create `tests/client/state.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { initialClientState, reduceClientState } from '../../src/client/state';

test('keeps messages separated by Session key', () => {
  let state = initialClientState;
  state = reduceClientState(state, { type: 'message-delta', sessionKey: 'coach:p1', messageId: 'streaming', delta: '复盘' });
  state = reduceClientState(state, { type: 'message-delta', sessionKey: 'tutor:l1', messageId: 'streaming', delta: '题目' });
  expect(state.messages['coach:p1']?.[0]?.text).toBe('复盘');
  expect(state.messages['tutor:l1']?.[0]?.text).toBe('题目');
});
```

- [ ] **Step 2: Implement client API and state**

Create `src/client/api.ts`:

```ts
import type { ChatMessage, LearningSetSnapshot, PlanWorkspaceSnapshot, SessionKey } from '../shared/contracts';

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export const api = {
  learningSet: () => json<LearningSetSnapshot>('/api/learning-set'),
  workspace: (planId: string) => json<PlanWorkspaceSnapshot>(`/api/workspaces/${encodeURIComponent(planId)}`),
  history: (key: SessionKey) => json<ChatMessage[]>(`/api/sessions/${encodeURIComponent(key)}/history`),
  message: (key: SessionKey, text: string) => json<{ accepted: true }>(`/api/sessions/${encodeURIComponent(key)}/messages`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }),
  }),
  lessonAction: (lessonId: string, action: 'start' | 'pause' | 'reprepare') =>
    json<PlanWorkspaceSnapshot>(`/api/lessons/${encodeURIComponent(lessonId)}/${action}`, { method: 'POST' }),
};
```

Create `src/client/state.ts`:

```ts
import type { ChatMessage, PlanWorkspaceSnapshot, SessionKey, StudyViewEvent } from '../shared/contracts';

export type ClientState = {
  workspace: PlanWorkspaceSnapshot | null;
  selected: SessionKey | null;
  messages: Partial<Record<SessionKey, ChatMessage[]>>;
  work: Partial<Record<SessionKey, string>>;
  errors: Partial<Record<SessionKey, string>>;
};

export const initialClientState: ClientState = { workspace: null, selected: null, messages: {}, work: {}, errors: {} };

export function reduceClientState(state: ClientState, event: StudyViewEvent): ClientState {
  if (event.type === 'snapshot') return { ...state, workspace: event.workspace };
  if (event.type === 'message-delta') {
    const messages = [...(state.messages[event.sessionKey] ?? [])];
    const index = messages.findIndex((message) => message.id === event.messageId);
    if (index < 0) messages.push({
      id: event.messageId,
      role: event.sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
      text: event.delta,
      complete: false,
    });
    else messages[index] = { ...messages[index]!, text: messages[index]!.text + event.delta };
    return { ...state, messages: { ...state.messages, [event.sessionKey]: messages } };
  }
  if (event.type === 'message') return {
    ...state,
    messages: {
      ...state.messages,
      [event.sessionKey]: (state.messages[event.sessionKey] ?? []).some((message) => message.id === event.message.id)
        ? (state.messages[event.sessionKey] ?? []).map((message) => message.id === event.message.id ? event.message : message)
        : [...(state.messages[event.sessionKey] ?? []), event.message],
    },
  };
  if (event.type === 'work-status') return {
    ...state,
    work: { ...state.work, [event.sessionKey]: event.status === 'running' ? event.label : '' },
  };
  if (event.type === 'session-error') return {
    ...state, errors: { ...state.errors, [event.sessionKey]: event.message },
  };
  return state;
}
```

- [ ] **Step 3: Implement the Markdown, Home and navigation components**

Create `MarkdownView.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function MarkdownView({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{children}</ReactMarkdown>;
}
```

Create `LearningSetHome.tsx`:

```tsx
import type { LearningSetSnapshot } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function LearningSetHome({ value, onOpen }: { value: LearningSetSnapshot; onOpen(id: string): void }) {
  return <main className="home">
    <p className="eyebrow">StudyForge Learning Set</p>
    <h1>{value.title}</h1>
    <MarkdownView>{value.overview}</MarkdownView>
    <section className="plan-list">{value.plans.map((plan) => <button key={plan.id} onClick={() => onOpen(plan.id)}>
      <span>{plan.status}</span><strong>{plan.title}</strong><p>{plan.capabilityStandard}</p>
    </button>)}</section>
  </main>;
}
```

Create `SessionTree.tsx`:

```tsx
import type { PlanWorkspaceSnapshot, SessionKey } from '../../shared/contracts';

export function SessionTree({ workspace, selected, onSelect }: {
  workspace: PlanWorkspaceSnapshot; selected: SessionKey; onSelect(key: SessionKey): void;
}) {
  return <nav className="session-tree" aria-label="Plan sessions">
    <button className={selected === workspace.coach.sessionKey ? 'selected' : ''} onClick={() => onSelect(workspace.coach.sessionKey)}>
      <b>Coach</b><span>方向、备课与复盘</span>
    </button>
    {workspace.lessons.map((lesson) => <button key={lesson.id} className={selected === lesson.sessionKey ? 'selected' : ''}
      onClick={() => onSelect(lesson.sessionKey)}>
      <b>{lesson.title}</b><span>{lesson.status}</span>
    </button>)}
  </nav>;
}
```

- [ ] **Step 4: Implement chat and classroom-node components**

Create `ChatPanel.tsx`:

```tsx
import { useState } from 'react';
import type { ChatMessage, SessionKey } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function ChatPanel({ sessionKey, messages, work, error, onSend }: {
  sessionKey: SessionKey; messages: ChatMessage[]; work: string; error?: string; onSend(text: string): Promise<void>;
}) {
  const [text, setText] = useState('');
  return <section className="chat">
    <header><span>当前发送到</span><strong>{sessionKey}</strong></header>
    <div className="timeline">{messages.map((message) => <article key={message.id} className={`message ${message.role}`}>
      <MarkdownView>{message.text}</MarkdownView>
    </article>)}</div>
    {work && <p className="work-status">{work}</p>}
    {error && <p className="session-error" role="alert">{error}</p>}
    <form onSubmit={(event) => { event.preventDefault(); const value = text.trim(); if (!value) return; setText(''); void onSend(value); }}>
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="写下你的想法或解题过程" />
      <button type="submit">发送</button>
    </form>
  </section>;
}
```

Create `ActivityDrawer.tsx`:

```tsx
import type { LessonNode } from '../../shared/contracts';

export function ActivityDrawer({ lesson }: { lesson: LessonNode | null }) {
  return <aside className="activities"><h2>课堂节点</h2>{lesson?.blocks.map((block) => <div key={block.id} data-status={block.status}>
    <span>{block.status}</span><b>{block.title}</b>{!block.required && <em>可选</em>}
  </div>) ?? <p>Coach 模式下暂无课堂节点。</p>}</aside>;
}
```

- [ ] **Step 5: Compose the App and WebSocket loop**

Create `src/client/App.tsx` that:

1. calls `api.learningSet()` on mount;
2. shows `LearningSetHome` until a Plan is selected;
3. calls `api.workspace(planId)`, selects `coach:<planId>`, and loads that Session history;
4. opens the event socket against the current origin, then dispatches every `StudyViewEvent` through `reduceClientState`:

   ```ts
   const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
   const socket = new WebSocket(`${protocol}//${location.host}/events`);
   ```
5. on Lesson selection, previews `prepared/closed/abandoned` without sending; for `active/paused`, loads history; “开始上课” for prepared and “继续上课” for paused both call `api.lessonAction(id, 'start')` before enabling the composer;
6. before navigating away from an `active` Tutor node, calls `api.lessonAction(currentLessonId, 'pause')`; when a snapshot closes the selected Lesson, returns selection to the Plan Coach;
7. derives `work` and `error` from the selected Session, and shows one reconnect banner while the WebSocket is closed;
8. renders `SessionTree`, `ChatPanel`, and `ActivityDrawer` in one shell.

Use these top-level elements so later tasks can extend them without changing ownership:

```tsx
return <div className="workspace-shell">
  <SessionTree workspace={workspace} selected={selected} onSelect={selectSession} />
  <ChatPanel sessionKey={selected} messages={messages} work={work} error={error} onSend={send} />
  <ActivityDrawer lesson={selectedLesson} />
</div>;
```

Replace `main.tsx` so it imports and renders this `App`.

- [ ] **Step 6: Add the restrained three-column layout**

Replace `styles.css` with CSS that defines these stable layout classes: `.home`, `.plan-list`, `.workspace-shell`, `.session-tree`, `.chat`, `.timeline`, `.message`, `.activities`, `.work-status`. Use a 260px sidebar, flexible chat center and 300px node drawer above 1100px; collapse the node drawer below the chat under 1100px. Keep one warm paper background, one dark ink color and one amber accent; do not add dashboard cards around every paragraph.

- [ ] **Step 7: Run reducer tests, build, and manual browser smoke**

```bash
cd apps/pi-teaching-web
bun test tests/client/state.test.ts
bun run typecheck
bun run build
```

Then run server and client in separate terminals:

```bash
STUDY_LEARNING_SET="$PWD/../../examples/derivative-demo/learning-set" bun run dev:server
bun run dev:client
```

Expected: Home shows the derivative overview; opening the Plan shows Coach plus three Lesson nodes; changing nodes never combines messages.

- [ ] **Step 8: Commit the core frontend**

```bash
git add apps/pi-teaching-web/src/client apps/pi-teaching-web/tests/client
git commit -m "feat: add learning and Plan workspace UI"
```

---

### Task 11: Add safe Lesson notebook, structured cards and image input

**Files:**

- Create: `apps/pi-teaching-web/src/study/student-notebook.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Create: `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
- Create: `apps/pi-teaching-web/src/client/components/StudentCard.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/tests/study/student-notebook.test.ts`

**Interfaces:**

- `GET /api/lessons/:lessonId/notebook` returns only `StudentNotebook` unless server started with `--authoring`.
- `POST /api/lessons/:lessonId/images` saves an image under `materials/classroom/<lesson-id>/` and returns a relative path.
- `POST /api/sessions/:sessionKey/messages` accepts `{ text, imagePaths }`; the server converts existing files to Pi image content.
- Student cards contain `path`, `stem` and choices only; never `answer`, `rubric`, `solution` or Teacher Control.

- [ ] **Step 1: Define the notebook contract and failing no-spoiler test**

Append to `contracts.ts`:

```ts
export type StudentProblemCard = { path: string; stem: string; choices: Array<{ label: string; text: string }> };
export type StudentNotebook = {
  lesson: Omit<LessonNode, 'blocks'> & { blocks: ActivityBlock[] };
  cards: Record<string, StudentProblemCard>;
  authoring?: { source: string };
};
```

Create `tests/study/student-notebook.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readStudentNotebook } from '../../src/study/student-notebook';

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');

test('returns card stems without answer-bearing fields', () => {
  const notebook = readStudentNotebook(root, 'lesson-003', false);
  const text = JSON.stringify(notebook);
  expect(text).toContain('mst_p0032_ex22');
  expect(text).toContain('关于 $x$ 的不等式');
  for (const forbidden of ['source_solution_summary', 'rubric', 'Teacher Control', 'answer']) {
    expect(text).not.toContain(forbidden);
  }
});
```

- [ ] **Step 2: Implement safe alias and card projection**

Create `src/study/student-notebook.ts` with these rules:

```ts
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { parse } from 'yaml';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';
import type { StudentNotebook, StudentProblemCard } from '../shared/contracts';
import { readPlanWorkspace } from './read-workspace';

function aliases(source: string): Map<string, string> {
  const section = /^## Aliases\s*$\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(source)?.[1] ?? '';
  return new Map([...section.matchAll(/^[-*]\s*([^:]+):\s*(\S.*?)\s*$/gm)].map((match) => [match[1]!.trim(), match[2]!.trim()]));
}

function studentCard(root: string, lessonPath: string, target: string): StudentProblemCard {
  const relativePath = normalize(join(dirname(lessonPath), target)).replaceAll('\\', '/');
  const absolute = resolveInsideRoot(root, relativePath);
  const raw = parse(readFileSync(absolute, 'utf8')) as Record<string, unknown>;
  const original = raw.original_problem as Record<string, unknown> | undefined;
  const choices = Array.isArray(original?.choices) ? original.choices.flatMap((choice) => {
    if (!choice || typeof choice !== 'object') return [];
    const value = choice as Record<string, unknown>;
    return typeof value.label === 'string' && typeof value.text_raw === 'string'
      ? [{ label: value.label, text: value.text_raw }] : [];
  }) : [];
  return {
    path: String(raw.storage_uri ?? target),
    stem: String(raw.stem ?? ''),
    choices,
  };
}

export function readStudentNotebook(root: string, lessonId: string, authoring: boolean): StudentNotebook {
  const roadmap = readFileSync(resolveInsideRoot(root, 'ROADMAP.md'), 'utf8');
  const planId = [...roadmap.matchAll(/\((plans\/[^)]+\.md)\)/g)]
    .map((match) => match[1]!.split('/').at(-1)!.replace(/\.md$/, ''))
    .find((id) => readPlanWorkspace(root, id).lessons.some((lesson) => lesson.id === lessonId));
  if (!planId) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
  const lesson = readPlanWorkspace(root, planId).lessons.find((item) => item.id === lessonId)!;
  const source = readFileSync(resolveInsideRoot(root, lesson.path), 'utf8');
  const cards: Record<string, StudentProblemCard> = {};
  for (const [alias, target] of aliases(source)) cards[alias] = studentCard(root, lesson.path, target);
  return {
    lesson,
    cards,
    ...(authoring ? { authoring: { source } } : {}),
  };
}
```

- [ ] **Step 3: Add notebook, upload and image-message API routes**

In `app.ts`:

- add `GET /api/lessons/:lessonId/notebook` using `readStudentNotebook(deps.root, lessonId, deps.authoring)`;
- add `POST /api/lessons/:lessonId/images` accepting `multipart/form-data` field `image`, writing its bytes to `materials/classroom/<lesson-id>/<crypto.randomUUID()>.<ext>` and returning `{ path }`;
- extend the message request to `{ text: string; imagePaths?: string[] }`;
- convert every path to an existing file under the learning-set root, then to Pi `ImageContent` with MIME inferred from `.png`, `.jpg`, `.jpeg` or `.webp`;
- pass the image content array to `registry.send`.

Use this exact base64 conversion at the server boundary:

```ts
const imageTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
} as const;

function readImageContent(root: string, path: string): ImageContent {
  const mediaType = imageTypes[extname(path).toLowerCase() as keyof typeof imageTypes];
  if (!mediaType) throw new Error(`UNSUPPORTED_IMAGE: ${path}`);
  return {
    type: 'image',
    source: {
      type: 'base64',
      mediaType,
      data: readFileSync(resolveInsideRoot(root, path)).toString('base64'),
    },
  };
}
```

For the upload route, map `image/png`, `image/jpeg` and `image/webp` to one extension, create `materials/classroom/<lesson-id>/`, write `Buffer.from(await image.arrayBuffer())`, and return that learning-set-relative path. Import `extname`, `dirname`, `mkdirSync`, `readFileSync`, `writeFileSync`, `resolveInsideRoot` and `readStudentNotebook` directly in `app.ts`.

The implementation should be direct file IO in the route. Do not add a storage service, upload database, deduplication or image-processing pipeline.

- [ ] **Step 4: Render notebook and structured Student cards**

Create `StudentCard.tsx`:

```tsx
import type { StudentProblemCard } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function StudentCard({ alias, card }: { alias: string; card: StudentProblemCard }) {
  return <article className="problem-card"><p>{alias}</p><MarkdownView>{card.stem}</MarkdownView>
    {card.choices.length > 0 && <ol>{card.choices.map((choice) => <li key={choice.label}><b>{choice.label}.</b> <MarkdownView>{choice.text}</MarkdownView></li>)}</ol>}
  </article>;
}
```

Create `LessonNotebook.tsx` to render the Lesson title, block list, each block's Student View and every alias/card in `StudentNotebook.cards`. Render `authoring.source` only when the API returned it; do not place authoring controls in the student response path.

- [ ] **Step 5: Add image selection to the composer**

Extend `ChatPanel` with `<input type="file" accept="image/png,image/jpeg,image/webp" />`, upload selected files through `api.uploadImage(lessonId, file)`, show small local previews, and call `api.message(sessionKey, text, imagePaths)`. Clear previews after the server accepts the message.

- [ ] **Step 6: Run no-spoiler tests and browser smoke**

```bash
cd apps/pi-teaching-web
bun test tests/study/student-notebook.test.ts
bun run typecheck
bun run build
```

Expected: Student notebook JSON contains card stems and choices but no answer, rubric, solution or Teacher Control. In authoring mode only, the notebook endpoint also contains raw Lesson source.

- [ ] **Step 7: Commit structured classroom content**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests/study/student-notebook.test.ts
git commit -m "feat: add safe classroom notebook and image input"
```

---

### Task 12: Project method evidence and add the evidence lens

**Files:**

- Create: `apps/pi-teaching-web/src/study/ability.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Create: `apps/pi-teaching-web/src/client/components/AbilityMap.tsx`
- Create: `apps/pi-teaching-web/src/client/components/EvidenceLens.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Create: `apps/pi-teaching-web/tests/study/ability.test.ts`

**Interfaces:**

- Produces: `readAbilityProjection(root): AbilityProjection` from active Trace and existing primary/secondary method aggregation.
- Produces: `readEvidence(root, sourceAnchor): EvidenceView` with a Trace observation and safe card metadata.
- `GET /api/abilities` and `GET /api/evidence?source=...` expose only source-linked student-safe evidence.

- [ ] **Step 1: Add ability and evidence contracts**

Append to `contracts.ts`:

```ts
export type AbilityNode = {
  method: string;
  state: 'unobserved' | 'unstable' | 'steady';
  score: number;
  evidenceCount: number;
  sources: string[];
};
export type AbilityProjection = { nodes: AbilityNode[] };
export type EvidenceView = {
  source: string;
  trace: { lessonId: string; blockId: string; assessment: string; support: string; note: string };
  card: null | { path: string; title: string; goal: string; methods: Array<{ name: string; role: 'primary' | 'secondary' }> };
};
```

- [ ] **Step 2: Write failing aggregation and drill-down tests**

Create `tests/study/ability.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readAbilityProjection, readEvidence } from '../../src/study/ability';

const root = join(import.meta.dir, '../../../../plugins/highschool-study/tests/fixtures/learning-set');

test('projects weighted method signals into qualitative states', () => {
  const projection = readAbilityProjection(root);
  expect(projection.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: '冻结变量法', evidenceCount: 2, state: 'unstable' }),
  ]));
});

test('drills one ability source back to its Trace and safe card metadata', () => {
  const evidence = readEvidence(root, 'lessons/lesson-001.md#trace-event-001');
  expect(evidence.trace.lessonId).toBe('lesson-001');
  expect(evidence.card?.methods).toContainEqual({ name: '冻结变量法', role: 'primary' });
  expect(JSON.stringify(evidence)).not.toContain('rubric');
});
```

- [ ] **Step 3: Implement ability and evidence projection**

Create `src/study/ability.ts`:

```ts
import {
  aggregateMethodSignals,
  readActiveTraces,
  readCard,
} from 'highschool-study-markdown/study-domain';
import type { AbilityProjection, EvidenceView } from '../shared/contracts';

export function readAbilityProjection(root: string): AbilityProjection {
  const active = readActiveTraces(root);
  const counts = new Map<string, number>();
  for (const trace of active) if (trace.cardPath) {
    const card = readCard(root, trace.cardPath);
    for (const method of card?.methods ?? []) counts.set(method.name, (counts.get(method.name) ?? 0) + 1);
  }
  return {
    nodes: aggregateMethodSignals(root, active).map((signal) => ({
      method: signal.method,
      state: signal.score >= 0.75 ? 'steady' : 'unstable',
      score: signal.score,
      evidenceCount: counts.get(signal.method) ?? 0,
      sources: signal.sourceRefs,
    })),
  };
}

export function readEvidence(root: string, sourceAnchor: string): EvidenceView {
  const trace = readActiveTraces(root).find((item) => item.sourceAnchor === sourceAnchor);
  if (!trace) throw new Error(`TRACE_NOT_FOUND: ${sourceAnchor}`);
  const card = trace.cardPath ? readCard(root, trace.cardPath) : null;
  return {
    source: sourceAnchor,
    trace: {
      lessonId: trace.lessonId,
      blockId: trace.blockId,
      assessment: trace.assessment,
      support: trace.support,
      note: trace.note,
    },
    card: card ? { path: card.path, title: card.title, goal: card.goal, methods: card.methods } : null,
  };
}
```

- [ ] **Step 4: Add API and UI**

Add `GET /api/abilities` and `GET /api/evidence?source=<anchor>` to `app.ts`.

Create `AbilityMap.tsx` as a compact list/network surface: one button per method, qualitative label `待观察 / 不稳定 / 较稳`, evidence count and an uncertainty halo driven by state. Clicking a node opens `EvidenceLens` on its first source.

Create `EvidenceLens.tsx` as one side panel showing the source anchor, original Trace note, assessment/support and safe card title/methods. It must not render raw card YAML.

- [ ] **Step 5: Run tests and browser smoke**

```bash
cd apps/pi-teaching-web
bun test tests/study/ability.test.ts
bun run typecheck
bun run build
```

Expected: method nodes use existing primary/secondary weights and every visible conclusion drills to a real Trace.

- [ ] **Step 6: Commit evidence visualization**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests/study/ability.test.ts
git commit -m "feat: visualize source-linked ability evidence"
```

---

### Task 13: Render dynamic Lesson routes and post-Lesson replay

**Files:**

- Create: `apps/pi-teaching-web/src/study/routes.ts`
- Create: `apps/pi-teaching-web/src/study/replay.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Create: `apps/pi-teaching-web/src/client/components/RouteMap.tsx`
- Create: `apps/pi-teaching-web/src/client/components/ReplayTimeline.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
- Create: `apps/pi-teaching-web/tests/study/routes-and-replay.test.ts`

**Interfaces:**

- Produces: `readRouteChanges(root, lessonPath)` and `applyRouteChanges(blockIds, changes)`.
- Produces: `buildReplay(root, lesson, history): ReplayItem[]` from existing Session history, Lesson Route Changes and active Trace.
- `GET /api/lessons/:lessonId/replay` returns full replay when Session history exists, otherwise an explicit `evidence-only` replay.

- [ ] **Step 1: Add route/replay contracts and failing tests**

Append to `contracts.ts`:

```ts
export type RouteChange = {
  id: string; action: 'insert' | 'skip' | 'move' | 'repeat'; blockId: string;
  before: string | null; after: string | null; reason: string; source: string;
};
export type ReplayItem = {
  id: string; kind: 'message' | 'trace' | 'route' | 'image'; label: string; detail: string; source: string | null;
};
export type LessonReplay = { mode: 'full' | 'evidence-only'; items: ReplayItem[] };
```

Create `tests/study/routes-and-replay.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { applyRouteChanges } from '../../src/study/routes';

test('replays append-only route changes over the initial block order', () => {
  const route = applyRouteChanges(['a', 'b', 'c'], [
    { id: 'route-001', action: 'skip', blockId: 'b', before: null, after: null, reason: 'evidence', source: '#trace-1' },
    { id: 'route-002', action: 'repeat', blockId: 'a', before: null, after: 'c', reason: 'student request', source: '#trace-2' },
  ]);
  expect(route).toEqual(['a', 'c', 'a']);
});
```

- [ ] **Step 2: Implement route parsing and replay**

In `routes.ts`, parse every `### Route change route-xxx` section into `RouteChange`. Implement `applyRouteChanges` by copying the initial array and applying actions in document order:

- `skip`: remove the first matching item;
- `repeat`: insert another copy before/after its target, defaulting to the end;
- `move`: remove the first matching item, then insert it before/after its target;
- `insert`: insert `blockId` only when it is not already in the route.

In `replay.ts`, combine:

```ts
export function buildReplay(
  root: string,
  lesson: LessonNode,
  history: ChatMessage[],
): LessonReplay {
  const traces = readActiveTraces(root, [lesson.path]);
  const routes = readRouteChanges(root, lesson.path);
  const items: ReplayItem[] = [
    ...history.map((message) => ({ id: message.id, kind: 'message' as const, label: message.role, detail: message.text, source: null })),
    ...traces.map((trace) => ({ id: trace.eventId, kind: 'trace' as const, label: `${trace.assessment} · ${trace.support}`, detail: trace.note, source: trace.sourceAnchor })),
    ...routes.map((route) => ({ id: route.id, kind: 'route' as const, label: `${route.action} ${route.blockId}`, detail: route.reason, source: route.source })),
  ];
  return { mode: history.length > 0 ? 'full' : 'evidence-only', items };
}
```

- [ ] **Step 3: Add replay API and UI**

Add `GET /api/lessons/:lessonId/replay`. Resolve the Lesson from the current workspace; use `registry.history(lesson.sessionKey)` if the Tutor Session has been opened, otherwise return evidence-only replay.

Create `RouteMap.tsx` showing the initial route as a muted row and effective route as an accent row. Use CSS transforms for movement when `route-change` events arrive; do not add an animation engine.

Create `ReplayTimeline.tsx` with a simple vertical scrub/list of messages, Trace and route changes. Label evidence-only mode explicitly. Embed both components in the Lesson notebook for `closed` and `abandoned` Lessons.

- [ ] **Step 4: Run route tests and build**

```bash
cd apps/pi-teaching-web
bun test tests/study/routes-and-replay.test.ts
bun run typecheck
bun run build
```

Expected: route replay is deterministic and a missing Pi history produces `evidence-only`, never invented chat.

- [ ] **Step 5: Commit route and replay UI**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests/study/routes-and-replay.test.ts
git commit -m "feat: add route map and Lesson replay"
```

---

### Task 14: Inject the selected persona and drive one visual theme

**Files:**

- Modify: `plugins/highschool-study/package.json`
- Create: `apps/pi-teaching-web/src/study/persona.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/study/persona.test.ts`

**Interfaces:**

- Produces: `resolvePersona(root, sessionOverride): { id, content }` with priority Session override, then `CLAUDE.local.md`, `CLAUDE.md`, bundled `neutral-tutor`.
- Produces: `GET /api/persona?sessionKey=...` and `POST /api/sessions/:sessionKey/persona`, returning only IDs and presentation metadata.
- Persona content enters Coach/Tutor ResourceLoader, but never tools, Trace, summaries or ability projection.

- [ ] **Step 1: Export bundled persona assets and write failing resolver tests**

Add to the plugin package exports:

```json
"./personas/*": "./skills/enter-learning-set/references/personas/*.md"
```

Create `tests/study/persona.test.ts` using a temporary root with:

```markdown
# Learning Set

- Default presentation persona: `calm-senpai`
```

and assert `resolvePersona(root).id === 'calm-senpai'`. Add `CLAUDE.local.md` with `- Preferred persona: energetic-classmate` and assert it wins. Add `.claude/personas/energetic-classmate.md` and assert the learning-set file content overrides the bundled content.

- [ ] **Step 2: Implement the exact persona resolution order**

Create `src/study/persona.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bundled = (id: string) => fileURLToPath(import.meta.resolve(`highschool-study-markdown/personas/${id}`));
const selection = (source: string, label: string) => new RegExp(`^- ${label}: \\x60([^\\x60]+)\\x60\\s*$`, 'm').exec(source)?.[1] ?? null;

export function resolvePersona(root: string, sessionOverride: string | null = null): { id: string; content: string } {
  const localPath = join(root, 'CLAUDE.local.md');
  const sharedPath = join(root, 'CLAUDE.md');
  const local = existsSync(localPath) ? selection(readFileSync(localPath, 'utf8'), 'Preferred persona') : null;
  const shared = existsSync(sharedPath) ? selection(readFileSync(sharedPath, 'utf8'), 'Default presentation persona') : null;
  const id = sessionOverride ?? local ?? shared ?? 'neutral-tutor';
  const projectPath = join(root, '.claude', 'personas', `${id}.md`);
  const path = existsSync(projectPath) ? projectPath : bundled(id);
  return { id, content: readFileSync(path, 'utf8') };
}
```

- [ ] **Step 3: Inject exactly one persona into each parent Session**

In `createRoleResourceLoader`, call `resolvePersona(root)` and append one virtual context file:

```ts
const persona = resolvePersona(root);
// inside agentsFilesOverride
{ path: `/virtual/studyforge-persona-${persona.id}.md`, content: `${persona.content}\n\nPresentation only: never change tools, facts, assessment, Trace or capability standards.` },
```

Do not enumerate or inject the other persona files.

- [ ] **Step 4: Add a Session-local persona override using Pi JSONL**

Extend `StudySession` with `personaId(): string | null` and `setPersona(id: string, content: string): Promise<void>`. Implement both in the Pi wrapper using the existing `SessionManager`:

```ts
personaId: () => manager.getEntries().flatMap((entry) =>
  entry.type === 'custom' && entry.customType === 'studyforge.persona.v1'
    ? [String((entry.data as { id?: unknown } | undefined)?.id ?? '')] : []).filter(Boolean).at(-1) ?? null,
setPersona: async (id, content) => {
  manager.appendCustomEntry('studyforge.persona.v1', { id });
  await session.sendCustomMessage({
    customType: 'studyforge.persona-context.v1',
    content: `${content}\n\nThis is the latest presentation persona. It replaces earlier persona instructions and cannot change facts, tools, assessment or Trace.`,
    display: false,
  }, { triggerTurn: false });
},
```

In `WorkspaceRegistry`, add `setPersona(key, id)`: resolve the requested file with `resolvePersona(root, id)`, open the selected Coach or active Tutor Session, and call `session.setPersona(id, content)`. Add `personaId(key)` returning `session.personaId() ?? resolvePersona(root).id`. This setting belongs to Pi Session JSONL and is deliberately not written to the learning set. Update the fake `StudySession` objects in `workspace-registry.test.ts` with both methods and add a test that Coach/Tutor overrides remain independent and survive reopening the same fake Session.

- [ ] **Step 5: Apply the persona ID only as a visual theme**

Add `GET /api/persona?sessionKey=<key>` returning `{ id, choices }`, where `choices` contains the three bundled IDs and display names, and `POST /api/sessions/:sessionKey/persona` accepting `{ id }` and calling `registry.setPersona`. In `App`, set `data-persona={persona.id}` on the app root and show a compact selector for the current Session. Add one small mapping in CSS for neutral, calm and energetic accent colors and avatar image placeholders. Phase animations must consume existing `phase`/`work-status` state; do not accept animation commands from model text.

- [ ] **Step 6: Run persona tests and existing evidence tests**

```bash
cd apps/pi-teaching-web
bun test tests/study/persona.test.ts tests/study/ability.test.ts
bun run typecheck
bun run build
```

Expected: persona selection changes context and CSS ID only; ability projection remains byte-for-byte equal across persona IDs.

- [ ] **Step 7: Commit persona integration**

```bash
git add plugins/highschool-study/package.json apps/pi-teaching-web/src apps/pi-teaching-web/tests/study/persona.test.ts
git commit -m "feat: add presentation persona to Pi frontend"
```

---

### Task 15: Package the Pi command and validate the derivative learning loop

**Files:**

- Modify: `apps/pi-teaching-web/package.json`
- Create: `apps/pi-teaching-web/src/pi-extension.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Create: `apps/pi-teaching-web/playwright.config.ts`
- Create: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Create: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Create: `apps/pi-teaching-web/README.md`
- Modify: `examples/derivative-demo/learning-set/lessons/lesson-003.md`
- Modify: `README.md`

**Interfaces:**

- Produces: Pi command `/study-web [path]` that starts the local server for one learning set and opens the browser.
- Produces: deterministic browser E2E against a fake Session adapter and a documented real-model smoke command.
- Produces no installer, updater, daemon manager or cross-platform process supervisor in this local-first phase.

- [ ] **Step 1: Add explicit Node State to the prepared demo Lesson**

For every Block in `examples/derivative-demo/learning-set/lessons/lesson-003.md`, insert `### Node State` before Student View. Use:

- `orientation`: `Kind: dialogue`, required, pending, no dependency;
- `assessment-01`: `Kind: problem`, required, pending, depends on `orientation`, uses `Q-DOMAIN-EX22`;
- `repair-optional`: `Kind: problem`, optional, pending, depends on `assessment-01`, uses `Q-DOMAIN-EX05`;
- `assessment-02`: `Kind: problem`, required, pending, depends on `assessment-01`, uses `Q-DOMAIN-EX16`;
- `reflection`: `Kind: reflection`, required, pending, depends on `assessment-02`.

Add a contract assertion that the parser returns those exact kinds, dependencies and aliases.

- [ ] **Step 2: Serve the built client from the local Bun server**

Add optional `staticRoot: string` to `AppDependencies`. After all API and WebSocket routes, handle only these local client requests:

```ts
if (deps.staticRoot && request.method === 'GET') {
  const asset = url.pathname.startsWith('/assets/') ? url.pathname.slice(1) : null;
  const shell = url.pathname === '/' || (!url.pathname.startsWith('/api/') && !url.pathname.includes('.'));
  const path = asset ?? (shell ? 'index.html' : null);
  if (path) {
    const file = Bun.file(join(deps.staticRoot, path));
    if (await file.exists()) return new Response(file);
  }
}
```

Import `join` in `app.ts`. In `server/index.ts`, compute the app-local directory exactly once and pass it to the handler:

```ts
const staticRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
const fetch = createRequestHandler({ root, authoring, registry, hub, staticRoot });
```

Import `dirname` and `fileURLToPath`. Run `bun run build && bun run start -- --learning-set ../../examples/derivative-demo/learning-set`, then verify both `/api/health` and `/` return 200 before continuing.

- [ ] **Step 3: Register the package and Pi command**

Add to `package.json`:

```json
"pi": {
  "extensions": ["./src/pi-extension.ts"],
  "skills": ["./resources/skills"]
}
```

Create `src/pi-extension.ts`:

```ts
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function waitForServer(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(url)).ok) return true; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

export default function studyWebExtension(pi: ExtensionAPI) {
  let child: ChildProcess | null = null;
  const serverEntry = join(dirname(fileURLToPath(import.meta.url)), 'server', 'index.ts');

  pi.registerCommand('study-web', {
    description: 'Open the StudyForge local teaching frontend',
    handler: async (args, ctx) => {
      const requested = args.trim() ? resolve(ctx.cwd, args.trim()) : join(ctx.cwd, 'learning-set');
      const root = existsSync(join(requested, 'ROADMAP.md')) ? requested : ctx.cwd;
      if (!existsSync(join(root, 'ROADMAP.md'))) {
        ctx.ui.notify('没有找到 ROADMAP.md；请从 learning-set 或其父目录运行。', 'error');
        return;
      }
      if (!child || child.exitCode !== null) child = spawn('bun', ['run', serverEntry, '--learning-set', root, '--port', '65000'], {
        stdio: 'ignore', env: process.env,
      });
      if (!await waitForServer('http://127.0.0.1:65000/api/health')) {
        ctx.ui.notify('StudyForge 本地服务没有成功启动；请先确认已安装 Bun。', 'error');
        return;
      }
      await pi.exec(process.platform === 'darwin' ? 'open' : 'xdg-open', ['http://127.0.0.1:65000']);
      ctx.ui.notify('StudyForge 已打开： http://127.0.0.1:65000', 'info');
    },
  });

  pi.on('session_shutdown', () => { child?.kill(); child = null; });
}
```

- [ ] **Step 4: Add one deterministic Playwright flow**

Create `tests/e2e/fixture-server.ts` using `createRequestHandler`, the real derivative learning-set reader and a fake registry whose Coach/Tutor histories are empty and whose state transitions return the real Markdown snapshot. It must expose Bun WebSocket support but never construct `ModelRuntime` or request model credentials.

Create `playwright.config.ts` with Chromium, base URL `http://127.0.0.1:65001`, and these two `webServer` entries:

```ts
webServer: [
  { command: 'bun run tests/e2e/fixture-server.ts', port: 65000, reuseExistingServer: false },
  { command: 'bunx vite --port 65001', port: 65001, reuseExistingServer: false },
],
```

Create `tests/e2e/workspace.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('moves from learning-set overview to Coach and a prepared Lesson preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '导数学习 Roadmap' })).toBeVisible();
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('Coach');
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('Lesson 003');
  await page.getByRole('button', { name: /Lesson 003/ }).click();
  await expect(page.getByText('Q-DOMAIN-EX22')).toBeVisible();
  await expect(page.getByText(/D，即/)).toHaveCount(0);
});
```

- [ ] **Step 5: Document local installation and real-model smoke**

Create `apps/pi-teaching-web/README.md` with:

```bash
cd apps/pi-teaching-web
bun install
bun run check
STUDY_LEARNING_SET="$PWD/../../examples/derivative-demo/learning-set" bun run start
```

Document Pi package installation from the local directory and `/study-web`. Add a real-model smoke checklist: open Coach, review the previous Lesson, prepare one no-spoiler Lesson with at least two real cards, start Tutor, submit text and an image, append one Trace, pause/resume, close by student confirmation, and return to Coach.

Add the same concise entry point to root `README.md`.

- [ ] **Step 6: Run the complete frontend and plugin verification**

```bash
cd apps/pi-teaching-web
bun run check
bunx playwright install chromium
bunx playwright test
cd ../../plugins/highschool-study
bun run release:check
```

Expected: all app tests, typecheck, Vite build, Playwright flow and existing Claude plugin release check PASS.

- [ ] **Step 7: Run the real Pi smoke with the derivative demo**

Start the frontend with a configured Pi model and execute the documented smoke checklist. Record only observed failures; do not add distribution hardening during this task. Fix only failures that block the normal local learning loop, then rerun the affected automated test and the failed smoke step.

- [ ] **Step 8: Commit the package and E2E**

```bash
git add apps/pi-teaching-web examples/derivative-demo/learning-set/lessons/lesson-003.md README.md
git commit -m "feat: package Pi teaching frontend"
```

## Deferred Distribution Hardening

The following work is explicitly outside this implementation plan and must not be pulled into the local MVP:

- account/authentication and multi-student isolation;
- OS-level answer secrecy, untrusted Markdown sanitization and upload malware scanning;
- schema migrations and backward-compatible readers;
- crash-safe multi-file transactions and automatic recovery journals;
- daemon installation, port arbitration, auto-update and cross-platform process supervision;
- telemetry, rate limits, audit export and centralized policy management;
- generic runtime adapters for Claude Code or OpenCode;
- automatic retry trees, circuit breakers and production observability stacks.

Create a separate hardening spec only when the frontend is ready for external distribution.
