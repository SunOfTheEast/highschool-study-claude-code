# 学生可见教学可靠性收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让普通学生无需充当系统审计员，也能获得不剧透、会顺着真实作答继续教、结论有边界且可追溯、长期画像能可靠落盘的完整学习周期。

**Architecture:** 保持现有 Markdown-first、Coach/Tutor Session 分层和四工具公共 MCP 不变；只在 Pi 内部增加安全课程就绪投影与画像原子应用工具。Plan 完成结论仍写入现有 `## Plan Summary`，Evidence Scout、来源回放、学生异议和 Roadmap 编辑均复用现有能力。确定性的身份、路径、枚举、来源资格和双文件提交交给运行时；教学判断、问诊、干预和结论表述留给 Agent 与 Skill。

**Tech Stack:** Bun 1.3.14、TypeScript 7、React 19、TypeBox 1.3、Pi 0.81、Markdown、Playwright 1.61、Claude Code plugin/MCP。

## Global Constraints

- 不新增数据库、向量库、后台索引、Evidence 数据层、裁判 Agent、`roadmap_update` 或第五个公共 MCP 工具。
- Claude Code 插件的公共 MCP 工具仍严格为 `card_search`、`trace_search`、`trace_append`、`source_resolve`。
- 不兼容或猜测旧式自由画像，也不为旧版自由 `complete + planSummary` 契约保留分支。
- 不测试 Agent/Skill 的逐字文案、标题或关键词；只测试可执行 schema、权限、持久化、投影和 UI 行为。
- `safe` 是默认学生投影；`raw-stream` 保留原始消息，不丢失 Pi JSONL。
- 所有真实模型验收都在导数学习集副本上运行，不能修改 `examples/derivative-demo/learning-set`。
- 每个任务只提交本任务列出的文件；保留现有 `.superpowers/` 和其他无关未跟踪文件。

---

## Task 1: 让 Lesson 已知参数进入工具 Schema

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/lesson-tool-contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Create: `apps/pi-teaching-web/tests/runtime/lesson-tool-contracts.test.ts`

- [ ] **Step 1: 先写动态 Block 与分问 Schema 的失败测试**

在 `lesson-tool-contracts.test.ts` 建立一份包含 `orientation`、`problem-a`、`reflection` 三个 Block、两张真实题卡别名的临时 Lesson。使用 TypeBox `Value.Check` 验证：

```ts
const blockId = lessonBlockIdSchema(root, 'lessons/lesson-001.md');
expect(Value.Check(blockId, 'problem-a')).toBe(true);
expect(Value.Check(blockId, 'invented-block')).toBe(false);

const question = lessonPartQuestionSchema(root, 'lessons/lesson-001.md');
if (!question) throw new Error('expected part-question schema');
expect(Value.Check(question, '第（1）问')).toBe(true);
expect(Value.Check(question, '随便一问')).toBe(false);
```

再在 `study-tools.test.ts` 增加四个契约断言：

```ts
expect(Value.Check(trace.parameters, validTraceInput('problem-a'))).toBe(true);
expect(Value.Check(trace.parameters, validTraceInput('invented-block'))).toBe(false);
expect(Value.Check(classroom.parameters, { action: 'pause' })).toBe(true);
expect(Value.Check(classroom.parameters, {
  action: 'activate',
  blockId: 'invented-block',
})).toBe(false);
```

运行：

```bash
cd apps/pi-teaching-web
bun test tests/runtime/lesson-tool-contracts.test.ts tests/runtime/study-tools.test.ts
```

Expected: 新测试因 helper 不存在、当前字段仍为自由字符串而失败。

- [ ] **Step 2: 实现一个共享的 Lesson 契约读取器**

`lesson-tool-contracts.ts` 只读取当前 Session-owned Lesson，不建立缓存：

```ts
import { Type, type TSchema } from 'typebox';
import {
  readCard,
  readLessonAliases,
  readMarkdownFile,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import { readPreparedLessonBlocks } from '../study/validate-prepared-lesson';

function literalUnion(values: string[], description: string): TSchema {
  const unique = [...new Set(values)];
  if (unique.length === 0) throw new Error('LESSON_SCHEMA_VALUES_REQUIRED');
  return Type.Union(
    unique.map((value) => Type.Literal(value)),
    { description },
  );
}

export function lessonBlockIdSchema(root: string, lessonPath: string): TSchema {
  const lesson = readMarkdownFile(root, lessonPath);
  return literalUnion(
    readPreparedLessonBlocks(lesson.body).map((block) => block.id),
    'Exact Block ID from the current Session-owned Lesson.',
  );
}

export function lessonPartQuestionSchema(
  root: string,
  lessonPath: string,
): TSchema | null {
  const lesson = readMarkdownFile(root, lessonPath);
  const labels = [...readLessonAliases(lesson.body).values()]
    .flatMap((target) => {
      const resolved = sourceResolve(root, { fromPath: lessonPath, target });
      const card = resolved.path === null ? null : readCard(root, resolved.path);
      return card?.parts ?? [];
    });
  return labels.length === 0
    ? null
    : literalUnion(
      labels,
      'Exact part label from a problem card bound to the current Lesson.',
    );
}
```

若 `readCard(...).parts` 的现有返回结构不是 `string[]`，只在这一 helper 中映射为现有真实标签；不得改变公共插件题卡结构。

- [ ] **Step 3: 把动态枚举接进三个 Tutor 工具**

在 `createStudyTools` 的 Tutor `trace_append` 中：

```ts
blockId: lessonBlockIdSchema(root, context.ownerPath),
```

在 `createClassroomUpdateTool` 中：

```ts
blockId: Type.Optional(lessonBlockIdSchema(root, ownerPath)),
```

保留现有执行期校验，因此 `pause` 仍可省略 `blockId`，其他 action 仍会在执行时要求它。

在 `createCardAlternativeAppendTool` 中先读取真实分问枚举，再动态组装参数：

```ts
const question = lessonPartQuestionSchema(root, ownerPath);
const parameters = Type.Object({
  sourceTraceId: Type.String({ minLength: 1 }),
  ...(question ? { question: Type.Optional(question) } : {}),
  solution: Type.String({ minLength: 1 }),
  method: Type.Union([methodName, Type.Null()]),
  support: Type.Union([
    Type.Literal('none'),
    Type.Literal('tutor'),
    Type.Literal('external'),
  ]),
}, { additionalProperties: false });
```

执行期先由 `sourceTraceId` 解析选中的真实题卡：

- 当前 Lesson 所有题卡都无分问：Schema 不出现 `question`，传给 domain 的值规范化为
  `整题`；
- 混合 Lesson 中选中无分问题卡：即使 Schema 提供其他卡的标签，执行期也要求省略，
  并规范化为 `整题`；
- 有分问：必须提供该题卡自身的精确标签；
- 标签虽属于同 Lesson 另一张卡也必须拒绝。

