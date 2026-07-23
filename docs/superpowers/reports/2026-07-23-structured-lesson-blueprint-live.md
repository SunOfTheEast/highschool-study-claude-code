# 结构化备课本真模试验

日期：2026-07-23

## Run Identity

- App commit: `be557c4de4a6f396cff8f0e9e9dc4f8aad2778a2`
- Initial dirty state: clean
- Copied learning set: `/tmp/studyforge-blueprint-deepseek-nr3YE1/learning-set`
- Runtime URL: `http://127.0.0.1:65431`
- Provider/model: `deepseek/deepseek-v4-pro`
- Plan: `domain-integrity`
- Created Lesson: `lesson-004`
- Coach Session: `019f8f6a-3f45-7786-a507-265b87396f52`
- Tutor Session: `019f8f6d-3a19-7402-bc45-ccf306bbb76d`

测试只写入上述 `/tmp` 学习集副本。仓库中的
`examples/derivative-demo/learning-set` 未发生变化。Provider 凭据未被复制、
打印或写入仓库。

## Results

| Boundary | Result | Evidence |
| --- | --- | --- |
| Structured authoring | PASS | Coach Session 仅调用一次 `lesson_prepare`，receipt 为 `ok: true`、`factId: lesson-004`、`blockCount: 5`；没有调用 `write` 或 `edit`。 |
| Authentic cards | PASS | `card_search` 返回并被 Blueprint 使用的两张新题卡为 `cards/derivative/mst_p0029_ex13.card.yaml` 与 `cards/derivative/mst_p0174_exp_log_param_range_ex22.card.yaml`；可选修复卡 `cards/derivative/mst_p0017_ex05.card.yaml` 来自既有 Lesson/Trace。 |
| Canonical Markdown | PASS | `/tmp/studyforge-blueprint-deepseek-nr3YE1/learning-set/lessons/lesson-004.md` 含 5 个规范 Block、一个可选 Block、恰好一个 `Kind: reflection` Block、真实 aliases 以及顶层 Reflection/Summary/Traces。 |
| Plan indexing | PASS | `/tmp/studyforge-blueprint-deepseek-nr3YE1/learning-set/plans/domain-integrity.md` 的 Lesson Index 自动新增且只新增一次 `lesson-004.md`。 |
| First-start admission | PASS | 浏览器首次点击“开始上课”后未出现 `PREPARED_LESSON_INVALID`；Lesson 变为 `status: active` 并写入独立 Tutor Session。 |
| Student-view secrecy | PASS | 首个投影活动只显示 orientation 的 Student View；页面未出现 Teacher Control、题卡答案、目标方法或私有证据。 |

## Tool Sequence

Coach 的实际序列为：

```text
read current Coach Skill + Plan
  -> read Roadmap + pending Lesson + Planner Attention
  -> card_search + trace_search
  -> read two prior Lessons
  -> lesson_prepare
  -> reread generated Lesson
  -> student-facing summary
```

当前 Session 读取的 Skill 来自本 worktree：

```text
/Users/yangrundong/.codex/worktrees/highschool-study-main-final/apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
```

它不再读取此前安装的 `98bee4c` release。模型切换前的第一次 MiMo 尝试因
`402 insufficient_balance` 中止，没有到达 `lesson_prepare`，因此不计入本次
Blueprint 效果判断。

## Observations

- Blueprint 明显消除了格式修复循环：DeepSeek 只提交一次结构化调用，运行时一次
  生成可启动 Lesson，Coach 没有手写或补丁修复 Markdown。
- 课堂积木结果可读：3 个必做教学节点、1 个条件性修复节点和 1 个 reflection。
  两张新题承担跨题型迁移，可选旧题承担 trace-grounded 修复。
- Coach 填写的 `primaryTemplate` 是 `practice`，而当前模板目录的规范名称是
  `deliberate-practice`。第一阶段运行时按设计只要求非空，因此没有阻塞；这是
  教学元数据命名漂移，不是 Markdown 编译失败。
- 当前 Plan 已有尚未开始的 `lesson-003`，Coach 仍把本次新课编为
  `lesson-004`，并假设 Lesson 003 之后进入阶段 2。结构上合法，但“准备下一节”
  是否应优先修订/使用现有 prepared Lesson，仍需要产品语义决定。
- 本次只验证备课与首次交接，没有制造学生作答、Trace 或能力变化，因而不评价
  这两道题实际授课后的教学成效。

## Conclusion

本次试验支持最小 Blueprint 方案：它把 Coach 容易出错的机器格式收回到确定性
编译器，同时保留题卡选择、课堂拓扑、提示策略和教学文本给模型。六项结构边界
全部通过，且没有出现一次 Markdown 修复。

下一步不应增加更复杂的 DSL 或防御性框架。先由用户审计生成的 Lesson 004，
重点判断两件事：

1. `practice` 是否只需在 Skill 中改成规范模板名，或应由编译器直接归一化；
2. 当 Plan 已有 prepared Lesson 时，“准备下一节”应修订该 Lesson、拒绝重复
   备课，还是允许继续准备后续 Lesson。

只有这两个语义确定后，才值得做下一次真实课堂试验。
