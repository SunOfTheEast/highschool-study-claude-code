# 导数连续三课教学质量验收

## 结论

本轮修复已经把系统从“课堂能说、事实写不进去”推进到“真实题卡、Trace、Lesson Session 和学生控制基本闭环”。三节真实课共使用 5 张不同的本地题卡，写入 12 条 Trace，全部成功；`先别提示`、学生主动结束、受提示与无提示区分、未来题卡隐藏均能工作。

但当前仍不能宣称教学闭环完全通过。最严重的问题已经从 Trace 写入故障转移到 Trace 的语义聚合：同一卡片的多条 step Trace 会被重复计入卡片上的每一个方法，单次课堂即可把多个方法推成“稳定”，甚至会给学生没有采用的方法加分。其次，Coach 会把不同方法外壳误当成不同问题类别，最终审计虽能在明确提醒后纠正，Markdown Plan 却没有同步更新。提示深度、工具旁白和学生异议后的 Trace 更正也仍有缺口。

因此本轮结果为：**事实通道 PASS，教学判断与投影 PARTIAL，Plan 闭环 FAIL。**

## Run Identity

| 项目 | 值 |
| --- | --- |
| 日期 | 2026-07-22（Asia/Shanghai） |
| 代码分支 | `codex/fix-trace-channel` |
| 验收代码 Commit | `13a314f` |
| 原始基线 Commit | `12b79e2` |
| 隔离学习集 | `/tmp/studyforge-pi-quality-acceptance-20260722-aicPAs/learning-set` |
| 隔离 Pi 目录 | `/tmp/studyforge-pi-quality-acceptance-20260722-aicPAs/pi-agent` |
| 前端 | `http://127.0.0.1:65130` |
| Pi | `0.81.0` |
| Provider / Model | `xiaomi / mimo-v2.5-pro-ultraspeed` |
| Coach Session | `019f88f1-e797-7744-8713-349e4496e9df` |
| Tutor Lesson 003 | `019f88f2-561d-74a2-acbc-4eaff999dd5e` |
| Tutor Lesson 004 | `019f88fc-ed08-7618-870f-890b6e36f124` |
| Tutor Lesson 005 | `019f8900-d2a8-7fe6-8d6b-49a212eeb2a5` |

验收运行使用独立学习集和独立 Pi 凭据目录；报告不包含密钥、完整系统提示词或逐字课堂转录。录屏和 Playwright trace 保留在隔离运行根的 `acceptance.webm` 与 `.playwright-cli/traces/` 中。

## Lesson Evidence

| Lesson | 未见题卡 | 关键情境 | Trace | 课堂结论 |
| --- | --- | --- | --- | --- |
| 003 | `mst_p0032_ex22`、`mst_p0030_ex16` | 学生先说“别提示”；随后明确请求一级提示；再用另一卡无提示迁移 | 3/3 成功 | 等待请求被尊重；第一题正确记为 `support: tutor`，第二题正确记为 `support: none`；学生确认后关闭 |
| 004 | `mst_p0026_ex04`、`mst_p0028_ex11` | 两道不同结构题均首次独立完成 | 3/3 成功 | 题卡真实、无提示、学生确认后关闭；但整题证据主要绑定到 `step_1`，反思又绑定到第一张卡，粒度不稳定 |
| 005 | `mst_p0290_lnx_shift_exp_param_hidden_point_ex04` | 单道嵌套约束题完整独立作答，并对 Tutor 的方法判分提出异议 | 6/6 成功 | 六个卡片步骤均有来源；替代解法先被误记为 `partially_correct`，异议被 Summary 接受但 Trace 未更正 |

### Lesson 003

