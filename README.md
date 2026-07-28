# StudyForge · Highschool Study

一套 Markdown-first 的高中个性化学习系统，同时提供 Claude Code 插件和本地 Pi
教学前端。两种入口共用同一个 `learning-set/`：Roadmap、Plan、Lesson、课堂
Trace 与学生确认过的长期偏好都是可以直接打开、修改和审查的文件；题卡与方法词表
使用 YAML，方法骨架也可以保留为 Markdown。

系统不把学习状态藏进数据库。摘要、能力图、首页续学位置和课堂界面都是从
Markdown/YAML、active Trace 与对应 Pi Session 重建的投影，可以继续下钻到原始
Lesson、题卡或材料。

## 两种使用入口

### Claude Code 插件

- 12 个学习 Skills，统一入口是 `/highschool-study:study`；
- 2 个 Agent：`study-coach` 与 `lesson-designer`；
- 4 个公共 MCP 工具：`card_search`、`trace_search`、`trace_append`、
  `source_resolve`；
- 支持规划、备课、授课、进度检查、记录更正与 Plan 级长期记忆整理。

题卡搜索只返回真实文件；没有命中就是有效结果，Agent 不能编造题卡、路径或来源。
Trace 采用只追加与 `Supersedes` 更正，旧记录保留审计，当前投影只使用 active
Trace。

### Pi 本地教学前端

Pi 把同一学习闭环组织成三个清楚的会话范围：

- **Roadmap Coach**：讨论长期方向、跨 Plan 回顾和新的学习周期；
- **Plan 学习顾问**：负责当前 Plan 的复盘、下一步判断和备课；
- **Lesson 课堂导师**：只推进当前 Lesson，并把作答与方法证据写回课堂记录。

当前前端已经包括：

- **续学优先首页**：用一个主入口回到仍可继续的 Lesson 或 Coach Session；
- **固定当前课堂**：聊天上方只固定当前 active Block，未揭示内容继续收起；
- **文档式课堂情境**：用连续、可折叠的小节呈现课堂脉络、方法进展、近期记录和深入查找；
- **研习资料**：在当前 Session 权限内搜索真实题卡、方法、材料与学习记录；
- **长期记忆确认卡**：Plan 完成后逐条采用、改写或不采用带来源的长期偏好候选；
- **陪伴风格**：按 Coach/Tutor Session 选择，只改变表达，不改变学习事实；
- **路由恢复**：刷新、前进后退或打开 Plan/Lesson 深链时，恢复 owner 匹配的原会话；
- **课堂回放与安全投影**：保留真实停止点，学生视图不展示工具参数、
  Teacher Control、未揭示答案或子任务内部结果。

可选的 quick/deep 工作流可以把跨题卡、跨 Lesson 的证据检索交给只读
Evidence Scout；Plan、Lesson、Trace 和长期画像仍只由父 Coach/Tutor 通过原有窄
工具写入。

## 快速开始

需要 Git、Bun，以及近期版本的 Claude Code。仓库包含 Claude Code marketplace
配置，可用下面的命令安装插件：

```bash
claude plugin marketplace add SunOfTheEast/highschool-study-claude-code --scope user
claude plugin install highschool-study@studyforge-learning --scope user
```

进入一个包含 `learning-set/` 的项目，启动 Claude Code 后运行：

```text
/highschool-study:study
```

若插件安装于已经打开的 Claude Code 会话，再运行 `/reload-plugins`。

### 启动 Pi 前端

Pi 前端从本仓库本地构建和安装：

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run build
pi install "$PWD"
```

然后进入包含 `learning-set/` 的目录，启动 Pi 并运行：

```text
/study-web
```

Pi 的安装、模型配置和开发启动方式见
[Pi 教学前端说明](apps/pi-teaching-web/README.md)。

## 试用导数学习集

仓库内的[公开试用学习集](examples/derivative-demo/README.md)包含 519 张导数题卡、
方法图谱、学习指南和一份尚未建立个性化 Plan/Lesson/Trace 的空白学习治理框架：

```bash
git clone https://github.com/SunOfTheEast/highschool-study-claude-code.git
cp -R highschool-study-claude-code/examples/derivative-demo ~/derivative-study-demo
cd ~/derivative-study-demo
claude
```

进入 Claude Code 后运行：

```text
/highschool-study:study
```

公开示例不包含原教材 PNG、整书文本或旧系统快照。

## Learning set

```text
learning-set/
├── ROADMAP.md
├── LEARNING_GUIDE.md
├── plans/
├── lessons/
├── memory/
│   ├── student-profile.md
│   ├── teaching-profile.md
│   └── planner-attention.md
├── cards/
├── graph/
└── materials/
```

- **Roadmap** 保存长期目标和可依赖、并行或重排的多个 Plan。
- **Plan** 是一个学习周期，保存能力标准、Lesson 索引、当前位置与带来源摘要。
- **Lesson** 是一次实际课堂，由可组合、跳过和重排的 ActivityBlock 构成。
- **Trace** 是作答、支持程度和学生实际方法的课堂证据；更正通过追加新事件完成。
- `student-profile.md` 与 `teaching-profile.md` 只保存学生确认过的稳定偏好。
- `planner-attention.md`、能力节点、摘要和任务轨都可重建，不是第二套学习事实。

## 能力与边界

当前实现覆盖 Roadmap → Plan → Lesson 的学习治理、真实题卡与 active Trace
双向检索、自适应课堂、防剧透 Student View、学生证据冻结、实际方法确认、真正另解、
课堂回放和带来源的长期学情研判。

它仍是一套本地学习插件与教学前端，不是教育 SaaS：不包含 SQLite、向量数据库、
后台索引、账号与班级管理、云同步、自动 Git 提交或统一上下文数据库。Pi Session
JSONL 保存原始会话历史，但不取代 learning set 中的学习事实。

## 文档与开发

- [完整中文说明书](docs/zh-CN/完整说明书.md)
- [Pi 教学前端说明](apps/pi-teaching-web/README.md)
- [Claude Code 插件说明](plugins/highschool-study/README.md)
- [导数学习集试用教程](examples/derivative-demo/README.md)

验证 Claude Code 插件：

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

验证 Pi 前端：

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
```
