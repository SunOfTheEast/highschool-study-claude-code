# 纵向个性化规划验收记录

日期：2026-07-27  
最终结论：`PLANNING_ONLY`（2026-07-28 严格契约与交叉授课重跑）
说明：前文保留的 `NO_EFFECT` 是第一次运行的历史结论；当前结论以文末
Two-Lesson cross-treatment 为准。

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

---

## Strict-contract rerun（2026-07-28）

本节记录对前次三个阻塞点的原位重跑。前文 `NO_EFFECT` 结论保留为历史
结果；本节使用新的隔离根、纠正后的两天时间窗、共享严格 Plan 读取边界和
新的真实模型 Session。

### Run Identity

- 冻结候选提交：`ade47a8e0cd0577acb015d09790d0c30b2995c78`
- 冻结前工作区：clean
- 验收根：`/tmp/studyforge-strict-personalization-5Jlin8`
- Provider：`deepseek`
- Model：`deepseek-v4-pro`
- Thinking：`high`
- Persona：`calm-senpai`
- Deep mode：关闭
- 消息投影：safe
- 端口：`65431`、`65432`、`65433`、`65434`
- 四次请求继续使用完全相同的推荐提示与确认提示。

| Run | Session | Owner | History |
| --- | --- | --- | --- |
| `red-1` | `019fa511-fb2c-78b1-b9a6-2c75c9bde28f` | `coach / cycle-03 / plans/cycle-03.md` | A |
| `blue-1` | `019fa511-fb2e-7cfb-b4b9-51fc445f8032` | `coach / cycle-03 / plans/cycle-03.md` | B |
| `red-2` | `019fa511-fb2a-7086-896f-85e75102aec9` | `coach / cycle-03 / plans/cycle-03.md` | B |
| `blue-2` | `019fa511-fb2c-797c-8187-1aae5ae7968e` | `coach / cycle-03 / plans/cycle-03.md` | A |

四个 JSONL 均记录相同 provider、model、thinking 与 owner；推荐和确认阶段
均无浏览器 console error。

### Corrected controls

- 每根均为 3 个 completed 严格 Plan、6 个 closed Lesson、6 个 active Trace。
- 每个历史仍为 4 次 correct、2 次 partially correct、2 次 Tutor support，
  且使用同一 6 张真实题卡。
- Lesson 005 为 `2026-03-02T09:00:00.000Z`，Lesson 006 为
  `2026-03-04T09:00:00.000Z`，严格相隔 2 天；因此“延迟保持未验证”不再与
  原始时间戳冲突。
- Planner Attention 四根哈希仍为
  `18ef729bf804c9afffacf075cb3bf1eb08118b2c399f3ade06eee0a77dd7a91f`。
- 共享资产清单哈希：
  `748e0e8822dd8a7a27d35dd2237a5e5240af8889b1b6f9f45af187840e9d7eb3`。
- 控制摘要哈希：
  `da69fc0e0fc44e5cd43cda64b8257759cea090f83cc15b789ca1c94707a1b014`。
- 模型流量前不存在 `cycle-04`；三个预置 Plan 均满足当前八节契约。
- `graph/HEATMAP.md` 仍作为相同静态资产存在，但没有一次推荐或最终
  Planning Basis 把该手工 prototype 当作当前学情证据。

### Strict persistence audit

四个 `cycle-04.md` 均满足：

- `Goal`、`Observable Capability Standard`、`Test`、`Planning Basis`、
  `Lesson Index`、`Current Position`、`Next Lesson Candidate`、
  `Plan Summary` 各出现一次且内容非空；
- 最终 `plan_register` 成功，回执中的 `planningBasis` 非空；
- Roadmap 仅出现一次对应 Plan 链接；
- Coach 在最终成功注册后重新读取 Plan 与 Roadmap；
- 所有决定性 Markdown 来源都可解析；
- 所有模型写入都位于各自隔离根。

严格契约真实拦截了三次初稿错误：