新增执行期测试，分别覆盖无分问自动推导、有分问精确匹配、跨卡标签拒绝。

- [ ] **Step 4: 让 `lesson_prepare.adjustments` 真正可省略**

Schema 改为：

```ts
adjustments: Type.Optional(Type.Array(nonempty, {
  description: 'Deliberate changes from the selected template defaults.',
})),
```

执行前显式规范化：

```ts
const blueprint: LessonBlueprint = {
  ...input,
  adjustments: input.adjustments ?? [],
};
```

补充测试，省略 `adjustments` 后生成的 Lesson 仍能通过 `validatePreparedLessonSource`，且 Blueprint 区域按现有 renderer 输出空调整列表。

- [ ] **Step 5: 运行本任务测试与类型检查**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/lesson-tool-contracts.test.ts tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: 所有动态枚举、自动 `整题`、可选 `adjustments` 测试通过；TypeScript 零错误。

- [ ] **Step 6: 提交**

```bash
git add apps/pi-teaching-web/src/runtime/lesson-tool-contracts.ts \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/src/runtime/classroom-update.ts \
  apps/pi-teaching-web/src/runtime/card-alternative-append.ts \
  apps/pi-teaching-web/tests/runtime/lesson-tool-contracts.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "fix: bind tutor tool schemas to the current lesson"
```

---

## Task 2: 用结构化 Learning Review 完成 Plan

**Files:**

- Create: `apps/pi-teaching-web/src/study/learning-review.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Modify: `apps/pi-teaching-web/src/study/coach-context.ts`
- Create: `apps/pi-teaching-web/tests/study/learning-review.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/coach-context.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/context-stack.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`

- [ ] **Step 1: 写渲染、解析和输入联合的失败测试**

在共享契约中先声明测试使用的目标类型：

```ts
export type LearningReview = {
  conclusion: string;
  boundary: string;
  nextStep: string;
  keyEvidence: Array<{ claim: string; source: string }>;
  supportingEvidence: Array<{
    claim: string;
    source: string;
    limitation: string;
  }>;
  openQuestions: Array<{ question: string; nextCheck: string }>;
};
```

测试一个完整对象经过 `renderLearningReview` 和 `parseLearningReview` 后严格相等；空
`openQuestions` 也必须往返成功。再断言 `plan_update.parameters`：

```ts
expect(Value.Check(planUpdate.parameters, {
  decision: 'complete',
  currentPosition: '已完成本周期。',
  nextLessonCandidate: '回到 Roadmap 讨论下一阶段。',
  learningReview: review,
})).toBe(true);
expect(Value.Check(planUpdate.parameters, {
  decision: 'complete',
  currentPosition: '已完成本周期。',
  nextLessonCandidate: '回到 Roadmap 讨论下一阶段。',
  planSummary: '旧式自由总结',
})).toBe(false);
expect(Value.Check(planUpdate.parameters, {
  decision: 'active',
  currentPosition: '仍在训练。',
  nextLessonCandidate: '继续一道迁移题。',
  planSummary: '保留自由总结。',
})).toBe(true);
```

运行：

```bash
cd apps/pi-teaching-web
bun test tests/study/learning-review.test.ts tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts
```

Expected: parser、renderer 和新联合输入尚不存在，测试失败。

- [ ] **Step 2: 实现唯一的 Markdown 表示**

`learning-review.ts` 导出：

```ts
export function renderLearningReview(review: LearningReview): string;
export function parseLearningReview(source: string): LearningReview | null;
export function validateLearningReviewSources(
  root: string,
  planPath: string,
  review: LearningReview,
): void;
```

固定写入现有 `## Plan Summary` 内部：

```markdown
### 阶段结论

能在限定类型中独立比较两条路线的代价。

### 适用范围

目前只覆盖两类参数函数，关键结论来自两张无提示题卡；保持性与跨章节迁移尚未验证。

### 下一步

回到 Roadmap 讨论跨题型迁移。

### 最能说明这一点

- 判断：能独立放弃高代价路线并完成低代价路线。
  - 来源：lessons/lesson-006.md#trace-event-001

### 可以作为参考

- 判断：能识别隐藏同构。
  - 来源：lessons/lesson-004.md#trace-event-002
  - 局限：Tutor 追问过标准模型

### 还需要再看看

- 问题：跨章节时是否仍能主动比较路线。
  - 下次检查：下一 Plan 安排一题非函数综合题
```

约束实现：

- `conclusion`、`boundary`、`nextStep` 允许自然段；
- claim、source、limitation、question、nextCheck 必须是非空单行文本；
- 缺少任一固定小标题时返回 `null`，普通进行中 Plan 的自由 `Plan Summary` 因此保持兼容；
- renderer 输出末尾换行，parser 只接受上述固定嵌套列表，不从散文猜测结构。

- [ ] **Step 3: 实现来源资格校验，不推断 mastery**

`validateLearningReviewSources` 对所有 key/supporting 来源执行：

1. `source_resolve` 能从当前 `planPath` 解析；
2. 来源所属 Lesson 的 `plan_id` 等于当前 Plan ID；
3. fragment 精确指向 active、未 supersede 的 Trace；
4. key 来源的 Trace 必须是 assessment 类任务、`assessment: correct`、`support: none`；
5. supporting 来源只要求 active Trace，限制由 Coach 如实填写；
6. 同一来源不能同时进入 key 和 supporting；
7. `openQuestions` 不接收来源。

测试只验证这些客观资格，不断言 claim 是否“足够有代表性”。至少覆盖：

- 其他 Plan 的 Trace 被拒绝；
- superseded Trace 被拒绝；
- `support: tutor` 不能进入 key、可以进入 supporting；
- 非 assessment 的正确 Trace 不能进入 key；
- 合法 key 与 supporting 能写入。

- [ ] **Step 4: 改造 `plan_update` 为判别联合**

`PlanUpdateInput` 改为：

```ts
type PlanProgressUpdate = {
  decision: 'active' | 'replan';
  currentPosition: string;
  nextLessonCandidate: string;
  planSummary: string;
};

type PlanCompleteUpdate = {
  decision: 'complete';
  currentPosition: string;
  nextLessonCandidate: string;
  learningReview: LearningReview;
};

export type PlanUpdateInput = PlanProgressUpdate | PlanCompleteUpdate;
```

TypeBox 参数也使用两个 `Type.Object` 的 `Type.Union`。学习回顾 schema 明确要求至少
一条关键来源，并关闭额外字段：

```ts
const text = Type.String({ minLength: 1 });
const learningReview = Type.Object({
  conclusion: text,
  boundary: text,
  nextStep: text,
  keyEvidence: Type.Array(Type.Object({
    claim: text,
    source: text,
  }, { additionalProperties: false }), { minItems: 1 }),
  supportingEvidence: Type.Array(Type.Object({
    claim: text,
    source: text,
    limitation: text,
  }, { additionalProperties: false })),
  openQuestions: Type.Array(Type.Object({
    question: text,
    nextCheck: text,
  }, { additionalProperties: false })),
}, { additionalProperties: false });
```

