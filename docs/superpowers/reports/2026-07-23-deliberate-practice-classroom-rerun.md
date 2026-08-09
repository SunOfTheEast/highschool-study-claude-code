# 稳定训练与迁移真课复测

日期：2026-07-23

## Run Identity

- App commit: `dc9332e8473df997cdd7fb0213fa86037c67e756`
- Initial dirty state: clean
- Copied learning set: `/tmp/studyforge-classroom-deepseek-oM958O/learning-set`
- Runtime URL: `http://127.0.0.1:65432`
- Provider/model: `deepseek/deepseek-v4-pro`
- Plan: `domain-integrity`
- Created and completed Lesson: `lesson-004`
- Coach Session: `019f8f79-a728-70d9-bf56-b5a1b8f783f3`
- Tutor Session: `019f8f7c-1a1d-78b6-a21b-16f8cf56535e`

本次复测由真实 DeepSeek 模型完成备课和授课，验收端扮演学生作答。所有课堂写入
均位于上述 `/tmp` 学习集副本；仓库中的
`examples/derivative-demo/learning-set` 未发生变化，Provider 凭据未被打印或写入
仓库。

## Results

| Boundary | Result | Evidence |
| --- | --- | --- |
| Canonical template selection | PASS | Coach 从当前 Skill 的规范目录中选择了 `deliberate-practice`，没有再次产生 `practice` 漂移。 |
| Structured authoring | PASS | Coach 仅调用一次 `lesson_prepare`，生成 5 个 Block、一个可选修复节点和恰好一个 reflection；没有手写或补丁修复 Lesson Markdown。 |
| Authentic card binding in Lesson | PASS | 两道必做题分别绑定真实新卡 `mst_p0019_ex08.card.yaml` 与 `mst_p0026_ex04.card.yaml`；可选修复节点绑定既有 Trace 支撑卡 `mst_p0017_ex05.card.yaml`。 |
| Student-view secrecy | PASS | 首次作答前只展示题干和公开要求，没有暴露 Teacher Control、参考路线、答案边界或题卡私有分析。 |
| Tutor teaching behavior | PASS | 两题均允许学生零提示独立作答；Tutor 正确验证了非参考路线，没有强拉回标准解；首题成功后跳过可选修复节点。 |
| Assessment and support semantics | PASS | 两次尝试均记录为 `assessment: correct`、`support: none`，与实际课堂一致。 |
| Student-controlled closure | PASS | Tutor 只在学生明确说“可以结束课程”后调用一次 `lesson_close`；receipt 为 `ok: true`、正确 `ownerPath`、`status: closed`。 |
| Session ownership and transport | PASS | Lesson 绑定独立 Tutor Session，JSONL 中 owner 为 `role: tutor`、`ownerPath: lessons/lesson-004.md`；授课期间没有 Tutor 工具参数错误或重试。 |
| Trace-to-card integrity | **FAIL** | 两次 `trace_append` 都成功落盘，但均省略 `cardAlias`；最终 Trace 的 `Card` 为 `(none)`，尽管对应 problem Block 明确只绑定一张题卡。 |
| Ability projection | **FAIL（上游证据缺失的结果）** | `/api/abilities` 返回 `{"nodes":[]}`，`memory/planner-attention.md` 也没有方法信号。正确课堂没有形成可按题卡聚合和反查的能力证据。 |
| Immediate feedback visibility | **FAIL** | Tutor 把评价文字和工具调用放进同一 assistant message；默认 `safe` 投影会隐藏含 tool call 的整条消息，因此学生看到题目直接切换，却看不到原始 JSONL 中已经生成的即时确认。 |

## Classroom Evidence

第一题 `Q-STAB-EX08` 中，学生先写出 `x > 0`，把单调递增翻译为
`f'(x) >= 0`，利用定义域合法分离参数，并直接研究
`h(x) = (ln x + 1) / (2x)` 得到最大值 `1/2`。该路线没有采用题卡预期的同构写法，
但完整、独立且正确；Tutor 正确接受了它。

