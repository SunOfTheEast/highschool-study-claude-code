# StudyForge 三坐标学习工作台设计

状态：已通过口头设计，待书面审阅
日期：2026-07-30

## 一、结论

StudyForge 前端采用三个平级主视图：

```text
课程脉络
知识山河
研习留痕
```

三页不是三套产品，而是同一学习事实的三个观察坐标系：

```text
课程脉络
  看“按什么顺序学”

知识山河
  看“这些内容在数学体系中的位置”

研习留痕
  看“系统为什么这样判断和安排”
```

三页共享当前 Plan、Lesson、方法、题卡和来源定位。学生在一个视图中选中 Lesson
后，可以带着同一对象跳到另外两个视图：

```text
Lesson 004
├── 课程脉络：它位于哪个 Plan，前后有哪些 Lesson
├── 知识山河：它关联哪些主方法、次方法和题卡
└── 研习留痕：它为什么被安排，依据哪些 Handoff 和 Trace
```

真正上课时，学生进入课程页下的专注课堂子页面。顶层三视图导航保留，但课堂不被
三栏面板压缩。

设计采用“留白新中式”视觉语言：

- 课程页像学习卷轴；
- 知识页像方法山水图；
- 记忆页像可追溯的研习档案；
- 专注课堂像安静的书桌。

## 二、与节点化运行时的关系

本设计建立在
`docs/superpowers/specs/2026-07-30-hierarchical-learning-node-runtime-design.md`
之上，不替换其事实协议。

底层节点设计回答：

- 谁拥有当前 Roadmap、Plan、Lesson；
- Candidate、prepared、active 和 terminal 如何变化；
- 上下文、工具、文件和 Session 如何隔离；
- Trace、Handoff 和长期记忆如何写入。

三坐标工作台只回答：

- 学生如何理解和操作这些事实；
- 同一个对象如何在三种坐标系中被定位；
- 哪些私有教学信息需要安全投影；
- 如何让复杂架构看起来简单、自然和漂亮。

三页均为可重建投影，不成为新的事实所有者：

```text
Markdown / Trace / Session / Profile
                ↓
        Read-only projections
                ↓
课程脉络 / 知识山河 / 研习留痕
```

本设计不增加：

- 新数据库；
- 后台索引；
- 向量库；
- 第二套学习状态；
- 三套独立前端应用；
- 独立的“记忆数据库”；
- 前端直接写 Trace 或 profile 的通路。

## 三、目标与非目标

### 3.1 目标

- 让高中生不用理解 Markdown、Session、Handoff 等内部架构，也能知道当前学习方向；
- 让课程顺序、数学知识结构和个性化依据分别拥有充足的视觉空间；
- 让同一 Plan、Lesson、题卡或来源可以跨页保持定位；
- 让知识图谱展示数学骨架，同时叠加学生真正走过的路径；
- 让记忆页默认使用自然语言，但仍能逐层回溯到原始课堂事实；
- 让学生可以从结论发起异议，并回到有权限的 Coach 对话；
- 保留现有安全投影，不因跨页展示而提前泄露题目、方法或 Teacher Control；
- 用一个统一 App Shell 维持连续、完整的产品体验。

### 3.2 非目标

本设计不试图：

- 把知识图谱变成自动规划规则引擎；
- 把方法聚合分数包装成精确 mastery；
- 让学生直接编辑 Trace、Handoff 或长期画像文件；
- 在手机上复刻完整桌面图谱画布；
- 在三页中复制课堂聊天；
- 把所有功能都放在首页；
- 用大量 Dashboard 卡片取代真实空间关系。

## 四、方案选择

### 4.1 方案 A：三坐标工作台

三个平级主视图共享一个选择上下文；课程拥有专注课堂子路由。

采用本方案。

优点：

- 三页真正属于同一个产品；
- 跨页后不会丢失当前 Lesson；
- 每页只负责一种主要问题；
- 可以直接复用节点树、方法图谱和证据树；
- 不增加事实层。

