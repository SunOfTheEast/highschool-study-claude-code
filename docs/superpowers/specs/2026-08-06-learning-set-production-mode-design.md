# StudyForge M1 学习集生产模式设计（化学首个学习集）

**状态：** 草案（第 1、2 节已经用户确认，全文待审阅）

**日期：** 2026-08-06

**实施路线：** App 内生产模式——StudyForge 增加与教学模式严格隔离的一等生产能力，
首个真实产出为化学首个学习集的单专题纵深切片（化学平衡）

## 1. 背景与核心判断

M0 阶段的产品设计已经收尾：Roadmap → Plan → Lesson 三级课程周期、文档原生记忆消融、
真实长周期终验（2 Plan / 5 Lesson，模拟学生）均已通过，开源发布硬化另有独立车道推进。

M1 阶段包含**两个独立子项目**：记忆系统与学习集生产。两者各自走独立的
spec → plan → 实施循环，不设计跨线接口。本设计只覆盖**学习集生产**。

学习集生产有四个已被确认的驱动力：

1. **化学第二学科**：愿景文档承诺化学是第二验证学科（记忆、联想、迁移与模型阶梯），
   但目前没有任何化学学习集、题卡或生产步骤；
2. **课堂内容资产化**：M0 终验全部课堂均使用教师内联题（`Uses` 为空），
   Material Scout 零真实调用，临场内容课后蒸发，学习集越用越瘦；
3. **真实使用扩张**：更多真实内容支撑长周期真实使用，这也是记忆系统未来最缺的
   证据来源；
4. **开源发布需要**：公开仓库需要来源干净、可 CC BY 再分发的示例学习集；现有
   519 张题卡来自仓库历史之外的私有扫描语料，没有可复现的生产路径。

现状事实：

- 仓库内**不存在任何题卡生产工具**：519 张题卡在首个公开提交中整体进入，
  唯一工具是 recall 索引重建脚本及其测试；
- Material Scout 是**纯检索**（读 vocabulary → grep TSV 索引 → 返回候选），
  从不生产题卡或材料，且在 M0 终验中从未被真实调用；
- 不存在"新学习集如何从零生产"的任何文档或流水线；
- 题卡 Schema（`highschool-study.problem-card.v1`）的字段名（goal/method/structure）
  本身学科通用，数学专属性只体现在冻结词汇与图谱内容上。

核心判断：学习集生产应当成为 StudyForge App 的一等能力（生产模式），而不是仓库
外围的脚本集合。课堂资产化未来长在同一套机制上；教学内核保持收敛，生产职责以
严格隔离的方式进入 App。管线从第一版就必须学科无关——它的第一个真实产出不是
数学洗数，而是化学首个学习集。

## 2. 目标

1. StudyForge App 增加与教学模式严格隔离的生产模式：生产者 Session、题卡生命周期、
   核验与终审、来源治理、生产页面。
2. 生产机制学科无关：不假设数学的方法树、冻结词汇或题卡内容。
3. 通过生产模式产出化学首个学习集：单专题纵深切片（化学平衡，含 Ksp），
   能支撑真实 Roadmap → Plan → Lesson 多课闭环。
4. 建立来源治理：逐来源记录许可状态与可再分发性，每张题卡的公开资格可推导、
   不返工。
5. 为课堂资产化预留接口契约（draft 状态、原子分配、评审入库通路），但首版不
   实施 Tutor 侧功能。
6. 以模拟学生长周期验收证明：化学切片可被真实教学链路使用，且生产全程可审计。

## 3. 非目标

- 不做记忆系统（M1 另一独立子项目，另行设计）；
- 不做课堂资产化的 Tutor 侧功能（只建接口契约）；
- 不做 519 张题卡的洗数与公开（开源发布阶段 B 另行；本设计的治理格式可被其复用）；
- 不做化学全范围覆盖（首版为单专题切片，不是完整学科）；
- 不做新的图谱渲染引擎（Knowledge 页只做最小 schema 分派）；
- 不做多用户、账号或权限系统（生产页是本地单用户 App 的教师侧入口）；
- 不修改教学契约：m0-document-contract、Roadmap/Plan/Lesson 生命周期、Block
  契约、Session 恢复机制全部不动；
- 不做自动公开/发布功能（是否公开化学集由后续治理决策决定）。