- 开课前 notebook 的 `cards` 为空；首个问题 Block 激活后只出现当前卡，未来卡不可见。
- 学生说“我先自己想，先别提示，我再想一次”后，Tutor 只回复等待，没有给比较对象、方法方向或关键式。
- 学生明确请求一级提示前，Tutor 先写入 incomplete / `support: none` Trace；完成后写入 correct / `support: tutor` Trace。
- 提示实际同时指出了配对对象和“除以两个正量的乘积”这一操作，已经接近二级提示，未满足“只给一级”的预期。
- 第二张不同 `cardPath` 的题无提示独立完成，并写入 correct / `support: none`。
- kickoff 阶段出现三条英语工具旁白；首轮 UI notebook 还曾短暂保持旧快照，直到下一条学生消息才刷新。后两节没有稳定复现该延迟。

### Lesson 004

- Coach 使用两张没有既有 Trace 的真实题卡；prepared 状态下 `cardAliases` 为空。
- 两题均在首次尝试中独立完成，Tutor 没有插入提示。
- Tutor 对第一题只写了一条 `step_1` Trace，Note 只描述定义域，却在 `classroom_update` Summary 中宣告整题完成；第二题同样绑定 `step_1`，但 Note 覆盖了完整路线。
- reflection 又写成一条绑定第一张卡 `step_1` 的 correct Trace，虽然反思内容同时涉及两张卡。这满足“有来源”，却会给投影造成重复和归属歧义。
- Coach 初次复盘把 `t+ln t` 与 `ln u+1/u` 两个方法外壳当成“跨题型”，违反 Plan 中“至少两类问题”的标准。

### Lesson 005

- Coach 正确选择一张无既有 Trace 的嵌套约束题，并把课堂控制在一个 assessment Block。
- Tutor 为 `step_1` 至 `step_6` 各写一条 Trace，工具调用全部成功，来源可回到卡片与 Lesson Block。
- 学生直接取 `x=0` 得必要条件，再独立完成充分性证明。该路线数学上完整，不需要先用 `h(x_0)=h'(x_0)=0` 推导候选点。
- Tutor 仍按卡片参考路线把 `step_2` 记为 `partially_correct`。学生指出这是合法替代路线后，Tutor 在 Reflection 和 Lesson Summary 中承认“逻辑完整无缺口”，却没有用已有 `supersedes` 能力更正原 Trace。
- 最终 Coach 在明确要求按问题类别审计后，承认 Test 2 未达标并建议 Plan 保持 active；但实际 `plans/domain-integrity.md` 仍写着 Lesson 005 为 prepared、Test 2 已通过、Test 3 未测试，形成“对话结论与持久状态”分叉。

## Continuity

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| Coach 父 Session | PASS | 三节 Tutor 结束后均返回同一个 Coach Session |
| Tutor 子 Session | PASS | 每节 Lesson 独立 Session，历史不复制 |
| 文件交接 | PASS | Lesson 文件、Trace 与带来源 Summary 完成 Session 间交接 |
| 学生主动结束 | PASS | 三节均由学生明确确认后关闭 |
| 真实题卡 | PASS | 5 张不同本地题卡，没有临时编题 |
| 未来卡隐藏 | PASS | prepared 时无卡；active 时只投影当前 Block 的卡 |
| 一键开课 | PARTIAL | 不再要求学生发送“开始”；但 Lesson 003 出现一次 kickoff 后前端快照延迟 |

## Trace 与投影

### 已通过

- 真实 `## Block assessment-01（必做）` 标题可以直接写 Trace。
- Pi Tutor 不再填写 `lessonPath`，运行时从 Tutor Session 的 Lesson 身份绑定。
- 12 次 `trace_append` 全部成功，0 次参数试探、0 次工具错误。
- 每次写入后 `planner-attention.md` 和前端 evidence map 都会刷新。
- 题卡路径、Lesson、Block、card step 和 support 均可回溯。

### 核心失败：一次作答被重复投影成多份“稳定能力”

Lesson 005 的一张卡产生 6 条 step Trace。当前投影把每条事件都映射到该卡 graph 上的全部方法，结果是：

