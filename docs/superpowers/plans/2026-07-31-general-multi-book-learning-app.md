# 通用多书学习 App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在独立分支交付一个可直接导入多本书、先问诊再规划、按 Lesson 连续学习、记录真实学习活动并能从课堂 Block 回到原始资料的通用学习 App；它复用 StudyForge 已验证的 Pi 会话与前端体验，但不依赖题卡、方法图谱、BKT 或数学专用证据协议。

**Architecture:** 新 App 位于 `apps/general-learning-web/`，拥有独立的 Markdown-first 工作区、资料导入器、两级可重建索引、Roadmap/Plan/Lesson 节点、Pi Coach/Tutor Session、活动级 LearningTrace、三层 Handoff 和资料覆盖投影。前端复用 StudyForge 的聊天流、Markdown/KaTeX 渲染、事件流与留白视觉原则；课堂右侧增加 Source Reader，所有带真实 `SourceRef` 的 ConversationBlock 都可跳回章节 Markdown 或原页，Reader 也可反查实际使用该资料的 Lesson。

**Tech Stack:** Bun 1.3.14、TypeScript 7、React 19、Vite 8、Pi 0.81、TypeBox 1.3.6、Markdown/YAML、原生 CSS、Bun test、Playwright 1.61；文档转换和检索实现都位于可替换接口后。

**Design:** `docs/superpowers/specs/2026-07-31-general-learning-kernel-design.md`

## Global Constraints

- 本计划只在 `codex/general-multibook-app` 分支执行；不得在包含用户未提交修改的 `main` 工作区直接开发。
- 新 App 与 StudyForge App 是两个独立可启动产品。首轮可以复用实现模式和视觉资产，但不得从 `apps/pi-teaching-web/src/` 进行跨 App 源码导入。
- 持久事实只存在于原始资料、转换后的 Markdown、Course Markdown、LearningTrace、Handoff、经学生确认的画像和原始 Pi Session；索引、覆盖、续学入口和 UI 数据均可重建。
- 自动目录图和单书局部图只用于检索，不决定课程先修、教学顺序、掌握状态或能力结论。
- Coach 私下检索、备课查看和 Tutor 单纯展示资料都不写 LearningTrace；只有学生实际参与活动后才写。
- LearningTrace 的核心字段不解释数学正确性、提示依赖或方法节点；学科专用结果只能放在 `activityResult` 扩展对象中。
- 模型只能选择检索结果中真实存在的 `SourceRef`；不能手写路径、页码、书 ID、Session ID、节点路径、Trace ID 或时间戳。
- 首版不实现 KnowledgeAnchor、后台语义精加工、跨书实体自动合并、通用 mastery、自动复习调度、数据库、多用户或 StudyForge Extension。
- 文档转换允许报告低置信或部分失败，但不得伪造缺失内容。索引失败不得损坏 Markdown 和课程事实。
- 互动组件必须有 `fallbackMarkdown`；组件失败不阻断课堂，也不生成虚假参与记录。
- 使用 `frontend-skill` 的约束：App 是克制的学习工作台，不做卡片拼盘；桌面围绕课程、对话、资料阅读三块组织，窄屏退化为抽屉。
- Skill 与 Agent 文本不写逐句、关键词或快照测试；只测试 schema、权限、持久化、投影、会话连续性和真实交互。
- 每个任务先写失败测试、确认 RED、实现最小 GREEN、重构、运行定向验证，再提交。

## Branch And Worktree

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code
git worktree add \
  -b codex/general-multibook-app \
  .worktrees/general-multibook-app \
  main
cd .worktrees/general-multibook-app
```

实现记录写入 `.superpowers/sdd/progress.md`，但该目录保持忽略，不提交到产品分支。

## Dependency Order

```text
Task 1  App 骨架与公共契约
  ↓
Task 2  Markdown-first 多书资料库与 SourceRef
  ↓
Task 3  文档转换器与导入 API
  ↓
Task 4  两级索引与 KnowledgeProvider
  ↓
Task 5  Roadmap / Plan / Lesson 与三层 Handoff
  ↓
Task 6  LearningActivity / LearningTrace / Coverage
  ↓
Task 7  Pi Coach / Tutor Session 与受限工具
  ↓
Task 8  ConversationBlock 与安全事件投影
  ↓
Task 9  App Shell、课程聊天和侧栏 Source Reader
  ↓
Task 10 导入、资料库、课程和记忆页面
  ↓
Task 11 两个学科 fixture、E2E 与真实模型 Smoke
  ↓
Task 12 当前文档、启动脚本与发布检查
```

---

## Task 1: 建立独立 App 骨架与公共契约

**Files:**

- Create: `apps/general-learning-web/package.json`
- Create: `apps/general-learning-web/tsconfig.json`
- Create: `apps/general-learning-web/vite.config.ts`
- Create: `apps/general-learning-web/playwright.config.ts`
- Create: `apps/general-learning-web/index.html`
- Create: `apps/general-learning-web/src/client/main.tsx`
- Create: `apps/general-learning-web/src/client/App.tsx`
- Create: `apps/general-learning-web/src/server/index.ts`
- Create: `apps/general-learning-web/src/server/app.ts`
- Create: `apps/general-learning-web/src/shared/contracts.ts`
- Create: `apps/general-learning-web/tests/shared/contracts.test.ts`

**Public contracts:**

```ts
export type NodeStatus =
  | 'draft'
  | 'prepared'
  | 'active'
  | 'paused'
  | 'completed'
  | 'abandoned';

export type SessionRole = 'roadmap-coach' | 'plan-coach' | 'tutor';

export type SessionOwner = {
  schema: 'general-learning.session-owner.v1';
  role: SessionRole;
  ownerId: string;
  ownerPath: string;
};

