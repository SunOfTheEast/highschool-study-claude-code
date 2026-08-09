# M1b 最小学习集生长实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** 让只有 `LEARNING_GUIDE.md` 与空 `memory/INDEX.md` 的学习集也能完成“自由学习 → 保存 Note / 题卡 → 形成对象记忆 → 重新打开题卡作答并继续问老师”的单一 M1b 闭环。

**Architecture:** 在既有 Roadmap / Plan / Lesson 树旁增加根级 `free:<pi-session-id>` Session；原生 Pi JSONL 独占自由对话事实，custom entries 只保存绑定资产与显式结束状态。Note、题卡和作答是学习集内独立 canonical 文件；对象记忆沿用 M1a Markdown 网络，但新增一个以完整 Pi Session 为来源的窄写入，不引入 Light Lesson、Log、Trace、词表或图谱。

**Tech Stack:** Bun、TypeScript、React 19、Pi coding-agent SessionManager、YAML、Markdown、Playwright、Bun test。

---

## Task 1：定义空白学习集与 M1b 公共投影

**Files:**

- Create: `apps/pi-teaching-web/tests/fixtures/m1b-blank-learning-set/LEARNING_GUIDE.md`
- Create: `apps/pi-teaching-web/tests/fixtures/m1b-blank-learning-set/memory/INDEX.md`
- Create: `apps/pi-teaching-web/tests/m1b/learning-set-home.test.ts`
- Create: `apps/pi-teaching-web/src/study/learning-set-home.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/knowledge.ts`

### Step 1：写失败测试

覆盖：无 `ROADMAP.md` 时仍能读取 guide、空资产和 `hasCourse: false`；有 Roadmap 的旧 fixture 仍返回课程入口；缺少 `graph/`、`cards/`、`materials/` 不再让资产页失败。

### Step 2：确认 RED

Run: `bun test tests/m1b/learning-set-home.test.ts`

Expected: FAIL，因为首页投影与可选静态资产读取尚不存在。

### Step 3：最小实现

新增 `LearningSetHomeSnapshot`、自由学习摘要和资产摘要公共类型；首页读取只要求 guide，可选读取课程；让知识投影在没有旧 graph 时返回空数组，但继续严格解析实际存在的旧格式。

### Step 4：确认 GREEN

Run: `bun test tests/m1b/learning-set-home.test.ts tests/m0/knowledge-ui.test.tsx tests/m0/markdown-domain.test.ts`

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/learning-set-home.ts apps/pi-teaching-web/src/study/knowledge.ts apps/pi-teaching-web/tests/fixtures/m1b-blank-learning-set apps/pi-teaching-web/tests/m1b/learning-set-home.test.ts
git commit -m "feat: open blank learning sets"
```

## Task 2：建立根级自由学习 Session

**Files:**

- Create: `apps/pi-teaching-web/tests/m1b/free-learning-session.test.ts`
- Create: `apps/pi-teaching-web/resources/agents/free-learning.md`
- Create: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-owner.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`

### Step 1：写失败测试

覆盖：创建多个互不阻塞的 `free:<id>`；只把责任、选中资产和生命周期写入原生 Session custom entries；恢复后使用同一 JSONL；显式结束幂等且拒绝继续发送；离开页面、空闲和创建新线程都不结束旧线程；不产生任何 Lesson/Log/Trace/Summary 文件。

### Step 2：确认 RED

Run: `bun test tests/m1b/free-learning-session.test.ts`

### Step 3：最小实现

把 Session scope 扩展成课程节点与自由学习的判别联合。复用一个 `WorkspaceRegistry` 的排队、订阅与恢复能力，但自由学习 owner 通过 `SessionManager.list/open` 查找，不读取课程树。新增自由学习角色和根 Skill；静态上下文只装载 guide、教学核心、角色、`memory/INDEX.md` 与学生选中的资产投影。

### Step 4：确认 GREEN

Run: `bun test tests/m1b/free-learning-session.test.ts tests/m0/native-session.test.ts`

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/runtime apps/pi-teaching-web/resources/agents/free-learning.md apps/pi-teaching-web/resources/skills/free-learning/SKILL.md apps/pi-teaching-web/tests/m1b/free-learning-session.test.ts
git commit -m "feat: add native free learning sessions"
```

## Task 3：实现 Note、薄题卡与确认后的窄写入

**Files:**

- Create: `apps/pi-teaching-web/tests/m1b/learning-assets.test.ts`
- Create: `apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts`
- Create: `apps/pi-teaching-web/src/study/learning-assets.ts`
- Create: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/knowledge.ts`

