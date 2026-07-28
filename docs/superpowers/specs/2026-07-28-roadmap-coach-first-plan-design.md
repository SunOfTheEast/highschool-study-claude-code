# Roadmap Coach 与首个 Plan 入口设计

状态：设计已确认，等待书面复核

日期：2026-07-28

## 一、问题

StudyForge 当前只有两类学生可见教学会话：

- 每个 Plan 一个 Coach Session；
- 每个已开始 Lesson 一个 Tutor Session。

这个边界适合日常学习，但空学习集存在一个闭环缺口：

```text
没有 Plan
  → 首页没有可进入的 Coach
  → 学生无法在产品内完成首次规划
  → 也就无法创建第一个 Plan
```

Plan 创建以后，学生偶尔还需要跨 Plan 回看整个学习集、解释长期方向或开启新周期。
这些行为不属于任何一个既有 Plan Coach，但频率很低，一整个学习集通常只发生数次。

本设计补充一个以 `ROADMAP.md` 为所有者的 Coach Session，使首次规划和低频全局规划都能
在产品内完成。它不增加第三种 Agent，也不把主页改造成常驻聊天工作区。

## 二、设计结论

StudyForge 继续只有两个 Agent 角色：

| 角色 | Session 粒度 | 职责 |
| --- | --- | --- |
| Coach | Roadmap 或 Plan | 规划、复盘、解释方向；Plan Coach 另负责备课 |
| Tutor | Lesson | 当前课堂的教学、评价、节点推进与 Trace 写入 |

Coach 根据 Session owner 获得两个不同工作范围：

```text
ROADMAP.md
  └── Roadmap Coach Session
        ├── 首次建立长期目标与第一个 Plan
        ├── 跨 Plan 回顾
        └── 开启新的学习周期

plans/<plan-id>.md
  └── Plan Coach Session
        ├── 当前 Plan 复盘与决策
        └── Lesson 备课

lessons/<lesson-id>.md
  └── Tutor Session
        └── 当前 Lesson 教学与课堂事实
```

Roadmap Coach 是同一个 Coach runtime 的 Roadmap scope，不是新的 Agent 类型、后台
Planner 或自动调度器。学生界面使用更自然的名称“总览与规划”。

## 三、Session 身份与恢复

### 3.1 持久引用

`ROADMAP.md` frontmatter 增加一条可选引用：

```yaml
roadmap_coach_session: <pi-session-id>
```

字段缺失或值为 `null` 表示尚未建立会话。学生第一次进入“总览与规划”时：

1. runtime 创建 Roadmap Coach Session；
2. 写入唯一 `studyforge.session-owner.v1`；
3. 立即把 Session ID 写回 `ROADMAP.md`；
4. 然后才返回历史与聊天界面。

刷新页面、重启本地服务或稍后再次进入时，runtime 只在 owner 三元组完全匹配时恢复：

```text
role: coach
ownerId: @roadmap
ownerPath: ROADMAP.md
```

内部 Session key 使用 `coach:@roadmap`。Plan ID 只允许小写字母、数字和连字符，因此
该 key 不会与 `coach:<plan-id>` 冲突。

缺失、损坏、重复或不匹配的 owner 元数据继续沿用现有规则：创建新 Session，并把新
引用写回 `ROADMAP.md`。不复制旧历史，不建立第二份会话数据库。

### 3.2 会话关系

Roadmap Coach 与各 Plan Coach 彼此独立：

- 不复制聊天历史；
- 不共享 Pi Session JSONL；
- 不把 Roadmap Coach 变成 Plan Coach 的父运行时；
- 只通过 `ROADMAP.md`、注册后的 Plan、带来源摘要和确认画像交接。

因此首次规划对话可以长期保留，而后续 Plan Coach 不会继承一整段全局讨论造成上下文
污染。

## 四、上下文装配

### 4.1 默认只读摘要层

Roadmap Coach 在作出全局判断或创建新 Plan 前，按以下顺序读取当前事实：

1. 学习集概述、学习原则与当前人设；
2. 完整 `ROADMAP.md`；
3. 已确认的学生画像与教学画像；
4. 每个 Plan 的 `Planning Basis`、`Current Position` 和 `Plan Summary`。

这些内容足以回答“这个学习集在学什么”“当前走到哪里”“下一周期为什么这样安排”。
它们也是向下查找原始记录的索引，而不是新的事实副本。

默认不批量装入：

- Lesson 正文或完整课堂 Session；
- 题卡题面、解答与私有 Teacher Control；
- 全量 Trace；
- Planner Attention 的全部明细。