export type SourceRef = {
  id: string;
  bookId: string;
  path: string;
  anchor: string;
  physicalPage: number | null;
  kind: 'section' | 'paragraph' | 'equation' | 'image' | 'table' | 'example' | 'media';
  sourceRevision: string;
};
```

- [ ] **Step 1: Write failing contract tests**

覆盖：

- 非法状态、角色和 `SourceRef.kind` 被拒绝；
- `SourceRef.id` 必须是 `book:<book-id>:span:<anchor>`；
- `path` 必须位于 `library/books/<book-id>/`；
- owner 的 `ownerPath` 与角色类型匹配；
- 模型输入类型不包含 runtime-owned ID、路径、Session 和时间字段。

运行：

```bash
cd apps/general-learning-web
bun test tests/shared/contracts.test.ts
```

Expected: App 和契约模块不存在，测试失败。

- [ ] **Step 2: Scaffold the smallest runnable app**

`package.json` 使用独立名称 `general-multibook-learning-web`，脚本至少包含：

```json
{
  "dev": "bun run --parallel dev:server dev:client",
  "dev:server": "bun --watch src/server/index.ts",
  "dev:client": "vite",
  "start": "bun run src/server/index.ts",
  "build": "vite build",
  "typecheck": "tsc --noEmit",
  "test": "bun test --path-ignore-patterns='tests/e2e/**'",
  "test:e2e": "playwright test",
  "check": "bun run typecheck && bun run test && bun run build"
}
```

依赖版本与 `apps/pi-teaching-web/package.json` 中 Pi、React、KaTeX、TypeBox、Vite 和
Playwright 保持一致；不跨目录 import StudyForge 源码。

- [ ] **Step 3: Implement strict runtime validators**

在 `shared/contracts.ts` 同时提供 TypeScript 类型和纯校验函数：

```ts
export function parseSourceRef(value: unknown): SourceRef;
export function parseSessionOwner(value: unknown): SessionOwner;
export function assertRelativeWorkspacePath(path: string): void;
```

路径校验只接受 POSIX 相对路径，拒绝绝对路径、`..`、空段和反斜杠。

- [ ] **Step 4: Verify and commit**

```bash
cd apps/general-learning-web
bun install
bun test tests/shared/contracts.test.ts
bun run typecheck
bun run build
git diff --check
git add apps/general-learning-web
git commit -m "feat: scaffold general multi-book learning app"
```

---

## Task 2: 建立 Markdown-first 多书资料库与稳定 SourceRef

**Files:**

- Create: `apps/general-learning-web/src/library/contracts.ts`
- Create: `apps/general-learning-web/src/library/source-ref.ts`
- Create: `apps/general-learning-web/src/library/book-store.ts`
- Create: `apps/general-learning-web/src/library/source-resolver.ts`
- Create: `apps/general-learning-web/tests/library/book-store.test.ts`
- Create: `apps/general-learning-web/tests/library/source-resolver.test.ts`
- Create: `apps/general-learning-web/tests/fixtures/workspace/library/books/chemistry-basics/BOOK.md`
- Create: `apps/general-learning-web/tests/fixtures/workspace/library/books/chemistry-basics/chapters/ch01.md`
- Create: `apps/general-learning-web/tests/fixtures/workspace/library/books/history-intro/BOOK.md`
- Create: `apps/general-learning-web/tests/fixtures/workspace/library/books/history-intro/chapters/ch01.md`

**Durable book manifest:**

```yaml
---
schema: general-learning.book.v1
book_id: chemistry-basics
title: 化学基础
source_revision: sha256:...
original_path: library/books/chemistry-basics/source/original.md
conversion_report: library/books/chemistry-basics/conversion-report.json
---

# 化学基础

## Chapters

- [第一章 物质与反应](chapters/ch01.md)
```

转换后的章节使用显式 HTML anchor：

```markdown
<a id="p0008-paragraph-03"></a>
催化剂能够改变反应速率，但不改变平衡常数。
```

- [ ] **Step 1: Write failing storage and resolution tests**

测试：

- 枚举多个合法 `BOOK.md`；
- 拒绝 book ID、manifest path 和目录不一致；
- 同一原始 revision 重导入保持 SourceRef 稳定；
- `resolveSourceRef` 返回书名、章节、片段、邻近文本、页码和质量提示；
- 不存在或跨书路径返回明确错误，不进行模糊猜测；
- 删除 `library/.index/` 后仍能从 `BOOK.md` 和章节读取来源。

- [ ] **Step 2: Implement the durable library reader**

提供：

```ts
export type BookManifest = {
  id: string;
  title: string;
  sourceRevision: string;
  originalPath: string;
  conversionReportPath: string;
  chapters: { title: string; path: string }[];
};

export function listBooks(root: string): BookManifest[];
export function readBook(root: string, bookId: string): BookManifest;
export function listSourceRefs(root: string, bookId: string): SourceRef[];
```

SourceRef 从导入器写入的 anchor sidecar
`library/books/<book-id>/source-map.json` 读取；运行时不重新猜 anchor。

- [ ] **Step 3: Implement source resolution**

```ts
export type ResolvedSource = {
  ref: SourceRef;
  bookTitle: string;
  chapterTitle: string;
  markdown: string;
  excerpt: string;
  neighborBefore: string | null;
  neighborAfter: string | null;
  pageImagePath: string | null;
  qualityWarnings: string[];
};

export function resolveSourceRef(root: string, id: string): ResolvedSource;
```

Reader 返回解析后的真实内容，不允许 caller 提供 path 或 page 覆盖。

- [ ] **Step 4: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/library/book-store.test.ts tests/library/source-resolver.test.ts
bun run typecheck
git diff --check
git add apps/general-learning-web/src/library apps/general-learning-web/tests/library \
  apps/general-learning-web/tests/fixtures/workspace/library
git commit -m "feat: add markdown-first multi-book library"
```

---

## Task 3: 实现可替换文档转换器与导入 API

**Files:**

- Create: `apps/general-learning-web/src/import/contracts.ts`
- Create: `apps/general-learning-web/src/import/document-converter.ts`
- Create: `apps/general-learning-web/src/import/markdown-converter.ts`
- Create: `apps/general-learning-web/src/import/docling-converter.ts`
- Create: `apps/general-learning-web/src/import/import-book.ts`
- Create: `apps/general-learning-web/src/import/source-map.ts`
- Modify: `apps/general-learning-web/src/server/app.ts`
- Create: `apps/general-learning-web/tests/import/markdown-converter.test.ts`
- Create: `apps/general-learning-web/tests/import/docling-converter.test.ts`
- Create: `apps/general-learning-web/tests/import/import-book.test.ts`
- Create: `apps/general-learning-web/tests/server/library-api.test.ts`