### Step 1：写失败测试

覆盖：Note 支持 Markdown / recall 混合有序块；薄题卡与旧 `highschool-study.problem-card.v1` 共存；学生投影不泄漏 `teacherRationale`；选中资产以短别名注入 Tutor；`save_note` / `save_problem_card` 只有在最新学生消息明确批准时可写；Runtime 绑定 ID、路径、revision、时间与来源 Session；同一 toolCall 成功重放一次；stale revision 拒绝覆盖。

### Step 2：确认 RED

Run: `bun test tests/m1b/learning-assets.test.ts tests/m1b/free-learning-tools.test.ts`

### Step 3：最小实现

以 YAML 保存 canonical Note 与薄题卡；不新增 Flashcard 对象、标签或掌握字段。工具只接收语义正文和选中来源别名，机械确认从当前 Pi 分支核对；用现有多文档事务完成新建/修订和幂等回执。资产页直接保存 Note 或题内笔记时，以 expected revision 保护并发。

### Step 4：确认 GREEN

Run: `bun test tests/m1b/learning-assets.test.ts tests/m1b/free-learning-tools.test.ts tests/m0/card-recall-index.test.ts tests/m0/native-session.test.ts`

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/study/learning-assets.ts apps/pi-teaching-web/src/runtime/free-learning-tools.ts apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/src/runtime/resource-loader.ts apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/knowledge.ts apps/pi-teaching-web/tests/m1b/learning-assets.test.ts apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts
git commit -m "feat: save m1b learning assets"
```

## Task 4：实现只追加的题卡作答与答案门

**Files:**

- Create: `apps/pi-teaching-web/tests/m1b/problem-attempts.test.ts`
- Create: `apps/pi-teaching-web/src/study/problem-attempts.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`

### Step 1：写失败测试

覆盖：提交答案或“不会”先追加 attempt；之后查看答案再追加 reveal；旧 attempt 永不回写未来状态；事件绑定当时 revision；重复请求 ID 幂等；Runtime 不判断正误、掌握或偏好；读取能给“问老师”投影最近作答与 reveal 状态。

### Step 2：确认 RED

Run: `bun test tests/m1b/problem-attempts.test.ts`

### Step 3：最小实现

在 `activity/problem-attempts/<card-id>.md` 中按顺序追加 Markdown 事件。事件 ID 和时间由 Runtime 生成，更新使用原子 stale 检查；答案正文仍来自 canonical 题卡，activity 只记录事实。

### Step 4：确认 GREEN

Run: `bun test tests/m1b/problem-attempts.test.ts`

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/study/problem-attempts.ts apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/tests/m1b/problem-attempts.test.ts
git commit -m "feat: record problem attempts and reveals"
```

## Task 5：从原生 Session 直接更新对象记忆

**Files:**

- Create: `apps/pi-teaching-web/tests/m1b/free-learning-memory.test.ts`
- Modify: `apps/pi-teaching-web/src/study/memory-mutations.ts`
- Modify: `apps/pi-teaching-web/src/runtime/memory-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`
- Modify: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`

### Step 1：写失败测试

覆盖：自由学习中途即可写；Learning History 只追加来源 Session 与 Runtime 时间；不要求 Block、Log、Trace、消息 ID 或轮次；existing object 只修改工具明确提交的快照字段；新对象仍由模型声明路由，无法安全分桶时沿用 deferred；空变更拒绝；保存资产、查看答案和结束 Session 都不会隐式写记忆。

### Step 2：确认 RED

Run: `bun test tests/m1b/free-learning-memory.test.ts`

### Step 3：最小实现

在 M1a mutation 层增加 `planFreeLearningMemoryCommit`，复用对象 ID、桶、索引、事务与校验原语，仅替换证据来源和 patch 语义；提供 `free_learning_memory_commit`。Skill 用唯一亮线门约束认知变化，不把漂亮资产、教师讲解、“懂了”或答案查看当成掌握。

### Step 4：确认 GREEN

Run: `bun test tests/m1b/free-learning-memory.test.ts tests/m1/memory-mutations.test.ts tests/m1/memory-tools.test.ts tests/m1/memory-skill-tree.test.ts`

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/study/memory-mutations.ts apps/pi-teaching-web/src/runtime/memory-tools.ts apps/pi-teaching-web/src/runtime/free-learning-tools.ts apps/pi-teaching-web/resources/contracts/m1-memory-contract.md apps/pi-teaching-web/resources/skills/free-learning/SKILL.md apps/pi-teaching-web/tests/m1b/free-learning-memory.test.ts
git commit -m "feat: consolidate memory from free learning"
```

