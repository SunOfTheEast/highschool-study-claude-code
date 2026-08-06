# StudyForge M0 可空静态资产与无题卡公开启动集设计

**状态：** 已确认设计，等待书面规格复核
**日期：** 2026-08-06
**范围：** M0 Learning Set 读取、备课来源路由、公开默认示例、Knowledge 空状态与验收

## 1. 决策摘要

StudyForge M0 的核心 Learning Set 只要求：

```text
LEARNING_GUIDE.md
ROADMAP.md
```

学习集根目录还必须可写，以便后续创建 Plan、Plan-local Lesson 和课堂记录。`graph/`、
`cards/`、`materials/` 都是彼此独立的可选增强，不再是启动、Doctor、课程生命周期或课堂
运行的前置条件。

结构化题卡仍是高性能题库检索适配器：存在时继续支持冻结词表、sidecar 索引和 Material
Scout；不存在时，Coach 可以使用学生持有材料或教师内联材料完成同一条 Roadmap → Plan →
Lesson 教学闭环。公开 M0 默认使用一套没有图谱、题卡和材料的最小数学启动集，以真实证明
Infra 不依赖当前 519 卡语料。

现有 519 张导数题卡继续留在可信私有仓库，不改写、不重新许可、不为首发逐卡“洗白”。
后续 clean export 整体排除该私有语料，只导出新的公开启动集。

## 2. 现状与证据

当前 `readKnowledge()` 会无条件读取 `graph/method_tree.yaml`。因此：

- 没有 `cards/` 时，Knowledge 可以返回空题卡；
- 没有 `materials/` 时，Knowledge 可以返回空材料；
- 没有 `graph/method_tree.yaml` 时，Doctor 判定 Learning Set 无效。

隔离探针已经证明：保留 `LEARNING_GUIDE.md`、`ROADMAP.md` 和方法图谱、移除全部题卡与材料
后，Doctor 七项通过，Server 正常启动，`/api/knowledge` 返回 `cards: 0`。再移除方法图谱后，
Doctor 唯一新增失败正是 `graph/method_tree.yaml` 缺失。这说明当前真正的硬耦合是静态方法树，
不是 Roadmap、Plan、Lesson 或 Session Runtime。

Agent/Skill 侧已经具备正确基础：`prepare-approved-lesson` 明确区分学生持有材料、教师内联
材料和学习集资产；Lesson 的 `Uses` 可以为空；Tutor 可以在当前 Lesson Goal 内生成并记录
短微题。此次设计只把这些已存在的教学边界变成被 Runtime、UI 和验收共同承认的正式能力。

## 3. 目标与非目标

### 3.1 目标

1. 只有 `LEARNING_GUIDE.md + ROADMAP.md` 的可写目录是合法 Learning Set。
2. 方法图谱、题卡和普通材料可以分别缺失、为空或独立存在。
3. 静态资产完全为空时，Doctor、Server、Course、Agent Session、Lesson、课堂日志与讲义继续工作。
4. 教师内联材料是一等来源，不是题库失败后的降级兜底。
5. 公开默认启动集不携带现有私有题库，并通过真实模型完成至少两节无题卡课堂。
6. 结构化题卡、索引和 Scout 路径继续作为可选增强受到回归保护。
7. 为 M1 的记忆系统和自造学习集保留真实 Lesson 来源，但不在 M0 预建半套持久化机制。

### 3.2 非目标

- 不设计或实现 M1 记忆 Schema、Student Model 或资产晋升工作流。
- 不把现场生成内容自动写入 `cards/`、`materials/`、索引或新数据库。
- 不新增 Learning Set manifest、能力枚举或资产插件系统。
- 不把普通 Markdown、PDF、图片强制转换成题卡字段。
- 不重写、删除或重新许可当前 519 张私有题卡。
- 不在本设计中创建公开 Git 根、远端仓库、发布标签或执行 push。
- 不修改 Roadmap、Plan、Lesson 的确认门、证据边界或生命周期所有权。

## 4. 最小 Learning Set 契约

### 4.1 必需内容

```text
<learning-set>/
├── LEARNING_GUIDE.md
└── ROADMAP.md
```

`ROADMAP.md` 仍需满足现有 Roadmap 文档契约，Plan Tree 可以为空。学习集根目录必须可写；
Plan 与 Lesson 目录由后续正常写入流程按需创建，不要求用 `.gitkeep` 伪造存在性。

### 4.2 可选切片

```text
graph/
cards/
materials/
```

三者互不要求同时存在：

- 只有 `materials/`：可以展示和使用普通文本、图片、PDF、视频或其他文件；
- 只有合法方法树：可以展示静态方法骨架；
- 只有题卡：可以读取题卡；没有方法树时 Knowledge 仍展示全部题卡，只是不提供方法树筛选；
- 三者都没有：KnowledgeSnapshot 为空，但课程系统完整可用。

