# StudyForge M1 本地教学 App

这是 StudyForge 当前唯一受支持的本地教学 App：一个 Markdown-first、单人运行的 Pi
教学工作台。学生即使没有 Roadmap、课程或预置资产，也能从自由学习直接开始；讨论中
经学生确认形成 Note、题卡和有证据边界的教师对象记忆。已有学习集仍保留 Roadmap、Plan、
Lesson 三级课程治理和 Block 课堂流程。

## 运行结构

```text
Free Learning Session ──→ Note / 题卡
          │
          └─────────────→ 对象记忆

Roadmap Session
  └── Plan Session
      └── Lesson Session

父节点需要历史
  → 从 memory/INDEX.md 找相关路线
  → read 对象 / 能力 / 偏好当前判断
  → 必要时按对象历史中的 Block ID 核对 Classroom Log
  → 作出下一步教学决定
```

自由学习是独立原生 Pi Session：允许多线程、可带学生明确选择的资产进入，并且只在学生
显式操作时结束。它不创建 Light Lesson、Classroom Log、Trace 或强制 Summary；对象记忆
可以在对话中发生真实认知变化时直接形成。

每个节点拥有独立原生 Pi Session。不同 Session 不复制聊天历史；Lesson 中真实发生的
对话、提示、纠正和决定直接追加到对应 Block 的 `Classroom Log`。每节课在唯一一次
正式课末反思后，直接向相关对象追加带时间和 Block 来源的 Learning History，并局部更新
明确偏好和 L0 路由；Plan 不再默认重读整课或重复采访学生。

长 Plan Session 不等待百万 token 窗口接近耗尽才整理上下文。当一次回复已经完整结束、
本轮成功写入 `plans/*/lessons/*.md`，且当前上下文达到 20 万 token 时，运行时调用 Pi 原生
compaction。压缩摘要只负责帮助同一个 Plan Session 接着工作，不是新的教学事实或
Handoff；需要细节时仍重新读取原始 Markdown，Pi JSONL 中的原始历史也不会被删除。
Roadmap、Lesson、失败写入以及仅修改 Plan 的回合都不触发这条规则。

模型只看到共享教学原则、当前角色、学习指南、紧凑的 `memory/INDEX.md` 和节点身份。
记忆召回只使用原生 `Read` / `Grep`，不增加 `recall_memory` 一类专用工具。Roadmap 与
Plan 使用原生文件工具；Lesson 的 Classroom Log / Block 仍由两个原子工具修改，原生
edit/write 被 Runtime 拦截；课堂事实、Block 变化和课末记忆分别使用绑定的原子工具。
启动时还可以给三个面向学生的节点统一装载一个人格表现层；人格只改变表达，不改变教学
职责和文档事实。

## 环境

- Bun 1.3+
- Pi `@earendil-works/pi-coding-agent`
- 已在 Pi 中配置可用模型

安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

安装 App 依赖并验证：

```bash
cd apps/pi-teaching-web
bun install
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts
```

## 直接启动

先构建前端，再指定 learning set：

```bash
cd apps/pi-teaching-web
bun run build
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run start
```

打开 <http://127.0.0.1:65000>。服务只监听 `127.0.0.1`。

### 可选教师人格

第一份可选人格是五条悟式导师。它让 Roadmap、Plan 和 Lesson 保持同一种轻松、
自信而有判断力的表达气质：

```bash
STUDY_PERSONA=gojo \
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" \
bun run start
```

不设置 `STUDY_PERSONA` 时继续使用简洁的中性教师语气。第一版没有前端人格选择器，
也不把人格偏好写进学习集或学生记忆；更换启动配置只影响之后新建或重新装载的
Session 资源。

开发模式：

```bash
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run dev:server
bun run dev:client
```

前端默认为 <http://127.0.0.1:65001>，并代理本地 API 与 WebSocket。

## 作为 Pi Package 使用

```bash
cd /path/to/highschool-study-claude-code/apps/pi-teaching-web
bun install
bun run build
pi install "$PWD"
```