| 方法 | 投影分数 | evidenceCount | 实际情况 |
| --- | ---: | ---: | --- |
| 显隐点探路 | 0.917 | 6 | 学生没有采用该方法，且对应 step 被记为 partial |
| 充分/必要性探路 | 0.917 | 6 | 同一次作答的六个步骤被当成六份证据 |
| 自由度与主元 | 0.917 | 6 | 同上 |
| 拟合与夹逼 | 0.917 | 6 | 同上 |

前端进一步把这些节点显示为 `steady`。这会让下一次备课误以为学生已在多个方法上形成稳定能力，是本轮最需要优先修复的缺陷。

现有 `method-signals` 测试验证的是“每条 active Trace 都按卡片方法角色计权”，因此 6 个 step 被当成 6 份证据并非偶发模型行为，而是当前投影契约本身缺少 attempt 级去重。

## Result Layer

| 层 | 结果 | 说明 |
| --- | --- | --- |
| Provider / 模型调用 | PASS | 三节真实 Tutor Session 和 Coach 复盘均完成 |
| 题卡真实性 | PASS | 所有课堂问题均来自本地真实题卡 |
| Session / Lesson 绑定 | PASS | Tutor Session 与 Lesson 一一对应 |
| 零提示与学生控制 | PASS | “先别提示”后没有方向性问题或关键式 |
| 提示同意 | PASS | 只有学生明确请求后才提示 |
| 一级提示粒度 | FAIL | 实际提示给出了操作方向，深度超过一级 |
| Trace 写入 | PASS | 12/12 成功 |
| Trace 支持度 | PASS | 受提示与无提示完成被区分 |
| Trace 语义忠实度 | FAIL | 替代解法异议未 supersede；反思与整题事件绑定不稳定 |
| Planner Attention | FAIL | 同一卡多 step 重复计数，并给未使用方法加分 |
| Plan 证据判断 | FAIL | 初次把方法外壳当问题类别；纠正后未写回 Plan |
| Lesson Summary | PARTIAL | 能接受学生纠正，但可能与 active Trace 冲突 |
| 未来题卡防剧透 | PASS | prepared 和未激活 Block 的卡不可见 |
| 消息节奏 | FAIL | L003 Tutor 与 Coach 均出现英语工具旁白 |
| 浏览器健康 | PASS | 唯一 console error 是 `favicon.ico` 404 |

## Cost

以下为 Pi Session 中模型返回的 usage/cost 汇总，不包含本地测试成本：

| Session | Input tokens | Output tokens | Cache read | Reported cost |
| --- | ---: | ---: | ---: | ---: |
| Coach | 645,900 | 23,924 | 2,792,192 | $0.9355 |
| Lesson 003 | 92,510 | 5,263 | 214,656 | $0.1368 |
| Lesson 004 | 43,113 | 3,791 | 214,272 | $0.0685 |
| Lesson 005 | 53,554 | 8,388 | 267,136 | $0.0947 |
| 合计 | 835,077 | 41,366 | 3,488,256 | **$1.2354** |

Coach 占本轮 reported cost 的约 76%。主要原因是反复读取整份 Plan、Lesson 和完整题卡，并多次生成大证据矩阵。正确性修复完成后，可再压缩 Coach 的读取和表达；当前不应为了省 token 牺牲证据审计。

## Final Regression

验收报告写入后重新执行了全量回归：

- Plugin：43 tests PASS，TypeScript PASS，bundle PASS，Claude plugin strict validation PASS。
- Pi teaching web：55 tests PASS，TypeScript PASS，Vite build PASS。
- Browser E2E：5 tests PASS。
- 唯一构建提示仍是既有的 Vite 500 kB chunk-size warning。

## 优化实施顺序（待审计）

### P0：先修证据含义，不改 schema