不新增 manifest。文件系统本身就是能力声明。

### 4.3 统一读取语义

| 状态 | 行为 |
|---|---|
| 可选路径不存在 | 返回对应空集合 |
| 可选目录存在但为空 | 合法，返回空集合 |
| 可选文件存在且合法 | 正常加载 |
| 声明格式的文件存在但损坏 | 报告精确路径和原因，不能吞成空集合 |
| 显式相对路径含 `..` 等并越出学习集 | 保持现有失败关闭行为 |

符号链接的统一安全策略属于仓库级路径加固，不借此次“可空资产”改动顺带扩张；本设计既不新增
符号链接能力，也不把链接目标当成公开启动集的一部分。

`readKnowledge()` 始终返回稳定结构：

```ts
{
  methods: [],
  cards: [],
  materials: [],
}
```

数组是否为空不改变其字段或 API 形状。

## 5. Agent 选材与课堂数据流

每份具体教学内容在备课时仍先归入一种来源。

### 5.1 学生持有材料

对话明确指向学生手里的内容，但系统没有正文或学习集路径时，不调用 Scout，也不假装知道
原件。专业准备确实依赖完整内容时，请学生提供；不能把模型重建内容称为原材料。

### 5.2 教师内联材料

教师内联材料是正式的一等路径。已批准 Lesson 允许 Coach 自主命题时：

- Coach 在当前备课中独立生成并数学自检；
- 完整题面、分问和学生首次作答所需信息写入 `Student View`；
- 答案、观察点、提示阶梯和决定性路线留在 `Teacher Control`；
- Block 的 `Uses` 可以为空；
- 不调用 Scout；
- 不先浏览学习集候选再声称内容是独立生成。

Lesson Tutor 直接根据 Lesson 内联内容教学。当前 Goal 内确需很短的迁移检查且没有已准备短
任务时，仍可按既有 Skill 现场生成、自检，并在 Classroom Log 标记“教师现场生成”。

### 5.3 学习集资产

只有已批准 Lesson 明确选择预置题卡、阅读、视频等学习集资产时才进入资产路径：

- 精确相对路径已绑定：Coach 直接完整读取并核验；
- 精确路径未绑定：按现有 `material-preparation` 协议交给 Scout；
- 非题卡材料使用短字面词和 brief 指定范围，不伪造 `goal/method/structure`；
- 必需资产不存在时，停止备课并回到 Plan 对话，不静默切换来源或缩水课堂。

结构化题卡 Scout 的词表、索引、停止边界和父子分工不变。无静态资产的公开主路径不会调用
Scout，因此也不需要给 Scout 增加“空学习集模式”或新的结构化工具。

## 6. M0 与 M1 的边界

M0 不自动沉淀现场内容，但已经保留 M1 所需的两类原始事实：

- Lesson 的 `Student View / Teacher Control` 说明教师实际准备了什么；
- Classroom Log 说明学生如何作答、获得何种帮助、怎样修正以及最终发生了什么。

因此教师现场生成的内容不会消失，只是不自动晋升为共享资产。M1 可以在独立设计中建立显式
流程：

```text
真实 Lesson 与课堂表现
→ 判断内容是否值得复用
→ 生成候选学习资产
→ 数学核验、来源说明与人工确认
→ 写入自造 Learning Set
→ 按资产类型建立可选索引
```

记忆系统从课堂表现和跨课变化中提取，不从题卡标签推断学生掌握。自造学习集与记忆都以
Lesson 为来源，但不混成同一事实库。此次 M0 工作不添加 memory、trace pool、promotion
record、asset manifest 或后台索引器。

## 7. 公开默认启动集

新增项目原创的公开启动集：

```text
examples/math-starter-m0/
├── README.md
├── LICENSE
└── learning-set/
    ├── LEARNING_GUIDE.md
    └── ROADMAP.md
```

- 内容采用项目为示例学习内容确定的 CC BY 4.0 边界，并提供独立说明；
- Roadmap 的 Plan Tree 为空，从与学生讨论真实学习目标开始；
- 不创建空 `graph/`、`cards/`、`materials/` 目录；
- `start:demo` 与 Doctor 默认选择该启动集；
- 私有内测通过 `STUDY_LEARNING_SET=examples/derivative-m0/learning-set` 显式选择现有语料。

当前私有目录继续保留并接受私有回归。后续 clean export 用白名单包含
`examples/math-starter-m0`，整体排除 `examples/derivative-m0`，不尝试在导出过程中改写题目。

## 8. UI 与 Doctor