进入包含 `learning-set/` 的目录并启动 Pi，然后运行：

```text
/study-web
```

也可以传入路径：

```text
/study-web /path/to/learning-set
```

## 学生流程

自由学习最小闭环：

1. 从首页直接“问老师”，或在学习资料页选择 Note / 题卡后进入讨论。
2. 真实认知变化出现时，Tutor 可直接更新对象记忆；普通闲聊不强制总结。
3. Tutor 公开拟保存内容，学生明确确认后才保存 Note 或题卡。
4. 学生显式结束线程；之后可重新打开题卡，先作答或选择“不会”，再看标准答案。
5. 学生可带着题卡和最近作答开启新线程，Tutor 按需使用相关对象记忆。

正式课程闭环保持不变：Roadmap 问诊与长期方向 → 学生启动 Plan → Coach 讨论并准备 Lesson
→ 学生启动 Lesson → Tutor 按 Block 教学与记录 → 学生结课 → Plan/Roadmap 回流。

浏览或刷新不会改变生命周期。Plan 状态只有
`prepared → active → completed`，Lesson 状态只有
`prepared → active → closed`；终态节点不重新打开，后续学习使用新的子节点。

## 页面与路由

主导航是“学习首页 / 学习资料 / 课程脉络（仅 Roadmap 存在时）”。

- **学习首页**：开始或恢复多个自由学习线程；不会为空白学习集伪造课程。
- **学习资料**：浏览、编辑和再次使用 Note 与题卡。
- **课程脉络**：课程树、中央对话、节点原文或课堂 Block。

```text
/home
/learn/:sessionId
/meta/:sessionId
/assets
/assets/notes/:noteId
/assets/problem-cards/:problemCardId
/assets/materials/:materialId
/footprint
/knowledge?focus=:semanticTag
/course
/course/plan/:planId
/course/plan/:planId/lesson/:lessonId
```

`/knowledge` 是从学习资料进入的局部语义关系视图：只从既有扁平标签和来源关系派生
确定性的邻域，不保存图坐标、边或第二份图谱事实。URL 只保留当前 `focus`；刷新、前进
后退和深链会恢复同一页面。课程 Session 从 frontmatter 恢复，自由学习从原生 Pi owner
恢复。

## Learning set 契约

```text
learning-set/
├── LEARNING_GUIDE.md
├── memory/INDEX.md
├── ROADMAP.md                         # 可选
├── plans/                             # 有正式课程时存在
│   └── <plan-id>/
│       ├── PLAN.md
│       └── lessons/<lesson-id>.md
├── memory/
│   ├── indexes/
│   ├── objects/
│   ├── capabilities/
│   └── preferences/
├── notes/*.note.yaml                  # 首次保存时创建
├── cards/m1b/*.card.yaml              # 薄题卡；旧完整题卡仍受支持
├── activity/problem-attempts/*.md     # 作答与答案查看只追加
├── graph/                             # 可选旧静态资产
└── materials/                         # 可选旧静态资产
```

真正空白的学习集只要求 `LEARNING_GUIDE.md` 与 `memory/INDEX.md`。资产 ID、路径、revision、
时间和来源由 Runtime 绑定；模型只提交教学内容。Flashcard 不是第三种对象，而是 Note 中
默认隐藏答案的 recall block。

Roadmap 存在时必须包含 `Overview`、`Long-term Goal`、可观察能力标准、`Test`、Plan Tree 和
当前位置。Plan 必须包含阶段目标、可观察能力标准、`Test`、Lesson Tree、当前位置和
下一课安排。Lesson 至少包含一个 Block：

```markdown
## Block block-001：活动名称

### Node State

- Kind: dialogue | problem | material | reflection
- Required: true | false
- Status: pending | active | completed | skipped
- Depends on:
- Uses:

### Student View

学生当前可以看到的内容。

### Teacher Control

教师备课说明；普通课堂面板不展示。

### Classroom Log

- 课堂中真实发生的一条记录。
```