active/replan 与 complete 两个外层 object 同样设置 `additionalProperties: false`，因此
不保留 `complete + planSummary`，也不允许 `active + learningReview`。`updatePlan` 中：

```ts
const summary = input.decision === 'complete'
  ? renderLearningReview(input.learningReview)
  : input.planSummary;
if (input.decision === 'complete') {
  validateLearningReviewSources(root, planPath, input.learningReview);
}
source = replaceSection(source, 'Plan Summary', summary);
```

保留现有 Lesson Index 重建、Plan status 和 Roadmap Plan Graph 同步。

- [ ] **Step 5: 让读模型同时提供自然文本和结构化回顾**

扩展 `PlanSummary` 与 `CoachContextView`：

```ts
planSummary: string;
learningReview: LearningReview | null;
```

`read-workspace.ts` 对 `Plan Summary` 调用 parser；`coach-context.ts` 直接转发。
进行中 Plan 的 `learningReview` 为 `null`，完成 Plan 的原始 `planSummary` 仍保留，供
旧侧栏或调试视图读取。

- [ ] **Step 6: 更新所有强类型 Plan fixture**

在现有进行中 Plan fixture 中显式增加 `learningReview: null`，覆盖 Context Stack、
Learning Set Home、Session Tree、client state、server workspace 和 E2E fixture。
完成 Plan 的读取测试使用 parser 返回的真实对象，不用类型断言绕过。

- [ ] **Step 7: 运行本任务测试**

```bash
cd apps/pi-teaching-web
bun test tests/study/learning-review.test.ts \
  tests/study/write-workspace.test.ts \
  tests/study/read-workspace.test.ts \
  tests/study/coach-context.test.ts \
  tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: 两种 `plan_update` 分支、来源资格、Markdown 往返和读取投影全部通过。

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/src/study/learning-review.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/runtime/plan-update.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/src/study/read-workspace.ts \
  apps/pi-teaching-web/src/study/coach-context.ts \
  apps/pi-teaching-web/tests/study/learning-review.test.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts \
  apps/pi-teaching-web/tests/study/read-workspace.test.ts \
  apps/pi-teaching-web/tests/study/coach-context.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/client/context-stack.test.tsx \
  apps/pi-teaching-web/tests/client/learning-set-home.test.tsx \
  apps/pi-teaching-web/tests/client/session-tree.test.tsx \
  apps/pi-teaching-web/tests/client/state.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/e2e/fixture-server.ts
git commit -m "feat: persist bounded plan learning reviews"
```

---

## Task 3: 给学生呈现可下钻、可质疑的双层回顾

**Files:**

- Create: `apps/pi-teaching-web/src/client/components/PlanLearningReview.tsx`
- Create: `apps/pi-teaching-web/tests/client/plan-learning-review.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ContextStack.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/client/context-stack.test.tsx`

- [ ] **Step 1: 写学生默认视图和详情视图的失败测试**

用一份真实 `LearningReview` 渲染组件，断言：

```ts
expect(screen.getByText(review.conclusion)).toBeTruthy();
expect(screen.getByText(`这项判断目前适用于：${review.boundary}`)).toBeTruthy();
expect(screen.getByText(review.nextStep)).toBeTruthy();
expect(screen.queryByText(review.keyEvidence[0]!.claim)).toBeNull();

await user.click(screen.getByRole('button', { name: '为什么这样判断' }));
expect(screen.getByText('最能说明这一点')).toBeTruthy();
expect(screen.getByText('可以作为参考')).toBeTruthy();
expect(screen.getByText('还需要再看看')).toBeTruthy();
```

点击某条来源调用现有 `onEvidence(source)`；点击“这和我的实际情况不一样”只调用
`onDisputePrefill(text)`，不得调用 `onSend`。

- [ ] **Step 2: 实现 `PlanLearningReview`**

组件 props 固定为：

```ts
type Props = {
  value: LearningReview;
  onEvidence(source: string): void;
  onDisputePrefill(text: string): void;
};
```

默认只显示结论、带“这项判断目前适用于”前缀的边界、下一步。详情展开后用学生语言
显示三个层级，不显示 PASS/FAIL、contaminated、tier、分数或 evidence count。

每条有来源的记录提供：

- “查看这次表现”：调用现有 Evidence Lens；
- “这和我的实际情况不一样”：生成以下预填消息，不自动发送：

```text
我对这条学习回顾有不同看法。
来源：lessons/lesson-006.md#trace-event-001
当前判断：能独立比较两条路线的代价。
我的补充：
```

- [ ] **Step 3: 加入最小 composer 预填机制**

`ChatPanel` 增加：

```ts
prefill: { id: string; text: string } | null;
onPrefillConsumed(id: string): void;
```

使用 `useEffect` 在 `prefill.id` 变化时写入 textarea，并在写入后通知 App 清除该
prefill；不得提交消息、改变 Plan 或创建异议对象。

`App.tsx` 保存一个页面内 `composerPrefill`。Plan Coach 且
`coachContext.learningReview !== null` 时，把 `PlanLearningReview` 作为 ChatPanel
的 stage 显示；来源继续走 `openEvidence`，异议进入当前同一个 Plan Coach composer。

- [ ] **Step 4: 避免 Context Stack 再次展开原始回顾**

完成 Plan 时，右侧 `ContextStack` 不再重复 Current Position、Next Lesson Candidate
或含固定嵌套列表的原始 `planSummary`：

```tsx
{coachContext.learningReview
  ? <p className="context-unavailable">阶段回顾已整理，请在对话区查看。</p>
  : (
    <>
      <h3>当前位置</h3>
      <MarkdownView>{coachContext.currentPosition}</MarkdownView>
      <h3>下一课候选</h3>
      <MarkdownView>{coachContext.nextLessonCandidate}</MarkdownView>
      <h3>阶段摘要</h3>
      <MarkdownView>{coachContext.planSummary}</MarkdownView>
    </>
  )}
```

结构化回顾只由中央 `PlanLearningReview` 控制默认/详情两层。测试断言完成 Plan 的右侧
栏不出现 key claim 或原始 Current Position，进行中 Plan 仍显示三项自由文本。

- [ ] **Step 5: 完成样式与无障碍状态**

样式遵循现有留白新中式主题：

- 默认回顾不做统计卡阵列；
- 详情使用自然段与细分隔线；
- 来源按钮可键盘聚焦；
- `<details>` 或等价 button 正确设置 expanded 状态；
- 手机宽度下不横向滚动。

- [ ] **Step 6: 运行组件测试和构建**

```bash
cd apps/pi-teaching-web
bun test tests/client/plan-learning-review.test.tsx tests/client/context-stack.test.tsx
bun run typecheck
bun run build
```