## 4. 总体架构与隔离边界

StudyForge 从"纯教学 App"变成"教学 + 生产双模式 App"。两种模式的关系是两条
不相交的河：

~~~text
生产模式（教师侧）                    教学模式（学生侧）
┌─────────────────────┐            ┌─────────────────────┐
│ Producer Session     │            │ Roadmap Session      │
│ （长期，绑定学习集根） │            │ Plan Session         │
│                      │            │ Lesson Session       │
│  起草 → 核验 → 终审   │            │                      │
└──────────┬──────────┘            └──────────┬──────────┘
           │ 写                                │ 读（仅 published）
           ▼                                   ▼
┌──────────────────────────────────────────────────────┐
│  Learning Set: cards/  graph/  materials/（资产区）    │
│                plans/   lessons/  ROADMAP.md（教学区） │
│                production/        PRODUCTION.md        │
└──────────────────────────────────────────────────────┘
~~~

五条不可逾越的隔离边界：

1. **职责隔离**：Producer Session 只生产资产（题卡/图谱/材料），永远不持有教学
   职责；教学 Session 永不写资产区。生产不是第四种课程节点，不进 Course 树。
2. **单写者**：Producer 是资产区的唯一写者；教学 Agent 对资产区只读，且只能读到
   `published` 状态的资产——草稿对教学过程不可见。这与 M0 单写者规则一样是协作
   纪律，不是权限系统。
3. **教学契约零改动**：文档契约、课程生命周期、Block 契约、Session 恢复机制全部
   不动。生产模式是新增，不是修改。
4. **学生体验隔离**：生产页面是本地单用户 App 里独立的顶部入口；Course/Knowledge
   页面结构不变；Knowledge 页只显示已入库资产。
5. **写入通路隔离**：资产区的任何写入（含题卡 ID/路径分配）走生产专用 Runtime
   通路，与教学文档写入通路分开。题卡 ID 由 Runtime 原子分配，直接吸收 M0 终验
   lesson-001 冲突的教训，不让模型扫目录猜号。

## 5. 生产者 Session 与生产工作流

### 5.1 挂载方式

学习集根新增 `PRODUCTION.md` 清单文件：

~~~md
---
id: production-chemistry-m0
kind: production
status: active
session_id: null
---

# 生产：chemistry-m0

## Current Blueprint

- production/blueprints/2026-08-chemical-equilibrium.md

## Batch State

- （批次表由 Producer 维护）
~~~

它是生产者 Session 的 owner 文档：Runtime 为生产模式增加独立打开通路（读取
PRODUCTION.md、校验 `status: active`、恢复或创建 `session_id`），不经过 Course
Tree。Session key 为 `producer:<learning-set-id>`。一个学习集一个长期 Producer
Session，类比 Roadmap Session 的长期性；生产对话记录就是该 Session 的原生记录。

### 5.2 静态资源与工具

Producer 注入：生产者角色说明（新增 `resources/agents/producer-node.md`）、题卡
Schema 契约、来源治理规则、生产 Skill（起草规范、批次纪律、Reviewer 调用协议），
并可 Read LEARNING_GUIDE 做教学对齐。**不注入任何教学 Skill**（roadmap-dialogue、
prepare-approved-lesson、tutor-lesson 等）。

工具：`read` / `grep` / `find` / `ls` / `edit` / `write` / `subagent`。
subagent 白名单只放生产 Reviewer（首版唯一），后续可加入来源提取 Scout。

### 5.3 生产工作流五步走

~~~text
① 专题蓝图 → ② 分批起草 → ③ Reviewer 核验 → ④ 用户终审 → ⑤ 入库
   （用户批准）   （draft 卡）    （有界子代理）     （生产页）    （published）
~~~

1. **专题蓝图**：任何批量生产前，Producer 与用户确认蓝图——图谱骨架、题卡规划
   （概念/计算/反模式/迁移的覆盖面与数量）、来源清单。蓝图写入学习集
   `production/blueprints/`。**蓝图必须经用户批准**——学生批准门哲学在生产侧的
   同构：未经确认不量产。
2. **分批起草**：按子专题分批（每批约 5–10 张），Producer 逐张起草，新卡一律
   `status: draft`。
