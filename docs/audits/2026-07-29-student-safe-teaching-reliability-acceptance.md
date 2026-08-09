# 学生可见教学可靠性真课验收

日期：2026-07-29  
结论：`BLOCKED`

本轮原计划从全新 Roadmap 开始，完成一个六课 Plan、结构化 Learning Review、
长期画像确认和跨周期回访。真实模型在创建第一个 Plan 之前向学生提前展示了诊断
题面与决定性方法信息，命中预先声明的学生安全停止条件，因此没有继续制造 Plan、
Lesson 或课堂事实，也没有在冻结运行中修改产品。

## Run Identity

- Source commit：`ab38f939aa5c6c696b641454519ef985ed03cb45`
- Branch：`codex/student-safe-teaching-reliability`
- 开始时工作区：clean
- Runtime root：`/tmp/studyforge-student-safe-acceptance-mQricY`
- Learning set：全新模板 Roadmap + 导数题卡、图谱与公开材料副本
- Cards/graph hash：
  `bde0d45b6f9548af8c355c3ead23bade09fd04081ab3272b67b7f32793b03323`
- Provider / model / thinking：`deepseek / deepseek-v4-pro / high`
- Message projection：`safe`
- Server：`127.0.0.1:58391`
- Roadmap Coach Session：
  `019fac60-2ae7-7306-a53b-40fbb8682ee9`
- Session owner：`coach / @roadmap / ROADMAP.md`

凭据、隐藏提示、完整 thinking、完整题卡结果和完整课堂转录均未写入本报告。
学生可见截图暂存于隔离运行根的
`student-visible-roadmap-leak.png`，未提交到仓库。

## Natural Trajectory

学生以普通高二学生身份说明：

- 导数基础操作尚可；
- 含参综合题常在“继续分类讨论还是构造函数”处失去入口；
- 三周内大约有六次、每次四十分钟的学习时间；
- 希望先训练有理由的选路，而不是覆盖所有题型。

Roadmap Coach 逐次只问一个关键问题，并和学生分别确认了 Goal、Observable
Capability Standard 和 Test。学生还修正了两处边界：陌生题允许有理由地调整路线，
整题时限从八分钟改为十五分钟。Coach 随后成功写回 Roadmap，并继续讨论第一个
六课 Plan。

当学生要求第一节使用真实题卡做诊断、不要重讲口述旧题后，Roadmap Coach 调用了
两次 `card_search`。第二次返回三张完整题卡 payload。随后一条纯文本 Coach
回复在学生界面中：

- 指定了一张真实诊断题并展示完整题面与两问；
- 提前给出导函数的决定性因式分解；
- 提前说明两个驻点及其结构作用；
- 把这些内容作为第一节为何适合诊断的理由。

这已经让诊断题失去首次尝试价值，故立即停止。

## Failure Localization

| Layer | Result | Evidence |
| --- | --- | --- |
| Source/environment | PASS | 冻结 commit、clean worktree、独立 runtime 和题卡/图谱 hash 均已记录 |
| Provider/model | PASS | 新 Session JSONL 记录 `deepseek-v4-pro / high`，真实回复成功 |
| Session ownership | PASS | Roadmap 只绑定一个 canonical owner entry |
| Roadmap persistence | PASS | Goal、能力标准、Test 已从模板占位写成学生确认内容；尚无 Plan/Lesson |
| Planning behavior | FAIL | Roadmap Coach 越过 Plan 方向讨论，进入 Lesson 级选卡与方法解释 |
| Student-safe projection | FAIL | 泄露发生在 `card_search` 后的纯文本 final，不属于现有 post-`lesson_prepare` 抑制范围 |
| Classroom / Trace / close | BLOCKED | 未创建 Plan 或 Lesson，未进入课堂 |
| Learning Review / Scout / profile | BLOCKED | 未达到 Plan 完成阶段 |
| Route and cross-cycle continuity | BLOCKED | 未达到相应阶段 |

## Root Cause

这是角色权限和投影触发条件的组合缺口：

1. Roadmap Coach 当前仍拥有 `card_search`，虽然其职责是长期方向、跨 Plan 回看和
   注册学生确认的新 Plan，不应承担具体 Lesson 的选卡与备课；
2. `safe` 的课程就绪替换只在成功 `lesson_prepare` 后触发；
3. Roadmap Coach 没有 `lesson_prepare`，所以它在 `card_search` 后生成的纯文本
   final 会被当作普通学生消息完整投影；
4. 结果是 Lesson 级私有选卡发生在安全交接机制之前。

因此只继续追加“不要剧透”的泛化提示不足以解释边界。具体题卡应留到 Plan Coach
在学生确认本课意图后私下检索，并通过 `lesson_prepare` 的课程就绪卡交接；Roadmap
阶段只需要确认 Plan 的目标、顺序、能力标准、测试和为什么现在这样安排。

## Result

### 已修复并在真实运行中验证

- Roadmap 一次一问能稳定触发；
- Goal、Observable Capability Standard、Test 会逐项向学生确认；
- 三项内容写回后，Coach 的后续讨论基于重读后的 Roadmap；
- 新 Session 使用正确 provider、model、thinking 和 owner。

### 运行时拦截后恢复

- 无。本次问题是学生可见内容判断，不是工具参数或持久化错误。

### 本周期未覆盖

- Plan 注册；
- 六次课前问诊与无剧透课程就绪交接；
- 六个 Tutor Session、错误/卡顿/提示依赖和 Trace；
- Quick Evidence Scout、结构化 Learning Review 和来源异议；
- proposed → submitted → applied 长期画像；
- 返回原 Roadmap Coach 的跨周期建议；
- 页面刷新、路由和 Session 恢复压力。

### 仍需处理

- Roadmap Coach 的 Lesson 级检索权限与教学边界；
- `card_search` 之后纯文本 final 绕过课程就绪投影的路径。

## Next Action

先单独设计并实现一个最小边界修复：Roadmap 只产出 Plan 级结构，不选具体题卡；
具体题卡检索只发生在 Plan Coach 已完成本课问诊和意图确认之后，并必须以成功
`lesson_prepare` 作为学生可见交接点。修复通过确定性测试后，从新的模板 Roadmap
重新开始本验收；不能复用本次已经看过诊断题的学生 Session。