**Interfaces:**

```ts
export interface DocumentConverter {
  inspect(input: OriginalDocument): Promise<DocumentInspection>;
  convert(input: OriginalDocument): Promise<ConvertedBook>;
}

export type ConvertedSpan = {
  anchor: string;
  physicalPage: number | null;
  kind: SourceRef['kind'];
  markdown: string;
};

export type ConvertedChapter = {
  id: string;
  title: string;
  spans: ConvertedSpan[];
};
```

- [ ] **Step 1: Write failing converter tests**

覆盖：

- `.md` 导入按标题拆章节，并为段落、公式、图片和表格生成稳定 anchor；
- 重复导入相同 bytes 返回同一 `sourceRevision` 和 SourceRef；
- 书 ID 冲突但 revision 不同时需要显式 replace，不静默覆盖；
- Docling adapter 只消费结构化进程结果，命令失败时保留 staging 并返回错误；
- 部分页失败写入 `conversion-report.json`，成功章节仍可入库；
- import 在 rename 前完成所有校验，失败不留下半本书；
- `.pdf`、`.epub`、`.docx` 默认路由到 Docling adapter，`.md` 使用内置 converter。

- [ ] **Step 2: Implement the Markdown converter**

内置转换器用于已有 Markdown 和测试，不进行 LLM 改写。anchor 来自：

```text
chapter-id + physical-page-or-0000 + span-kind + within-chapter ordinal
```

内容变化导致 revision 改变，但同 revision 重建必须字节级稳定。

- [ ] **Step 3: Implement the Docling process adapter**

`DoclingDocumentConverter` 通过配置的命令调用外部 Docling，不把 Python 运行时嵌入
Node 进程：

```ts
export type ConverterProcess = (
  command: string[],
  input: { sourcePath: string; outputDir: string },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
```

生产默认命令从 `GENERAL_LEARNING_DOCLING_COMMAND` 读取；未配置时 API 明确返回
`DOCUMENT_CONVERTER_UNAVAILABLE`，不伪装为成功。测试注入 fake process。

- [ ] **Step 4: Implement atomic import**

流程：

```text
uploads/<uuid>
→ inspect
→ convert 到 .runtime/import-staging/<uuid>
→ 校验 BOOK.md / chapters / source-map / report
→ 原子 rename 到 library/books/<book-id>
→ 触发该书索引重建
```

用户原始文件复制到 `source/original.<ext>`，不以临时上传路径为事实。

- [ ] **Step 5: Add API**

```text
GET  /api/library/books
POST /api/library/import
GET  /api/library/books/:bookId
POST /api/library/books/:bookId/rebuild
GET  /api/sources/:encodedSourceRef
GET  /api/source-assets/*
```

上传 API 只接受支持的扩展名和显式 `bookId` / `title`；静态资源 resolver 限制在当前
workspace。

- [ ] **Step 6: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/import tests/server/library-api.test.ts
bun run typecheck
git diff --check
git add apps/general-learning-web/src/import apps/general-learning-web/src/server \
  apps/general-learning-web/tests/import apps/general-learning-web/tests/server/library-api.test.ts
git commit -m "feat: import source documents into traceable markdown"
```

---

## Task 4: 实现两级可重建索引与 KnowledgeProvider

**Files:**

- Create: `apps/general-learning-web/src/knowledge/contracts.ts`
- Create: `apps/general-learning-web/src/knowledge/catalog-index.ts`
- Create: `apps/general-learning-web/src/knowledge/book-index.ts`
- Create: `apps/general-learning-web/src/knowledge/filesystem-provider.ts`
- Create: `apps/general-learning-web/src/knowledge/rebuild.ts`
- Create: `apps/general-learning-web/tests/knowledge/catalog-index.test.ts`
- Create: `apps/general-learning-web/tests/knowledge/book-index.test.ts`
- Create: `apps/general-learning-web/tests/knowledge/filesystem-provider.test.ts`

**Provider contract:**

```ts
export interface KnowledgeProvider {
  catalogSearch(input: CatalogSearchInput): Promise<CatalogCandidate[]>;
  search(input: KnowledgeSearchInput): Promise<ContextPacket>;
  open(sourceRef: string): Promise<ResolvedSource>;
  rebuild(scope: RebuildScope): Promise<RebuildReceipt>;
}

export type KnowledgeSearchInput = {
  query: string;
  allowedBookIds: string[];
  limit: number;
};

export type ContextHit = {
  sourceRef: string;
  excerpt: string;
  reason: string;
  bookTitle: string;
  chapterTitle: string;
  physicalPage: number | null;
  relatedLabels: string[];
  qualityWarnings: string[];
};
```

- [ ] **Step 1: Write failing two-level retrieval tests**

断言：

- catalog 先从书名、章节名和导入标签路由到候选书；
- 每本书的局部索引只包含自己的 SourceRef；
- Roadmap `allowedBookIds` 是硬边界，查询词命中越界书也不能返回；
- 多书检索并行合并、去重并保留每条召回理由；
- 空结果返回空 hits，不编造答案；
- 删除 `.index` 后 `rebuild` 可从持久 Markdown 重建同等结果；
- 自动 related label 不被序列化为课程先修或 mastery 字段。

- [ ] **Step 2: Implement deterministic v1 indexes**

首版索引写入：

```text
library/.index/catalog/catalog.json
library/.index/books/<book-id>.json
```

目录层保存书、章节、标题词和导入标签；单书层保存 SourceRef、规范化 token、标题路径、
邻接章节和显式 Markdown 链接。使用小型确定性 BM25-like 评分，不新增向量数据库或
后台进程。

- [ ] **Step 3: Implement scoped search and open**

`FilesystemKnowledgeProvider.search` 必须先规范化并验证 `allowedBookIds`，再搜索对应
局部索引。返回的 SourceRef 最后通过 `resolveSourceRef` 再校验，索引中的过期条目不
直接成为内容。

- [ ] **Step 4: Add index invalidation**

导入、替换或删除书后只重建该书局部索引并更新 catalog；失败保留旧 index revision，
返回失败 receipt。课程事实不受影响。

- [ ] **Step 5: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/knowledge
bun run typecheck
git diff --check
git add apps/general-learning-web/src/knowledge apps/general-learning-web/tests/knowledge
git commit -m "feat: add scoped two-level knowledge retrieval"
```