Expected: 默认/展开、来源下钻、预填不自动发送均通过，生产构建成功。

- [ ] **Step 7: 提交**

```bash
git add apps/pi-teaching-web/src/client/components/PlanLearningReview.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/components/ContextStack.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/client/plan-learning-review.test.tsx \
  apps/pi-teaching-web/tests/client/context-stack.test.tsx
git commit -m "feat: show source-linked student learning reviews"
```

---

## Task 4: 把备课后的自由回复替换成无剧透就绪卡

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation-projector.ts`
- Modify: `apps/pi-teaching-web/src/projection/projector.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Create: `apps/pi-teaching-web/src/client/components/LessonReadyCard.tsx`
- Create: `apps/pi-teaching-web/tests/client/lesson-ready-card.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/projection/conversation-projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/projection/projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`

- [ ] **Step 1: 写 safe/raw、刷新与瞬时泄露的失败测试**

构造以下存储顺序：

1. Coach assistant 带 `lesson_prepare` toolCall；
2. 成功 `toolResult`，`details.kind === 'lesson-prepare'` 且 `value.ok === true`；
3. Coach 纯文本最终回复，故意包含题名、方法名和选卡理由。

断言：

```ts
expect(projectConversationEntries(key, entries, 'safe')).toEqual([
  {
    kind: 'lesson-ready',
    lesson: {
      lessonId: 'lesson-007',
      lessonPath: 'lessons/lesson-007.md',
      blockCount: 5,
      blockKinds: ['dialogue', 'problem', 'reflection'],
    },
  },
]);
expect(projectConversationEntries(key, entries, 'raw-stream'))
  .toContainEqual(expect.objectContaining({ kind: 'message' }));
```

再写 server 事件测试：成功 `lesson_prepare` 后的同 turn `message_end` 在 safe 下不发布
`message`；`agent_end` 只发布由完整 history 重建的 `conversation-snapshot`。失败
toolResult 不触发抑制。

- [ ] **Step 2: 增加结构化 Conversation Item**

共享类型增加：

```ts
export type LessonReadyNotice = {
  lessonId: string;
  lessonPath: string;
  blockCount: number;
  blockKinds: ActivityKind[];
};

export type ConversationItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'lesson-ready'; lesson: LessonReadyNotice }
  | { kind: 'memory-review'; review: MemoryReviewSnapshot };
```

Notice 不包含 Lesson title、题卡、题面、方法、路线、选择理由或 Teacher Control。

- [ ] **Step 3: 让成功 receipt 携带可安全展示的活动种类**

`lesson_prepare` 已在写入后重新读取 Lesson；在同一位置把活动 kind 去重写入 receipt：

```ts
const blockKinds = [...new Set(lesson.blocks.map((block) => block.kind))];
const value = {
  ok: true as const,
  ownerPath,
  factId: lesson.id,
  status: 'prepared' as const,
  lessonPath: lesson.path,
  blockCount: lesson.blocks.length,
  blockKinds,
};
```

这些值只能是现有 `ActivityKind`，不包含 Block title、Student View、Uses 或 Teacher
Control。在 `study-tools.test.ts` 断言 receipt 的 `blockKinds` 与重新读取的 Lesson
一致。

- [ ] **Step 4: 在持久历史投影中识别成功 receipt**

`conversation-projector.ts` 新增严格 type guard，只接受：

```ts
message.role === 'toolResult'
&& message.toolName === 'lesson_prepare'
&& message.isError === false
&& message.details?.kind === 'lesson-prepare'
&& message.details.value?.ok === true
&& Array.isArray(message.details.value?.blockKinds)
&& message.details.value.blockKinds.every((kind) => (
  ['dialogue', 'problem', 'material', 'reflection'].includes(kind)
))
```

在 `safe` 模式下排队 `LessonReadyNotice`，并用它替换该成功结果后的第一条纯 Coach
final；若 turn 没有 final，遍历结束时仍输出就绪卡。`raw-stream` 完全走原消息投影。
一次成功 prepare 只产生一张卡，刷新从 JSONL receipt 重建，不依赖浏览器状态。

- [ ] **Step 5: 阻止 live safe 投影短暂显示自由 final**

`server/app.ts` 的每个已绑定 Session 维护 turn-local `preparedInCurrentTurn`：

- `tool_execution_end` 成功且 toolName 为 `lesson_prepare` 时置为 true；
- true 时跳过该 Session 下一条 assistant `message_end` 的 safe message 投影；
- `agent_end` 后清除并发布完整 conversation snapshot；
- raw-stream 不抑制；
- 工具失败、其他工具和后续新 turn 不受影响。

把状态判断提取为可单测的小函数，不改 Pi JSONL，不改现有 work-status。

- [ ] **Step 6: 渲染就绪卡并隐藏 prepared 标题**

`LessonReadyCard` 只显示：

- “这一节已经准备好”；
- “共 N 个课堂环节”，并把 receipt 中的 kind 映射为“讨论 / 尝试 / 材料 / 小结”；
- “具体题目会由课堂导师逐步展开”；
- “开始上课”与“返回讨论”。

组件只接收 notice 与两个回调：

```ts
type LessonReadyCardProps = {
  value: LessonReadyNotice;
  status: LessonStatus | null;
  onPrimary(lessonId: string): void;
  onDiscuss(): void;
};
```

App 用 `notice.lessonId` 在当前 workspace 查找 prepared Lesson，再调用现有
`startLesson(lesson)`；若刷新时 Lesson 已 active/paused/closed，则 primary action
分别变成“继续课堂”或“查看记录”，不能再次启动。`onDiscuss` 选择当前
`workspace.coach.sessionKey`。组件不接收或读取 Lesson title。`SessionTree` 与
prepared gate 对 `status: prepared` 使用“待开始课程 / N 个环节”，不显示真实 Lesson
title；Lesson 进入 `active` 后恢复真实 title。不得增加 `handoffMode`。

- [ ] **Step 7: 运行投影、server、组件和构建测试**

```bash
cd apps/pi-teaching-web
bun test tests/projection/conversation-projector.test.ts \
  tests/projection/projector.test.ts \
  tests/runtime/study-tools.test.ts \
  tests/server/workspace-api.test.ts \
  tests/client/lesson-ready-card.test.tsx \
  tests/client/session-tree.test.tsx
bun run typecheck
bun run build
```

Expected: safe 永不包含故意注入的题名/方法，raw-stream 仍包含；刷新重建同一就绪卡；
prepared 导航不暴露 title。

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  apps/pi-teaching-web/src/projection/conversation-projector.ts \
  apps/pi-teaching-web/src/projection/projector.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/components/LessonReadyCard.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/components/SessionTree.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/projection/conversation-projector.test.ts \
  apps/pi-teaching-web/tests/projection/projector.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/client/lesson-ready-card.test.tsx \
  apps/pi-teaching-web/tests/client/session-tree.test.tsx
