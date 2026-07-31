# StudyForge 节点化主线整合设计

**状态：** 已确认

**目标分支：** `codex/studyforge-node-workspace`

**最终主线：** `main`

## 一、目标

将已经完成并验证的层级 Node Runtime 与三坐标学习工作台正式整合回 StudyForge
`main`，同时完整保留当前主工作树中的教学可靠性小修，不在整合过程中增加新功能、兼容
旧学习集或重新设计教学协议。

整合完成后，StudyForge 的唯一开发基线是节点化架构：

```text
ROADMAP.md / Plan Tree
  → Plan / Lesson Tree
  → Node-owned Session
  → global Trace Pool
  → three-layer Handoff
  → Course / Knowledge / Memory
```

旧线性 Runtime 不再继续接受补丁；知页仍由独立 `zhiye` 仓库维护。

## 二、当前事实

### 2.1 StudyForge `main`

当前主线为：

```text
a4f0c12 docs: retire zhiye from StudyForge
```

它仍运行旧 StudyForge Runtime，并带有 11 个尚未提交的 tracked 修改：

- Coach 的题卡与 Trace 紧凑召回；
- Tutor 的学生原话、教师贡献和撤回判断归因；
- Teacher Control 中“预测不是观察”的边界；
- 超长题目下课堂输入框可达性；
- 对应测试与重新生成的插件 bundle。

`.superpowers/` 和
`docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`
是现存未跟踪内容，不属于本次整合输入。

### 2.2 节点化分支

`codex/studyforge-node-workspace@ba9a380` 从 `f0a4b3d` 分出，领先 54 个提交，已经
实现：

- 层级 Plan/Lesson Candidate 与 materialization；
- Node Session owner、Activation Snapshot、上下文页表与文件权限；
- 学习集级全局 Trace Pool；
- 三层 Handoff 证据树和学生确认后的长期记忆晋升；
- Course、Knowledge、Memory 三坐标页面和专注课堂；
- 导数示范学习集向节点格式的直接迁移；
- 不读取、不兼容旧 `Plan Graph`、`Lesson Index` 或 Lesson 内 Trace。

本次设计前的重新验证结果为：

| 验证 | 结果 |
| --- | --- |
| Pi App typecheck、unit/integration、build | 394 pass，0 fail |
| Claude 插件 `release:check` | 71 pass，0 fail，strict validation 通过 |
| Playwright E2E | 38 pass，0 fail |
| 节点化分支 tracked working tree | clean |

### 2.3 关键去重结论

主工作树 11 个 tracked 修改与节点化分支首个提交完全相同：

```text
main working diff patch-id
fb8918d7356915b5fe0d44acb11c1397c374733d

744a980 fix: preserve accepted teaching refinements
fb8918d7356915b5fe0d44acb11c1397c374733d
```

因此这些修复已经进入节点化分支，不需要再次 cherry-pick、手工移植或重写。主工作树
里的 dirty state 只需被安全封存，不能作为第二份补丁重复进入主线。

## 三、方案比较

### 方案 A：封存旧补丁，合并主线，再快进切换

这是选定方案。

- 把当前 dirty patch 保存到独立 parking branch；
- 节点化分支合入当前 `main` 的知页退役提交；
- 验证 `744a980` 已完整覆盖 parking patch；
- 全套验收后将 `main` fast-forward 到节点化分支。

优点是保留 54 个已验证提交、不重复代码、不重写历史，并给现有用户修改留下可审计
退路。

### 方案 B：把 dirty patch 先提交到 `main`，再合并节点分支

虽然 Git 可能合并相同结果，但会让同一补丁以两个不同 commit 身份进入拓扑，增加无意义
历史和冲突判断，因此不采用。

### 方案 C：继续维护旧 `main`

这会在即将被替换的 Runtime 上重复修复上下文、Trace、路由和前端问题，且节点分支的
54 个提交继续漂移，不采用。

不使用 rebase 或 squash。前者会重写已经验收的节点化历史，后者会丢失逐步修复和真实
验收的可追溯性。

## 四、整合拓扑

```text
f0a4b3d
├── a4f0c12 main
│     └── 知页退役、README 指向
│
├── parking branch
│     └── 当前 11 文件 dirty patch 的安全快照
│
└── 744a980 ... ba9a380 node workspace
                      │
                      ├── merge a4f0c12
                      ├── 自动与真实验收
                      └── fast-forward main
```

最终 `main` 包含：

- 当前 StudyForge 主线历史；
- `744a980` 及其后的全部节点化提交；
- `a4f0c12` 的知页退役结果；
- 一份整合验收记录。

parking branch 不合并，只用于证明旧主工作树内容没有丢失。

## 五、执行阶段

### 5.1 封存主工作树补丁

在当前主工作树中：

1. 再次记录 `main` HEAD、tracked dirty paths 和 patch-id；
2. 确认 patch-id 仍等于 `744a980` 的 patch-id；
3. 创建 `codex/pre-node-hotfixes`；
4. 只提交 11 个 tracked 文件，提交信息为
   `fix: preserve accepted teaching refinements before node cutover`；
5. 不添加 `.superpowers/` 或未跟踪的旧三课计划；
6. 切回 `main`。

切回后，11 个文件恢复为 `main` 当前版本，但修复内容已同时存在于 parking branch 和
节点化分支的 `744a980` 中。这个过程不使用 `reset --hard`、`checkout --`、stash 或手工
删除用户修改。