---

## Task 5: 建立 Roadmap、Plan、Lesson 与三层 Handoff

**Files:**

- Create: `apps/general-learning-web/src/course/contracts.ts`
- Create: `apps/general-learning-web/src/course/markdown.ts`
- Create: `apps/general-learning-web/src/course/read-course.ts`
- Create: `apps/general-learning-web/src/course/write-course.ts`
- Create: `apps/general-learning-web/src/course/handoff.ts`
- Create: `apps/general-learning-web/src/course/session-owner.ts`
- Create: `apps/general-learning-web/tests/course/course-markdown.test.ts`
- Create: `apps/general-learning-web/tests/course/handoff.test.ts`
- Create: `apps/general-learning-web/tests/course/session-owner.test.ts`
- Create: `apps/general-learning-web/tests/fixtures/workspace/courses/chemistry-foundation/ROADMAP.md`
- Create: `apps/general-learning-web/tests/fixtures/workspace/courses/chemistry-foundation/plans/plan-001.md`
- Create: `apps/general-learning-web/tests/fixtures/workspace/courses/chemistry-foundation/lessons/lesson-001.md`

**Normative files:**

```text
courses/<course-id>/
├── ROADMAP.md
├── plans/
├── lessons/
├── traces/
└── handoffs/
```

Roadmap frontmatter owns `course_id`, `status`, `source_scope` and Coach Session。Plan owns
`plan_id`, `course_id`, `status` and Coach Session。Lesson owns `lesson_id`, `plan_id`,
`status` and Tutor Session。所有 ID 与路径由 runtime 分配。

- [ ] **Step 1: Write failing parse/render tests**

覆盖：

- Roadmap 必须有 Goal、Observable Capability Standard、Plan Tree 和 Roadmap Memory；
- Plan 必须有 Cycle Goal、Lesson Tree、Current Position 和 Plan Memory；
- Lesson 必须有 Lesson Goal、Activities、Source Bindings 和 Lesson Handoff；
- source scope 只引用真实 book ID；
- parent/child 文件关系必须一致；
- Session owner 缺失、重复或路径不一致时不复用 Session；
- render → parse 往返稳定，不读取旧 StudyForge 题卡或方法字段。

- [ ] **Step 2: Implement course readers and writers**

写入入口是窄函数，不暴露通用 Markdown edit：

```ts
export function createRoadmap(root: string, input: RoadmapDraft): RoadmapNode;
export function preparePlan(root: string, roadmapPath: string, input: PlanDraft): PlanNode;
export function prepareLesson(root: string, planPath: string, input: LessonDraft): LessonNode;
export function updatePlan(root: string, planPath: string, input: PlanDecision): PlanNode;
export function updateRoadmap(root: string, roadmapPath: string, input: RoadmapDecision): RoadmapNode;
```

prepared 子节点可由父节点重排；active 后由自己的 Session 拥有，父级只在子级 Handoff
返回后调整后续未激活节点。

- [ ] **Step 3: Implement three Handoff contracts**

共同外壳：

```ts
export type Handoff = {
  schema: 'general-learning.handoff.v1';
  level: 'lesson' | 'plan' | 'roadmap';
  ownerRef: string;
  summary: string;
  observations: string[];
  openQuestions: string[];
  nextAttention: string[];
  sourceRefs: string[];
};
```

Lesson source 可以指向 LearningTrace 和 Session；Plan 只能聚合本 Plan 的 Lesson
Handoff；Roadmap 只能聚合本 Roadmap 的 Plan Handoff。全局画像候选只能来自 Roadmap
Handoff，并逐项由学生确认。

- [ ] **Step 4: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/course
bun run typecheck
git diff --check
git add apps/general-learning-web/src/course apps/general-learning-web/tests/course \
  apps/general-learning-web/tests/fixtures/workspace/courses
git commit -m "feat: add roadmap plan lesson and handoff domain"
```

---

## Task 6: 实现 LearningActivity、LearningTrace 与资料覆盖

**Files:**

- Create: `apps/general-learning-web/src/learning/contracts.ts`
- Create: `apps/general-learning-web/src/learning/trace-store.ts`
- Create: `apps/general-learning-web/src/learning/activity-state.ts`
- Create: `apps/general-learning-web/src/learning/coverage.ts`
- Create: `apps/general-learning-web/tests/learning/trace-store.test.ts`
- Create: `apps/general-learning-web/tests/learning/activity-state.test.ts`
- Create: `apps/general-learning-web/tests/learning/coverage.test.ts`

**Core contracts:**

```ts
export type LearningActivity = {
  id: string;
  title: string;
  presentation: 'conversation' | 'question' | 'reading' | 'media' | 'interactive';
  participationContract: string;
  sourceRefs: string[];
};

export type LearningTrace = {
  id: string;
  lessonRef: string;
  activityRef: string;
  sessionRef: string;
  occurredAt: string;
  participation: 'completed' | 'partial';
  sourceRefs: string[];
  observation: string;
  activityResult?: Record<string, unknown>;
};
```

- [ ] **Step 1: Write failing participation tests**

测试：

- `displayed`、`preloaded`、Coach retrieval 不满足写 Trace 条件；
- student response、discussion contribution、reader acknowledgement with requested
  response、interactive result 可以写；
- runtime 从当前 Tutor Session 和 Lesson 推导 lesson/activity/session/time/ID；
- 输入 SourceRef 必须来自当前 Activity 绑定或当前 Tutor 检索 receipt；
- 明确更正直接替换同一 Lesson trace 文件并更新 Lesson Handoff，保留 `corrected_at`
  作为普通审计元数据，不创建 supersede 链；
- activityResult 任意扩展，但不能覆盖公共字段。

- [ ] **Step 2: Implement trace persistence**

每条 Trace 使用：

```text
courses/<course-id>/traces/<lesson-id>/<trace-id>.md
```

frontmatter 保存公共机器字段，正文只保存 `## Observation` 和可选
`## Activity Result` JSON fenced block。`writeLearningTrace` 只接受 runtime-bound
context 与模型提供的 observation/result。