git commit -m "feat: project a spoiler-safe lesson handoff"
```

---

## Task 5: 建立规范画像解析和双文件原子应用

**Files:**

- Create: `apps/pi-teaching-web/src/memory-review/profile-document.ts`
- Create: `apps/pi-teaching-web/src/memory-review/apply-tool.ts`
- Modify: `apps/pi-teaching-web/src/memory-review/contracts.ts`
- Modify: `apps/pi-teaching-web/src/memory-review/source-validation.ts`
- Modify: `apps/pi-teaching-web/src/memory-review/store.ts`
- Create: `apps/pi-teaching-web/tests/memory-review/profile-document.test.ts`
- Create: `apps/pi-teaching-web/tests/memory-review/apply-tool.test.ts`
- Modify: `apps/pi-teaching-web/tests/memory-review/source-validation.test.ts`
- Modify: `apps/pi-teaching-web/tests/memory-review/store.test.ts`

- [ ] **Step 1: 写规范画像 parser/renderer 的失败测试**

目标条目：

```ts
const entry = {
  id: 'S1',
  content: '独立尝试后再获得方向性提示',
  scope: '当前 Roadmap',
  sources: ['lessons/lesson-003.md#trace-event-002'],
  rationale: '多节课中这种节奏能保留自己的路线判断',
  counterEvidence: '暂无',
};
```

验证：

- `## Active Preferences` 下的 S1/T1 可严格往返；
- 空 Active Preferences 合法；
- 学生文件出现 T1、字段缺失、重复 ID、非纯路径 source 时拒绝；
- 旧自由 bullet 明确抛出 `MEMORY_PROFILE_FORMAT_INVALID`，不迁移、不猜测。

- [ ] **Step 2: 实现规范画像文档**

`profile-document.ts` 导出：

```ts
export type ProfileOwner = 'student' | 'teaching';
export type ProfileEntry = {
  id: string;
  content: string;
  scope: string;
  sources: string[];
  rationale: string;
  counterEvidence: string;
};

export function parseProfileDocument(
  source: string,
  owner: ProfileOwner,
): ProfileEntry[];

export function renderProfileDocument(
  source: string,
  owner: ProfileOwner,
  entries: ProfileEntry[],
): string;
```

保留 `## Active Preferences` 之外的现有文档内容，只规范替换该 section。运行时按现有
最大编号分配下一个 S/T ID；model 和 UI 不传 profile ID。

- [ ] **Step 3: 扩展 review receipt 和状态**

契约增加：

```ts
export type MemoryReviewApplyReceipt = {
  reviewId: string;
  appliedItems: string[];
  unchangedItems: string[];
  profilePaths: {
    student: 'memory/student-profile.md';
    teaching: 'memory/teaching-profile.md';
  };
};

type MemoryReviewSnapshotBase = {
  id: string;
  planId: string;
  items: MemoryReviewItem[];
  decisions: MemoryReviewDecision[];
};

export type MemoryReviewSnapshot =
  | (MemoryReviewSnapshotBase & { status: 'proposed' | 'submitted' })
  | (MemoryReviewSnapshotBase & {
      status: 'applied';
      receipt: MemoryReviewApplyReceipt;
    });
```

只有 applied 分支携带 receipt，proposal/submission 不制造空回执；store 保留
append-only 快照。更新 store 测试，latest 返回带 receipt 的 applied 快照。

- [ ] **Step 4: 写 apply 语义和原子回滚的失败测试**

覆盖：

- accept add 分配 S1/T1；
- accept revise/delete 要求 exact `currentText`；
- rewrite add/revise 使用学生文本；
- rewrite delete 表示保留该 ID 并将 Content 改为学生文本；
- reject 进入 `unchangedItems`；
- 同 `reviewId` 第二次调用返回同 receipt 且文件字节不变；
- 只允许同 Session 最新 submitted review 和 owner-bound Plan；
- 第二个目标文件 rename 注入失败时，两份原文件都恢复。

文件操作注入接口固定为：

```ts
export type ProfileFileOps = {
  read(path: string): string;
  write(path: string, source: string): void;
  rename(from: string, to: string): void;
  remove(path: string): void;
  exists(path: string): boolean;
};
```

- [ ] **Step 5: 实现 `memory_review_apply` domain 与工具**

`createMemoryReviewApplyTool(root, planId, ownerPath, store, fileOps?)`：

1. 读取 store latest，要求 id 匹配且 status 为 submitted；若 already applied 则返回
   retained receipt；
2. 重新读取并验证 owner-bound Plan；
3. 解析 `memory/student-profile.md` 与 `memory/teaching-profile.md`；
4. 应用 UI 已提交 decisions，运行时分配稳定 ID；
5. 在内存生成并重新 parse 两份目标文本；
6. 写两个同目录 temp，再把原文件 rename 到 backup，依次安装两个 temp；
7. 任何已处理失败恢复两份原文件并清理 temp/backup；
8. 成功后保存 status applied 与 receipt。

工具返回：

```ts
{
  ok: true,
  reviewId: receipt.reviewId,
  appliedItems: receipt.appliedItems,
  unchangedItems: receipt.unchangedItems,
  profilePaths: receipt.profilePaths,
}
```

不增加崩溃 journal、数据库或旧格式迁移。

- [ ] **Step 6: 让 proposal 来源校验使用规范 Content**

`source-validation.ts` 不再用 `source.includes(currentText)`。对 revise/delete：

```ts
const entries = parseProfileDocument(profileSource, item.owner);
const current = entries.find((entry) => entry.content === item.currentText);
if (!current) throw new Error(`MEMORY_REVIEW_CURRENT_TEXT_MISMATCH: ${item.id}`);
```

对 add，若已有完全相同 Content 则拒绝。所有 `sources` 必须是能由
`source_resolve` 解析的纯路径/fragment；含括号说明或前后解释的值拒绝。

- [ ] **Step 7: 运行画像 domain 测试**

```bash
cd apps/pi-teaching-web
bun test tests/memory-review/profile-document.test.ts \
  tests/memory-review/apply-tool.test.ts \
  tests/memory-review/source-validation.test.ts \
  tests/memory-review/store.test.ts
bun run typecheck
```

Expected: 规范格式、操作语义、幂等和第二文件失败回滚全部通过。

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/src/memory-review/profile-document.ts \
  apps/pi-teaching-web/src/memory-review/apply-tool.ts \
  apps/pi-teaching-web/src/memory-review/contracts.ts \
  apps/pi-teaching-web/src/memory-review/source-validation.ts \
  apps/pi-teaching-web/src/memory-review/store.ts \
  apps/pi-teaching-web/tests/memory-review/profile-document.test.ts \
  apps/pi-teaching-web/tests/memory-review/apply-tool.test.ts \
  apps/pi-teaching-web/tests/memory-review/source-validation.test.ts \
  apps/pi-teaching-web/tests/memory-review/store.test.ts
