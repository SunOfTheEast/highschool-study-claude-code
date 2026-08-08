# StudyForge M1c 语义学习集与学习路径合流实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Use superpowers:test-driven-development for every product slice, superpowers:writing-skills for every Skill change, and superpowers:verification-before-completion before claiming completion.

**Goal:** 在不增加图数据库、统一 recall 工具、足迹日志或 Session 转换的前提下，让 Note、题卡、原始资料、教师记忆、自由学习和正式课程通过平坦语义标签与固定 revision 来源自然合流，并由 Meta Session 在学生确认后创建长期 Roadmap。

**Architecture:** Canonical 内容仍是 Markdown/YAML 与原生 Pi Session。新持久 schema 只有 `studyforge.semantic-tags.v1` 与 `studyforge.material.v1`：前者给 Note/题卡稳定身份维护独立 metadata revision，后者给原始资料维护不可变 revision。资产形成来源固定到 asset revision 或 Material revision + locator；旧 M1b 来源只读为 `legacy-unpinned`。统一召回、关系邻居、反向来源和学生学习足迹全部是可删除重建的投影。Meta、Free Learning、Roadmap、Plan、Lesson 保持不同 Pi Session；共享的是资产和记忆，不是对话状态。

**Tech Stack:** Bun 1.3、TypeScript 7、React 19、Pi coding-agent 0.81、YAML、Markdown、`pdfjs-dist`（仅 PDF 机械文本提取）、Playwright、Bun test。

**Baseline:** 在 `codex/m1b-minimal-learning-loop` 的 `16a2f2f` 上执行 `bun install --frozen-lockfile && bun run check`：229 tests pass，TypeScript 与 Vite build 通过；Vite 仅保留既有 chunk-size warning。

---

## Task 1：区分资产句柄、固定来源与独立语义 sidecar

**Files:**

- Create: `apps/pi-teaching-web/src/study/semantic-tags.ts`
- Create: `apps/pi-teaching-web/tests/m1c/semantic-assets.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/learning-assets.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/tests/m1b/learning-assets.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts`

### Step 1：写失败测试

覆盖以下不变量：

- `LearningAssetHandle = { kind: 'note' | 'problem-card'; id }` 只用于选择上下文；新 `LearningSourceReference` 必须是 `{kind,id,revision}` 或 `{kind:'material',id,revision,locator}`；
- M1b 旧 YAML 中 `{kind,id}` 只解析为内部 `legacy-unpinned`，读取时可见，任何新保存都拒绝把它伪装成当前 revision；
- 新 Note/题卡创建时，canonical 内容与 `semantics/assets/<kind>/<id>.tags.yaml` 同一事务成功；至少一个 `core`，`related` 可空，短标签去重，禁止多行与空白词；
- sidecar 使用 `schema: studyforge.semantic-tags.v1`、稳定 `subject`、独立 `revision` 与 Runtime 时间；标签更新只递增 metadata revision，不改变资产 revision；
- 更新 M1c 资产时，旧 canonical bytes 原子存入 `notes/.revisions/<id>/<revision>.note.yaml` 或 `cards/m1b/.revisions/<id>/<revision>.card.yaml`，当前文件成为下一 revision；历史 revision 可精确读取且不被回写；
- 来源 revision 必须存在；拒绝自引用、未知 revision、重复来源和 revision 级环；M1c 上线前不存在的历史 revision 明确返回 unresolved，不猜测补造；
- `source-N` 别名在保存瞬间由 Runtime 解析为当前 Session 已绑定的准确 revision，而不是仅返回稳定 ID。

### Step 2：确认 RED

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1c/semantic-assets.test.ts tests/m1b/learning-assets.test.ts tests/m1b/free-learning-tools.test.ts
```

Expected: FAIL，原因是当前 `sources` 无 revision、无 sidecar、更新会覆盖旧 revision。

### Step 3：最小实现

在公共契约中把“选择句柄”和“形成来源”拆开。`semantic-tags.ts` 只负责 sidecar 解析、候选写入与 metadata stale check；`learning-assets.ts` 负责 revision archive、来源存在性/环校验与精确读取。扩展 `planLearningNoteSave` / `planProblemCardSave` 为：

```ts
type SemanticTagDraft = { core: string[]; related: string[] };