- [ ] **Step 3: Implement rebuildable coverage**

```ts
export type SourceCoverage = {
  sourceRef: string;
  encounters: {
    lessonId: string;
    planId: string;
    courseId: string;
    activityId: string;
    traceId: string;
    occurredAt: string;
    participation: 'completed' | 'partial';
  }[];
};

export function buildCoverage(root: string): CoverageProjection;
export function lessonsForSource(root: string, sourceRef: string): SourceCoverage;
export function sourcesForLesson(root: string, lessonId: string): SourceCoverage[];
```

页面覆盖只按真实 span 聚合；同页一个 span 命中不把整页标记完成；投影永远不用
`mastery`、`ability` 或百分比命名。

- [ ] **Step 4: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/learning
bun run typecheck
git diff --check
git add apps/general-learning-web/src/learning apps/general-learning-web/tests/learning
git commit -m "feat: record activity traces and source coverage"
```

---

## Task 7: 接入 Pi Coach/Tutor Session 与节点受限工具

**Files:**

- Create: `apps/general-learning-web/src/runtime/session-scope.ts`
- Create: `apps/general-learning-web/src/runtime/session-factory.ts`
- Create: `apps/general-learning-web/src/runtime/workspace-registry.ts`
- Create: `apps/general-learning-web/src/runtime/resource-loader.ts`
- Create: `apps/general-learning-web/src/runtime/tools/knowledge-search.ts`
- Create: `apps/general-learning-web/src/runtime/tools/source-open.ts`
- Create: `apps/general-learning-web/src/runtime/tools/roadmap-update.ts`
- Create: `apps/general-learning-web/src/runtime/tools/plan-prepare.ts`
- Create: `apps/general-learning-web/src/runtime/tools/lesson-prepare.ts`
- Create: `apps/general-learning-web/src/runtime/tools/plan-update.ts`
- Create: `apps/general-learning-web/src/runtime/tools/activity-update.ts`
- Create: `apps/general-learning-web/src/runtime/tools/learning-trace-write.ts`
- Create: `apps/general-learning-web/src/runtime/tools/lesson-close.ts`
- Create: `apps/general-learning-web/resources/agents/roadmap-coach.md`
- Create: `apps/general-learning-web/resources/agents/plan-coach.md`
- Create: `apps/general-learning-web/resources/agents/tutor.md`
- Create: `apps/general-learning-web/resources/skills/roadmap-study/SKILL.md`
- Create: `apps/general-learning-web/resources/skills/coach-study/SKILL.md`
- Create: `apps/general-learning-web/resources/skills/tutor-lesson/SKILL.md`
- Create: `apps/general-learning-web/tests/runtime/session-factory.test.ts`
- Create: `apps/general-learning-web/tests/runtime/tool-permissions.test.ts`
- Create: `apps/general-learning-web/tests/runtime/study-tools.test.ts`

**Role tools:**

```text
Roadmap Coach:
  knowledge_search, source_open, roadmap_update, plan_prepare

Plan Coach:
  knowledge_search, source_open, lesson_prepare, plan_update,
  memory_review_propose

Tutor:
  knowledge_search, source_open, activity_update,
  learning_trace_write, lesson_close
```

- [ ] **Step 1: Write failing permission and owner-binding tests**

覆盖：

- 每个节点只有一个匹配 role/ownerId/ownerPath 的 Session；
- Roadmap、Plan、Lesson Session 历史互不复制；
- Tutor 不能修改 Plan/Roadmap，Coach 不能写课堂 Trace；
- tool input schema 不暴露 ownerPath、lessonPath、sessionId、traceId、occurredAt；
- knowledge search 自动使用 Roadmap source scope；
- Tutor 只能把当前检索 receipt 中的 SourceRef 绑定到当前 Activity；
- terminal node 对 Agent 工具只读；
- Lesson 结束后返回同一 Plan Coach Session，Plan 结束后返回同一 Roadmap Session。

- [ ] **Step 2: Implement the Pi session factory**

复用 `apps/pi-teaching-web/src/runtime/session-factory.ts` 的实现模式，不复制 StudyForge
工具。Session custom entry 使用 `general-learning.session-owner.v1`。资源加载器按角色
编译：

```text
node role prompt
+ current node Markdown
+ direct parent Handoff
+ required ancestor goal summary
+ confirmed global student profile
+ this-turn ContextPacket receipts
```

- [ ] **Step 3: Implement narrow tools**

工具返回最小 receipt：

```ts
type WriteReceipt = { ok: true; ownerPath: string };
type SearchReceipt = {
  ok: true;
  receiptId: string;
  hits: ContextHit[];
};
```

runtime 保存当前 Session 可使用的检索 receipt，模型后续只能引用其中的
`sourceRef`。错误 receipt 不能被 Agent 当作持久化成功。

- [ ] **Step 4: Write role prompts and skills**

只写稳定教学判断：

- Roadmap Coach 先一问一答地问诊目标、基础、时间和关键限制，再建立课程；
- Plan Coach 至少追问本课需要澄清的关键条件，结合前课 Handoff 临近备课；
- Tutor 自然教学，先听懂学生，再判断、介入、再观察；
- 结束 Lesson 的最终主动权交给学生；
- 不把检索、展示或“学生看见了”误写为真实参与；
- 任何结论保留来源与不确定边界。

不在 Skill 中复制工具字段、错误码或状态机。

- [ ] **Step 5: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/runtime
bun run typecheck
git diff --check
git add apps/general-learning-web/src/runtime apps/general-learning-web/resources \
  apps/general-learning-web/tests/runtime
git commit -m "feat: bind general learning sessions and tools"
```