### 4.2 按需下钻

当某个来源可能改变方向判断时，Roadmap Coach 才沿摘要链接读取对应 Lesson、active
Trace、题卡或学生原话。历史范围大、来源冲突且决定确实会改变方向时，可以使用现有
Evidence Scout；信息已经足够时不启动动态工作流。

本设计不增加 `study_context_get`、向量库、后台索引或自动召回服务。上下文通过
Roadmap scope 的 Skill 指导 Coach 使用现有读取与搜索能力取得，并在每次重大规划前
重新读取当前摘要，避免低频 Session 依赖数月前的陈旧上下文。

### 4.3 无历史时

空学习集没有可供研判的课堂事实。Roadmap Coach 应：

- 把学生自述视为尚未验证的起点；
- 共同确定长期目标、现实约束和可观察能力标准；
- 必要时把第一个 Plan 设计成短诊断周期；
- 不从题库结构、空画像或方法图谱反推出学生薄弱点。

## 五、职责与工具边界

### 5.1 Roadmap Coach 可以做什么

- 解释学习集目标、原则和 Plan 关系；
- 建立或在学生确认后修订 Roadmap 的长期目标、能力标准与测试；
- 跨 Plan 回顾累计进展；
- 讨论、创建并注册新的 Plan；
- 在信息不足时使用只读 Evidence Scout；
- 将最终决定写入 Markdown，并从写回后的文件重新读取后再报告。

### 5.2 Roadmap Coach 不能做什么

- 不能调用 `plan_update` 修改既有 Plan；
- 不能调用 `lesson_prepare` 备课；
- 不能替 Tutor 教当前 Lesson 或写入 Trace；
- 不能自动切换学生正在学习的 Plan；
- 不能未经学生确认创建、重排或改变学习周期；
- 不能把摘要、BKT 或 Planner Attention 当作自动规划判决。

若讨论结果只是调整当前 Plan 内的下一步，Roadmap Coach 应引导学生回到对应 Plan
Coach。若学生进入某个新 Plan，之后的复盘和备课均由该 Plan Coach 负责。

首版本沿用当前本地单人 runtime：Roadmap scope 不暴露 `plan_update` 和
`lesson_prepare`，并由 Skill 限定原生写入只用于学生确认后的 Roadmap 与全新 Plan。
本阶段不增加文件级权限沙箱或新的 Plan 编写工具。

## 六、第一个或下一个 Plan 的交接

完整流程为：

```text
学生进入“总览与规划”
  → 恢复或创建 Roadmap Coach Session
  → 讨论目标、历史与候选方向
  → 学生明确确认一个 Plan
  → Coach 写入严格的 plans/<plan-id>.md
  → 调用 plan_register
  → 重新读取 Plan 与 ROADMAP.md
  → 主页出现新 Plan
  → 学生点击后进入独立 Plan Coach Session
```

新 Plan 必须满足当前严格 Plan 契约：

- `Goal`
- `Observable Capability Standard`
- `Test`
- `Planning Basis`
- `Lesson Index`
- `Current Position`
- `Next Lesson Candidate`
- `Plan Summary`

在真实 Lesson 尚未创建时，`Lesson Index` 只写 `（暂无）`。新 Plan 的
`coach_session` 为 `null`；只有学生首次进入该 Plan 时，才建立自己的 Plan Coach
Session。Roadmap Coach 不替它预建 Lesson。

`Planning Basis` 承担最小而完整的交接：

- 为什么现在选择这个方向；
- 哪些学生陈述或真实来源改变了决定；
- 后续什么表现支持或推翻当前判断。

Roadmap Coach 的聊天全文不复制到 Plan Coach。若信息没有进入确认后的 Roadmap、
Plan 或带来源摘要，就不应被当作正式交接事实。

## 七、首页与路由

### 7.1 自适应入口

采用“会变轻重的规划条目”：

**没有 Plan 时**

- 首页把“和规划 Coach 建立第一个学习周期”显示为唯一主要操作；
- 学习集概述和研习原则仍然可见；
- 不显示空白 Plan 卡片或伪造的当前进度。

**已有 Plan 时**

- 原 Plan 列表和继续学习层级保持不变；
- 列表末尾保留低权重的“总览与规划”条目；
- 副文案为“回看全局 · 开启新的学习周期”；
- 不常驻聊天窗，不抢占当前 Plan 的主要入口。

### 7.2 独立页面

点击入口进入 `/roadmap`。页面复用现有 Coach 的聊天、消息投影、人设与深度工作流
组件，但不显示某个 Plan 的 SessionTree、Lesson Notebook 或 Plan 能力面板。