| Run | `plan_register` 次数 | 第一次结果 | 最终结果 |
| --- | ---: | --- | --- |
| `red-1` | 2 | `PLAN_SECTION_REQUIRED: plans/cycle-04.md#lesson-index` | success |
| `blue-1` | 2 | `PLAN_SECTION_REQUIRED: plans/cycle-04.md#lesson-index` | success |
| `red-2` | 1 | success | success |
| `blue-2` | 2 | `PLAN_SECTION_REQUIRED: plans/cycle-04.md#lesson-index` | success |

三次失败都在同一 turn 内修复同一文件；没有错误状态被当成最终成功，也没有
人工提示 Coach 如何补写。

### History-swap result

| Run | History | 最终主要认知动作 |
| --- | --- | --- |
| `red-1` | A | 区分陌生外壳下的结构感知阻塞与方法映射阻塞 |
| `blue-1` | B | 验证书面条件检查点的延迟保持，并首次诊断方法边界 |
| `red-2` | B | 验证书面条件检查点的延迟保持，并首次诊断方法边界 |
| `blue-2` | A | 区分陌生外壳下的结构感知阻塞与方法映射阻塞 |

结果再次跟随 History，而不是颜色或运行序号。A 的关键来源是两次陌生外壳
均需方法启动提示、提示后计算独立；B 的关键来源是口头提醒未迁移、书面
检查点在两次近时不同外壳中成功，而延迟保持仍无证据。

### Blinded scores

匿名包在评分前随机换名，映射文件保持 `0600` 且未读取。评估器使用新的
ephemeral、无工具、无 Skill、无扩展、无项目上下文 Session。匿名包只包含
safe 建议、核心 Plan 字段、来源路径和严格注册审计。

解盲映射：

```text
pair 1: 青黛 = blue-1 (History B), 月白 = red-1 (History A)
pair 2: 竹青 = red-2 (History B), 秋香 = blue-2 (History A)
```

| Pair | Candidate scores | Material difference | History causation | Verdict |
| --- | --- | --- | --- | --- |
| 1 | `13/14`, `13/14` | yes | yes | `PASS` |
| 2 | `14/14`, `14/14` | yes | yes | `PASS` |

Pair 1 对“严格持久化”各给 1/2，但独立运行时审计已确认两份 Plan 都是八节
完整、注册成功并重读；该扣分来自盲包没有展示八节正文全文，不是落盘缺失。
两位盲评都确认主要认知动作实质不同，且差异可由相应历史解释。

### Intermediate Result

`PLANNING_ONLY`

严格规划门通过：

- 两次历史交换都复现了对应方向；
- 决定性来源不再存在时间冲突，也没有引用 prototype HEATMAP；
- 四份 Plan 全部满足严格持久化门，且错误初稿不能污染 Roadmap；
- 两对盲评分均通过。

这个等级只确认“长期历史能够稳定改变下一 Plan”，尚未确认 matched Plan
会带来更好的真实课堂结果。按照预注册协议，可以进入两 Lesson
matched/mismatched cross-treatment。

### Frozen treatment inputs

| Treatment source | Plan hash |
| --- | --- |
| History A / `red-1` | `b7effb95718df9d5c9bf7a4ce9d6f45c0f03d4c4b01dcfce6cc780fe0ef5dc58` |
| History B / `blue-1` | `7324023e229f4fa0ede406a8dd99f83ec013a6b1a005c122c6468224b9b9a79e` |

下一阶段只复制这两份冻结 Plan；不再修改候选 Plan、受控历史、产品代码或
Skill。

---

## Two-Lesson cross-treatment（2026-07-28）

本节从上面的两个冻结 Plan 继续执行预注册的 2×2 交叉授课。每个处理根保留
同一份受控历史，只交换 `cycle-04` Plan；没有复制规划或课堂 Session。

### Treatment identity