type LearningAssetSaveDraft = {
  target?: { id: string; expectedRevision: number };
  expectedTagRevision?: number;
  tags: SemanticTagDraft;
  sources: LearningSourceReference[];
};
```

创建时返回内容候选与 tag 候选；修订时另返回 immutable archive 候选。继续用现有 `commitDocumentCandidates` 保证 all-or-nothing；不要把投影重建塞进该事务。

### Step 4：确认 GREEN

Run:

```bash
bun test tests/m1c/semantic-assets.test.ts tests/m1b/learning-assets.test.ts tests/m1b/free-learning-tools.test.ts tests/m1b/problem-attempts.test.ts
```

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/semantic-tags.ts apps/pi-teaching-web/src/study/learning-assets.ts apps/pi-teaching-web/src/runtime/free-learning-tools.ts apps/pi-teaching-web/tests/m1c/semantic-assets.test.ts apps/pi-teaching-web/tests/m1b/learning-assets.test.ts apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts
git commit -m "feat: pin learning asset sources and semantics"
```

## Task 2：建立统一安全召回与可重建关系投影

**Files:**

- Create: `apps/pi-teaching-web/src/study/semantic-index.ts`
- Create: `apps/pi-teaching-web/tests/m1c/semantic-index.test.ts`
- Modify: `apps/pi-teaching-web/scripts/build-card-recall-index.ts`
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Modify: `apps/pi-teaching-web/tests/m0/card-recall-index.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`

### Step 1：写失败测试与 Skill 压力场景

确定性测试覆盖：

- 新 sidecar 投影成安全行：`path,kind,id,core,related,title_or_stem`；不包含 Note 正文、答案、教师依据、学生笔记、作答或记忆；
- 旧题卡 `graph.goal/method/structure` 的 primary 投到 `core`，secondary、part-level 和 subroute 投到 `related`，不修改 519 张旧卡与冻结词表；
- 删除 `semantics/indexes/*` 后可从 canonical 事实重建相同结果；
- 反向来源和标签共现邻居由当前 sidecar/来源生成，不接受独立写入；对象记忆只用对象标题与已有 bucket 标题投影，不机械继承资产标签；
- `querySemanticRecall(root, { terms, limit, allowRelatedExpansion })` 达到 brief 数量即停；空结果只报告当前切片为空。

Skill RED 使用一个 fresh-context Scout 压力场景：brief 要两道“绝对值 + 三次函数 + 参数主元”题。观察旧文本是否继续深读全家族、寻找最优或把学生记忆带给 Scout；记录原始返回作为 RED 证据。

### Step 2：确认 RED

Run:

```bash
bun test tests/m1c/semantic-index.test.ts tests/m0/card-recall-index.test.ts tests/m0/public-surface.test.ts
```

Expected: FAIL，因为当前 index 只支持旧 `goal/method/structure` 且无新资产/关系投影。

### Step 3：最小实现

把旧卡解析函数提取为可复用兼容投影；默认生成 `semantics/indexes/asset-recall.tsv`。关系查询直接在内存中从 canonical 文件重建，M1c 不写 graph 正文。Scout 文本明确：先读安全索引；只浅读题面；需要 Material 时用 Search/Read；达到 brief 数量立即返回；未授权不沿邻居；不得读取 Note 正文、记忆、作答或答案。

### Step 4：Skill GREEN 与回归

用同一压力输入重跑 fresh-context Scout，要求首击返回所需数量后停止，并在报告中列出它实际读取的安全字段与文件；不要求固定措辞。

Run:

```bash
bun test tests/m1c/semantic-index.test.ts tests/m0/card-recall-index.test.ts tests/m0/study-subagent-guard.test.ts tests/m0/public-surface.test.ts
```

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/study/semantic-index.ts apps/pi-teaching-web/scripts/build-card-recall-index.ts apps/pi-teaching-web/resources/subagents/study-material-scout.md apps/pi-teaching-web/tests/m1c/semantic-index.test.ts apps/pi-teaching-web/tests/m0/card-recall-index.test.ts apps/pi-teaching-web/tests/m0/public-surface.test.ts
git commit -m "feat: unify semantic asset recall"
```

## Task 3：实现受管 Material revision 与机械检索投影

**Files:**

- Create: `apps/pi-teaching-web/src/study/materials.ts`
- Create: `apps/pi-teaching-web/tests/m1c/materials.test.ts`
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/bun.lock`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/knowledge.ts`
- Modify: `apps/pi-teaching-web/src/study/learning-set-home.ts`

### Step 1：写失败测试

覆盖：

- 导入文本、Markdown、PDF 或图片只创建 `materials/<id>/manifest.yaml` 与 `revisions/<n>/original.<ext>`；不会创建 Note、题卡、tag sidecar、记忆、Roadmap 或 mastery 字段；
- `studyforge.material.v1` manifest 的 ID、revision、哈希、标题、MIME、原始文件名、导入时间由 Runtime 绑定；相同 request ID 幂等，相同 Material 更新创建新不可变 revision；
- UTF-8 文本直接可读；PDF 仅用 `pdfjs-dist` 机械提取页面文本到 `projections/<revision>/pages/page-0001.txt`，locator 为真实页码；图片可直接 Read，但没有 OCR 能力时状态明确为 `image-readable` 而不是伪造可搜索正文；
- PDF 提取失败仍保留原始 revision 并返回 `searchStatus: unavailable`；重试投影不创建新 revision；
- Material locator 必须存在于相应 revision；对直接文本允许 `lines-<start>-<end>`，对 PDF 允许 `page-<nnnn>`；
- `readKnowledge` 不把 manifest、archive 和投影碎片当成多份资料；M1c 前 `materials/` 散装文件继续只读显示，不能静默成为 pinned source。

### Step 2：确认 RED

Run:

```bash
bun test tests/m1c/materials.test.ts tests/m0/material-search-projection.test.ts tests/m1b/learning-set-home.test.ts
```

Expected: FAIL，因为当前 `materials/` 只是递归文件列表，无身份、revision 与 locator。

### Step 3：最小实现

新增：

```ts
importMaterial(root, { title, filename, mediaType, bytes, requestId, target? }, at)
readMaterial(root, id, revision?)
readMaterialLocator(root, { id, revision, locator })
retryMaterialProjection(root, id, revision)
```

使用文件 hash 与 request receipt 保证幂等；原始文件和 manifest 用现有多文档事务提交。文本/PDF projection 是可重建衍生物，失败不得回滚原件。不要生成关键词、章节对象或每页语义 sidecar。

### Step 4：确认 GREEN

Run:

```bash
bun test tests/m1c/materials.test.ts tests/m0/material-search-projection.test.ts tests/m1b/learning-set-home.test.ts tests/m0/knowledge-ui.test.tsx
```

### Step 5：提交

```bash
git add apps/pi-teaching-web/package.json apps/pi-teaching-web/bun.lock apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/materials.ts apps/pi-teaching-web/src/study/knowledge.ts apps/pi-teaching-web/src/study/learning-set-home.ts apps/pi-teaching-web/tests/m1c/materials.test.ts
git commit -m "feat: import revisioned learning materials"
```

## Task 4：让 Free Learning 与正式 Lesson 共用准确资产沉淀门

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/learning-asset-tools.ts`
- Create: `apps/pi-teaching-web/tests/m1c/session-asset-tools.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/lesson-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`

### Step 1：写失败测试与两个 Skill RED 场景

工具测试覆盖：

- `save_note` / `save_problem_card` 共用一套确认与 pinned-source 实现；Free Learning 从学生明确选择的上下文解析 alias，Lesson 只从当前 Lesson `Uses` 与本次明确绑定项解析，绝不枚举兄弟 Plan/Lesson；
- 最新学生消息必须明确确认模型刚刚公开展示的拟保存内容；沉默、继续做题或“我懂了”不算批准；“嗯/可以/保存吧”在上下文明确时可以批准；
- 保存正文、sources 和初始标签原子完成；保存资产不会调用记忆工具，记忆提交也不会自动保存资产；
- Lesson 原生 edit/write 边界保持不变；只新增窄资产工具，不给 Tutor 通用写权限；
- 同一 toolCall 重放只产生一个资产。

Skill RED 1：自由讨论得到关键解释后学生还没要求保存，Tutor 不应中断教学追问 sidecar 字段。Skill RED 2：正式 Lesson 中学生形成好解释，Tutor 先完成眼前教学，再用普通语言展示候选并询问；没有确认不得写。保留原始转录。

### Step 2：确认 RED

Run:

```bash
bun test tests/m1c/session-asset-tools.test.ts tests/m1b/free-learning-tools.test.ts tests/m0/lesson-tools.test.ts tests/m1/memory-skill-tree.test.ts
```

