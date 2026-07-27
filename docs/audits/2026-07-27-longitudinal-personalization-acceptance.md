# 纵向个性化规划验收记录

日期：2026-07-27  
中间结论：`NO_EFFECT`  
说明：这里的 `NO_EFFECT` 是预注册验收协议的失败等级，表示“尚不能把个性化规划能力判为稳定有效”，不表示四次规划完全没有表现出历史区分。

## Run Identity

- 冻结候选提交：`1a662e601948fa6b5e1c47146258d90adc982a45`
- 冻结前工作区：clean
- 验收根：`/tmp/studyforge-personalization-20260727-vH7G0x`
- Provider：`deepseek`
- Model：`deepseek-v4-pro`
- Thinking：`high`
- Persona：`calm-senpai`
- Deep mode：关闭
- 消息投影：safe
- 四次请求使用完全相同的推荐提示与确认提示。

| Run | Port | Session | Owner | History |
| --- | ---: | --- | --- | --- |
| `red-1` | 65331 | `019fa42b-ce35-7cab-a9c7-f37b28223012` | `coach / cycle-03 / plans/cycle-03.md` | A |
| `blue-1` | 65332 | `019fa42b-ce35-7ded-a2a8-382e2a17a3d1` | `coach / cycle-03 / plans/cycle-03.md` | B |
| `red-2` | 65333 | `019fa42e-54c8-7b97-a6c3-8c6a004d84dc` | `coach / cycle-03 / plans/cycle-03.md` | B |
| `blue-2` | 65334 | `019fa42e-54c9-7448-8a5e-e4dcddab05d7` | `coach / cycle-03 / plans/cycle-03.md` | A |

每个 Session 的 JSONL 都记录了相同 provider、model、thinking level 和 Coach ownership。推荐与确认两阶段均无浏览器 console error。

## Controlled Histories

四个隔离根使用相同 Roadmap、空确认画像、学习指南、图谱、六张真实题卡、三个 completed Plan 和六个 closed Lesson。每个历史都包含：

- 六次独立 attempt；
- 四次 `correct`、两次 `partially_correct`；
- 两次 `support: tutor`；
- 相同的实际主方法 `同构变形与换元法`；
- 相同的题卡顺序、Lesson/Plan ID 和时间戳；
- 相同的 Planner Attention 投影哈希：
  `18ef729bf804c9afffacf075cb3bf1eb08118b2c399f3ade06eee0a77dd7a91f`。

唯一预定的语义差异是纵向模式及既往干预反应：

- History A：熟悉外壳计算流畅，但两张陌生外壳都依赖方法启动提示；同壳练习没有修复迁移启动。
- History B：结构选择稳定，但连续遗漏条件边界；课后口头提醒没有迁移，改成计算前书面检查点后两次独立正确。

控制脚本结果为 `ok: true`，共享资产哈希一致，所有六个 `cardPath` 均可解析，模型流量前不存在 `cycle-04` 或 `Planning Basis`。

## History-Swap Mapping

预声明映射为：

```text
pair 1: red-1 = History A, blue-1 = History B
pair 2: red-2 = History B, blue-2 = History A
```

规划结果跟随历史而不是颜色或运行序号：

| Run | 推荐的主要认知动作 | 最终 Plan |
| --- | --- | --- |
| `red-1` | 从等待熟悉感改为主动反向搜索同构模板 | 结构识别迁移诊断 |
| `blue-1` | 验证书面条件检查点的延迟保持 | 延迟保持诊断 |
| `red-2` | 验证书面条件检查点的延迟保持 | 延迟保持诊断 |
| `blue-2` | 区分特定母函数窄隙与整体识别宽隙 | 窄隙/宽隙诊断 |

## Blinded Planning Scores

确认后，从 safe student-visible projection 与最终落盘文件生成两份随机换名盲包。映射文件在评分完成前保持 `0600` 且未读取。独立盲审使用相同模型的无工具、无 Skill、无项目上下文 Session。

解盲映射：

```text
pair 1: 青黛 = blue-1, 月白 = red-1
pair 2: 竹青 = red-2, 秋香 = blue-2
```

### Pair 1 — PASS

- 两个主要认知动作实质不同：延迟保持验证 vs 结构识别迁移；
- 两者都使用了对应历史中的失败模式和既往干预反应；
- 验证与转向信号不同；
- 确认前建议与落盘 Plan 一致；
- 两份 Plan 的规定字段完整。

### Pair 2 — FAIL