## Task 6：暴露 M1b HTTP API 与失效事件

**Files:**

- Create: `apps/pi-teaching-web/tests/m1b/server-api.test.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/server/event-hub.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`

### Step 1：写失败测试

覆盖：首页；自由学习创建/列表/历史/发送/结束；Note 与题卡列表/详情/学生修订；attempt/reveal；从题卡“问老师”创建带上下文 Session；参数、路径和 revision 校验；资产或记忆成功时只发必要 invalidation，失败时不发。

### Step 2：确认 RED

Run: `bun test tests/m1b/server-api.test.ts`

### Step 3：最小实现

新增显式 `/api/home`、`/api/free-learning`、`/api/assets/...` 与 `/api/problem-cards/...` 路由。保留原 `/api/course`、课程 lifecycle 和现有 Session 路由；Session key parser 只扩展 `free:<id>`，不让自由学习进入课程树。

### Step 4：确认 GREEN

Run: `bun test tests/m1b/server-api.test.ts tests/m0/server-api.test.ts tests/m0/public-surface.test.ts`

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/server apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/tests/m1b/server-api.test.ts
git commit -m "feat: expose m1b learning APIs"
```

## Task 7：完成首页、自由学习与资产再次使用界面

**Files:**

- Create: `apps/pi-teaching-web/tests/m1b/m1b-ui.test.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/HomePage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/FreeLearningPage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/NotePage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- Create: `apps/pi-teaching-web/src/client/styles/m1b.css`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/components/AppShell.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/PrimaryViewNav.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/client/view-state.ts`

### Step 1：写失败测试

覆盖：空白首页只显示“问老师 / 我的学习资料 / 最近自由学习”；已有课程额外显示课程入口；新开和恢复多个自由线程；显式结束；Note 阅读、编辑和 recall 翻面；题卡作答/不会后才显示答案；“问老师”携带题卡与最近作答；学生投影不出现教师依据。

### Step 2：确认 RED

Run: `bun test tests/m1b/m1b-ui.test.tsx`

### Step 3：最小实现

保持现有留白视觉语言，主导航收敛为“首页 / 学习资料 / 课程（存在时）”。自由学习继续复用 `ChatPanel`，不伪装课堂 Block；资产页按类型和最近更新时间浏览，不加入标签图或搜索邻居。

### Step 4：确认 GREEN

Run: `bun test tests/m1b/m1b-ui.test.tsx tests/m0/course-ui.test.tsx tests/m0/course-overview.test.tsx tests/m0/knowledge-ui.test.tsx`

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/client apps/pi-teaching-web/tests/m1b/m1b-ui.test.tsx
git commit -m "feat: complete the m1b student loop"
```

## Task 8：端到端验收与文档收口

**Files:**

- Create: `apps/pi-teaching-web/tests/e2e/m1b-cycle.spec.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-07-m1b-semantic-learning-set-growth-design.md`

### Step 1：写失败 E2E

使用空白 fixture，走完整浏览器闭环：新建自由学习 → 对话资产写入回执 → 显式结束 → 重启 fixture server → 打开题卡 → 提交作答 → 查看答案 → 问老师 → 新 Session 恢复题卡、最近作答与记忆上下文。确定性断言不依赖真实模型措辞。

### Step 2：确认 RED 后补齐 fixture 与文档

Run: `bun run test:e2e -- tests/e2e/m1b-cycle.spec.ts`

更新支持矩阵和边界：M1b 已实现；M1c 仍未实现；自由学习不创建 Light Lesson / Log / Trace。

### Step 3：全量验证

Run:

```bash
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts
```

Expected: 类型检查、全部 Bun 测试、生产构建和 M0/M1b 浏览器闭环全部通过。

### Step 4：检查范围与提交

```bash
git status --short
git diff --check
git log --oneline --decorate -10
git add AGENTS.md apps/pi-teaching-web/README.md apps/pi-teaching-web/tests/e2e apps/pi-teaching-web/tests/m0/public-surface.test.ts docs/superpowers/specs/2026-08-07-m1b-semantic-learning-set-growth-design.md
git commit -m "test: verify the m1b learning loop"
```