Expected: FAIL，因为 Lesson 没有资产工具且 Free Learning 尚不接收标签/pinned source。

### Step 3：最小实现

抽出 `createLearningAssetTools(root, binding, manager)`；binding 只暴露已授权 alias，不暴露搜索目录。Free Learning 与 Lesson 各自组装工具名，但共用机械确认、幂等与事务。修改两个 Skill 的唯一亮线：先处理学习 → 展示学生可见内容 → 明确确认 → 保存；内部 revision、sidecar 与索引不向学生解释。

### Step 4：Skill GREEN 与回归

重跑相同压力场景，检查首击顺序和持久产物；不把完整 prose 快照写入测试。

Run:

```bash
bun test tests/m1c/session-asset-tools.test.ts tests/m1b/free-learning-tools.test.ts tests/m0/lesson-tools.test.ts tests/m1/memory-skill-tree.test.ts tests/m1/lesson-memory-guard.test.ts
```

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/runtime/learning-asset-tools.ts apps/pi-teaching-web/src/runtime/free-learning-tools.ts apps/pi-teaching-web/src/runtime/lesson-tools.ts apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/src/runtime/session-scope.ts apps/pi-teaching-web/src/runtime/resource-loader.ts apps/pi-teaching-web/resources/skills/free-learning/SKILL.md apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/tests/m1c/session-asset-tools.test.ts apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts apps/pi-teaching-web/tests/m0/lesson-tools.test.ts apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts
git commit -m "feat: save learning assets from live lessons"
```

## Task 5：增加正式备课自编题的窄持久化通路

**Files:**

- Create: `apps/pi-teaching-web/tests/m1c/prepared-card-persistence.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/m0/plan-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`

### Step 1：写失败测试与 Skill RED 场景

覆盖：准备完成的 Lesson 可以继续使用内联自编题；只有 Coach 展示完整题卡并获得学生明确确认后，`save_prepared_problem_card` 才创建一张带 tags/sources 的卡并把精确路径挂到指定 prepared Lesson 的目标 Block `Uses`；拒绝保存不改 Lesson；卡保存失败不回滚已准备 Lesson；重复调用不重复卡或 Uses；不得修改 active/closed Lesson、别的 Plan 或整个课程目录。

Skill RED：学生批准课堂方案但没批准把自编题永久入库。Coach 必须先完成备课，然后把“是否保存这张自编题”作为独立公开决定；不得把课程批准偷换成资产批准。

### Step 2：确认 RED

Run:

```bash
bun test tests/m1c/prepared-card-persistence.test.ts tests/m0/plan-tools.test.ts tests/m1/memory-skill-tree.test.ts
```

### Step 3：最小实现

给 Plan 增加一个只接受当前 Plan 下 prepared Lesson 精确 path/block ID 的 custom tool。资产事务成功后，再用现有原子 Lesson mutation 防重复挂载；第二步失败时回执明确报告已创建的孤立卡路径，重试只修复同一挂载，不扫描猜测。不要给普通 Plan 讨论开放 Note 或任意资产编辑。

### Step 4：确认 GREEN

Run:

```bash
bun test tests/m1c/prepared-card-persistence.test.ts tests/m0/plan-tools.test.ts tests/m0/lesson-mutations.test.ts tests/m1/memory-skill-tree.test.ts
```

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/runtime/plan-tools.ts apps/pi-teaching-web/src/runtime/session-scope.ts apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md apps/pi-teaching-web/tests/m1c/prepared-card-persistence.test.ts apps/pi-teaching-web/tests/m0/plan-tools.test.ts apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts
git commit -m "feat: persist approved prepared problem cards"
```

## Task 6：建立根级 Meta Session 与只创建 Roadmap 的物化门

**Files:**