代价：

- 需要统一路由和跨页选择协议；
- 三种 projection 必须共同遵守揭示与隐私边界；
- 当前 `App.tsx` 需要拆成 App Shell 和独立页面模块。

### 4.2 方案 B：三个独立页面

每页独立保存筛选和加载状态，只用普通链接互相跳转。

初期简单，但当前 Lesson 和来源定位容易丢失，长期会逐渐变成三套不一致的产品。

不采用。

### 4.3 方案 C：课程主页加两个覆盖面板

课程页保持唯一主页，知识与记忆只作为抽屉或覆盖层。

改动较小，但知识图谱和证据树没有足够空间，也无法形成三种平等的观察坐标。

不采用。

## 五、统一 App Shell

顶栏在三个主视图和专注课堂中始终存在：

```text
┌──────────────────────────────────────────────────────────────────────┐
│ StudyForge · 高阶导数学习集                                         │
│                                                                      │
│       [课程脉络] [知识山河] [研习留痕]        当前定位 · Lesson 004  │
└──────────────────────────────────────────────────────────────────────┘
```

App Shell 负责：

- 学习集身份；
- 三个主视图切换；
- 当前对象的学生安全名称；
- Presentation Persona；
- 连接状态；
- 返回当前学习位置；
- 全局错误和加载状态。

App Shell 不负责：

- 加载全部三页数据；
- 保存学习事实；
- 解释 Handoff；
- 管理课堂 Block；
- 推断方法掌握。

### 5.1 共享选择

三页共享一个浏览状态：

```ts
export type ViewSelection = {
  planId: string | null;
  lessonId: string | null;
  methodName: string | null;
  cardPath: string | null;
  evidenceSource: string | null;
  courseReturnRoute: string;
};
```

它只表示用户正在看什么，不写入：

- Roadmap；
- Plan；
- Lesson；
- Pi Session；
- profile；
- Trace；
- local learning state。

选择由 URL 和当前路由重建。浏览器可以记住最近成功打开的课程位置，但不能把它
当作事实。

### 5.2 路由

规范路由为：

```text
/course
/course/plan/<plan-id>
/course/plan/<plan-id>/lesson/<lesson-id>

/knowledge
/knowledge?plan=<plan-id>&lesson=<lesson-id>&method=<encoded-name>

/memory
/memory?plan=<plan-id>&lesson=<lesson-id>&source=<encoded-source-ref>
```

其中：

- `/course/plan/.../lesson/...` 是专注课堂或 terminal Replay；
- knowledge 和 memory 的 query 只用于当前选择；
- query 不授予额外文件权限；
- Runtime 仍根据真实 Session 和 Node scope 决定可见范围；
- 无效 query 被丢弃，页面本身仍可打开。

### 5.3 跨页返回

从专注课堂切到知识或记忆页时：

- 保留当前 Lesson；
- `courseReturnRoute` 指向原课堂；
- 返回课程页时恢复课堂或原树位置；
- 不重新创建 Session；
- 不复制聊天历史。

## 六、课程脉络页

### 6.1 页面职责

课程页回答：

1. 我在学什么；
2. 当前到哪里；
3. 下一步可能去哪；
4. 为什么当前 Plan / Lesson 存在；
5. 怎样进入 Coach、课堂或 Replay。

它是默认首页。

### 6.2 布局

```text
┌──────────────┬──────────────────────────────────┬─────────────────┐
│ Roadmap 树   │ 当前 Plan 的 Lesson 编排         │ 节点详情        │
│              │                                  │                 │
│ Plan 分支    │ 已完成 → 当前 → prepared         │ 公开目的        │
│ Lesson 节点  │ candidate 分支                   │ 活动结构        │
│              │                                  │ 安排依据        │
│              │                                  │ 跨页入口        │
└──────────────┴──────────────────────────────────┴─────────────────┘
```