---

## Task 8: 实现 ConversationBlock 与学生安全事件投影

**Files:**

- Create: `apps/general-learning-web/src/conversation/contracts.ts`
- Create: `apps/general-learning-web/src/conversation/block-registry.ts`
- Create: `apps/general-learning-web/src/conversation/projector.ts`
- Create: `apps/general-learning-web/src/conversation/source-links.ts`
- Modify: `apps/general-learning-web/src/server/app.ts`
- Create: `apps/general-learning-web/tests/conversation/block-registry.test.ts`
- Create: `apps/general-learning-web/tests/conversation/projector.test.ts`
- Create: `apps/general-learning-web/tests/conversation/source-links.test.ts`

**Block contract:**

```ts
type ConversationBlock =
  | TextBlock
  | MediaBlock
  | QuestionBlock
  | InteractiveBlock;

type ConversationBlockBase = {
  id: string;
  activityId: string | null;
  sourceRefs: string[];
  fallbackMarkdown?: string;
};
```

- [ ] **Step 1: Write failing projection tests**

覆盖：

- sourceRefs 必须来自已验证 SourceRef；
- Question/Interactive 只有产生学生响应后才可形成 Trace；
- Media 单纯播放或展示不自动形成 Trace；
- 未注册互动类型渲染 fallback Markdown；
- internal tool args、filesystem paths、Agent reasoning、原始 ContextPacket 和 hidden
  teaching note 不进入 safe projection；
- 每个可见来源链接包含 blockId、sourceRef 和 reader target；
- Block 的顺序可由 Tutor 调整，但历史消息不重写。

- [ ] **Step 2: Implement a small registered block set**

首版注册：

```text
text
image
video-link
single-question
multi-choice
comparison
timeline
```

不支持任意生成 HTML。`interactive` 未匹配注册表时展示 `fallbackMarkdown`。

- [ ] **Step 3: Project Pi events**

将模型文本、工具状态和 ConversationBlock 合成为稳定时间线。原始 Pi JSONL 保留；
safe projection 只投影学生需要的状态与内容。

- [ ] **Step 4: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/conversation
bun run typecheck
git diff --check
git add apps/general-learning-web/src/conversation apps/general-learning-web/src/server \
  apps/general-learning-web/tests/conversation
git commit -m "feat: project source-linked conversation blocks"
```

---

## Task 9: 完成 App Shell、课程聊天与侧栏 Markdown Source Reader

**Files:**

- Create: `apps/general-learning-web/src/client/api.ts`
- Create: `apps/general-learning-web/src/client/routes.ts`
- Create: `apps/general-learning-web/src/client/state.ts`
- Create: `apps/general-learning-web/src/client/components/AppShell.tsx`
- Create: `apps/general-learning-web/src/client/components/CourseRail.tsx`
- Create: `apps/general-learning-web/src/client/components/ChatPanel.tsx`
- Create: `apps/general-learning-web/src/client/components/ConversationBlockView.tsx`
- Create: `apps/general-learning-web/src/client/components/MarkdownView.tsx`
- Create: `apps/general-learning-web/src/client/components/SourceReader.tsx`
- Create: `apps/general-learning-web/src/client/components/SourceHistory.tsx`
- Create: `apps/general-learning-web/src/client/styles/base.css`
- Create: `apps/general-learning-web/src/client/styles/shell.css`
- Create: `apps/general-learning-web/src/client/styles/chat.css`
- Create: `apps/general-learning-web/src/client/styles/reader.css`
- Create: `apps/general-learning-web/tests/client/routes.test.ts`
- Create: `apps/general-learning-web/tests/client/source-reader.test.tsx`
- Create: `apps/general-learning-web/tests/client/conversation-block-view.test.tsx`

**Visual thesis:** 像一张摊开的学习桌：左侧是克制的课程书签，中间是自然连续的师生对话，右侧是可随时翻回原文的书页；浅纸色、墨色文字、单一朱砂强调，不用仪表盘卡片墙。

**Content plan:** 稳定 App Shell → 当前课程/Session → 对话主舞台 → 原文侧栏与来源历史。

**Interaction thesis:** Block 来源轻触展开 Reader；Reader 在同一页平滑定位 anchor；课程与资料切换使用短距离共享布局过渡，并尊重 reduced motion。

- [ ] **Step 1: Write failing route and reader tests**

规范路由：

```text
/library
/course/<courseId>
/course/<courseId>/plan/<planId>
/course/<courseId>/plan/<planId>/lesson/<lessonId>
```

Reader 状态是当前页面选择，不是学习事实：

```ts
type ReaderSelection = {
  sourceRef: string;
  originBlockId: string | null;
};
```

测试：

- Lesson 刷新恢复相同 Tutor Session 和公开节点；
- 点击 Block 来源在右栏打开真实章节并滚到 anchor；
- 同一 Block 多来源可切换；
- Reader 显示书名、章节、页码、质量提示和“在哪些 Lesson 学过”；
- Reader 的“回到课堂”定位原 Block；
- URL 不能通过手写 sourceRef 越过当前 Course source scope；
- 窄屏 Reader 为抽屉，关闭不影响 Lesson Session。

- [ ] **Step 2: Implement the persistent shell**

桌面：

```text
┌──────────────┬──────────────────────────────┬──────────────────────┐
│ Course Rail  │ Tutor / Coach conversation   │ Source Reader        │
│ Roadmap      │ ConversationBlocks           │ Markdown / page      │
│ Plans        │ Composer                     │ lesson backlinks     │
│ Lessons      │                              │                      │
└──────────────┴──────────────────────────────┴──────────────────────┘
```

中栏始终是主要工作面；Reader 未打开时折叠为窄书签，不保留空大面板。

- [ ] **Step 3: Implement source-to-reader and reader-to-lesson links**

Block 链接调用：

```text
GET /api/sources/:sourceRef
GET /api/coverage/source/:sourceRef
```

Source Reader 不直接读取任意文件。backlink 只展示真实 LearningTrace encounters，
点击后导航到对应 Lesson replay 并突出 activity/block。

- [ ] **Step 4: Reuse presentation patterns without source coupling**

可以移植 StudyForge 的 `MarkdownView`、ChatPanel 交互方式、KaTeX、SSE/WebSocket
连接状态和留白设计 token；复制后改为通用命名。不得引用 StudyForge Ability、Card、
Method、Evidence Lens 或数学专用样式。

- [ ] **Step 5: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/client
bun run typecheck
bun run build
git diff --check
git add apps/general-learning-web/src/client apps/general-learning-web/tests/client
git commit -m "feat: add course chat and traceable source reader"
```

