# StudyForge M1 本地教学 App

这是 StudyForge 当前唯一受支持的本地教学 App：一个 Markdown-first、单人运行的 Pi
教学工作台。它保留 Roadmap、Plan、Lesson 三级课程治理和 Block 课堂流程，并加入
学习集内、可追溯、渐进式披露的教师笔记记忆。记忆不是聊天摘要或静态学生画像；它服务
下一次真实教学判断。

## 运行结构

```text
Roadmap Session
  └── Plan Session
      └── Lesson Session

父节点需要历史
  → 从 memory/INDEX.md 找相关路线
  → read 对象 / 能力 / 偏好当前判断
  → 必要时按对象历史中的 Block ID 核对 Classroom Log
  → 作出下一步教学决定
```

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
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
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

1. Roadmap Session 先介绍学习集的目的、范围与价值，再逐步问诊。
2. 学生打开一个 `prepared` Plan 并点击“开始这一阶段”。
3. Plan Session 读取当前 Plan 和相关对象记忆，讨论并准备下一课；必要时才核对来源 Block。
4. 学生打开一个 `prepared` Lesson 并点击“开始本课”。
5. Tutor 按 Block 教学，把真实过程追加到当前 Block 日志。
6. 学生决定结束本课，Tutor 完成一次自然反思和最小记忆固化，页面再回到父 Plan。
7. 达到阶段标准后，由学生完成 Plan 并回到 Roadmap 商议下一周期。

浏览或刷新不会改变生命周期。Plan 状态只有
`prepared → active → completed`，Lesson 状态只有
`prepared → active → closed`；终态节点不重新打开，后续学习使用新的子节点。

## 页面与路由

只有两个主页面：

- **课程脉络**：课程树、中央对话、节点原文或课堂 Block。左右栏默认收起，让对话
  成为主要工作区。
- **知识山河**：浏览静态方法图谱、题卡和材料，不显示个人掌握或学习建议。

```text
/course
/course/plan/:planId
/course/plan/:planId/lesson/:lessonId
/knowledge
```

URL 是当前节点选择的来源。刷新、前进后退和深链会恢复同一节点，并从 frontmatter
中的 `session_id` 恢复 owner 匹配的 Pi Session。

## Learning set 契约

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/
│   └── <plan-id>/
│       ├── PLAN.md
│       └── lessons/<lesson-id>.md
├── memory/
│   ├── INDEX.md
│   ├── indexes/
│   ├── objects/
│   ├── capabilities/
│   └── preferences/
├── cards/
├── graph/
└── materials/
```

Roadmap 必须包含 `Overview`、`Long-term Goal`、可观察能力标准、`Test`、Plan Tree 和
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

教学文本位于 `resources/agents/`、`resources/skills/`、
`resources/teaching/math-teaching-core.md` 和
`resources/teaching/teacher-presence.md`。

## API 与事件

当前 HTTP API 只提供：

- `GET /api/health`
- `GET /api/course`
- `GET /api/knowledge`
- `GET /api/sessions/:key/history`
- `POST /api/sessions/:key/messages`
- `POST /api/plans/:planId/start|complete`
- `POST /api/plans/:planId/lessons/:lessonId/start|close`

`/events` 通过 WebSocket 传输原始教师文本、原生工具活动、运行状态、错误和文档
失效通知。教师最终文本不经改写；工具调用作为默认折叠的独立活动项显示。

## 验收

确定性 E2E 覆盖 Roadmap 对话、Plan/Lesson 启停、Block 面板、工具活动、刷新恢复、
Knowledge 和旧入口 404：

```bash
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

自动化通过后，仍应在复制出的学习集上跑真实模型长周期，重点观察课末是否只反思一次、
Plan 是否真正消费固化结果、能力假设是否跨对象成立，以及 L0 是否始终保持紧凑。