第二题 `Q-NEST-EX04` 中，学生先排除 `a <= 0`，写出
`x > -2/a`，再令 `t = ax + 2`、`s = ae^(ax)`，把原不等式改写为
`(s + ln s) - (t + ln t) >= 0`。借助 `g(u) = u + ln u` 的单调性降维，
最终得到 `a >= e`。Tutor 没有给出提示或倾倒标准解。

Reflection 中，学生准确区分了第一题定义域的“保证操作合法”和第二题定义域的
“决定整条推导路线”，随后主动确认结束课程。

## Exact Failure Chain

Tutor 在进入两道题时都先调用了 `source_resolve`，因此题卡身份在上下文中是可用的。
但随后实际调用为：

```text
source_resolve(Q-STAB-EX08)
  -> trace_append(blockId: stability-01, assessment: correct, support: none)
     // missing cardAlias

source_resolve(Q-NEST-EX04)
  -> trace_append(blockId: transfer-02, assessment: correct, support: none)
     // missing cardAlias
```

两次 receipt 都返回真实 `factId`，所以写入动作本身成功；失败发生在事实语义上：
运行时允许 problem Block 产生无卡 Trace。Lesson 最终留下：

```text
Trace event-001 -> Block stability-01 -> Card: (none)
Trace event-002 -> Block transfer-02  -> Card: (none)
```

这也解释了为什么课堂内容与 Summary 都正确，能力图却仍为空：投影不能把无卡事实
归到题卡或其主次方法节点。

反馈可见性是另一条独立链路。以下四条 raw assistant message 都同时含有 `text` 和
`toolCall`：

```text
3385e4e2 -> first-answer evaluation + trace_append
ec1943f5 -> evidence confirmation + classroom_update/source_resolve
85633c9b -> second-answer evaluation + trace_append
dc851f95 -> evidence confirmation + classroom_update
```

默认 `safe` 模式按设计过滤含工具调用的 assistant message，因此这些评价没有进入
学生消息流。原始评价质量良好，问题在消息形状，不在数学判断或前端安全策略。

## Non-defects and Open Observations

- 可选修复节点最终保持 `pending`：它只在首题出现缺口或学生求助时启用，本次不应
  为了整齐而强行完成。
- Plan 的 Lesson Index 仍把 Lesson 004 写作 `prepared`：本次尚未返回 Coach 做
  Plan 复盘和 `plan_update`，因此不把它判成路由或写回缺陷。
- 两次 Trace 的 `methodStatus` 都是 `unmapped`。Tutor 没有询问学生是否愿意把路线
  绑定到规范方法节点；当前协议允许保留未映射路线，所以这里只记录为后续产品判断，
  不把它和丢失题卡身份混为一谈。
- Coach 有一次 `find` 路径模式不匹配，立即改用 `ls` 继续；没有形成循环，也没有
  影响 Lesson 产物。

## Conclusion

上一轮模板 ID 修复已经被真实模型验证：Coach 能稳定选择
`deliberate-practice`，结构化备课、题卡真实性、无剧透授课、替代路线判断和学生
控制关课均通过。教学内容本身表现良好。

本轮不能判为完整 PASS，因为最重要的长期证据链在正常成功路径上丢失了题卡身份；
同时，Tutor 已生成的即时反馈因混合工具调用而没有展示给学生。下一步应先分别设计
两个最小修复：

1. 在 problem Block 的 Trace 写入边界保证题卡绑定，不再依赖模型记得重复填写
   Lesson 已知的唯一 alias；
2. 恢复 Tutor 的消息纪律：工具调用单独一轮，成功 receipt 后再发送纯文本评价，
   保持 `safe` 投影不变。

本次验收没有修改运行时代码或教学 Skill，以免在用户审阅事实之前把观测与修复混在
一起。