1. **按一次 card attempt 聚合投影，而不是按 Trace 行计数。**
   - 聚合键使用现有事实：`lessonPath + blockId + cardPath`。
   - step Trace 先合成为一次 attempt 结果；primary method 贡献高、secondary method 贡献低，但 `evidenceCount` 每张卡每次尝试最多加 1。
   - `steady` 至少需要多个不同 `cardPath` 的独立 attempt，不能由一张卡的多个 step 达成。
   - 投影仍明确是备课注意信号，不升级为自动 mastery 判决。

2. **学生异议被 Tutor 接受时，必须用现有 supersede 机制修正 Trace。**
   - 不新增字段、不新增裁判 Agent。
   - Tutor 接受“替代路线逻辑完整”后，先写 superseding Trace，再写 Reflection / Summary。
   - Planner Attention 只读取 active Trace，确保纠正立即传递。

3. **Coach 的最终决定必须写回 Plan。**
   - 最终审计若判定 active / complete / replan，必须同步更新 Lesson Index、Current Position、Next Lesson Candidate 和 Plan Summary。
   - 发送给学生的结论必须从写回后的 Plan 再读一次，不能只停留在聊天文本。

### P1：收紧教学判断与消息节奏

4. **问题类别只读取卡片 `graph.goal.primary`，方法外壳只读取 `graph.method`。**
   - 证据矩阵必须同时展示两列。
   - Plan 要求“不同题型”时，比较 goal，不比较 method。
   - 下一课候选搜索先过滤已有 goal，再找第二类真实题卡。

5. **把提示级别写成可操作的教学定义。**
   - 一级：只指出学生现有表达中值得观察的位置，不引入新操作、新函数或中间式。
   - 二级：可以建议操作或方法类别，但不给变形结果。
   - 三级：才允许给关键中间式。
   - 仍然只靠 Tutor Skill，不增加提示门、输出拦截或第二模型。

6. **工具调用回合只发工具，不发旁白。**
   - Coach / Tutor 在 tool-use 回合不输出 “Now let me…” 或中文操作说明。
   - 工具完成后另发学生可见教学消息；前端继续用结构化事件展示节点推进。

7. **kickoff 的 notebook 更新跟随 agent-end，而不是跟随调用返回。**
   - `sendCustomMessage(..., triggerTurn: true)` 返回不代表模型回合已结束。
   - 在 Tutor `agent_end` 或首个 `classroom_update` 完成后发布新 snapshot，消除首屏偶发旧状态。

### P2：正确性稳定后再降成本

8. Coach 每轮只读取 Plan、上一节 Summary/active Trace 和候选卡摘要；只有证据冲突时再展开原始 Lesson。
9. `card_search` 候选结果避免重复携带整张长答案；确定候选后再单独读取目标卡。
10. Plan 中保留一份短证据矩阵，后续复盘做增量更新，不反复重建全部历史表格。

## 下一轮最小验收

不需要再跑三节。完成 P0 与 P1 后，跑两节即可：

1. 一节包含两步以上 Trace 的卡，确认 projection 的 `evidenceCount` 只增加 1，且未采用的方法不被宣告稳定。
2. 一节使用与“恒成立参数范围”不同的 `graph.goal.primary`，确认 Coach 能自动识别第二问题类别并正确写回 Plan。
3. 在其中一节故意提交合法替代解法并提出异议，确认 superseding Trace、Lesson Summary、planner attention 和 Plan 四者一致。
4. 再请求一次一级提示，确认只给观察点，不给操作方向。

## 明确不做

- 不增加规则引擎、第二裁判 Agent、数据库或向量库。
- 不增加 `request_hint`、前端提示门、输出拦截或提示状态机。
- 不新增 Trace 字段，不恢复 rubric ID。
- 不为了兼容旧坏数据增加分支；只修当前主路径。
- 不把 planner attention 当成自动能力结论。

## Next Action

等待审计本报告的 P0 / P1 顺序。建议首先批准“attempt 级聚合 + supersede 更正 + Plan 写回”三个改动；它们共同修复事实被错误解释的问题，且都能复用现有 Markdown、Trace 字段和工具，不扩张架构。