左侧展示全局管理树，中央强调当前 Plan，右侧解释当前选择。

### 6.3 学生状态语言

Runtime status 投影为：

| Runtime | 学生界面 |
|---|---|
| candidate | 可能的下一步 |
| prepared | 已准备，可以开始 |
| active | 正在进行 |
| paused | 已暂停，可以继续 |
| completed / closed | 已完成 |
| abandoned | 历史记录 |

Candidate：

- 只显示公开目的；
- 没有 Session；
- 没有“开始”按钮；
- 不显示 `Consider when`、Sources 或 Private note；
- 使用较轻的树梢纸签视觉。

Prepared：

- 显示安全标题或安全替代标题；
- 显示公开目的和活动形状；
- 可以开始；
- 可以要求重新备课；
- assessment / diagnostic 继续遵守防剧透投影。

Active / Paused：

- 进入原 Tutor Session；
- 不从父节点重备；
- 不显示父节点私有教学判断。

Terminal：

- 查看总结、Handoff 的学生安全解释和 Replay；
- 不恢复成可写 Agent Session；
- 视觉上属于历史主干，不被删除。

### 6.4 交互

Plan 节点：

- 打开 Plan Coach；
- 展示其 Lesson Tree；
- 查看阶段目标与可观察能力标准；
- 跳到该 Plan 的知识轨迹或记忆总结。

Lesson 节点：

- 查看公开目的和活动结构；
- prepared 时开始或请求重备；
- active / paused 时继续；
- terminal 时查看 Replay；
- 跳到知识位置；
- 跳到安排依据。

Roadmap 根：

- 打开 Roadmap Coach；
- 查看跨 Plan 方向；
- 商议新的 Plan；
- 查看跨周期记忆。

### 6.5 动态编排

Lesson 结束后：

```text
Lesson Handoff
  → 返回原 Plan Coach
  → Coach 与学生复盘
  → 修改 candidate / prepared siblings
  → Course projection 刷新
```

树的变化使用轻量动效表达：

- 新 Candidate 像新枝条出现；
- replan 只重排未激活分支；
- active 和 terminal 节点位置稳定；
- 不用动画掩盖状态写入失败。

## 七、专注课堂子页面

课堂不是第四个主视图，而是课程脉络下的执行子页面。

