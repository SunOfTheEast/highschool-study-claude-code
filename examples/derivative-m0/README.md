# StudyForge M0 私有导数评估集

这个目录保存当前私有 beta 验收使用的导数学习集：519 张题卡、静态方法图谱、学习指南，以及用于真实长周期测试的课程状态。它用于受控内测，不是已经完成来源清洗的公开示例包。

## 许可证边界

这里的内容是 private beta evaluation corpus。它不属于根目录 Apache-2.0 代码许可证，也未获准公开再分发。公开仓库切出前，必须由单独的数据清洗计划移除或替换本目录，并逐项记录新学习资产的来源与许可证。

The private beta evaluation corpus under examples/derivative-m0 is not licensed under Apache-2.0 and is not approved for public redistribution.

请勿把真实学生记录、私有课堂对话、Pi Session 文件或派生画像提交到这个目录。

## 私有仓库内运行

从仓库根目录执行：

```bash
bun install --frozen-lockfile
bun run doctor
bun run start:demo
```

默认学习集是 `examples/derivative-m0/learning-set`，服务只监听 `127.0.0.1:65000`。也可以通过 `STUDY_LEARNING_SET` 指向另一个已授权的 Learning Set。

## 结构

课程树严格采用 Plan-local Lesson 结构：

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/<plan-id>/
│   ├── PLAN.md
│   └── lessons/<lesson-id>.md
├── cards/
├── graph/
└── materials/
```

Roadmap、Plan 与 Lesson 分别拥有独立 Pi Session。父节点只沿文档中已链接的树读取证据；未链接文件不能被当作学生历史。