3. **Reviewer 有界核验**：按批调用生产 Reviewer 子代理。吸收终验"200 秒深审"
   教训，上三道闸：
   - **范围有界**：只读工具；读取范围限于本批题卡与其引用的来源记录；
   - **深度分级**：常规卡轻审；新概念引入、模型阶梯升级点等关键卡才深审，关键卡
     由蓝图预先指定；
   - **输出结构化**：逐卡结论 pass/fix/reject + 决定性问题 + 最低必要修正，
     评审记录落盘到 `production/reviews/`。
4. **用户终审**：生产页展示草稿、Reviewer 结论与变更预览，用户逐批批准或退回
   （退回附评论 → 回到 `draft`）。
5. **入库**：批准后 `status: published` → Runtime 重建 recall 索引（只索引
   published）→ Knowledge 页经现有 `knowledge-invalidated` 机制自动刷新。

### 5.4 题卡状态机

~~~text
draft → verified → published
  ↑______ returned ______┘
~~~

- `draft`：Producer 起草中或退回后待改；
- `verified`：Reviewer 核验通过，等待用户终审；
- `published`：终审通过，对教学可见；
- `returned`：终审退回，附评论。

状态写在题卡自身 frontmatter 的 `status` 字段。对既有 519 张：**无 `status` 字段
视为 published**（祖父规则，不做批量迁移）。

题卡路径不因状态变化：草稿与已发布卡同目录（`cards/<topic>/`），可见性全部由
消费侧按 `status` 过滤——Knowledge 页数据、recall 索引构建、Scout 检索结果都只
包含 published（含祖父规则）。

### 5.5 题卡 ID 原子分配

Producer 不得自选 ID/路径。流程：

~~~text
Producer 申请 → Runtime 原子分配 content_item_id + 精确路径并创建占位
→ Producer 在占位文件上起草 → 提交时 Schema 校验（无有效占位即拒绝）
~~~

排他创建、单次占位、失败不留孤立文件。模型扫目录猜号在机制上不可能。

## 6. 化学题卡与图谱的学科泛化

化学学习集位于 `examples/chemistry-m0/`（逻辑路径，实施时可机械调整），结构遵循
M0 学习集契约：`LEARNING_GUIDE.md`、`ROADMAP.md`、`plans/`、`lessons/`、`cards/`、
`graph/`、`materials/`，外加生产要素 `PRODUCTION.md` 与 `production/`。化学平衡
是该学习集的第一个专题，后续专题在同一学习集内扩展。

### 6.1 题卡 Schema

化学题卡复用 `highschool-study.problem-card.v1`：字段名（goal/method/structure/
fallback/detail_terms）学科通用，数学专属性只在词汇内容。新增唯一字段
`status`（见 5.4）。

化学题卡的字段语义映射：

- `goal`：学习任务类型（解释关系、计算、比较、迁移判断）；
- `method`：方法或模型（如平衡常数表达、三段式、Q 与 K 比较、勒夏特列原理）；
- `structure`：题面结构特征（恒容/恒压、多平衡共存、图像给信息等）；
- `teaching_card`：识别线索、常见失败（反模式）、相近练习——直接承载愿景要求的
  模式与反模式教学；
- `source_evidence`：来源记录引用（见第 7 节）。

### 6.2 化学词汇

`graph/vocabulary.yaml` 使用新 schema id
`studyforge.learning_graph_vocabulary.chemistry.v1`。首版**不冻结**：词汇随生产
演进，变更必须经蓝图批准留痕；切片验收通过后再冻结。

### 6.3 化学图谱

愿景对化学提出的能力要求是记忆效率、联想效率、迁移效率，以及"先应试模型、后
科学模型"的模型阶梯。因此化学图谱不是方法树，而是**概念/模型树**：

- 新文件 `graph/concept_tree.yaml`，schema `studyforge.concept_tree.v1`；
- 节点：`id`、`label`、`parent_id`、`kind`（问题域/概念/模型/事实）；
- 模型节点可携带 `ladder` 元数据：`level`（exam / scientific）与
  `upgrade_triggers`（稳定表现、学生追问、反例冲突、后续依赖）——模型阶梯沉淀在
  图谱数据中，升级判断的 teaching 决策由 LEARNING_GUIDE 与 Skill 表达；
- Knowledge 页做**最小分派**：解析 `method_tree.v1` 或 `concept_tree.v1`，统一按
  树渲染；首版不为 ladder 做专门可视化。