### 7.1 布局

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 固定 App Shell                                                       │
├──────────────────┬────────────────────────────────┬──────────────────┤
│ Lesson 导航      │ Tutor 对话                     │ 当前课堂本       │
│ 当前 Block       │ 学生输入                       │ 题面 / 材料      │
│ 可见活动进度     │ 结构化课堂事件                 │ 已揭示来源       │
└──────────────────┴────────────────────────────────┴──────────────────┘
```

课堂主体优先级：

1. 当前学生—Tutor 对话；
2. 当前可回答的 Student View；
3. 当前 Block；
4. 已揭示材料；
5. 课堂进度。

不把完整 Course Tree、Knowledge Graph 或 Memory Lineage 塞进课堂。

### 7.2 顶栏切换

课堂期间可以切换到知识或记忆页，但：

- 未揭示题卡和方法仍不可见；
- Session 继续由 Runtime 管理；
- 页面切换不等于暂停；
- 返回后继续原消息和 Block；
- 学生明确结束仍使用 Lesson close，而非离开路由。

## 八、知识山河页

### 8.1 页面职责

知识页回答：

1. 学习集的数学方法骨架是什么；
2. 当前 Lesson 在骨架中的什么位置；
3. 哪些题卡和材料挂在方法上；
4. 学生真实走过哪些方法路径；
5. 当前判断的证据和边界是什么。

它不是内容目录换皮，也不是 mastery 仪表盘。

### 8.2 底图

底图严格来自公共资产：

```text
graph/method_tree.yaml
cards/**/*.yaml
materials/**
```

方法关系只使用学习集正式骨架：

- primary method；
- secondary / supporting method；
- 题卡绑定；
- 材料引用。

不从学生 Trace 反向修改公共方法图谱。

### 8.3 学生轨迹覆盖层

个人学习轨迹来自 active Trace：

```text
Trace
→ card
→ card primary / secondary methods
→ method evidence projection
```

视觉只表达：

- 尚未观察；
- 已有记录但仍需观察；
- 多张不同题卡上表现较稳定；
- 当前 Lesson 正在涉及；
- 来源后来被更正。

不显示：

- 精确 mastery 百分比；
- 自动“已掌握”判决；
- 固定学习风格；
- 由一张题卡产生的稳定能力标签。

方法聚合内部仍可用于排序，学生文案明确它是关注信号。

### 8.4 布局

```text
┌──────────────┬──────────────────────────────────┬─────────────────┐
│ 方法分区     │ 可平移的方法骨架                 │ 方法详情        │
│              │                                  │                 │
│ 主题筛选     │ primary / secondary 节点         │ 题卡            │
│ Plan / 时间  │ 当前 Lesson 投影                 │ Lesson          │
│ 图例         │ 学生真实路径                     │ Trace 边界      │
└──────────────┴──────────────────────────────────┴─────────────────┘
```

首版不引入第三方通用 DAG 编辑器。图谱只读，可以：

- 平移；
- 缩放；
- 聚焦；
- 按主题、Plan、时间筛选；
- 点击节点；
- 沿来源跳转。

### 8.5 方法详情

方法详情展示：

- 方法在正式骨架中的父子位置；
- 以它为 primary 的题卡；
- 以它为 secondary / supporting 的题卡；
- 涉及它的 Lesson；
- active Trace 的题卡数量、支持条件和来源；
- 当前状态的自然语言边界；
- 跳回课程；
- 跳到记忆来源。

### 8.6 当前 Lesson 投影

当前 Lesson 可以投影到方法图上，但必须遵守 reveal policy：

- closed Lesson 可以显示真实已使用方法；
- active Lesson 只显示已揭示 Block 的方法和题卡；
- prepared assessment / diagnostic 不显示隐藏方法或题卡；
- 普通专题课可以显示学生已经被允许知道的能力目标与题号；
- Teacher Control 中的候选路线永不进入学生知识页。

因此跨页定位不能成为剧透旁路。

## 九、研习留痕页

### 9.1 页面职责

记忆页默认面向学生，回答：

1. 系统记住了什么；
2. 这是长期记忆、阶段发现还是待验证问题；
3. 判断来自哪些课堂；
4. 它怎样改变了后续教学；
5. 如果不准确，学生怎样提出异议。

默认不把学生放进技术审计器。

### 9.2 三类内容必须分开

```text
已确认长期记忆
  student-profile / teaching-profile

阶段性发现与开放问题
  Roadmap / Plan / Lesson Handoff

原始课堂事实
  active Trace / Session message / Card / Block
```

普通能力结论不会因为出现在记忆页就升级成 profile。

### 9.3 结论优先的展开顺序

默认从当前结论向下展开：

```text
长期记忆 S3
  → Roadmap Claim
    → Plan Claim
      → Lesson Claim
        → Trace / Session / Card / Block
```

时间线只作为筛选：

- 本课；
- 本 Plan；
- 跨 Plan；
- 全部历史。

它不取代来源树。

### 9.4 布局

```text
┌──────────────┬──────────────────────────────────┬─────────────────┐
│ 记忆目录     │ 结论到原始事实的来源链           │ 来源详情        │
│              │                                  │                 │
│ 已确认       │ Roadmap Claim                    │ 学生原话        │
│ 阶段发现     │ → Plan Claim                     │ 实际支持        │
│ 待验证问题   │ → Lesson Claim                   │ 题卡 / 方法     │
│ 时间筛选     │ → Trace                          │ 边界            │
└──────────────┴──────────────────────────────────┴─────────────────┘
```

### 9.5 学生安全投影

默认显示自然语言：

> 多条路线都可行时，先比较计算代价，比直接开始展开更稳定。

技术来源放在可展开详情中：

- Claim ID；
- Trace ID；
- 文件路径；
- Session message ID；
- active / invalidated；
- supersedes。

学生默认看不到：

- Teacher Control；
- 未揭示答案；
- 私有候选路线；
- Coach 对学生可能失败方式的预测；
- Deep Workflow 子 Agent 原始结果；
- 完整系统 prompt；
- 原始 Pi JSONL。

Teaching Claim 默认不逐字投影。页面只显示经过学生安全改写的“教学安排说明”，
完整 Claim 保留在 Coach / raw-stream 诊断面。

### 9.6 来源失效

若底层 Trace 被 supersede：

- 历史 Claim 文本保留；
- 来源链标记 invalidated；
- 学生看到“这条判断依赖的课堂记录后来被修正”；
- 当前规划不再使用它；
- 不自动重写全部历史叙事；
- 新长期记忆不能引用失效来源。

### 9.7 提出异议

每条长期记忆、阶段结论和原始 Trace 均提供“提出异议”。

点击后：

1. Runtime 根据 source 找到当前有权限承接讨论的 Coach；
2. 跳到对应 Coach Session；
3. 输入框预填学生安全问题和规范 source handle；
4. 学生补充自己的异议；
5. Coach 复核来源；
6. 实际更正仍使用现有受权流程；
7. UI 在成功事实回执后刷新。

页面不直接：

- 改 Markdown；
- 删除 Trace；
- 覆盖 profile；
- reopen terminal Tutor；
- 把“已提出异议”伪装成“已更正”。

若当前版本没有可写的更正 owner，Roadmap Coach 承接讨论并明确下一步；按钮不能声称
已完成更正。

## 十、跨页映射

### 10.1 Course → Knowledge

输入：

```text
planId
lessonId
```

解析：

- Lesson 已揭示 Block；
- Lesson 题卡 alias；
- 卡片 primary / secondary methods；
- active Trace methods；
- reveal policy。

输出：

- 当前方法节点；
- 当前题卡；
- Lesson 投影标记；
- 可公开的学习轨迹。

### 10.2 Course → Memory

输入：

```text
planId
lessonId
```

解析：

- Activation Snapshot 中的来源；
- 当前或 sealed Handoff；
- 当前 Lesson active Trace；
- 相关 confirmed memory。

输出：

- “为什么安排这节课”；
- 适配依据；
- 来源树；
- 边界。

### 10.3 Knowledge → Course

输入：

```text
methodName
cardPath
```

解析：

- 相关 Trace 的 lessonId；
- 当前 Plan 优先；
- 公开 Lesson title。

输出：

- 使用该方法的 Lesson 列表；
- 跳回某节课程；
- Replay 或 Coach 入口。

### 10.4 Knowledge → Memory

输入：

```text
methodName
trace source
```

输出：

- 方法状态来自哪些 Trace；
- 每条记录的 assessment、support、card；
- 依赖该记录的 Handoff Claim；
- 失效边界。

### 10.5 Memory → Course / Knowledge

Claim 或 Trace 可以反查：

- planId；
- lessonId；
- blockId；
- cardPath；
- method binding。

UI 只使用 Runtime 返回的规范映射，不从字符串猜文件或节点。

## 十一、Projection 契约

### 11.1 Course

```ts
export type CourseViewProjection = {
  learningSet: {
    title: string;
    overview: string;
    goal: string;
  };
  roadmap: PublicTreeNode;
  plans: PublicTreeNode[];
  selectedPlan: PublicPlanView | null;
  selectedLesson: PublicLessonView | null;
  continueTarget: PublicContinueTarget;
};
```

### 11.2 Knowledge

```ts
export type KnowledgeNodeState =
  | 'unobserved'
  | 'observed'
  | 'more-stable'
  | 'invalidated';

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  role: 'root' | 'primary' | 'secondary';
  state: KnowledgeNodeState;
  evidenceCount: number;
  distinctCardCount: number;
  selected: boolean;
};

export type KnowledgeViewProjection = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  lessonPins: PublicLessonPin[];
  selectedMethod: PublicMethodDetail | null;
  filters: PublicKnowledgeFilters;
};
```

`more-stable` 是学生界面文案，不是自动 mastery。

### 11.3 Memory

```ts
export type MemoryViewProjection = {
  confirmed: PublicMemoryItem[];
  stageFindings: PublicFinding[];
  openQuestions: PublicOpenQuestion[];
  selectedSource: string | null;
  lineage: PublicEvidenceNode | null;
  detail: PublicEvidenceDetail | null;
  filters: PublicMemoryFilters;
};
```

### 11.4 共享原则

- projection 没有自由写入 API；
- 所有 source 都由 Runtime 生成或验证；
- 前端不能请求超出 Session / reveal scope 的详情；
- 缺少可选信息时省略，不回退私有文本；
- WebSocket 更新投影，不发送第二份事实。

## 十二、前端组件边界

现有巨型 `App.tsx` 拆成：

```text
AppShell
├── PrimaryViewNav
├── CurrentSelectionChip
├── CoursePage
│   ├── CourseTree
│   ├── PlanStage
│   └── CourseInspector
├── FocusedClassroomPage
├── KnowledgePage
│   ├── MethodFilters
│   ├── MethodLandscape
│   └── MethodInspector
└── MemoryPage
    ├── MemoryDirectory
    ├── EvidenceLineage
    └── EvidenceDetail
```

组件只接收 projection 和事件回调，不自己读取文件。

### 12.1 可复用现有组件

- `ChatPanel`：专注课堂；
- `SessionTree`：改造成课程树中的 Session projection；
- `AbilityMap`：方法详情中的证据摘要，不再承担整页图谱；
- `EvidenceLens`：演进为 `EvidenceDetail`；
- `ContextStack`：保留在 Coach / 诊断面，不成为三页主导航；
- `LessonReadyCard`：prepared Lesson 详情；
- `ReplayTimeline`：terminal Lesson。

### 12.2 不复用的边界

不把：

- `RouteMap` 直接扩张成通用知识图；
- `EvidenceLens` 直接扩张成整个记忆页面；
- `SessionTree` 直接同时承担 Roadmap、知识和记忆导航；
- `App.tsx` 继续堆积三页全部加载和交互。

## 十三、数据加载与刷新

三个主视图按路由懒加载：

```text
/course     → CourseViewProjection
/knowledge  → KnowledgeViewProjection
/memory     → MemoryViewProjection
```

首版允许增加三个只读 view endpoint，或由现有 endpoint 组合，但最终前端不得自行理解
Markdown。

推荐接口：

```text
GET /api/views/course
GET /api/views/knowledge
GET /api/views/memory
```

query 使用规范 selection。服务端：

- 校验 selection；
- 应用 reveal / scope policy；
- 读取事实；
- 返回学生安全 projection。

写入仍走现有工具和 Runtime。

事实变化后：

```text
Trace append / supersede
Node activate / close
Handoff seal
Memory apply
        ↓
WebSocket snapshot / projection event
        ↓
当前可见页面刷新
```

不在首版增加后台预计算。

## 十四、安全与隐私

### 14.1 安全投影统一

三个页面共同调用同一 reveal policy，不各写一套：

- assessment / diagnostic 不提前显示方法和题卡；
- prepared Lesson 不泄露 Teacher Control；
- closed Lesson 可以显示已发生事实；
- raw-stream 仍是本地诊断选项；
- 默认学生页始终 safe。

### 14.2 URL 不是权限

学生手工修改：

```text
?source=...
?lesson=...
?method=...
```

不会扩大数据范围。无权限 selection 返回空选择或安全错误。

### 14.3 来源详情

默认自然语言，技术详情按需展开。技术详情可以显示：

- 稳定 source handle；
- active / invalidated；
- occurredAt；
- assessment；
- support；
- card / block；
- boundary。

不显示：

- 系统 prompt；
- API key；
- 完整 JSONL；
- 未显示的题解；
- 私有 Agent reasoning；
- 子 Agent raw result。

## 十五、空状态与失败处理

### 15.1 课程页

- 尚无 Plan：显示 Roadmap 问诊入口；
- 有 Candidate 无 prepared：说明 Coach 正在与学生商议；
- prepared 无法开始：保留节点，显示可理解错误；
- 路由节点已不存在：回到最近真实父节点。

### 15.2 知识页

- 无 Trace：展示完整公共方法骨架，个人轨迹为空；
- 方法没有题卡：保留节点，不编造资产；
- 选中方法不存在：清除选择，不清空整页；
- projection 失败：课程与课堂不受影响。

### 15.3 记忆页

- 无长期记忆：显示“尚未形成经你确认的长期记录”；
- 有 Handoff 无 profile：显示阶段发现，不升级；
- source-only Handoff：显示原始来源，不展示虚构结论；
- invalidated：保留历史、标记失效；
- 来源不可读：显示缺失，不用相邻来源猜内容。

### 15.4 网络与刷新

- 每页有独立 loading skeleton；
- App Shell 保持可见；
- WebSocket 断开不清除已加载 projection；
- 重连后重读当前 URL；
- 错误不创建学习事实。

## 十六、视觉设计系统

### 16.1 总体气质

采用“留白新中式”：

| 视觉元素 | 用途 |
|---|---|
| 宣纸暖白 | 页面底色 |
| 墨绿 / 玉色 | 主结构、active、可信来源 |
| 朱砂红 | 当前选择、课堂入口、关键来源 |
| 低饱和金 | 教学洞见、边界、适配说明 |
| 宋体 | 标题、结论、引用 |
| 现代黑体 | 正文、操作、数据 |

### 16.2 三页空间隐喻

#### 课程脉络

- 树与卷轴；
- 节点沿学习顺序展开；
- Candidate 像远处纸签；
- active 像当前落笔位置；
- terminal 是稳定墨迹。

#### 知识山河

- 方法骨架像山脉与支流；
- primary 是主峰；
- secondary / supporting 是支脉；
- 题卡和 Lesson 是挂点；
- 个人轨迹像走过的路线。

#### 研习留痕

- 来源链像档案索引；
- 结论在上，原始记录在下；
- active 来源清晰；
- invalidated 来源淡化但不消失；
- 学生原话使用阅读感更强的引用版式。

### 16.3 不做 Card Soup

每页只保留一个主要视觉主体：

- Course Tree；
- Method Landscape；
- Evidence Lineage。

右侧 Inspector 是辅助，不把页面切成十几个统计卡。

### 16.4 动效

动效只解释结构：

- Lesson 完成后新分支出现；
- 跨页时当前选择保持；
- Handoff 来源逐层展开；
- supersede 后旧来源淡化；
- 图谱聚焦使用平滑位移。

不使用：

- 装饰性粒子；
- 强烈弹跳；
- 大面积自动播放；
- 会影响数学阅读的背景动画。

支持 `prefers-reduced-motion`。

## 十七、响应式与可访问性

桌面端是首要体验。

### 17.1 宽屏

使用三段式布局和完整知识画布。

### 17.2 中等宽度

- 左栏收窄；
- 右侧 Inspector 变为抽屉；
- 主体仍保持树或图。

### 17.3 窄屏

- Course Tree 变为缩进单列；
- Knowledge Graph 变为可聚焦的层级列表；
- Memory Lineage 变为单列来源链；
- Focused Classroom 只保留对话与当前活动；
- 不在手机上强塞完整画布。

### 17.4 可访问性

- 状态不只靠颜色；
- 键盘可遍历节点；
- 图谱节点有可读名称和详情列表替代；
- 来源树使用语义层级；
- reduced motion；
- 正文保持足够对比度和字号；
- 数学公式继续使用 KaTeX。

## 十八、测试

### 18.1 Projection

- Course projection 只含公开节点字段；
- Knowledge projection 正确聚合 primary / secondary；
- active Trace 和 distinct card 语义正确；
- Memory projection 区分 confirmed / stage / open question；
- invalidated 来源不能进入当前规划；
- prepared assessment 不泄露方法。

### 18.2 路由与选择

- 三页切换保持 plan / lesson；
- Method 可以回到相关 Lesson；
- Claim / Trace 可以回到正确 Plan / Lesson；
- 刷新恢复 URL selection；
- 非法 selection 清除而不崩溃；
- URL 不扩大 scope。

### 18.3 UI

- Candidate 没有开始按钮；
- prepared 有学生启动入口；
- terminal 进入 Replay；
- 技术来源默认折叠；
- “提出异议”回到正确 Coach 并预填 source；
- safe 页面不显示 Teacher Control。

### 18.4 E2E

完整流程：

```text
Course 选 Lesson
→ Knowledge 查看方法位置
→ Memory 查看安排依据
→ 返回 Course
→ 开始专注课堂
→ 完成 Lesson
→ 返回更新后的 Course Tree
→ Memory 查看新 Handoff
```

### 18.5 视觉验收

不做像素快照作为主要测试。使用 Playwright：

- 检查三种典型宽度；
- 检查遮挡、滚动、焦点和 reduced motion；
- 为三页各保存一张人工审阅截图；
- 使用真实导数学习集内容，不用 Lorem Ipsum。

## 十九、复杂度控制

这项设计只增加必要复杂度：

### 必要

- 三个路由级页面；
- 共享 ViewSelection；
- 三个只读 projection；
- 跨页规范映射；
- 学生安全来源投影；
- App Shell 拆分。

### 不必要，首版不做

- 通用图布局引擎；
- 后端图数据库；
- 复杂动画框架；
- 三页独立状态管理器；
- 知识图谱编辑器；
- 自定义时间轴数据库；
- 前端直接纠错工具；
- 移动端完整画布；
- 可分享公共 URL。

### 与节点化实施计划的关系

现有
`docs/superpowers/plans/2026-07-30-hierarchical-learning-node-runtime.md`
中的 Task 13 已包含公开树和 Handoff 下钻，但范围不足以覆盖完整三坐标工作台。

正式实施时有两种安全方式：

1. 在节点 Runtime 的事实、Handoff、Trace 和 projection contract 完成后，执行独立的
   三坐标前端计划；
2. 修订原 Task 13，使其只建立基础 projection 和 App Shell，再由独立计划完成三页。

推荐第二种。不要在节点事实层尚未稳定时并行实现最终三页，否则前端会反复追逐变动
中的 schema。

## 二十、完成标准

以下条件同时满足时，三坐标工作台完成：

- 三个平级主视图使用统一 App Shell；
- Course 是默认首页；
- 真正上课进入专注课堂子页面；
- 三页共享当前 Plan、Lesson、方法和来源定位；
- Course 能展示 Roadmap → Plan → Lesson 的真实控制树；
- Knowledge 使用正式方法骨架并叠加 active Trace 学习轨迹；
- Memory 默认自然语言，能逐层回溯到原始事实；
- 异议回到有权限的 Coach，不直接编辑事实；
- 跨页映射不泄露未揭示题目、方法或 Teacher Control；
- 刷新可以恢复当前视图和选择；
- 三个页面没有重复事实所有权；
- 没有数据库、后台索引、通用图引擎或自动 mastery；
- 桌面端具有完整、统一、克制且明显区别于管理后台的视觉品质；
- 窄屏拥有可用的层级降级；
- 真实导数学习集 E2E 能完成课程 → 知识 → 记忆 → 课堂 → 新 Handoff 的闭环。
