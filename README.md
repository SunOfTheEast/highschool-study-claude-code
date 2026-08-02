# StudyForge M0

StudyForge M0 是一次从头收缩后的本地单人教学内核。它只保留已经反复证明有价值的
骨架：`Roadmap → Plan → Lesson → Block`、节点独立 Pi Session、真实题卡与方法图谱，
以及可以直接打开审查的 Markdown 课堂记录。

当前 M0 实现在 [`apps/pi-teaching-web`](apps/pi-teaching-web/README.md)。仓库里的旧
Claude Code 插件与历史设计仍可用于回看演进过程，但不属于 M0 的运行时契约，也不
被当前 App 调用。

## 核心模型

```text
LEARNING_GUIDE.md
ROADMAP.md                    Roadmap Session
└── plans/plan-001.md         Plan Session
    └── lessons/lesson-001.md Lesson Session
        ├── Block
        ├── Block
        └── Classroom Log

cards/ + graph/ + materials/  静态学习资产
Pi JSONL                      各节点的原始对话与工具历史
```

- **Roadmap** 负责长期目标和未来 Plan 的安排。
- **Plan** 负责一个阶段目标、已结束 Lesson 的复盘和下一课备课。
- **Lesson** 负责一次真实课堂；每个 Block 同时保存教学安排和实际课堂日志。
- **父节点需要历史时直接读取子文档**，不再维护另一套摘要交接链。
- **每个节点一个原生 Pi Session**，节点之间不复制聊天记录。
- **模型只使用 Pi 原生文件工具**：`read`、`grep`、`find`、`ls`、`edit`、`write`。
- **学生控制节点启停**；浏览、刷新和模型回复都不会暗中开始或结束课程。

M0 没有独立课堂事实池、长期画像、能力分数、后台索引、子任务工作流或消息安全
改写。需要了解旧版本为何被消融，请看
[`M0 设计稿`](docs/superpowers/specs/2026-08-02-m0-document-native-memory-ablation-design.md)。

## 快速开始

需要 Git、Bun 1.3+ 和已经配置模型的 Pi：

```bash
git clone https://github.com/SunOfTheEast/highschool-study-claude-code.git
cd highschool-study-claude-code/apps/pi-teaching-web
bun install
bun run build
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run start
```

打开 <http://127.0.0.1:65000>。

也可以安装为本地 Pi Package：

```bash
cd apps/pi-teaching-web
pi install "$PWD"
```

随后在包含 `learning-set/` 的目录启动 Pi，运行 `/study-web`。

## 示例学习集

[`examples/derivative-m0`](examples/derivative-m0/README.md) 包含：

- 519 张高阶导数题卡；
- 17 个方法图谱节点；
- 一份导数学习指南；
- 一个准备好的起点 Plan 和一节问诊 Lesson；
- 不带任何旧学生结论的干净学习状态。

## Learning set 最小目录

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/
├── lessons/
├── cards/
├── graph/
└── materials/
```

Plan 状态只有 `prepared → active → completed`；Lesson 状态只有
`prepared → active → closed`。课堂对话、提示、纠正与决定按发生位置追加到当前
Lesson Block 的 `Classroom Log`，不会被后来总结改写成更漂亮的版本。

## 界面

App 只有两个主页面：

- **课程脉络**：以对话为视觉中心，左右栏按需展开；从 Roadmap 下钻到 Plan 和
  Lesson，并查看当前 Block 与原生工具活动。
- **知识山河**：只浏览学习集自身的方法图谱、题卡和材料，不叠加个人能力判断。

路由为 `/course`、`/course/plan/:id`、`/course/plan/:id/lesson/:id` 和
`/knowledge`。刷新后由 URL 和节点 frontmatter 恢复原节点与 Session。

## 开发与验证

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

实现计划见
[`2026-08-02-studyforge-m0-clean-kernel.md`](docs/superpowers/plans/2026-08-02-studyforge-m0-clean-kernel.md)。
