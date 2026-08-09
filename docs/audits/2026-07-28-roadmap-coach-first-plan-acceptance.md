# Roadmap Coach 首次规划真实模型验收

日期：2026-07-28

## 环境

- 候选提交：`4df4ba2599d84f3aa48c02dd4d3e8e63bf490751`
- 分支：`codex/roadmap-coach-first-plan`
- 隔离学习集：`/tmp/studyforge-roadmap-coach-acceptance-kPHgbg/learning-set`
- 本地入口：`http://127.0.0.1:65320`
- Provider：`deepseek`
- Model：`deepseek-v4-pro`
- Roadmap Session：`019fa85c-bae2-7005-b08b-471b3249e1b5`
- Roadmap Session owner：`coach / @roadmap / ROADMAP.md`
- Plan Coach Session：`019fa863-3a86-7a03-b59b-a594561cbf76`
- 验收开始前候选分支 clean；真实模型流量只进入隔离副本。
- 验收后 `git diff --exit-code -- examples/derivative-demo/learning-set` 通过，源示例没有变化。

## 结果

| 验收项 | 结果 | 来源 |
| --- | --- | --- |
| 空学习集主入口 | PASS | 首页在零 Plan 状态显示“建立第一个学习周期”，点击后进入 `/roadmap`。 |
| Roadmap Session 写回 | PASS | 隔离副本 `ROADMAP.md` 写入非空 `roadmap_coach_session`；Pi JSONL 的 owner 为 `coach / @roadmap / ROADMAP.md`。 |
| 刷新恢复同一历史 | PASS | 刷新 `/roadmap` 后仍为同一 Session，三轮学生消息及对应 Coach 回复继续可见。 |
| 确认前不注册 Plan | PASS | 前两轮讨论及一次刷新后，`plans/` 仍只有 `.gitkeep`，Roadmap Plan Graph 仍为空。 |
| 严格 Plan 注册 | PASS | 确认后只生成并注册 `plans/structural-judgment-cycle-1.md`；`kind: plan`、`status: active`，八个必需小节各出现一次且非空，Planning Basis 保留了学生目标、当前模式、节奏与检验偏好。 |
| 不预建 Lesson | PASS | 注册后 Lesson Index 只有 `（暂无）`，`lessons/` 没有新增 Lesson，也没有 Tutor Session。 |
| Plan Coach 独立 Session | PASS | 首页进入 `/plan/structural-judgment-cycle-1` 后写入独立 `coach_session`；其 ID 与 Roadmap Session 不同，初始聊天为空，返回 `/roadmap` 后原规划历史完整恢复。 |

## 观察

- Roadmap 和实际题卡文件数均为 519，但旧的 `graph/VOCABULARY.md` 标题仍写
  “750 题”。Roadmap Coach 首轮复述了 750。该资产口径不一致没有改变本次
  Plan 的方向、能力标准或 Session 交接，因此不阻塞本功能验收；发布学习集前
  应单独重建或校正这份派生词表。
- Plan Coach 尚无对话时，页面和 Plan frontmatter 已获得独立 Session ID，
  历史为空；Pi JSONL 会在首次实际消息后持久化。此行为没有复制 Roadmap
  历史，也没有产生 Lesson。
- 浏览器控制台只出现 favicon 的 404，没有影响工作区、Session 或流式消息的
  运行时错误。

## 结论

`ROADMAP_COACH_ACCEPTED`

首次使用链路已闭合：学生可以从空学习集进入长期规划对话，在明确确认前保持
零写入，确认后得到一份满足严格契约的首个 Plan；随后进入独立的 Plan Coach，
而 Roadmap 对话仍可单独恢复。