- Create: `apps/pi-teaching-web/resources/agents/meta-session.md`
- Create: `apps/pi-teaching-web/resources/skills/meta-dialogue/SKILL.md`
- Create: `apps/pi-teaching-web/src/runtime/meta-tools.ts`
- Create: `apps/pi-teaching-web/tests/m1c/meta-session.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-owner.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/study/learning-set-home.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

### Step 1：写失败测试与 Skill RED 场景

Runtime 覆盖：

- `meta:<pi-session-id>` 是根级、可恢复的原生 Session，可从 Session owner 找回；不属于课程树，也不创建 Light Lesson/Log/Summary；
- Meta 只加载 guide、memory L0、紧凑资产/标签/足迹概述和学生明确选择的上下文，不枚举完整库；
- `create_roadmap` 必须核验最新学生消息对公开 Roadmap 方案的明确确认；模型只提交标题、概述、长期目标、能力标准、直接检验和当前位置；Runtime 绑定固定 path、ID、active status、session ID；
- ROADMAP 已存在时拒绝第二份；未确认/写失败不留半文件；成功只创建 `ROADMAP.md`，绝不创建 Plan；
- 成功后首页指向新的 Roadmap Session，Roadmap Skill 继续负责诊断与第一个 Plan。

Skill RED 场景 A：空白学习集学生说“我完全不知道化学反应原理怎么学”；Meta 先讨论长期变化，不直接写 Plan。场景 B：已有一条 Ksp Note 和对象记忆；Meta 可引用真实证据但不得把资料覆盖当能力。场景 C：学生拒绝长期课程；自由学习仍可用且无 ROADMAP。

### Step 2：确认 RED

Run:

```bash
bun test tests/m1c/meta-session.test.ts tests/m0/native-session.test.ts tests/m1b/free-learning-session.test.ts
```

### Step 3：最小实现

扩展 `StudySessionScope`、session key parser 与 owner entry 为 Meta variant；复用 Registry 队列/恢复，不建立额外状态文件。新增 `createMetaTools` 的唯一窄工具。Meta Skill 的顺序只有：理解是否需要长期路径 → 必要时按需读证据 → 普通语言公开 Roadmap 级方案 → 明确确认 → 调工具 → 把第一个 Plan 留给 Roadmap。

### Step 4：Skill GREEN 与回归

用 fresh Pi Session 重跑三个场景，检查首击边界；确定性回归：

```bash
bun test tests/m1c/meta-session.test.ts tests/m0/native-session.test.ts tests/m1b/free-learning-session.test.ts tests/m0/markdown-domain.test.ts
```

### Step 5：提交

```bash
git add apps/pi-teaching-web/resources/agents/meta-session.md apps/pi-teaching-web/resources/skills/meta-dialogue/SKILL.md apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/runtime/meta-tools.ts apps/pi-teaching-web/src/runtime/session-scope.ts apps/pi-teaching-web/src/runtime/session-owner.ts apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/src/runtime/resource-loader.ts apps/pi-teaching-web/src/runtime/workspace-registry.ts apps/pi-teaching-web/src/study/learning-set-home.ts apps/pi-teaching-web/tests/m1c/meta-session.test.ts apps/pi-teaching-web/tests/m0/native-session.test.ts
git commit -m "feat: create roadmaps through meta sessions"
```

## Task 7：从既有事实投影学习足迹

**Files:**

- Create: `apps/pi-teaching-web/src/study/learning-footprint.ts`
- Create: `apps/pi-teaching-web/tests/m1c/learning-footprint.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/study/memory-mutations.ts`

### Step 1：写失败测试

覆盖：

- `readLearningFootprint` 从 Pi Session Header/Entry 时间、当前 node status、Free/Meta owner、资产 created/revision、Material import、attempt/reveal 与对象 Learning History 事件生成统一时间线；
- 不创建 `footprint.*`、生命周期时间字段或新的 custom event；删除任何缓存都可得到同一投影；
- 条目保留 canonical route/source，学生默认只见对象标题、时间、活动与入口，不暴露教师 current judgment 正文；
- 同一 Session 多条 entry 可压成“首次/继续”显示，但不伪造关闭按钮时刻；活动种类来自事实本身，不引入 `main/side/daily` domain enum；
- 旧来源缺时间时明确省略/降级排序，不用文件 mtime 伪造成认知事件。

### Step 2：确认 RED

Run:

```bash
bun test tests/m1c/learning-footprint.test.ts tests/m1/memory-mutations.test.ts tests/m1b/problem-attempts.test.ts
```

### Step 3：最小实现

给 Registry 增加只读 `listOwnedSessionFacts()`，返回已验证 owner、SessionInfo 与 branch entry 时间；对象记忆解析只提取已有 Learning History 的时间、标题与来源链接。`readLearningFootprint` 进行稳定排序和去重，只返回 DTO。

### Step 4：确认 GREEN

Run:

```bash
bun test tests/m1c/learning-footprint.test.ts tests/m1/memory-mutations.test.ts tests/m1b/problem-attempts.test.ts tests/m0/native-session.test.ts
```

### Step 5：提交

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/learning-footprint.ts apps/pi-teaching-web/src/runtime/workspace-registry.ts apps/pi-teaching-web/src/study/memory-mutations.ts apps/pi-teaching-web/tests/m1c/learning-footprint.test.ts
git commit -m "feat: project the student learning footprint"
```

