# Highschool Study for Claude Code

一个面向高中个性化学习的 Claude Code 插件。Roadmap、Plan、Lesson、课堂 Trace 与学生确认过的长期偏好都保存在可读的 Markdown learning set 中；题卡和知识图谱使用 YAML。没有数据库，也不需要额外的学习应用。

仓库同时提供：

- 可从 Claude Code marketplace 直接安装的插件；
- 9 个学习工作流 Skills、2 个 Agent 配置和 4 个窄 MCP 工具；
- 完整的[中文说明书](docs/zh-CN/完整说明书.md)；
- 含 519 张导数题卡的[公开试用学习集](examples/derivative-demo/README.md)；
- 已确认的[中英文设计稿与实施计划](docs/design/)。

## 一分钟安装

前置条件：近期版本的 Claude Code、Git，以及可在终端运行的 Bun。

```bash
claude plugin marketplace add SunOfTheEast/highschool-study-claude-code --scope user
claude plugin install highschool-study@studyforge-learning --scope user
```

启动或重新进入 Claude Code 后，可以先检查：

```bash
claude plugin list
claude mcp list
```

进入一个包含 `learning-set/` 的项目，在 Claude Code 中运行：

```text
/highschool-study:study
```

如果安装发生在已经打开的 Claude Code 会话中，再运行：

```text
/reload-plugins
```

## 试用导数学习集

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

然后可以直接说：

```text
继续“定义域完整性的系统加固”这个 Plan。
先读取 Roadmap、当前 Plan、前三节 Lesson 和已有 Trace，
告诉我目前学到哪里，再和我讨论下一步怎么上。
```

试用集包含全部 519 张迁移题卡和知识图谱，但不包含原教材 PNG、整书文本或旧 StudyForge 快照。公开课堂记录已经去标识化。

## 学习集概述与展示人设

没有课堂 Trace 时，`study` 会展示 `ROADMAP.md` 的 Learning Set Overview；已有 Trace 时，只有用户要求才展开这份概述。

学习集可以在 `.claude/personas/<id>.md` 添加专属人设，或用同名文件覆盖内置人设。临时切换不写文件；持久选择写入 Git 忽略的 `CLAUDE.local.md`。人设只改变面向学生的表达，绝不改变能力判断、题卡、Trace、测试或备课。

## 核心结构

```text
learning-set/
├── ROADMAP.md
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

- Roadmap 是长期目标，直接包含可依赖、并行和重排的多个 Plan。
- Plan 是一个合适的学习周期，包含多个 Lesson。
- Lesson 绑定一次 Claude Code 会话，由可自由组合的 ActivityBlock 构成。
- Trace 是课堂事实和题卡绑定的唯一 owner；题卡搜索会一并返回该卡的有效 Trace 历史。
- 长期画像只在 Plan 完成后汇总，并在学生逐项确认后更新。

## 四个 MCP 工具

- `card_search`：搜索真实存在的题卡，并附带每张卡的完整 active Trace。
- `trace_search`：搜索 active Trace，并反查、去重关联题卡。
- `trace_append`：向 Lesson 只追加新的课堂 Trace。
- `source_resolve`：验证 learning set 内的文件、Markdown 锚点或题卡步骤。

找不到真实题卡时，工具返回空结果；Agent 必须停止找卡，不能编造题卡、路径或来源。

## 文档

- [完整中文说明书](docs/zh-CN/完整说明书.md)
- [Pi 教学前端中文设计说明](docs/zh-CN/Pi教学前端设计说明.md)
- [导数学习集试用教程](examples/derivative-demo/README.md)
- [中文架构设计](docs/design/architecture.zh-CN.md)
- [English architecture](docs/design/architecture.en.md)
- [中文实施计划](docs/design/implementation-plan.zh-CN.md)
- [English implementation plan](docs/design/implementation-plan.en.md)
- [学习集概述与可切换人设实施计划](docs/superpowers/plans/2026-07-21-learning-set-orientation-personas.zh-CN.md)
- [Learning-set orientation and selectable personas plan](docs/superpowers/plans/2026-07-21-learning-set-orientation-personas.en.md)
- [自适应课堂模板与防剧透设计](docs/superpowers/specs/2026-07-21-adaptive-lesson-templates-and-reveal-policy-design.md)
- [自适应课堂模板与防剧透实施计划](docs/superpowers/plans/2026-07-21-adaptive-lesson-templates-and-reveal-policy.md)
- [插件源码说明](plugins/highschool-study/README.md)

Claude Code 官方参考：[发现和安装插件](https://code.claude.com/docs/en/discover-plugins)、[创建和分发 marketplace](https://code.claude.com/docs/en/plugin-marketplaces)。

## 开发与验证

```bash
cd plugins/highschool-study
bun install
bun run release:check
```

`release:check` 会重新生成自包含 MCP bundle，然后运行 TypeScript 检查、全部测试和 Claude Code 严格插件验证。公开安装不需要执行 `bun install`；安装包已经包含 bundle，但运行 MCP 仍需要系统能找到 `bun`。

## 当前发布边界

这是一个 Claude Code 学习插件，而不是完整教育产品。它刻意不包含 SQLite、向量数据库、后台服务、自动 Git 提交、统一上下文编译器或人类教师协作层。

本仓库当前未指定开源许可证；代码与题卡可用于安装和试用，进一步再分发或商用前请先联系仓库所有者。
