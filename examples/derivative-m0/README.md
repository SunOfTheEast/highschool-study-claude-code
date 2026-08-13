# 高阶导数结构学习示例

这是 StudyForge 内置的干净示例学习集，主要用于体验正式课程和验证旧资产兼容性。它包含：

- 519 张高阶导数题卡；
- 受控的目标、方法与结构标签；
- 一份学习指南和静态方法关系；
- 一条尚未替陌生学生安排具体 Plan 的 Roadmap；
- 空的教师记忆入口，不含任何真实学生结论或旧 Session。

这个示例是资产与课程已经存在的学习集，不是 PDF 书籍导入示例。第一次使用 StudyForge 时，
仍建议把自己正在学习的教材或讲义导入，从真实章节开始。

## 在桌面 App 中使用

第一次打开时选择“使用导数示例”。StudyForge 会把示例复制到
`~/Documents/StudyForge/`，之后的课程、记忆和作答只写入这份个人副本，不修改安装包或
Git 仓库中的原件。

进入后先和 Roadmap 老师说明当前目标与真实困难。完整 Roadmap 方案经过确认后，Roadmap
安排第一个 Plan；Plan 再与学生讨论并准备具体 Lesson。

## 从源码启动

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run dev:server
bun run dev:client
```

## 目录

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/                  # 新 Plan 与其 lessons 在这里生长
├── memory/
│   └── INDEX.md
├── cards/derivative/       # 519 张旧完整题卡
├── graph/                  # 受控标签与旧静态关系
└── materials/source-guide.md
```

课堂对话、提示、纠正和决定追加到所属 Lesson Block 的 `Classroom Log`。结课后，对象相关的
认知变化直接进入教师对象记忆的 Learning History，并保留 Lesson 与 Block 来源。旧 Log、
旧作答和旧判断不会为了生成更漂亮的总结而被改写。
