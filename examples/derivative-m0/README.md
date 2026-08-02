# StudyForge M0 导数学习集

这是 M0 干净内核的公开示例，包含 500 余张导数题卡、静态方法图谱、一份学习指南、
一个准备好的 Plan 和一节起点问诊 Lesson。它不包含长期画像、独立课堂事实池、派生
能力分数或旧会话快照。

## 本地启动

在仓库中运行：

```bash
cd apps/pi-teaching-web
bun install
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run dev
```

浏览器打开 Vite 输出的本地地址。Roadmap 是入口；由学生点击开始第一个 Plan，随后
进入起点问诊 Lesson。Roadmap、Plan、Lesson 各自使用独立的原生 Pi Session。

## 目录

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/plan-001.md
├── lessons/lesson-001.md
├── cards/
├── graph/
└── materials/
```

课堂发生的对话、提示、纠正和决定直接追加到当前 Lesson 的 Block `Classroom Log`。
下一节课备课时，Plan Session 重新读取本 Plan 已关闭的 Lesson，不依赖另一套摘要或
记忆对象。题卡和方法图谱保持为可复用的静态学习资产。