## Task 8：暴露 M1c API、朴素入口与确定性浏览器闭环

**Files:**

- Create: `apps/pi-teaching-web/tests/m1c/server-api.test.ts`
- Create: `apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx`
- Create: `apps/pi-teaching-web/tests/e2e/m1c-cycle.spec.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/HomePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/NotePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/m1b.css`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`

### Step 1：写失败 API/UI/E2E 测试

API 覆盖：multipart Material 导入与 revision 更新、Material/locator 读取、tag 更新、统一语义查询/关系投影、Meta 创建/历史/发送、footprint；严格校验 ID、revision、locator、MIME 与上传上限。成功只发布必要 invalidation，失败不发布。

朴素 UI 覆盖：

- 首页无 Roadmap 时显示“规划长期学习”并可创建/恢复 Meta；已有 Roadmap 时只显示课程入口；
- 资产页能上传/打开 Material，查看可搜索状态、标签和固定来源；可以从 Note/题卡/Material locator 发起自由学习；
- 首页或资产页提供简洁学习足迹入口，不做 M1d 图谱可视化；
- 学生界面只说“来源页/版本、保存、资料暂不可搜索”，不暴露 sidecar、metadata revision 或 projection 术语。

浏览器闭环使用 deterministic fake session factory，不调用模型：空白集 → 导入文本资料 → 选中 locator 开自由学习 → 通过工具 fixture 保存带标签/来源 Note → 开 Meta → 确认后只生成 Roadmap → 查看足迹 → 进入 Roadmap。

### Step 2：确认 RED

Run:

```bash
bun test tests/m1c/server-api.test.ts tests/m1c/m1c-ui.test.tsx
bun run test:e2e -- tests/e2e/m1c-cycle.spec.ts
```

### Step 3：最小实现

增加 `/api/materials`、`/api/materials/:id`、`/api/materials/:id/revisions/:revision/locators/:locator`、`/api/semantics/query`、`/api/semantics/relations`、`/api/meta`、`/api/footprint`。UI 只补能完成闭环的表单、列表和跳转；不在 M1c 做知识图、复杂筛选或页面重设计。

### Step 4：确定性 GREEN

Run:

```bash
bun test tests/m1c/server-api.test.ts tests/m1c/m1c-ui.test.tsx
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts tests/e2e/m1c-cycle.spec.ts
bun run check
```

### Step 5：更新支持文档并提交

修改根 `AGENTS.md`，只记录已经成为真实 runtime 的 M1c durable domain、Session、工具、路由与验证命令；不把计划或未来 M1d 写成现状。

```bash
git add AGENTS.md apps/pi-teaching-web/src/server apps/pi-teaching-web/src/client apps/pi-teaching-web/tests/m1c/server-api.test.ts apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx apps/pi-teaching-web/tests/e2e/m1c-cycle.spec.ts apps/pi-teaching-web/tests/e2e/fixture-server.ts
git commit -m "feat: expose the m1c learning loop"
```

## Task 9：冻结代码并运行真实模型验收

**Files:**

- Create: `apps/pi-teaching-web/scripts/m1c-validation/cli.ts`
- Create: `apps/pi-teaching-web/scripts/m1c-validation/layout.ts`
- Create: `apps/pi-teaching-web/scripts/m1c-validation/turn-client.ts`
- Create: `apps/pi-teaching-web/tests/m1c/m1c-validation-harness.test.ts`
- Create: `apps/pi-teaching-web/tests/m1c/m1c-validation-protocol.test.ts`
- Create: `docs/superpowers/reports/2026-08-09-m1c-real-model-validation.md`
- Modify: `apps/pi-teaching-web/package.json`

### Step 1：先测试验收器自身

覆盖：

- 每次 run 复制 blank fixture 到独立临时 learning-set，不污染示例/用户数据；
- 报告记录 git commit、dirty state、provider、主模型、Scout 模型、thinking level、session IDs、每轮时间、token/usage（provider 可见时）、tool calls、错误和最终 canonical 文件清单；
- transcript、原生 Pi JSONL、HTTP event stream 与产物快照落到 run directory；
- harness 只发送真实学生会说的话，不提示工具名、路径、schema、revision 或预期调用顺序；
- 代码冻结后的一次 acceptance run 中不得边跑边改；失败原样保留。修复必须成为独立 commit，并从新 learning-set 开新 run。

### Step 2：确认 RED 并实现最小 harness

Run:

```bash
bun test tests/m1c/m1c-validation-harness.test.ts tests/m1c/m1c-validation-protocol.test.ts
```

复用 M1a 的 HTTP/事件客户端，但增加 Material 上传、Meta 与产物审计。脚本参数：

```text
--provider openai-codex
--main-model gpt-5.6-sol
--main-thinking high
--scout-model gpt-5.6-terra
--scout-thinking high
--scenario all
--output <absolute-run-directory>
```

### Step 3：最终确定性冻结

Run:

```bash
bun install --frozen-lockfile
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts tests/e2e/m1c-cycle.spec.ts
git status --short
```

若失败，先修复、重新从相关 RED/GREEN 开始并提交；只有全部通过后才开始真实模型 run。

### Step 4：运行三条真实链路

使用真实 OpenAI OAuth/provider 配置，主对话固定 `gpt-5.6-sol` high，Scout 固定 `gpt-5.6-terra` high：

1. **有资料的化学链路：** 学生导入一份含 Ksp/纯固体内容的真实短教材资料，从原文入口问“为什么溶度积里固体不见了”；教师先教，再在自然确认下保存有准确 Material locator 的 Note；有可证实认知变化时才写对象记忆；随后 Meta 与学生讨论并确认 Roadmap，确认后只创建 Roadmap。
2. **空白自由讨论链路：** 学生不带资料问阿伦尼乌斯方程温度敏感性，表达含糊且不主动要求标签；教师通过比较帮助其形成解释，学生自然提出“帮我存成笔记”；产物有标签、无伪造 sources，漂亮 Note 不自动成为掌握判断。
3. **正式课程与旧题库链路：** 使用已有对象记忆与旧题库，让 Roadmap/Plan 形成一个训练 Lesson；Coach brief 要两道目标题，Scout 从安全索引召回足量即停，Coach 深读并负责核验；Lesson 以当前表现为准，可在明确确认后保存现场资产；足迹能串起自由学习、课程、资产与真实对象历史但不暴露内部判断正文。

每个情境观察首击：是否先教学、确认门是否守住、Session 是否保持类型、来源是否准确、Scout 是否适可而止、学生是否无需理解内部 schema、等待期间是否有可见进展。

### Step 5：审计产物并写报告

报告逐条映射 spec §16：PASS / FAIL / NOT OBSERVED；列出事实证据路径，不用主观“看起来可以”代替。若模型失败，区分：模型能力、Skill 边界、Runtime 机械失败、检索质量、前端/传输；保留完整 run，不把同一次失败 run 修饰成通过。

最终是否发布由项目负责人判断；自动报告不得代替这一决定。

### Step 6：提交验收器与报告

```bash
git add apps/pi-teaching-web/package.json apps/pi-teaching-web/scripts/m1c-validation apps/pi-teaching-web/tests/m1c/m1c-validation-harness.test.ts apps/pi-teaching-web/tests/m1c/m1c-validation-protocol.test.ts docs/superpowers/reports/2026-08-09-m1c-real-model-validation.md
git commit -m "test: validate m1c with real teaching models"
```

---

## 完成定义

以下条件必须同时成立，才能汇报 M1c 实施完成：

1. Spec §16.1 的 14 条确定性边界均有自动测试或明确代码证据；
2. `bun run check` 与 M0/M1b/M1c 三条 Playwright 闭环在最终 commit 上通过；
3. 两个新 durable schema 之外没有出现第三份 canonical log/index/graph；
4. 三个真实模型情境至少各完成一次独立 run，原始转录、Pi Session、时间/工具证据和产物快照可复核；
5. 验收报告诚实保留失败与未观察项，最终发布判断仍交给项目负责人；
6. `git status --short` 只包含有意保留且已在交付中说明的证据文件，不含凭据、OAuth token、用户 Session 或临时 learning-set。