git commit -m "feat: atomically apply confirmed learning profiles"
```

---

## Task 6: 将画像应用接入 Plan Coach 与学生界面

**Files:**

- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation-projector.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/components/MemoryReviewCard.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/MemoryReviewPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/projection/conversation-projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/memory-review-card.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/memory-review-panel.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`

- [ ] **Step 1: 写权限、唤醒和状态投影失败测试**

断言最终工具边界：

```ts
expect(scopeToolNames(planCoach)).toContain('memory_review_apply');
expect(scopeToolNames(planCoach)).not.toContain('write');
expect(scopeToolNames(planCoach)).not.toContain('edit');
expect(scopeToolNames(roadmapCoach)).toContain('write');
expect(scopeToolNames(roadmapCoach)).toContain('edit');
expect(scopeToolNames(tutor)).not.toContain('memory_review_apply');
```

提交 API 测试要求：

- HTTP 立即返回 `202` 与 `status: submitted`；
- hidden continuation 内容要求 `memory_review_apply({reviewId})`，不要求 generic edit；
- Agent 调用成功后 conversation snapshot 中同一 review 为 `applied`；
- 刷新后 latest 仍为 applied；
- 工具失败时仍为 submitted，UI 不伪装已应用。

- [ ] **Step 2: 注册 Plan Coach 内部 apply 工具并收紧写权限**

在 Plan Coach `ownerTools` 中加入：

```ts
createMemoryReviewApplyTool(
  root,
  ownerId,
  ownerPath,
  memoryReviewStore,
)
```

`scopeToolNames` 明确分三个分支：

- Roadmap Coach：保留 `write`、`edit`；
- Plan Coach：移除 `write`、`edit`，增加 `memory_review_apply`；
- Tutor：保持现状。

公共 Claude plugin MCP 数量不受影响。

- [ ] **Step 3: 把 decision continuation 改成单一工具动作**

`memoryReviewDecisionMessage` 的隐藏内容只传 reviewId、Plan ID、items、decisions，并写：

```text
Call memory_review_apply with this reviewId.
Do not edit either profile directly.
After a successful receipt, reread memory/student-profile.md and
memory/teaching-profile.md and report only that reread state.
```

`submitMemoryReview` 保存 submitted 后唤醒同一 Session；工具自行保存 applied。server
仍立即返回 submitted，后续 `agent_end` conversation snapshot 提供 applied 状态。

- [ ] **Step 4: 投影和渲染 applied 状态**

`conversation-projector` 已按同 review ID 取 latest，因此只需确保 applied snapshot
覆盖 proposed/submitted。UI：

- proposed：可打开逐项确认；
- submitted：显示“正在写入”且不可重复提交；
- applied：显示“已写入长期画像”，列出 applied/unchanged 数量；
- submitted 失败：保持“已确认，待写入”，允许通过同 Coach 对话重试，不假称成功。

MemoryReviewPanel 对 applied 只读，不能再次提交。

- [ ] **Step 5: 防止 HTTP submitted 覆盖更早到达的 applied 事件**

WebSocket 的 applied snapshot 可能先于 `POST .../submit` 的 202 响应到达。增加一个只按
同 review ID 合并的单调状态 helper：

```ts
const reviewRank = { proposed: 0, submitted: 1, applied: 2 } as const;

export function laterMemoryReview(
  current: MemoryReviewSnapshot,
  incoming: MemoryReviewSnapshot,
): MemoryReviewSnapshot {
  if (current.id !== incoming.id) return incoming;
  return reviewRank[incoming.status] >= reviewRank[current.status]
    ? incoming
    : current;
}
```

App 处理 202 时使用该 helper，不直接把卡片改回 submitted。测试模拟 applied
conversation snapshot 先到、submitted HTTP 后到，最终仍为 applied。该 helper 不合并
不同 review，也不承担持久化。

- [ ] **Step 6: 运行接线测试**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts \
  tests/projection/conversation-projector.test.ts \
  tests/server/workspace-api.test.ts \
  tests/client/memory-review-card.test.tsx \
  tests/client/memory-review-panel.test.tsx \
  tests/client/state.test.ts
bun run typecheck
bun run build
```

Expected: 权限、202→applied 异步状态、刷新和失败保真全部通过。

- [ ] **Step 7: 提交**

```bash
git add apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/projection/conversation-projector.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/components/MemoryReviewCard.tsx \
  apps/pi-teaching-web/src/client/components/MemoryReviewPanel.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/state.ts \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/projection/conversation-projector.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/client/memory-review-card.test.tsx \
  apps/pi-teaching-web/tests/client/memory-review-panel.test.tsx \
  apps/pi-teaching-web/tests/client/state.test.ts
git commit -m "feat: close the confirmed memory review loop"
```

---

## Task 7: 收口 Coach/Tutor 行为、Roadmap 首次同步与反证核对

**Files:**

- Modify: `apps/pi-teaching-web/resources/agents/coach.md`
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md`
- Modify: `apps/pi-teaching-web/resources/agents/roadmap-coach.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Modify: `plugins/highschool-study/agents/study-coach.md`
- Modify: `plugins/highschool-study/agents/lesson-designer.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md`
- Modify: `plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md`
- Modify: `plugins/highschool-study/skills/plan-next-cycle/SKILL.md`
- Modify: `plugins/highschool-study/learning-set-template/ROADMAP.md`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `plugins/highschool-study/tests/contract/package-and-template.test.ts`

- [ ] **Step 1: 先写可执行边界的失败测试**

不测试提示词原句。只测试：

1. Plan Coach 在 deep toggle 关闭时仍能看到 `deep_workflow_propose`；
2. Roadmap Coach/Tutor 在 deep toggle 关闭时仍看不到该工具；
3. toggle 打开时三个角色都按原逻辑获得工具；
4. Roadmap template 同时有非空 `## Goal`、`## Observable Capability Standard`、
   `## Test` 占位 section；
5. 公共 MCP 仍为四工具。

目标 helper：

```ts
deepModeToolNames(
  currentNames,
  enabled,
  { mandatoryQuickScout: isPlanCoachScope(scope) },
);
```

- [ ] **Step 2: 为 Plan 完成审计保留一次 Quick Scout**

修改 active-tool 过滤逻辑：

```ts
export function deepModeToolNames(
  current: string[],
  enabled: boolean,
  options: { mandatoryQuickScout: boolean },
): string[] {
  const names = current.filter((name) => name !== 'deep_workflow_propose');
  return enabled || options.mandatoryQuickScout
    ? [...names, 'deep_workflow_propose']
    : names;
}
```

这里只解决工具可达性。Plan Coach 根提示规定：deep off 时只允许为第一次 complete
审计提议现有 Quick Evidence Scout；其他可选工作流仍由 Skill 和 deep toggle 管理。
不新增工具、不自动替 Coach 做 complete 判决。

- [ ] **Step 3: 改写 Plan Coach 高显著规则**

