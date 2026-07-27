# 导数示例学习集干净基线设计

状态：等待书面复核  
日期：2026-07-27

## 1. 问题

当前公开导数示例同时承担了两种互相冲突的职责：

1. 它是 Pi 教学运行时的确定性回归夹具；
2. 它又是用户首次看到的高级导数学习集。

现有 Roadmap 只有 `domain-integrity` 一个 Plan，三节 Lesson 也都服务于定义域补缺。自动测试每次复制这份状态，因此产品演示和真课压测持续回到同一个补缺分支，无法代表 519 张题卡和高级方法图谱的真实覆盖范围。

## 2. 设计结论

将“稳定回归状态”和“公开产品示例”分开：

- 旧的定义域 Roadmap、Plan、三节 Lesson 和测试所需题卡迁入 Pi 前端专用测试夹具；
- 公开 `examples/derivative-demo/learning-set/` 只保留干净、无学生缺陷预设的高级导数入口；
- 公开学习集暂不创建 Plan 或 Lesson，后续从同构变形、切线与公切线、参变量分离等主干能力重新设计；
- 519 张题卡、知识图谱、材料、画像文件和人设配置继续留在公开学习集。

这次只建立干净基线，不提前决定新的高级 Roadmap 结构。

## 3. 测试夹具

新增：

```text
apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/
├── ROADMAP.md
├── plans/domain-integrity.md
├── lessons/lesson-001.md
├── lessons/lesson-002.md
├── lessons/lesson-003.md
├── cards/derivative/
│   ├── mst_p0017_ex05.card.yaml
│   ├── mst_p0019_ex11.card.yaml
│   ├── mst_p0030_ex16.card.yaml
│   └── mst_p0032_ex22.card.yaml
└── memory/
    ├── planner-attention.md
    ├── student-profile.md
    └── teaching-profile.md
```

只复制现有测试实际使用的内容，不复制全部 519 张题卡。所有原本直接读取公开 Demo 的 Pi 前端测试改为读取该夹具。E2E 仍然在临时目录中复制夹具，避免测试写回仓库。

测试夹具不保留本机 `coach_session` 或 `tutor_session`，确保回归测试不绑定个人 Pi Session。

## 4. 公开学习集的干净状态

`ROADMAP.md` 保持格式有效，但不预设某个学生已经遗漏定义域，也不创建 active Plan：

- 标题：`高阶导数学习`
- 概述：说明题库覆盖的高级方法范围和适用学生；
- Goal：由学生与学习商议共同确定第一阶段；
- Observable Capability Standard：暂未建立，随首个 Plan 一起确定；
- Test：暂未建立；
- Plan Graph：明确显示“尚未创建学习阶段”，不链接任何 Plan。

删除公开学习集中的：

- `plans/domain-integrity.md`
- `lessons/lesson-001.md`
- `lessons/lesson-002.md`
- `lessons/lesson-003.md`

保留 `plans/.gitkeep` 与 `lessons/.gitkeep`。

## 5. 记忆处理

两份已经为空的确认画像保持不变：

- `memory/student-profile.md`
- `memory/teaching-profile.md`

`memory/planner-attention.md` 是从旧 Trace 生成的投影。删除旧 Lesson 后必须把其 `Method Signals` 清空，否则会留下无法上溯的断链观察。保留文件和说明文字，但不保留旧分数或来源。

## 6. 用户已有修改

当前 `plans/domain-integrity.md` 含未提交的本机 `coach_session`。清理前将当前 Roadmap、Plan、Lesson 和相关记忆完整备份到仓库外的临时目录，并输出路径。测试夹具使用不带本机 Session ID 的规范状态。

## 7. 验收标准

1. 公开 Roadmap 可以被 `readLearningSet()` 正常读取；
2. 公开 Roadmap 返回空 Plan 列表；
3. 公开 `plans/` 和 `lessons/` 除 `.gitkeep` 外没有旧学习状态；
4. 公开记忆不存在指向已删除 Lesson 的链接；
5. 题卡数量仍为 519，图谱、材料、人设和画像文件未丢失；
6. Pi 前端现有 domain-integrity 单元测试和 E2E 测试改读独立夹具并继续通过；
7. 测试夹具不包含本机 Session ID。

## 8. 非目标

- 本次不设计新的高级 Roadmap；
- 不新增高级 Plan 或 Lesson；
- 不修改题卡、知识图谱或工具协议；
- 不修改前端交互和视觉；
- 不引入数据库、云端状态或新的兼容层。
