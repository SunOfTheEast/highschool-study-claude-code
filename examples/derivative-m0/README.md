# StudyForge M1 导数学习集

这是 M1 的公开干净示例，包含 500 余张导数题卡、静态方法图谱、一份学习指南，以及
一份尚未替陌生学生安排课程的 Roadmap。它不包含预设 Plan、学生结论、派生能力分数或
旧会话快照；`memory/INDEX.md` 只提供空的教师记忆起点。

## 本地启动

在仓库中运行：

```bash
cd apps/pi-teaching-web
bun install
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run dev
```

浏览器打开 Vite 输出的本地地址。Roadmap 是入口；先介绍学习集并完成起点问诊，再由
Roadmap Session 创建学生确认过的第一个 Plan。Plan Session 负责准备真实 Lesson。
Roadmap、Plan、Lesson 各自使用独立的原生 Pi Session。

## 目录

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/
├── lessons/
├── memory/
│   └── INDEX.md
├── cards/
├── graph/
└── materials/
```

课堂发生的对话、提示、纠正和决定直接追加到当前 Lesson 的 Block `Classroom Log`。
课末唯一反思会把 Trace 留在来源 Lesson，并按真实证据更新对象、能力或明确偏好记忆；
下一节课备课时，Plan Session 从 `memory/INDEX.md` 渐进展开。题卡和方法图谱保持为可
复用的静态学习资产。