Pi 根提示和 Claude plugin 对应语义共同加入，但不复制 Pi 工具签名：

- 每次 `lesson_prepare` 前先进行多轮问诊；
- 每轮只问一个会改变 Lesson 的关键问题，直到会改变本课的歧义已澄清，或学生明确
  停止提问并把判断权交给 Coach；
- 在私下备课前先总结本课意图，给学生一次修正或确认的机会；
- 学生确认需求后才私下找卡、比路线、写 Teacher Control；
- `lesson_prepare` 成功后不再生成课题、题面、方法或选卡理由摘要；
- 第一次 complete 前调用一次 50k token、180 秒、单任务 Quick Evidence Scout；
- Scout 输入包含拟定 conclusion、boundary、key/supporting 来源；
- Scout 只找冲突、遗漏、支持条件、旧表述和无法重读的写入，不给 verdict；
- 关键来源集合改变时最多再核对一次；
- Scout 失败/超时时缩小 boundary，并加入 open question；
- 所有写入后重新读取，学生结论只从重读状态生成；
- 默认不用表格、评分口吻和工具操作旁白。

现有 `deep-workflow/SKILL.md` 明确 50k/180s 的 Quick Scout 例外，原始结果仍私有，前端
只显示流程进度。

- [ ] **Step 4: 改写 Tutor 的自然教学循环**

Pi Tutor 根提示/Skill 与 Claude plugin `run-lesson` 共同表达：

```text
理解学生实际写出的数学内容
→ 找到一个最关键的障碍或机会
→ 给出一个与当前需要匹配的干预
→ 观察学生下一次反应
```

落到行为边界：

- 先复述或保留学生已经成立的数学部分；
- 一次只处理一个当前 blocker；
- 未请求完整解答时不倾倒标准路线；
- 一次提示只够推进当前一步；
- 方向性提示前先把学生 pre-help 内容写入 Trace；
- 最终 Trace 比较 pre-help、Tutor contribution、final route；
- 用过方向性提示即 `support: tutor`，不能因最终答案完整改回 none；
- 不泄露 Teacher Control、参考解、内部矩阵或“对标路线”；
- 真正另解与方法确认继续遵守现有工具契约；
- 学生确认结束后不再开始新教学或 Reflection。

不增加提示 UI 硬门，不切成每题一个 Session，不做隐式 compact。

- [ ] **Step 5: 固化 Roadmap 首次注册前的长期目标同步**

`ROADMAP.md` template 加入：

```markdown
## Test

（与学生确认后，填写用于判断 Roadmap 长期目标是否达成的综合任务。）
```

Roadmap Coach 根提示与两个 runtime 的相关 Skills 规定，在首次 `plan_register` 前：

1. 一次一问确认长期 Goal；
2. 确认可观测能力标准；
3. 确认 Roadmap Test；
4. 用 Roadmap Coach 保留的 edit/write 替换三处占位；
5. 注册学生确认的 Plan；
6. 重新读取 Roadmap 和 Plan 再汇报。

局部 Plan 目标不得覆盖 Roadmap 长期目标；之后只有学生长期目标真实变化才修改。

- [ ] **Step 6: 人工语义对照，不新增 prose 测试**

逐对检查：

- Pi `coach-study` ↔ plugin `prepare-next-lesson`；
- Pi `tutor-lesson` ↔ plugin `run-lesson`；
- Pi `roadmap-study` / `plan-next-cycle` ↔ plugin 对应 Skills；
- Pi memory apply 流程 ↔ plugin 的确认后写回语义。

检查目标是同一教学判断、不同工具表述；不得把 Pi-only `memory_review_apply` 或动态
workflow 签名复制到公共 plugin。

- [ ] **Step 7: 运行权限和模板测试**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
bun run typecheck

cd ../../plugins/highschool-study
bun test tests/contract/package-and-template.test.ts
bun run typecheck
```

Expected: Plan Coach 的 mandatory Quick Scout 可达，其他角色的 off 状态不变；
Roadmap template 三项齐全；无提示词精确文本测试。

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/resources/agents/coach.md \
  apps/pi-teaching-web/resources/agents/tutor.md \
  apps/pi-teaching-web/resources/agents/roadmap-coach.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  plugins/highschool-study/agents/study-coach.md \
  plugins/highschool-study/agents/lesson-designer.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/run-lesson/SKILL.md \
  plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md \
  plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md \
  plugins/highschool-study/skills/plan-next-cycle/SKILL.md \
  plugins/highschool-study/learning-set-template/ROADMAP.md \
  plugins/highschool-study/tests/contract/package-and-template.test.ts
git commit -m "feat: tighten student-safe teaching contracts"
```

---

## Task 8: 跨层回归、当前文档与完整确定性验收

**Files:**

- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 扩展 E2E fixture**

fixture 增加：

- 一个完成 Plan 的合法结构化 Learning Review；
- key/supporting 各一条可打开的 active Trace；
- 一个 prepared Lesson，真实 title 带明显题目关键词，用来证明界面隐藏；
- 一个 applied Memory Review receipt；
- safe history 中成功 `lesson_prepare` 后带泄露内容的自由 final。

fixture 仍只写临时目录，不改公开导数学习集。

- [ ] **Step 2: 写跨层 Playwright 场景**

在 `workspace.spec.ts` 增加一个连续场景：

1. 打开 Plan Coach，看到就绪卡而不是泄露 final；
2. sidebar 和 gate 在 prepared 状态不显示真实 title；
3. 刷新后仍是同一就绪卡；
4. 开始 Lesson 后真实 title 才可见；
5. 返回完成 Plan，默认看到 conclusion/boundary/nextStep；
6. 展开详情，三个学生语言层级可见；
7. 点击来源打开现有 Evidence Lens；
8. 点击异议只预填 composer，网络请求计数保持不变；
9. applied 画像卡显示“已写入长期画像”；
10. raw-stream fixture 的原始泄露文本仍可由诊断投影读到。

- [ ] **Step 3: 更新当前契约文档**

`AGENTS.md` 只更新已变化的事实：

- `complete` 使用 `learningReview`，active/replan 使用 `planSummary`；
- Plan Coach 无 generic write/edit，新增 Pi-only `memory_review_apply`；
- confirmed profiles 的规范条目与原子双写；
- Plan completion 的 mandatory Quick Scout 例外；
- safe lesson-ready 投影和 prepared title 隐藏；
- Roadmap 首次 Plan 前同步 Goal/Capability/Test。

`apps/pi-teaching-web/README.md` 与 `docs/zh-CN/完整说明书.md` 说明学生操作：

- 备课后如何进入无剧透课程；
- 如何查看回顾来源并预填异议；
- 长期记忆从 proposed→submitted→applied 的真实状态；
- deep toggle 关闭时为何 Plan 完成仍会出现一次反证核对流程；
- raw-stream 仅供本地诊断。

历史 spec/audit 不回写成当前功能说明。