若执行时 patch-id 已变化，说明用户又修改了这些文件。此时停止封存和整合，重新审计
新增差异；不得用旧结论覆盖新修改。

### 5.2 把当前主线合入节点化分支

在 `codex/studyforge-node-workspace`：

1. 确认 tracked tree clean；
2. merge 当前 `main`，不 rebase；
3. 保留节点化 `AGENTS.md`、README 和功能说明；
4. 同时保留 `a4f0c12` 删除知页专属设计/计划和 README 迁移指向的结果；
5. 不恢复 `apps/general-learning-web`、知页示范数据或任何旧知页文档。

预计唯一需要人工判断的是 README 文档入口。如果发生其他源码冲突，先定位原因；不得
以 `ours` 或 `theirs` 批量吞掉一侧。

### 5.3 教学小修等价审计

合并后核对 `744a980` 的三个行为结果仍然存在：

1. Plan Coach 的 `card_search` / `trace_search` 只返回元数据索引和 active Trace；
2. Tutor 的负面判断必须指向学生实际说出的错误，撤回判断时先 supersede，教师被学生
   否定的内容不自动计为 `support:tutor`；
3. 当前题目高于桌面视口时，课堂内容内部滚动，composer 仍可见、可点击；窄屏保持普通
   页面流。

这一步以节点分支现有实现和测试为准，不再把 parking commit cherry-pick 进来。若某项
测试在主线合并后失败，只修复该行为回归，不重新引入旧 Runtime 接口。

### 5.4 自动验收

在节点化分支根的两个产品目录执行：

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check

cd ../../apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
```

硬要求：

- 公共 MCP 仍恰好四个；
- 插件 strict validation 通过；
- Pi 类型检查、全部测试和生产构建通过；
- 38 项现有 E2E 全部通过；
- `git diff --check` 通过；
- tracked tree clean。

测试数量可以因新增整合测试增加，不能减少现有测试或使用筛选绕过失败。

### 5.5 真实短课验收

复制公开导数学习集，在副本中使用真实模型完成一条最短闭环：

```text
Roadmap Coach
  → 选择并物化一个 Plan Candidate
  → Plan Coach 问诊并物化一个 Lesson Candidate
  → 学生显式开始 Lesson
  → Tutor 完成至少一个真实 problem Block
  → 写入 active Trace
  → 学生确认关课并封存 Lesson Handoff
  → 返回 Plan Coach
  → Course / Knowledge / Memory 三页读取同一事实
```

验收只需一节短课，不重新跑六课压力测试。重点检查：

- Node owner 和路由刷新后仍一致；
- 题卡与 Trace 双向来源正确；
- Handoff 只引用合法当前层来源；
- Knowledge 只显示 active Trace 投影，不宣称 mastery；
- Memory 能下钻来源，不泄露 Teacher Control；
- Tutor 的提示、撤回和支持归因保持自然且诚实。

公开示范学习集不得被验收写入；模型凭据和 Session JSONL 不进入 Git。

### 5.6 主线切换

真实验收通过后：

1. 在主工作树重新读取 HEAD 和 status；
2. 确认 tracked tree clean，未跟踪文件与封存前一致；
3. 使用 `git merge --ff-only codex/studyforge-node-workspace`；
4. 从新 `main` 重新构建插件和 Pi App；
5. 重装本地 StudyForge；
6. 启动一次生产模式 smoke，确认默认 Course 页面、Knowledge、Memory 和课堂深链可用。

若 `main` 在整合期间新增提交，先把它们合入节点分支并重新验收；不得强推或覆盖。

## 六、事实与文件边界

整合不改变已经确认的节点化契约：

- 新 Runtime 只读取 Plan Tree、Lesson Tree 和全局 Trace；
- 不兼容旧 Plan/Lesson 结构；
- 不新增数据库、向量库、规则引擎、Agent、工具或长期记忆层；
- 不把前端选择、图谱布局或聊天摘要升级为事实；
- 不把知页源码重新带回 StudyForge；
- 不修改题卡 primary、secondary、subroute 或方法树语义；
- 不为了整合重跑长期研究实验或添加分发防御代码。

## 七、失败与回退

整合前的安全锚点为：

- 旧主线：`a4f0c12`；
- 原节点化分支：`ba9a380`；
- dirty patch：`codex/pre-node-hotfixes`；
- 已提交教学小修：`744a980`。

节点分支上的 merge 或整合修复失败时，在该分支使用普通 `git revert` 或新修复提交；不
重写 StudyForge 历史。主线 fast-forward 只在全部验收通过后执行，因此验收失败不会
改变 `main`。

切换后若出现阻塞性回归，优先 revert 主线切换后的整合提交。parking branch 只是内容
保险，不作为可运行旧产品继续开发。

## 八、完成标准

- `main` 包含层级 Node Runtime 和三坐标工作台全部 54 个既有节点化实现提交；
- 知页退役结果仍在，StudyForge 当前树没有知页源码或专属文档；
- 当前 11 文件教学小修由 `744a980` 唯一承载，没有重复补丁；
- Pi App、插件、38 项 E2E 与真实短课验收全部通过；
- 导数示范学习集使用新树结构，不存在旧结构兼容读取；
- 主工作树只保留原有、明确排除的未跟踪本地文件；
- 本地安装指向新 `main`；
- 下一轮开发只基于节点化 StudyForge，不再回到旧线性 Runtime。