首版不建 aliases（Scout 漏检真实出现时再加）、不建 mst_skeleton/HEATMAP 类的
手工多层图谱（YAGNI，等真实需要）。

### 6.4 recall 索引与校验工具

`graph/card-recall-index.tsv` 七列结构不变（path/goal/method/structure/
choice_count/part_count/stem）。`build-card-recall-index.ts` 需泛化两点：
按 `status` 过滤（只索引 published + 祖父规则），以及确认无数学硬编码（若有，
参数化学科词汇）。索引重建由入库动作触发（Runtime 调用模块函数，非 CLI）。

### 6.5 化学 LEARNING_GUIDE

化学学习集携带自己的 `LEARNING_GUIDE.md`，承载愿景 §5 的教学原则：

- 先让学生解释当前模型，再比较、再迁移、再反模式；
- 先形成可操作的高中应试模型；稳定表现、主动追问、反例冲突、后续依赖四类触发器
  成立时才升级为更深模型；
- 不把有条件近似永久教成无条件事实。

## 7. 来源治理与许可记录

数学集的 `materials/source-guide.md` 模式泛化为逐来源清单。

### 7.1 来源清单

化学集建立 `materials/SOURCES.md`，每个来源一条记录：

- 稳定 ID；
- 类型（教材 / 教辅 / 考题 / 原创 / 模型原创）；
- 作者或出版信息；
- 许可状态与可再分发性判断；
- 是否含改写；
- 核验状态。

### 7.2 题卡溯源

每张题卡的 `source_evidence.source_refs` 引用来源 ID；模型原创题标记为原创来源。
一张卡的公开资格 = 其全部来源记录均可再分发——公开决策可以推迟，但记录先行，
不返工。

### 7.3 私有来源边界

用户提供的私有资料（扫描件、教辅全文）**内容不入库**：仓库只保存来源记录、
页码/位置引用与核验状态，与数学集"原教材图片不在公开仓库中"的既有边界一致。
公开可分发材料可直接放入 `materials/`。

## 8. 课堂资产化车道（接口预留，首版不实施）

首版建成课堂资产化所需的全部接口契约：draft 状态、原子 ID 分配、评审入库通路。
未来车道：Tutor 课后将临场内联题整理为 draft 卡，经同一分配与评审流入库。

首版纪律：不得以课堂资产化为名给任何教学 Session 增加写资产区的权限；Tutor 侧
改动为零。

## 9. 前端

- 顶部导航新增第三个入口**生产**（`PRIMARY_VIEWS` 增加 `production`，路由
  `/production`）；
- 生产页包含：与 Producer 的对话区（复用 SessionKey 通用的聊天管线）、当前蓝图、
  批次列表、草稿预览与 Reviewer 结论、批准/退回操作、来源清单；
- Course、Knowledge 页面结构不变；Knowledge 只显示 published 资产；
- 生产页是本地单用户 App 的教师侧入口，不做账号与权限。

## 10. Runtime 改动点

1. SessionKey 空间增加 `producer:<learning-set-id>` 形态（`app.ts` 的 key 校验
   同步放行）；生产 Session 不是 Course 节点，不进入 NodeKind 生命周期；
2. `session-owner` 白名单与 owner 解析：新增经 `PRODUCTION.md` 的独立打开通路；
3. `resource-loader`：生产者角色文件与生产 Skill 装配（无教学 Skill）；
4. `session-scope`：Producer 工具集与 subagent 白名单护栏（仅生产 Reviewer）；
5. 新增端点：生产快照（蓝图/批次/草稿/来源）、批准与退回、题卡占位分配、索引
   重建触发；
6. `study/knowledge.ts`：`concept_tree.v1` 最小分派 + 题卡按 `status` 过滤；
7. `build-card-recall-index.ts`：`status` 过滤泛化。

## 11. 错误处理

保持 M0 直接风格：

- 题卡 YAML/Schema 校验失败：报告文件与字段错误，不自动修复；
- 占位分配冲突：报告真实冲突，不擅自换号；
- Reviewer 子代理失败或超时：批次标记为未核验，不静默放行，可重试；
- 索引重建失败：该批次不入库，保留旧索引，错误可见；
- `PRODUCTION.md` 缺失或损坏：生产模式不可用并明示原因，教学路径不受影响；
- 不静默降级，不提供兼容适配器。