- [ ] **Step 4: 运行 Pi 全量确定性验证**

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
```

Expected: typecheck、全部非 E2E 测试、生产 build 和 Playwright 全部通过。

- [ ] **Step 5: 运行 plugin 发布验证**

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

Expected: 单文件 MCP build、TypeScript、全部测试、strict plugin validation 通过；公共
MCP 工具仍为四个。

- [ ] **Step 6: 检查源学习集与 diff**

```bash
git diff --exit-code -- examples/derivative-demo/learning-set
git diff --check
git status --short
```

Expected: 导数学习集零修改；无空白错误；status 只包含本任务文档/E2E 改动及开始前
已经存在的无关未跟踪文件。

- [ ] **Step 7: 提交**

```bash
git add apps/pi-teaching-web/tests/e2e/fixture-server.ts \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts \
  apps/pi-teaching-web/README.md \
  docs/zh-CN/完整说明书.md \
  AGENTS.md
git commit -m "docs: document student-safe teaching reliability"
```

---

## Task 9: 运行六节真课与跨周期收口验收

**Files:**

- Create: `docs/audits/2026-07-29-student-safe-teaching-reliability-acceptance.md`

- [ ] **Step 1: 使用真实验收 Skill 并冻结运行条件**

执行者必须先读取并使用 `studyclaw-e2e-validation` Skill。记录：

```bash
git rev-parse HEAD
(
  cd examples/derivative-demo/learning-set
  find cards graph -type f -print | LC_ALL=C sort | while IFS= read -r file; do
    shasum -a 256 "$file"
  done | shasum -a 256
)
```

从本次新 Session JSONL 记录 provider、model、thinking；报告不写凭据。确定性测试通过
后冻结代码、提示词和资产，真课途中不修补。

- [ ] **Step 2: 建立全新隔离学习集**

```bash
RUN_ROOT="$(mktemp -d /tmp/studyforge-student-safe-acceptance-XXXXXX)"
mkdir -p "$RUN_ROOT/learning-set"
rsync -a plugins/highschool-study/learning-set-template/ "$RUN_ROOT/learning-set/"
rsync -a examples/derivative-demo/learning-set/cards/ "$RUN_ROOT/learning-set/cards/"
rsync -a examples/derivative-demo/learning-set/graph/ "$RUN_ROOT/learning-set/graph/"
rsync -a examples/derivative-demo/learning-set/materials/ "$RUN_ROOT/learning-set/materials/"
```

确认副本 Roadmap 只有模板占位，`plans/` 与 `lessons/` 没有历史课程，题卡/图谱资产
hash 与冻结值一致。

- [ ] **Step 3: 启动 clean runtime**

```bash
cd apps/pi-teaching-web
STUDY_LEARNING_SET="$RUN_ROOT/learning-set" \
  bun run src/server/index.ts --port 0
```

终端会打印实际随机端口；浏览器只连接该副本。不得复用旧
Roadmap/Plan/Tutor Session。

- [ ] **Step 4: 以普通高中生完成完整周期**

顺序必须是：

1. Roadmap Coach 逐步问诊并与学生确认 Goal、Observable Capability Standard、Test；
2. Roadmap 三项写回并重读后注册一个 Plan；
3. Plan Coach 完成六次课前一次一问、私下备课和无剧透就绪交接；
4. 六个独立 Tutor Session 完成六节真实 Lesson；
5. 第一次 complete 前运行一次 Quick Evidence Scout 反证核对；
6. 写入结构化 Learning Review；
7. 学生展开来源、提出至少一次自然异议或补充；
8. Coach 提议长期画像，学生逐项确认，`memory_review_apply` 原子落盘；
9. 返回原 Roadmap Coach，进行下一阶段问诊和建议；
10. 不实际开始第二个 Plan。

模拟学生只看学生界面，自然出现若干不完整回答、普通错误、疲劳、提示请求/拒绝、自我
纠正或替代路线；未自然出现的现象记为未覆盖，不为测试清单表演。

- [ ] **Step 5: 独立做运行后审计**

模拟学生不主动指出系统缺陷。课程结束后，验收者分别对照：

- 学生可见 safe 对话；
- raw Pi Session JSONL；
- Roadmap、Plan、六个 Lesson；
- active/superseded Trace；
- 两份 canonical profile；
- Dynamic Workflow 原始 Evidence Scout 结果。

逐项审计八个维度：问诊触发、揭示边界、教学适配、Trace 真实性、学习回顾、画像落盘、
Session/路由恢复、学生观感。特别检查：

- 学生界面无题面/方法提前泄露，但 raw 数据完整；
- Tutor 每次只做一个主要教学动作；
- pre-help 与 Tutor contribution 能解释最终 support；
- key 来源均为 assessment + correct + none；
- boundary 写明任务类型、支持条件、样本范围和未测迁移/保持；
- Scout 反证被 Coach 吸收，没有第二裁决结论；
- profile 只写 `memory/student-profile.md` 与 `memory/teaching-profile.md`；
- Coach 所有“已写入”说法都能从重读文件证实。

- [ ] **Step 6: 写验收报告**

报告固定分四类：

- 已修复并验证；
- 运行时拦截后恢复；
- 本周期未覆盖；
- 仍需处理。

同时记录六节课的自然轨迹、关键来源、提示依赖、Scout 发现、学生异议、画像 receipt、
路由恢复结果。前端发送失败若未复现，只写“未复现”，不得推测已经修复。

- [ ] **Step 7: 最终安全检查与提交报告**

```bash
git diff --exit-code -- examples/derivative-demo/learning-set
if rg -n "sk-[A-Za-z0-9_-]+|api[_-]?key|authorization:" \
  docs/audits/2026-07-29-student-safe-teaching-reliability-acceptance.md; then
  exit 1
fi
git diff --check
```

Expected: 源学习集零修改；凭据扫描零结果；Markdown 无空白错误。

```bash
git add docs/audits/2026-07-29-student-safe-teaching-reliability-acceptance.md
git commit -m "docs: record student-safe teaching acceptance"
```

---

## Final Verification

- [ ] `apps/pi-teaching-web`: `bun run check` 通过。
- [ ] `apps/pi-teaching-web`: `bun run test:e2e` 通过。
- [ ] `plugins/highschool-study`: `bun run release:check` 通过。
- [ ] `git diff --exit-code -- examples/derivative-demo/learning-set` 通过。
- [ ] 公共 MCP 工具仍为四个，Pi-only 新工具没有进入 plugin。
- [ ] safe 视图不泄露备课 final，raw-stream 与 Pi JSONL 保留原始内容。
- [ ] complete Plan 只能写 `learningReview`，active/replan 只能写 `planSummary`。
- [ ] confirmed profiles 只在 canonical `memory/` 路径，以规范 S/T 条目双文件原子更新。
- [ ] 真课报告区分已验证、恢复、未覆盖和仍需处理，不把模拟学生当系统审计员。
