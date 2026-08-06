# StudyForge M1

StudyForge M1 是一个本地、单人、Markdown-first 的长期教学工作台。它保留已经在真实
长周期中验证过的 `Roadmap → Plan → Lesson → Block`、节点独立 Pi Session、真实题卡与
方法图谱，并加入一套可以直接打开审查的教师笔记记忆。当前产品实现只位于
[`apps/pi-teaching-web`](apps/pi-teaching-web/README.md)。

## 核心模型

```text
LEARNING_GUIDE.md
ROADMAP.md                         Roadmap Session
└── plans/plan-001/PLAN.md         Plan Session
    └── lessons/lesson-001.md      Lesson Session
        ├── Block
        ├── Block
        ├── Classroom Log
        └── Consolidated Learning Traces

memory/INDEX.md                    常驻 L0 路由
├── indexes/                       对象分桶
├── objects/                       对象记忆与完整 Trace 时间线
├── capabilities/                  跨对象能力假设
└── preferences/                   明确偏好与作用范围

cards/ + graph/ + materials/  静态学习资产
Pi JSONL                      各节点的原始对话与工具历史
```

- **Roadmap** 负责长期目标和未来 Plan 的安排。
- **Plan** 负责一个阶段目标、已结束 Lesson 的复盘和下一课备课。
- **Lesson** 负责一次真实课堂；每个 Block 保存实际课堂日志，课末只固化一次记忆。
- **记忆按需披露**：`memory/INDEX.md → L1 当前判断 → 来源 Trace → 必要时 Classroom Log`。
- **每个节点一个原生 Pi Session**，节点之间不复制聊天记录。
- **模型使用 Pi 原生文件工具**；M1 没有通用记忆工具或第二套事实服务。
- **学生控制节点启停**；浏览、刷新和模型回复都不会暗中开始或结束课程。

记忆不是聊天摘要或静态学生画像：可复述表现是学习痕迹，单个知识对象学到哪里是对象
记忆，模式跨不同对象后才可能成为能力假设，明确表达的互动需求才是偏好；教师以后要做
什么仍留在 Plan / Roadmap。完整设计见
[`M1 教师笔记记忆设计`](docs/superpowers/specs/2026-08-06-m1-teacher-notebook-memory-design.md)。

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
- 一份等待真实学生问诊的空 Roadmap 起点；
- 只有空 `memory/INDEX.md`、不带任何旧学生结论的干净学习状态。

## Learning set 最小目录

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/
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

Plan 状态只有 `prepared → active → completed`；Lesson 状态只有
`prepared → active → closed`。课堂对话、提示、纠正与决定按发生位置追加到当前
Lesson Block 的 `Classroom Log`，不会被后来总结改写成更漂亮的版本。
课末 Trace 也只追加在来源 Lesson；对象、能力和偏好的当前判断可以更新，但必须保留
流变概述和来源链接。

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

M1 实施计划见
[`2026-08-07-m1-teacher-notebook-memory.md`](docs/superpowers/plans/2026-08-07-m1-teacher-notebook-memory.md)。