## 12. 测试

- `tests/m0/production-*.test.ts`：Producer 资源装配（无教学 Skill）、Session key
  校验、占位分配原子性、状态机迁移、recall 索引的 status 过滤、subagent 白名单
  护栏；
- 服务端生产端点测试（仿 `server-api.test.ts` 的 fake registry）；
- 夹具：`tests/fixtures/` 扩展生产要素（PRODUCTION.md、draft/published 题卡各一、
  concept_tree.yaml 样例）；
- `tests/e2e/production-cycle.spec.ts`：生产对话 → 草稿 → 核验 → 批准 → Knowledge
  可见；
- `bun run check` 保持全绿。

## 13. 验收（模拟学生长周期）

复刻 M0 终验方法（隔离运行根、隐藏学生画像、安全停止条件、不可改写证据），分两段：

### 阶段 A：生产验收

通过生产模式产出化学平衡切片的全部内容：蓝图经用户批准 → 分批起草 → Reviewer
核验记录全部落盘 → 终审入库。全程可审计、可重放。

### 阶段 B：教学验收

隐藏画像的模拟学生（化学版：会背概念但说不清关系与边界的学生）在化学集上完成：

~~~text
首次 Roadmap 问诊 → Plan 物化并开始 → 多节 Lesson 完整授课、关闭与复盘
→ Plan 经确认收口 → 回流 Roadmap
~~~

判据：

1. 生命周期完整：无题卡/课程 ID 冲突，状态机全程合法；
2. 化学正确性：Reviewer 与终审记录支持，无已知的条件性错误被教成无条件事实；
3. 课程事实可信：Classroom Log 原位记录，父级沿 Tree 回读；
4. Scout 首次真实调用：至少一节备课使用未绑定学习集资产选题，验证化学词汇 +
   recall 索引的检索链路（M0 终验中 Scout 零调用的缺口在此补上）；
5. 备课与课堂时延如实记录，但沿用终验原则：不把功能通过扩大成性能通过。

切片规模以"支撑多课闭环"为准：题卡数十张量级，不是数百张。

## 14. 实施阶段

1. **阶段 1：生产机制**——Session 通路、PRODUCTION.md、原子分配、状态机、
   Reviewer 协议、治理格式、校验泛化、生产页最小 UI、测试；
2. **阶段 2：化学平衡切片生产**——蓝图 → 分批起草 → 核验 → 终审 → 全部入库；
3. **阶段 3：模拟长周期教学验收**——按第 13 节执行并出报告。

每个阶段独立制定实施计划；阶段 2 依赖阶段 1 的机制，阶段 3 依赖阶段 2 的内容。

## 15. 与开源硬化车道的协调

开源硬化车道与本设计触碰同一批文件（`session-scope`、`app.ts`、`resource-loader`
等），且硬化计划将把 `apps/pi-teaching-web/` 改名为 `apps/studyforge/`。

实施前必须确认硬化车道状态：

- 若改名已落定，本设计在新路径上实施；
- 若改名未落定，与硬化车道约定先后，避免两条车道并行改同一文件；
- 本设计文档中的路径均为逻辑路径，落地以实施时为准。

## 16. 已确认决策

- M1 的记忆系统与学习集生产为两个独立子项目，各自走 spec → plan → 实施循环；
- 学习集生产采用 **App 内生产模式**（生产是 StudyForge 一等能力），而非离线管线
  或纯手工起步；
- 四个驱动力全部成立：化学第二学科、课堂内容资产化、真实使用扩张、开源发布需要；
- 首个真实产出为**化学首个学习集**（管线从第一版学科无关）；
- 首版范围为**单专题纵深切片**：化学平衡（含 Ksp）；
- 来源为用户提供的资料 + 模型原创起草，逐来源记录许可状态；
- 生产方式为 **Agent 起草 + 独立 Reviewer 核验 + 用户终审**；
- 验收采用**模拟学生长周期**（复刻 M0 终验方法），真实学生使用随后自然发生；
- 课堂资产化首版只建接口契约，不实施 Tutor 侧功能；
- 第 1 节（总体架构与隔离边界）、第 5 节（生产者 Session 与生产工作流）已在
  讨论中逐节确认。