### 8.1 Knowledge 可见性

Course 永远是主视图。只有存在至少一个静态资产候选时，Course 页主导航才显示 Knowledge。
为了不在每次进入 Course 时解析 519 张私有题卡，Server 只投影一个轻量
`knowledgeAvailable` 布尔值，不读取题干、解答或完整图谱。候选的判定规则固定为：

- `graph/method_tree.yaml` 存在；或
- `cards/` 下递归存在至少一个 `.yaml` / `.yml` 文件；或
- `materials/` 下递归存在至少一个普通文件。

缺失目录和空目录都得到 `false`。该投影只回答“是否值得显示入口”，不替代合法性校验；候选
存在但内容损坏时入口可以显示，`readKnowledge()` 和 Doctor 仍按精确路径报告错误。正常合法
学习集上，`knowledgeAvailable` 与 KnowledgeSnapshot 是否至少有一项内容一致。

该布尔值只控制导航显示，不参与 Roadmap、Plan、Lesson、Agent 装载或教学判断。

用户直接访问 `/knowledge` 时，Server 仍返回稳定 KnowledgeSnapshot。三项全空时页面显示
诚实空状态：当前学习集没有预置静态资产，课程仍可使用学生提供的材料和教师准备的任务。
页面不伪造方法节点、题卡数量或“正在生成”的状态。

### 8.2 Doctor

Doctor 将最小启动集判为合法，缺少可选资产不产生 warn 或 fail。Doctor 仍调用完整
`readKnowledge()`，所以一个已存在但损坏的可选文件会使 `learning-set` 检查失败，并返回
精确路径与原因。是否在成功消息中显示静态资产数量属于展示细节，不新增第八个检查，也不
改变七项 Doctor 契约。

## 9. 错误与恢复边界

- 缺失可选资产不是错误，不触发自动修复、目录创建或网络下载。
- 损坏资产是错误，不静默跳过，也不删除用户文件。
- 一个题卡损坏时，不因其他题卡可读就把整个切片描述为健康。
- `graph/card-recall-index.tsv` 仍是题卡召回的可再生 sidecar，不成为启动前提。
- 没有题卡时不运行索引生成器；用户显式运行索引命令而没有卡时，现有明确失败可以保留。
- 已批准课堂明确依赖缺失资产时，由 Plan 对话处理来源变化；Runtime 不擅自把它改成内联题。
- 无资产路径中不新增 Scout 重试、父 Session 批量搜索或模型猜测路径。

## 10. 验收设计

### 10.1 空学习集自动化主路径

1. 只有 Guide 与 Roadmap 时，`readKnowledge()` 返回三个空集合。
2. Doctor、真实 Server 和 `/api/course`、`/api/knowledge` 正常。
3. 缺失可选路径通过；存在但损坏的方法树或题卡失败并报告精确文件。
4. Course 隐藏 Knowledge 主导航；直接 `/knowledge` 渲染诚实空状态。
5. Coach 可以创建完整内联 problem Block，`Uses` 为空。
6. Tutor 可以开始、教学、记录、推进、关闭 Lesson 并导出讲义。
7. 公共 E2E 的 Roadmap、Plan、Lesson 与讲义闭环不依赖题卡 fixture。

### 10.2 资产增强回归路径

1. 保留小型结构化题卡 fixture，继续验证方法树、题卡和材料可以分别加载。
2. card recall index 测试改用小型项目内 fixture，不以 519 卡语料作为公共工具测试前提。
3. Scout 的结构化召回、停止边界和非题卡材料路径保持现有测试。
4. 私有仓库继续单独验证 519 卡学习集；该语料测试与语料本身在 clean export 中同时排除。

### 10.3 真实模型无题卡闭环

从一份新的 `math-starter-m0` 副本开始，模拟一个真实、不知道该怎么学的学生：

```text
Roadmap 自然问诊
→ 学生确认首个 Plan
→ Plan 讨论并准备第一课
→ Coach 独立生成内联任务，不调用 Scout
→ Tutor 完成课堂并记录首次表现与帮助
→ Plan 直接读取关闭 Lesson，讨论并准备第二课
→ 第二课继续使用内联或学生提供内容
→ 完成首个 Plan
```

必须检查：

- 模型不会因为没有题库而拒绝备课；
- 不会把现场生成内容冒充为学习集题卡；
- 不会为了找不存在的资产枚举 `graph/`、`cards/` 或 `materials/`；
- 内联题数学正确、难度和教学作用符合已批准 Lesson；
- 两节课之间根据原始 Lesson 证据调整；
- 学生确认门、父子写入顺序、Plan-local Lesson 路径和 UI 生命周期全部守住。

## 11. 预期改动面

