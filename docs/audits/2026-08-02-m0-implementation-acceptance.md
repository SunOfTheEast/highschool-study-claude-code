# StudyForge M0 干净内核实施验收

日期：2026-08-02  
分支：`codex/studyforge-m0-clean-kernel`

## 结论

M0 的工程闭环已经成立：系统回到严格的 `Roadmap → Plan → Lesson → Block / Classroom Log` 文档骨架，每个节点使用自己的原生 Pi Session，父节点直接读取子节点 Markdown，不再依赖对象化 Trace、Handoff、安全投影或多层派生记忆。

本次验收只证明新的最小内核能够创建、推进、关闭和重新读取一个学习周期，并能由真实模型完成学习集介绍与首次问诊。它不证明长期个性化教学已经优于旧系统；这部分必须通过后续真实课程观察。

## 保留下来的职责

- `ROADMAP.md`：学习集目的、长期目标、Plan 索引和当前方向。
- `plans/*.md`：一个阶段的目标、Lesson 编排、当前进度和复盘。
- `lessons/*.md`：课堂流程控制；每个 Block 的状态和课堂中实际发生的内容都直接写回本文档。
- `cards/`、`graph/`、`materials/`：静态教学资产，由 Agent 使用普通文件工具按需读取。
- 原生 Pi Session：Roadmap、Plan、Lesson 各自保留对话历史，但不复制彼此的 transcript。
- Coach / Tutor Skills：只规定节点职责、文档读写方式和教学行为，不再复制一套运行时事实模型。

## 删除的旧机制

- 对象化 Trace 池及其搜索、投影、纠正链。
- Lesson → Plan → Roadmap 的 Handoff 压缩链。
- Planner Attention、BKT、Context Frame 和长期画像写入流程。
- 面向单人本地应用并无必要的安全投影与公开/私有字段双轨。
- `lesson_prepare`、`classroom_update`、`lesson_close` 等长嵌套领域工具。
- Scout、深层工作流和旧兼容 API。

旧机制不是被判定为永远无用，而是退出 M0 基线。只有直接读取原始 Lesson 文档在真实课程中重复暴露出明确瓶颈时，才逐项重新引入。

## 自动化验证

在 `apps/pi-teaching-web` 中运行：

```text
bun run check
```

结果：

- TypeScript 类型检查通过。
- 8 个测试文件、27 个测试、135 个断言全部通过。
- Vite 生产构建通过。
- 构建仅有一个非阻塞提示：主 JavaScript chunk 约 599 kB，超过 Vite 默认 500 kB 提示线。

运行完整浏览器闭环：

```text
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

结果：`1 passed`。用例覆盖 Roadmap、Plan、Lesson 的进入与推进，以及 Knowledge 页面浏览。测试结束时出现的 WebSocket `ECONNRESET` 来自 Playwright 关闭页面和测试服务器的时序，不影响断言或进程退出状态。

运行旧机制残留审计：

```text
rg -n "trace_append|trace_search|Handoff|Planner Attention|BKT|Context Frame|memory_review|source_resolve|lesson_prepare|classroom_update|lesson_close" apps/pi-teaching-web examples/derivative-m0
```

结果：零命中。`examples/derivative-m0/learning-set` 只保留 Roadmap、Plan、Lesson 与静态资产目录，没有 `memory/` 或 `traces/`。

## 真实模型短烟测

使用 DeepSeek V4 Flash 和临时复制的导数学习集启动了全新 Roadmap Session。Agent 的首轮行为是：

1. 读取 `LEARNING_GUIDE.md`、`ROADMAP.md` 和学习集概述；
2. 用学生能理解的话介绍学习集的用途、训练目标与可用资产；
3. 说明学习方向应根据学生当前困难共同确定；
4. 只追问一个具体问题：最近一次做导数综合题时停在哪一步。

这修复了此前“直接开始问诊”和“只完成了内部材料核对”式的异常话术。

首轮烟测同时发现资源加载器把学习指南标记成虚拟路径，导致 Agent 额外发起一次失败读取。现在注入项使用真实 `LEARNING_GUIDE.md` 路径；回归测试和第二次真实模型烟测均确认三次读取全部成功，没有失败工具项。

## 当前边界

- M0 刻意没有长期记忆聚合、能力投影和对象化证据系统。
- 父节点通过普通 `read` 重新读取子节点文档，因此事实是否清楚取决于 Lesson 的课堂记录质量。
- 目前只完成真实模型首次介绍/问诊烟测，尚未完成长 Plan 的真实教学验证。
- 生产包仍可继续做代码分割，但这不是 M0 功能闭环的阻塞项。

## 下一轮经验验证

保持内核不再扩张，按以下顺序使用：

1. 在一个 Roadmap 下完成首次问诊。
2. 创建 Plan 1，连续运行 6 节真实 Lesson。
3. 每节课结束后让 Plan Agent 直接读取完整 Lesson 文档，再备下一节课。
4. Plan 结束后回到 Roadmap Agent，直接读取 Plan 和所属 Lesson，创建 Plan 2。
5. 再运行 2–3 节 Lesson，观察跨 Plan 规划是否仍能正确使用历史事实。

只有同一种直接读取缺陷在至少两节 Lesson 中重复出现，并且能指出缺失信息与教学后果，才进入 M1 设计。届时一次只增加一个机制，继续以消融方式判断收益。