Roadmap Coach 注册新 Plan 后不自动切换页面。学生可以：

- 继续讨论；
- 返回主页查看新 Plan；
- 点击新 Plan，显式进入它的 Plan Coach。

浏览器刷新 `/roadmap` 时恢复同一个 Roadmap Coach Session。无效引用回到首页，并
沿现有 Session owner 规则在下次进入时建立新会话。

## 八、最小失败语义

### 8.1 会话创建失败

`roadmap_coach_session` 只在真实 Session 创建成功后写入。创建失败时主页仍可浏览，
已有 Plan、Coach 和 Tutor 不受影响。

### 8.2 Plan 发布失败

Coach 可以在 Session 中讨论和修改草案，但 Plan 只有在以下条件全部成立后才出现在
主页：

1. 严格 Plan 文件已经写入；
2. `plan_register` 返回成功 receipt；
3. 重新读取的 `ROADMAP.md / Plan Graph` 包含该真实链接。

校验或注册失败时保留原 Roadmap Coach Session，由 Coach 修正同一草案后重试。主页
不显示未注册文件，不增加 pending Plan 数据库或复杂事务系统。

### 8.3 Roadmap Coach 暂时不可用

它是低频入口，不是日常学习的前置依赖。Roadmap Coach 模型调用失败、Session 损坏或
页面不可用时，所有已经注册的 Plan 和 Lesson 继续正常工作。

## 九、最小实现范围

首版只包含：

1. `ROADMAP.md / roadmap_coach_session` 的读取与写回；
2. Roadmap scope 的 Coach Session 创建、恢复和工具裁剪；
3. Roadmap Coach 的摘要优先上下文与规划 Skill；
4. `/roadmap` 路由、API 和独立 Coach 页面；
5. 首页自适应“总览与规划”入口；
6. 新 Plan 注册后重新读取 Learning Set 的正常刷新。

明确不包含：

- 第三种 Agent；
- Roadmap Coach 常驻首页聊天区；
- 自动选择、自动切换或自动完成 Plan；
- 新数据库、向量检索、后台规则引擎或统一 context API；
- Roadmap Coach 与 Plan Coach 的历史复制；
- 为低频入口新建复杂草稿、重试或恢复系统；
- 修改题卡、Trace、能力投影或 Tutor 协议。

## 十、验收

### 10.1 空学习集

1. `Plan Graph` 为空时，主页显示主要规划入口而不是空白列表。
2. 进入后创建 Roadmap Coach Session，并把合法引用写回 `ROADMAP.md`。
3. 发送消息后刷新页面或重启服务，`/roadmap` 恢复相同历史。

### 10.2 Plan 创建

1. 学生确认前不注册 Plan。
2. 确认后生成满足严格契约的 Plan，初始 `Lesson Index` 为 `（暂无）`。
3. `plan_register` 成功并重新读取后，主页出现真实 Plan。
4. 点击新 Plan 才创建独立 Plan Coach Session；Roadmap 聊天历史不被复制。

### 10.3 权限

1. Roadmap scope 不暴露 `plan_update` 和 `lesson_prepare`。
2. Plan Coach 继续拥有当前 Plan 的更新与备课工具。
3. Tutor 的 Session、工具与 Trace 写入边界不变。

### 10.4 已有学习集

1. 已有 Plan 的主页只显示低权重“总览与规划”条目。
2. 多次进入恢复同一个 Roadmap Coach Session。
3. Roadmap Coach 不可用时，已有 Plan 与 Lesson 仍可进入。

## 十一、自审

- **是否增加了第三种 Agent？** 没有；只是给现有 Coach 增加 Roadmap owner scope。
- **是否让低频功能占据主页主视觉？** 没有；入口只在空学习集时突出，之后自动降级。
- **是否绕过 Plan Coach？** 没有；Roadmap Coach 只能开启周期，Plan 内复盘与备课仍归
  Plan Coach。
- **是否复制了长期记忆或聊天历史？** 没有；只读取现有摘要、画像与来源，正式交接写回
  Markdown。
- **是否引入了新的召回系统？** 没有；继续使用文件读取、现有搜索和按需 Evidence
  Scout。
- **是否为少见故障建设了防御系统？** 没有；只保留 Session owner 校验、严格 Plan
  注册和失败不发布三条现有边界。
- **是否影响已经注册的学习周期？** 没有；Roadmap Coach 是可选入口，现有 Plan 与
  Tutor 路径保持独立。