---

## Task 10: 完成资料库、课程、记忆与覆盖页面

**Files:**

- Create: `apps/general-learning-web/src/client/pages/LibraryPage.tsx`
- Create: `apps/general-learning-web/src/client/pages/CoursePage.tsx`
- Create: `apps/general-learning-web/src/client/pages/LessonPage.tsx`
- Create: `apps/general-learning-web/src/client/pages/MemoryPage.tsx`
- Create: `apps/general-learning-web/src/client/components/BookShelf.tsx`
- Create: `apps/general-learning-web/src/client/components/BookImportDialog.tsx`
- Create: `apps/general-learning-web/src/client/components/LessonSkeleton.tsx`
- Create: `apps/general-learning-web/src/client/components/CoverageMap.tsx`
- Create: `apps/general-learning-web/src/client/components/HandoffLineage.tsx`
- Create: `apps/general-learning-web/src/client/styles/library.css`
- Create: `apps/general-learning-web/src/client/styles/course.css`
- Create: `apps/general-learning-web/src/client/styles/memory.css`
- Modify: `apps/general-learning-web/src/client/App.tsx`
- Modify: `apps/general-learning-web/src/server/app.ts`
- Create: `apps/general-learning-web/tests/client/library-page.test.tsx`
- Create: `apps/general-learning-web/tests/client/course-page.test.tsx`
- Create: `apps/general-learning-web/tests/client/memory-page.test.tsx`
- Create: `apps/general-learning-web/tests/server/course-api.test.ts`
- Create: `apps/general-learning-web/tests/server/coverage-api.test.ts`

- [ ] **Step 1: Write failing page and API tests**

覆盖：

- Library 显示导入状态、转换质量、章节和可重建索引状态；
- 导入完成不自动创建课程，而是进入 Roadmap Coach 问诊入口；
- Course 显示 Roadmap → Plan → Lesson 骨架和当前续学位置；
- prepared Lesson 开始后绑定独立 Tutor Session；
- Plan 与 Roadmap Handoff 可以逐层回到 Lesson、Trace、Session 和 SourceRef；
- 全局画像只显示学生已确认条目；
- Coverage 使用“已学习/曾接触/部分参与”等语言，不使用掌握度；
- 所有页面共享 App Shell，切页不重建正在运行的 Session。

- [ ] **Step 2: Implement the Library page**

BookShelf 用书脊/目录式布局，不做统计卡片墙。导入 Dialog 支持选择 Markdown、
PDF、EPUB、DOCX，明确显示 converter 可用性和转换警告。

- [ ] **Step 3: Implement Course and Lesson pages**

Course 页面把 Lesson skeleton 作为可调整路径展示；Lesson 页面使用 Task 9 三栏
工作区。学生可结束 Lesson、回到 Plan Coach、要求重排或改变方向。

- [ ] **Step 4: Implement Memory and Coverage**

Memory 按 Lesson Handoff → Plan Memory → Roadmap Memory → confirmed profile 分层。
Coverage 以书/章节/页/Source span 下钻，点击任意真实 encounter 回到 Lesson。

- [ ] **Step 5: Add responsive and accessibility behavior**

- `>= 1180px`：三栏；
- `760–1179px`：Course Rail 固定，Reader 抽屉；
- `< 760px`：单栏聊天，课程与 Reader 都是独立抽屉；
- 状态不只靠颜色；
- 所有来源、导航和抽屉可键盘操作；
- 触控目标至少 44px；
- `prefers-reduced-motion` 关闭位移和滚动动画。

- [ ] **Step 6: Verify and commit**

```bash
cd apps/general-learning-web
bun test tests/client tests/server/course-api.test.ts tests/server/coverage-api.test.ts
bun run check
git diff --check
git add apps/general-learning-web/src/client apps/general-learning-web/src/server \
  apps/general-learning-web/tests/client apps/general-learning-web/tests/server
git commit -m "feat: complete general learning workspace pages"
```

---

## Task 11: 建立双学科 Fixture、跨页 E2E 与真实模型 Smoke

**Files:**

- Create: `examples/general-learning-demo/README.md`
- Create: `examples/general-learning-demo/learning-workspace/library/books/chemistry-basics/**`
- Create: `examples/general-learning-demo/learning-workspace/library/books/history-intro/**`
- Create: `examples/general-learning-demo/learning-workspace/courses/chemistry-foundation/**`
- Create: `examples/general-learning-demo/learning-workspace/memory/student-profile.md`
- Create: `apps/general-learning-web/tests/e2e/fixture-server.ts`
- Create: `apps/general-learning-web/tests/e2e/library-and-reader.spec.ts`
- Create: `apps/general-learning-web/tests/e2e/course-continuity.spec.ts`
- Create: `apps/general-learning-web/tests/e2e/coverage-and-memory.spec.ts`
- Create: `docs/audits/2026-07-31-general-learning-app-acceptance.md`

- [ ] **Step 1: Build two non-card learning fixtures**

化学周期包含：

- 概念辨析；
- 方程式阅读；
- 实验现象预测；
- 至少一项有真实学生回应的活动。

历史周期包含：

- 原文阅读；
- 两份史料比较；
- 时间线互动；
- 至少一项部分参与活动。

两者都不包含题卡、方法图谱、BKT 或自动 mastery。

- [ ] **Step 2: Write E2E before final UI fixes**

浏览器流程：