对象记忆在课末直接追加本次变化及其来源：

```markdown
## Learning History

- 2026-08-08T20:15:00.000Z — 提示比较共同结构后完成；自主识别仍待检验。
  - 来源：[lesson-001](../../plans/plan-001/lessons/lesson-001.md) — Block `block-003`
```

自由学习中的对象记忆直接引用整个原生 Session，不伪造 Block 或消息级证据：

```markdown
- 2026-08-08T20:15:00.000Z — 学生独立区分了恒温下的 Ksp 与即时离子积。
  - 来源：原生自由学习 Session `free-session-001`
```

`memory/INDEX.md` 只保存当前前沿和稳定路径；L1 文件保存对象流变、跨对象能力假设和
明确偏好。旧 Log、旧 Learning History 和学生原话不回写，教学待办仍留在 Plan / Roadmap。

Plan ID 在 Roadmap 内唯一，Lesson ID 在所属 Plan 内唯一；Lesson Session key 使用
`lesson:<plan-id>:<lesson-id>`。严格解析器拒绝路径逃逸、父子身份不一致、同级重复 ID、
非法状态和旧版 Lesson 区块；
它不自动兼容旧 learning set。

## Agent 职责

- **Roadmap**：首次先介绍学习集，再一问一答地找到有价值的长期方向；只安排未来
  `prepared` Plan。
- **Plan**：先消费与刚关闭 Lesson 相关的 L1；只有缺失、冲突或高影响判断才按 Block ID
  下钻课堂。跨不同对象后才形成工作能力假设；私下检索题卡，不静默缩减商定内容。
- **Lesson**：按学生实际回答逐级提示，先验证不同路线；对方法名称没把握时询问
  学生；预案外表现确有需要时按需召回，课末只固化一次。
- **Free Learning Tutor**：保持发散讨论；只有学生看过拟保存内容并明确确认后才保存
  Note/题卡；只有本次表现真正改变未来教学判断时才写对象记忆。

教学文本位于 `resources/agents/`、`resources/skills/`、
`resources/teaching/teaching-core.md` 和
`resources/teaching/teacher-presence.md`。

## API 与事件

当前主要 HTTP API 包括：

- `GET /api/health`
- `GET /api/home`
- `GET|POST /api/free-learning`
- `POST /api/free-learning/:id/end`
- `GET /api/assets`
- `GET|PUT /api/assets/notes/:id`
- `GET /api/assets/problem-cards/:id`
- `PUT /api/assets/problem-cards/:id/note`
- `POST /api/problem-cards/:id/attempts|reveal|ask-teacher`
- `GET|POST /api/materials`
- `GET /api/materials/:id`
- `GET /api/materials/:id/revisions/:revision/locators/:locator`
- `GET /api/semantics/relations`
- `POST /api/semantics/query`
- `GET /api/footprint`
- `GET /api/course`
- `GET /api/knowledge`
- `GET /api/sessions/:key/history`
- `POST /api/sessions/:key/messages`
- `POST /api/plans/:planId/start|complete`
- `POST /api/plans/:planId/lessons/:lessonId/start|close`

`/events` 通过 WebSocket 传输原始教师文本、原生工具活动、运行状态、错误和文档
失效通知。教师文本不经改写并统一走 Markdown/KaTeX；普通工具只显示不含参数与结果的
安全回执，Material Scout、Lesson Reviewer 与可打印讲义使用专门的进展投影。

## 验收

确定性 E2E 分别覆盖正式课程闭环，以及空白学习集 → 自由学习 → 经确认保存资产 →
对象记忆 → 重启恢复 → 题卡作答/答案门 → 带作答再次问老师：

```bash
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts tests/e2e/m1c-cycle.spec.ts tests/e2e/m1d-ui.spec.ts
```

自动化通过后，仍应在复制出的学习集上跑真实模型长周期，重点观察课末是否只反思一次、
Plan 是否真正消费固化结果、能力假设是否跨对象成立，以及 L0 是否始终保持紧凑。