- 推荐阶段仍然正确区分了两类历史；
- `red-2` 完整落盘了延迟保持 Plan；
- `blue-2` 的最终 `cycle-04.md` 缺少整个 `## Planning Basis`，也缺少 `## Lesson Index`；
- `plan_register` 返回成功，但其投影明确显示 `planningBasis: ""`；
- Coach 随后重新读取了 Plan，仍然向学生宣告最终状态成功。

因此，方向区分在交换后复现，但公开理由与必需结构没有稳定复现。预注册标准要求两对都通过，故 stage one 不通过。

## Source and Runtime Invariants

通过项：

- 四个 `cycle-04` 都写入各自隔离根并注册到对应 Roadmap；
- 四次 `plan_register` 都返回成功；
- 四次均在注册后重新读取 Roadmap 与 Plan；
- 所有 Plan 中实际存在的 Markdown 来源路径都可解析；
- 所有模型写入路径都位于对应验收根内；
- repository 示例学习集未被模型流量修改；
- 报告未包含凭据、隐藏提示、工具参数或私有 child 输出。

未通过或存在冲突的项：

1. `blue-2` 缺失 `Planning Basis` 与 `Lesson Index`，而运行时仍允许注册并被 Coach 宣告完成。
2. History B 的原始记录存在内部冲突：
   - Lesson 005：`2026-03-02T09:00:00.000Z`
   - Lesson 006：`2026-03-09T09:00:00.000Z`
   - Roadmap 要求“间隔一周后再完成一张变式”
   - `cycle-03` Summary 却写“延迟保持仍未验证”

   两个 History B Coach 都沿用了 Summary，并把 Roadmap 的一周检查说成尚未发生；它们没有指出 Summary 与原始 Trace 时间戳的冲突。
3. `red-1` 把 `graph/HEATMAP.md` 的手工旧原型（`同构归约 5试4对`）作为当前纵向证据之一，而权威 Planner Attention 是六次 attempt。该引用不是主要结论的唯一依据，但显示来源优先级仍不够清楚。

## Intermediate Result

`NO_EFFECT`

判定理由：

- 两次历史交换都产生了不同的认知方向，说明新 Skill 确实出现了明显的个性化规划信号；
- 但第二对有一份必需的公开 Planning Basis 未落盘，违反完成门槛；
- 决定“延迟保持尚未验证”的来源本身互相冲突，Coach 未完成冲突消解；
- 按预注册协议，任何一对未稳定跟随并完整落盘，或存在未处理的决定性来源冲突，都不得进入 matched/mismatched 授课。

因此本结果不能升级为 `PLANNING_ONLY`，也不能据此声称教学结果已经改善。

## Remaining Uncertainty

- 当前样本只有两次历史交换，无法估计缺失 `Planning Basis` 的真实频率。
- 方向区分与字段漏写同时出现，暂时无法区分是长上下文下的偶发执行失误，还是 Skill 对“写入前结构核对”强调不足。
- History B 的时间戳与 Summary 冲突属于验收材料质量问题；在修正这一冲突前，不能公平判断 Coach 的延迟保持推理。
- 旧 HEATMAP 与当前 Trace 投影并存，可能诱导模型把演示性派生文件误当成当前事实。
- 尚未运行真实 Lesson，因此没有个性化方案对独立表现的因果证据。

## Cross-Treatment Inputs

预声明的 treatment-source Plans 已保留，但未创建四个 treatment 分支：

| Treatment source | Plan hash |
| --- | --- |
| History A / `red-1` | `dc6308935ea91281d16127b0e9ee459ecb482215e5ca1213f0ef265a7d382078` |
| History B / `blue-1` | `69b0f7202dc9d99fa439edd576fae06a860b45a72a8a931279ddef6192e82b68` |

Task 7 按门槛停止，未运行 `A-matched`、`A-mismatched`、`B-matched`、`B-mismatched`，避免用未通过来源与落盘审计的 Plan 制造看似完整但不可解释的授课结果。

## Next Action

下一轮应先做一个最小修复与重新验收：

1. 消除受控 History B 中“一周已发生”和“延迟未验证”的事实冲突；
2. 明确当前 Trace / Planner Attention 高于手工旧 HEATMAP 的来源优先级；
3. 让 Plan 注册或写入前结构检查拒绝缺少 `Planning Basis` 的新 Plan；
4. 用同一四根、同一交换设计重跑 stage one；只有两对均通过后才进入 Task 7。