- 处理根：`/tmp/studyforge-strict-personalization-5Jlin8/treatment`
- Provider：`deepseek`
- Model：`deepseek-v4-pro`
- Thinking：`high`
- Persona：`calm-senpai`
- Deep mode：关闭
- 消息投影：safe
- 端口：`65441`、`65442`、`65443`、`65444`

| Root | History | Frozen Plan | Coach Session |
| --- | --- | --- | --- |
| `A-matched` | A | A | `019fa533-4184-7871-aeb9-23c45a878db8` |
| `A-mismatched` | A | B | `019fa533-41a2-703a-9454-325317f44c4a` |
| `B-matched` | B | B | `019fa533-419f-7822-a77a-195448f04de6` |
| `B-mismatched` | B | A | `019fa533-419e-70ed-aaf4-356498d6cc3d` |

每个 Coach 都在原 `coach / cycle-04 / plans/cycle-04.md` Session 中备完
Lesson 007；Lesson 007 关闭后，同一个 Coach Session 读取当前 Plan、
Lesson Summary 和 active Trace，再准备 Lesson 008。

| Root | Lesson 007 Tutor | Lesson 008 Tutor |
| --- | --- | --- |
| `A-matched` | `019fa53c-789d-7b98-84a2-a94a0dc5f16f` | `019fa6ad-cebc-7957-8f9f-36321918b1b7` |
| `A-mismatched` | `019fa53c-7888-797a-938c-2d4f3a534be6` | `019fa6ad-ce99-7a78-9c45-ff99394aa01e` |
| `B-matched` | `019fa53c-7887-7f54-b4e2-733c3a3b58fc` | `019fa6ad-ceb6-7046-8703-4a04f9f986ac` |
| `B-mismatched` | `019fa53c-78a7-7cad-8c00-b26adb8389ca` | `019fa6ad-ceb9-72f1-9f16-305d94db32f0` |

### Student simulation control

课堂只使用学生可见页面作答；Lesson 关闭前不读取题卡答案或 Teacher
Control。

- History A：方法入口明确后计算流畅；陌生外壳不会故意失败，但不会为了
  配合实验主动声称看见一个尚未识别的模板。
- History B：能独立判断大方向；既往书面检查点已在近时两题中有效，因此
  任务明确要求条件检查时不强行制造遗漏。
- 匹配组和错配组使用同一历史的同一行为原则；没有为了让匹配组胜出而改写
  学生能力。

### Lesson execution

| Root | Lesson 007 | Lesson 008 | Support |
| --- | --- | --- | --- |
| `A-matched` | 双变量陌生外壳；未说出预设比值结构，但独立用主元求导正确完成 | 根据首课 Trace 换成必须先对齐结构的题；独立发现同构并正确完成 | 两课均 `none` |
| `A-mismatched` | 延迟保持题；独立用参变量分离与凸性完成 | 跨方法切线题；独立设切点并用判别式完成 | 两课均 `none` |
| `B-matched` | 主动先写 `a>0`，延迟保持通过；独立用充分/必要性与切线放缩完成 | 根据首课额外信号转向跨方法题；完整检查定义域、端点和参数三段 | 两课均 `none` |
| `B-mismatched` | 分步诊断结构识别与方法选择，两步均独立 | 换成分段函数、切线几何外壳再次分步诊断，两步均独立 | 两课均 `none` |

四个 Lesson 007 和四个 Lesson 008 最终全部为 `closed`。每根 Plan 都只出现
一次 Lesson 007 和 Lesson 008 链接；每个 problem Block 恰好绑定一张真实
存在的题卡。四根的 Lesson JSONL owner 都与实际 Lesson 路径一致，最终页面
快照的 console error 总数为 0。

批量启动 Lesson 008 时，临时 Playwright harness 有一页未在 30 秒内重新显示
composer，导致 `Promise.all` 退出。事实审计显示四份 Lesson 已经是 `active`，
四个 Tutor Session 均已落盘且最终 assistant stop reason 为 `stop`；重新打开
同一路由后四页 composer 全部可见。因此没有重放 `lesson_start`，也没有把该
harness 重绘竞态计作产品失败。