下面列出实施时的预期文件边界；详细步骤由后续 implementation plan 决定。

### 11.1 核心读取与投影

| 文件 | 预期变化 |
|---|---|
| `apps/studyforge/src/study/knowledge.ts` | 方法树缺失时返回空；保持存在但损坏时失败；提供轻量资产存在性判断 |
| `apps/studyforge/src/shared/contracts.ts` | 为 Course 投影增加不含资产内容的 `knowledgeAvailable` |
| `apps/studyforge/src/study/markdown.ts` 或 `workspace.ts` | 把轻量可见性投影装入 CourseSnapshot，不读取完整题卡 |
| `apps/studyforge/src/server/app.ts` | 继续返回稳定 KnowledgeSnapshot，并覆盖新的 Course 投影 |

### 11.2 前端

| 文件 | 预期变化 |
|---|---|
| `apps/studyforge/src/client/App.tsx` | 把 Knowledge 可见性传入壳层；直接路由仍可加载空快照 |
| `apps/studyforge/src/client/components/AppShell.tsx` | 接收可用主视图集合或 Knowledge 可见性 |
| `apps/studyforge/src/client/components/PrimaryViewNav.tsx` | 没有静态资产时只显示 Course |
| `apps/studyforge/src/client/pages/KnowledgePage.tsx` | 三项全空时渲染整页诚实空状态 |

### 11.3 默认路径与公开启动集

| 文件 | 预期变化 |
|---|---|
| `scripts/lib/doctor.ts` | 默认 Learning Set 改为 `examples/math-starter-m0/learning-set` |
| `examples/math-starter-m0/README.md` | 说明用途、最小契约、许可证和无预置资产事实 |
| `examples/math-starter-m0/LICENSE` | 示例学习内容的 CC BY 4.0 许可证文本或规范引用 |
| `examples/math-starter-m0/learning-set/LEARNING_GUIDE.md` | 项目原创的最小数学教学原则 |
| `examples/math-starter-m0/learning-set/ROADMAP.md` | 空 Plan Tree 与自然问诊起点 |

### 11.4 自动化测试

| 文件 | 预期变化 |
|---|---|
| `apps/studyforge/tests/m0/markdown-domain.test.ts` | 增加完全无静态资产与损坏可选资产的读取测试 |
| `apps/studyforge/tests/m0/knowledge-ui.test.tsx` | 增加整页空状态；保留资产丰富 fixture 回归 |
| `apps/studyforge/tests/m0/course-ui.test.tsx` | 验证 Knowledge 导航按可用性显示 |
| `apps/studyforge/tests/m0/server-api.test.ts` | 验证空 Knowledge API 与 Course 可见性投影 |
| `apps/studyforge/tests/m0/card-recall-index.test.ts` | 从私有 519 卡迁移到小型公共 fixture |
| `apps/studyforge/tests/m0/derivative-demo.test.ts` | 转为私有语料验收边界，后续 clean export 不包含 |
| `apps/studyforge/tests/e2e/fixture-server.ts` 与 fixture | 公共 E2E 改为无图谱、无题卡、无材料的内联课堂 |
| `apps/studyforge/tests/e2e/m0-cycle.spec.ts` | Knowledge 空状态和无题卡课程闭环 |
| `tests/release/doctor.test.ts` | 默认路径和最小学习集通过 |
| `tests/release/docs-contract.test.ts` | 新公开启动集与私有语料边界同时受保护 |

### 11.5 文档

预计更新 `README.md`、`README.en.md`、`AGENTS.md`、
`docs/architecture/m0-runtime.zh-CN.md`、`docs/guides/agent-assisted-setup.zh-CN.md` 与
`docs/guides/learning-set.zh-CN.md`，把公开默认路径、可空静态资产和私有内测选择方式写准。

### 11.6 明确不改

- Roadmap、Plan、Lesson 文档语法与生命周期 Runtime；
- Session identity、Plan-local Lesson 路径和 compaction；
- `classroom_log_append`、`classroom_update`、讲义导出；
- 结构化题卡 Schema、现有 Scout 检索算法和停止边界；
- 519 张私有题卡、方法图谱和私有课程数据；
- M1 记忆与自造学习集实现；
- 远端仓库、发布历史和 GitHub 可见性。

## 12. 完成标准

本设计的实施完成条件是：根目录默认启动公开 `math-starter-m0`，确定性检查和公共 E2E 全绿，
资产丰富路径没有回归，并且一次真实模型两课闭环证明 StudyForge 可以从没有图谱、题卡和
材料的学习集开始教学。完成这些条件仍不自动授权 clean export、公开 GitHub 仓库或发布；
那些动作继续由独立计划和明确批准控制。