```text
打开资料库
→ 导入/查看两本书
→ 进入 Roadmap Coach 问诊
→ 建立一个 Plan 与 Lesson skeleton
→ 开始 Lesson
→ 使用至少三种 ConversationBlock
→ 点击 Block 来源打开 Reader
→ 返回 Block
→ 学生参与后写 LearningTrace
→ 结束 Lesson 并回到同一 Plan Coach
→ 查看 Coverage 和 Handoff lineage
→ 刷新并恢复
```

E2E fixture 可使用确定性 fake session transport 验证 UI，但不能代替下一步真实模型
Smoke。

- [ ] **Step 3: Run automated verification**

```bash
cd apps/general-learning-web
bun run check
bun run test:e2e
```

- [ ] **Step 4: Run a real-model smoke**

使用当前已配置的 Pi provider；不得在报告或仓库记录密钥。至少完成：

1. Roadmap Coach 一次真实问诊；
2. Plan Coach 一次临近备课与真实来源检索；
3. Tutor 一次含阅读/辨析的短课；
4. 学生实际回应后写入一条 LearningTrace；
5. Lesson Handoff 回到原 Plan Coach；
6. Block → Source Reader → Lesson backlink 全链路。

记录 provider、model、commit、dirty state、workspace copy、Session ID、Trace 文件和
截图；不把原始私有 Session 提交。

- [ ] **Step 5: Write the acceptance report**

报告按层记录 PASS/FAIL/BLOCKED：

```text
conversion
library/source resolution
knowledge scope
course/session continuity
conversation blocks
trace/coverage
memory lineage
frontend reader
provider/model
```

只修 Smoke 真实暴露的问题，不依据想象增加防御系统。

- [ ] **Step 6: Commit**

```bash
git add examples/general-learning-demo \
  apps/general-learning-web/tests/e2e \
  docs/audits/2026-07-31-general-learning-app-acceptance.md
git commit -m "test: validate general multi-book learning loop"
```

---

## Task 12: 更新当前文档、启动脚本与发布检查

**Files:**

- Create: `apps/general-learning-web/README.md`
- Create: `docs/zh-CN/通用多书学习App说明书.md`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Document the two-App repository**

明确：

```text
apps/pi-teaching-web       StudyForge 高精度高中数学 App
apps/general-learning-web  通用多书学习 App
```

说明两者共享的架构思想和明确不共享的学科专用能力。

- [ ] **Step 2: Document local startup**

```bash
cd apps/general-learning-web
bun install --frozen-lockfile
GENERAL_LEARNING_HOME=/absolute/path/to/learning-workspace \
  bun run dev
```

说明 Docling 命令配置、Markdown 无外部 converter 导入、示范工作区、端口覆盖、数据
备份和索引重建。

- [ ] **Step 3: Update repository authority**

`AGENTS.md` 增加通用 App 的事实层级、目录、验证命令和安全边界；不得把本计划或历史
设计改成当前功能权威。

- [ ] **Step 4: Run static boundary checks**

```bash
rg -n 'problem_card|primary method|secondary method|BKT|mastery' \
  apps/general-learning-web/src \
  apps/general-learning-web/resources

rg -n 'apps/pi-teaching-web/src' apps/general-learning-web

rg -n 'api[_-]?key|sk-[A-Za-z0-9]' \
  apps/general-learning-web examples/general-learning-demo docs/zh-CN/通用多书学习App说明书.md
```

Expected:

- 通用 App runtime 没有 StudyForge 专用事实和能力语义；
- 没有跨 App 源码 import；
- 没有凭据。

- [ ] **Step 5: Run complete verification**

```bash
cd apps/general-learning-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
cd ../..
git diff --check
git status --short
```

- [ ] **Step 6: Commit**

```bash
git add apps/general-learning-web/README.md \
  docs/zh-CN/通用多书学习App说明书.md \
  README.md AGENTS.md
git commit -m "docs: publish general multi-book learning app"
```

---

## Final Acceptance Checklist

- [ ] 资料库可同时保存多本书，并能导入 Markdown、PDF、EPUB、DOCX；外部 converter 不可用时明确失败。
- [ ] 原书、Markdown、页图、SourceRef 和转换报告互相可追溯。
- [ ] 删除 `library/.index` 后可从持久资料重建两级索引。
- [ ] Roadmap source scope 是检索硬边界；Lesson 不自行扩大范围。
- [ ] 导入书籍后先进入 Coach 问诊，不自动生成一套课程。
- [ ] Roadmap、Plan、Lesson 拥有独立 Session，父子通过 Handoff 交接而不复制完整历史。
- [ ] Plan 先保存 Lesson skeleton，Lesson 在开始前结合最新 Handoff 和资料临近备课。
- [ ] Tutor 对话可混排文字、媒体、问题和注册互动块，失败时退化为 Markdown。
- [ ] Coach 私下检索、Tutor 单纯展示和预加载 Block 不写 LearningTrace。
- [ ] 学生真实参与后，Trace 能回到 Activity、Session、Lesson 和真实 SourceRef。
- [ ] 资料覆盖只表示真实接触，不冒充掌握度。
- [ ] Lesson、Plan、Roadmap 记忆逐层压缩，每层都可下钻来源。
- [ ] 全局画像只含学生逐项确认的稳定偏好。
- [ ] 课堂中任一带来源 Block 可一键打开右侧 Markdown Reader 并定位 anchor/页图。
- [ ] Reader 可反查该 SourceRef 在哪些 Lesson 中被真实学习，且能返回原 Block。
- [ ] 页面刷新恢复 Course/Plan/Lesson 与原 Pi Session，不复制或重建聊天。
- [ ] 化学与历史两个非题卡学习周期通过自动 E2E。
- [ ] 至少一轮真实 Pi Coach/Tutor Smoke 完成并有去敏验收报告。
- [ ] `bun run check`、`bun run test:e2e` 和 `git diff --check` 全部通过。
- [ ] 通用 App 不包含题卡、方法图谱、BKT、通用 mastery、KnowledgeAnchor 或后台语义 Worker。