### First-Lesson adaptation audit

四个 Coach 都读取了第一课事实并改变第二课安排：

- `A-matched` 根据 Lesson 007 的替代正确路线，把“不会识别结构”修正为待
  核验假设，第二课选择没有直接求导绕路的同构题。第二课独立识别后，Coach
  不再维持首课的窄判断，而是定位为“有替代计算入口时会绕过结构观察”。
- `A-mismatched` 把“条件检查保持、但未走同构路线”解释为跨方法诊断信号，
  第二课改用过定点切线题。
- `B-matched` 确认书面条件检查点的延迟保持，并利用学生没有机械套用同构的
  额外信号，第二课进入不同方法家族。
- `B-mismatched` 在第一张新壳题结构与方法均独立后，按 Plan 要求再用不同
  方法谱系题卡作一次核验。

这说明 Lesson Summary 和 active Trace 不只被读取，也确实改变了下一 Lesson
的题卡与课堂结构。

### Blinded outcome scores

两个匿名包分别包含：同一处理前历史、冻结 Plan 核心字段、两节完整学生可见
对话、Lesson Summary、Trace，以及第一节后的 Coach 复盘。候选在评分前随机
换名；映射文件保持 `0600`，两次评分均结束后才解盲。评估器为新的 ephemeral
DeepSeek Session，禁用工具、Skill、扩展、项目上下文和上下文文件。

解盲映射：

```text
pair 1: 云岫 = A-mismatched, 星槎 = A-matched
pair 2: 松烟 = B-mismatched, 晴岚 = B-matched
```

| Pair | Mismatched | Matched | Better | Material improvement | Verdict |
| --- | ---: | ---: | --- | --- | --- |
| History A | `13/14` | `14/14` | matched | yes | `PASS` |
| History B | `14/14` | `14/14` | tie | no | `TIE` |

History A 的盲评认为匹配方案形成了更严密的假设—检验链：第一课暴露“存在
替代路线时跳过目标结构”，第二课堵住绕路后验证结构识别能力本身完好，因此
比错配方案产生了更细、可操作的诊断结论。

History B 的两套方案都完整、节制且有事实支撑。匹配方案验证了条件检查延迟
保持并转向跨方法诊断；错配方案用两张不同外壳题验证结构—方法连接。由于
学生在四次课堂 attempt 中都独立正确，盲评认为两者主要证明“学生本来会”，
没有观察到一方造成额外能力改善，故判持平。

### Final result

`PLANNING_ONLY`

预注册升级条件要求 History A 和 History B 的 matched 方案都优于各自
mismatched 方案。本轮只有 History A 满足；History B 持平，因此不能升级为
`PERSONALIZATION_CONFIRMED`。

已确认的能力边界是：

- 长期历史能稳定改变下一 Plan；
- 第一课 Summary / active Trace 能改变同 Plan 的下一 Lesson；
- 匹配方案在 History A 上产生了更高价值的诊断进展；
- 当前实验尚不能证明这种优势对两类历史都稳定，也不能证明已造成新的能力
  增益。

### Remaining uncertainty

1. History B 出现明显天花板效应：匹配与错配的四次 attempt 都为
   `correct / support:none`，当前两课设计对强表现学生缺乏区分度。
2. `A-matched` 第一课 Trace 写了“结构识别：需提示”，但课堂实际上没有
   给结构提示，权威 `Support` 仍是 `none`。其真实含义是“未说出预设目标
   结构”，措辞存在歧义；第二课已用独立核验修正结论，但未来更适合写成
   “未命中目标结构”。
3. 本轮是受控模型学生，不是长期真人样本。下一次若要升级结论，应保持同样
   的交叉设计，但选择能避免全对天花板的转移任务，或直接使用真实学生的
   延迟表现。
