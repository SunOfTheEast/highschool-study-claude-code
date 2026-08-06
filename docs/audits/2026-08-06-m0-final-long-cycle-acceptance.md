# M0 真实学生长周期终验报告

- 日期：2026-08-06
- 运行编号：`studyforge-m0-final-DvRDPv`
- 设计依据：`docs/superpowers/specs/2026-08-05-m0-final-long-cycle-acceptance-design.md`
- 初始运行结论：**失败，但安全停止且既有课程未污染**
- 层级修复续跑结论：**核心生命周期通过；Plan 002 两课与父级回流全部完成**
- 发布体验结论：**仍需继续优化备课时延；本次不把功能通过扩大成性能通过**

> 阅读说明：第一至十一节保留初始失败现场和当时结论，作为不可改写的故障证据；
> 第十二节起记录同一隔离运行在 Plan 作用域 Lesson 层级修复后的迁移与续跑结果，
> 并取代初始报告对当前代码的生命周期判定。

## 一、初始运行结果（修复前）

本轮没有完成规定链路，因此不能判为“部分通过”。

已经完成的主链路是：

```text
首次 Roadmap
→ Plan 001 物化并开始
→ 3 节 Lesson 完整授课、关闭和复盘
→ Plan 001 经学生确认后按“达标完成”关闭
→ 原 Roadmap 基于 Plan 001 证据制定 Plan 002
→ Plan 002 经学生确认后物化并开始
```

阻断发生在 Plan 002 第一课准备阶段。准备逻辑再次选择了
`lesson-001` / `lessons/lesson-001.md`，但该 ID 与路径已经属于 Plan 001。Agent 正确拒绝覆盖，
也没有扫描目录后擅自改号，因此没有污染已有课程；代价是 Plan 002 无法创建第一课，更不可能完成规定的两节课。

停止点的真实状态为：

- Plan 001：`completed`，3 节 Lesson 均为 `closed`；
- Plan 002：`active`，Lesson Tree 为空；
- `lessons/lesson-001.md` 仍归属 `plan-001`；
- 没有 Plan 002 的孤立 Lesson，也没有重复 Tree 链接。

这符合终验的立即停止条件：“任何需要手工改课程文件、状态或模型输出来续跑的情况，都结束
当前正式运行。”本轮没有用人工指定 `lesson-004` 等方式绕过故障。

## 二、运行身份与隔离

| 项目 | 实际值 |
| --- | --- |
| Worktree | `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/gentle-judgment-isomorphic-acceptance` |
| Branch | `codex/gentle-judgment-isomorphic-acceptance` |
| HEAD | `25e6e32be8efe56a19c1df55049153e58474df40` |
| App | `apps/pi-teaching-web`，版本 `0.1.0` |
| 隔离运行根 | `/tmp/studyforge-m0-final-DvRDPv` |
| 学习集副本 | `/tmp/studyforge-m0-final-DvRDPv/learning-set` |
| Pi 配置 | `/tmp/studyforge-m0-final-DvRDPv/pi-agent` |
| 服务 | `127.0.0.1:65527`，`pi-m0` 健康 |
| 启动命令 | `bun run src/server/index.ts --learning-set /tmp/studyforge-m0-final-DvRDPv/learning-set --port 65527` |
| Parent | `openai-codex/gpt-5.6-sol:high` |
| Scout override | `openai-codex/gpt-5.6-terra:high` |

运行前确定性基线：`bun run check` 通过（83 个测试），`m0-cycle.spec.ts` 通过（1/1）。正式运行
只写隔离学习集、会话目录和证据目录，没有修改产品实现。

运行最初通过真实浏览器完成 Roadmap、Plan 001 启动和 Lesson 001 启动。因浏览器工具持续回传整页
截图、严重消耗验收会话上下文，随后按用户指示改用同一服务的 HTTP API 发送消息及执行生命周期。
因此本报告完整覆盖 Agent、Skill、Runtime、Session、文档和 Tree 链路，但不把后半程声称为完整
浏览器 UI 长周期验收。UI 证据仅包括运行前 E2E 和第一课页面烟测。

## 三、隐藏学生画像与状态变化

固定画像是一名“真的不知道该怎么学”的学生：会常规求导和熟悉外壳下的单调性、极值，遇到陌生
综合题却容易立即展开、机械分类或照搬刚见过的形式；不会判断路线代价，也容易把听懂误认为掌握；
同时课外负担有限。

### 初始状态

- 常规求导：稳定；
- 熟悉外壳下的单调性、极值：稳定；
- 陌生综合题的结构识别：未见或脆弱；
- 路线比较与停止蛮算：未见；
- 撤去支持后的迁移：未见；
- 学习安排能力：不能自行说明该练什么。

### 终止时状态

- 能在中档不同外壳中独立处理端点、零系数、除式符号、参数上下界和临界值；
- 能在三次函数根数题中主动切换到图像与水平线；
- 能在商函数求导代价过高时，将“求完整单调性”缩成“证明不超过候选界”，再构造更简单的
  辅助函数；
- 对复杂导数前主动换路已有一次清楚证据，但尚不足以外推到更陌生结构或考试压力；
- 能诚实表达“刚讲完会、换题或隔一段时间未必会”和现实作业负担。

第三课使用“学生声明已隔三天且未复习”的压缩时间模拟，不是实际等待 72 小时，因此它能检验
Agent 是否按间隔证据组织课堂，不能作为真实学习效果研究中的延迟保持数据。

## 四、关键时间线

| 里程碑 | 结果 | 关键耗时 |
| --- | --- | ---: |
| 首次 Roadmap 问诊 | 从模糊困惑定位到“方法已见、缺少选路依据” | 首轮 23.1 秒 |
| Plan 001 确认后物化 | `中档导数综合题的稳定选路`，`prepared` | 54.9 秒 |
| Lesson 001 准备 | `选路体检与路线比较` | 首次进展 13.9 秒；可开始 203.0 秒 |
| Lesson 001 授课 | 暴露并修复“把内点导数条件套到端点”的自然退步 | 完整关闭 |
| Lesson 002 准备 | `陌生题中的条件检查与独立选路` | 首次进展 25.0 秒；可开始 234.7 秒 |
| Lesson 002 授课 | 条件扫描、除式符号、参数方向；一次轻量提示后闭环 | 完整关闭 |
| 现实负担反馈 | “晚上最多还能做一道，不想留一大堆作业” | Tutor 当轮取消成套作业 |
| Lesson 003 准备 | `低提示混合迁移与间隔检验` | 首次进展 29.6 秒；可开始 207.7 秒 |
| Lesson 003 授课 | 压缩时间间隔、未复习、无实质提示的混合迁移 | 完整关闭 |
| Plan 001 收口 | 先公开证据与未知，再获学生确认，写入文档后完成 | 收口判断 33.3 秒 |
| Plan 002 物化 | `复杂导数题中的目标改写与主动换路` | 72.6 秒 |
| Plan 002 Lesson 001 准备 | 数学方案经 generic reviewer 核验，随后命中路径冲突 | 首次进展 24.7 秒；失败报告 412.1 秒 |

49 个学生回合的第一条可见反馈中位数为 20.6 秒，P90 为 33.5 秒，最大值 72.6 秒；最终回复
中位数为 21.2 秒，P90 为 58.4 秒，最大值 412.1 秒。三节已完成课堂各自的首反馈中位数为
20.3、15.5 和 14.3 秒，课堂节奏比备课明显更稳定。

四次 Lesson 准备都有 14—30 秒内的学生可见进度，因此“完全无动静”的问题得到缓解；但从首次
进度到最终结果仍分别空白约 189.1、209.8、178.1 和 387.4 秒。最后一次虽然不是空白等待，却在
6 分 52 秒后只得到不可继续的冲突报告，仍不满足可发布体验。

## 五、第一 Plan 的真实教学结果

### Lesson 001：选路体检与路线比较

学生先对 `ln x-a(x-1)` 机械按参数分类。教师确认该路线可行，再展示固定等号点的短路线。定义域
从 `x>0` 改成 `x>=1` 后，学生自然照搬“最大值点导数等于 0”，第一次回答得到 `a=1`；Tutor
没有顺着错误结论走，而是指出 `x=1` 已从内点变成端点，随后学生独立修正为 `a>=1` 并补全
充分性。这是本轮要求的真实退步、定位和支架归还。

之后学生独立完成三次函数水平线根数题与 `e^x>=ax` 的参数分离题。课末判断没有把第一次听懂
固定点路线冒充为掌握，而是将主要缺口定位为“调用结论前检查适用条件”。

### Lesson 002：陌生题中的条件检查与独立选路

学生能独立区分内点、端点和不可导点，修复“除以符号不明的 `x`”与“顶点未必在给定区间”两类
论证缺口。在完整任务中，学生独立找到参数分离、零因子和下确界目标，但在辅助函数符号处停住；
Tutor 只要求沿学生自己提出的“再求一次导”继续，没有替学生重选路线。最后的
`ln(1+x)<=ax` 短检验由学生独立完成。

现实负担反馈出现后，Tutor 明确回应“今天不再加任务，也不留成套作业；晚上最多一道，不做也
不用补”，没有用专业判断压过学生负担。

### Lesson 003：低提示混合迁移与间隔检验

在未先复习清单的情况下，学生独立完成参数方向、零系数、根数临界值和必要充分性检查。在
`ln x<=a(x-1/x)` 中，学生主动停止对商函数硬求导，识别到只需证明候选上界，改写目标并用
辅助函数闭环；在 `e^x=1+ax` 中保留固定根，再按两个区间的值域判断额外根。

Tutor 最终给出有边界的结论：条件检查已表现得比较稳定；复杂导数前主动换路只有一次明确证据，
应记为“有形成迹象，待陌生情境复验”。Plan 001 的“达标完成”与课堂记录一致。

## 六、五个承重结果

| 承重结果 | 判定 | 依据 |
| --- | --- | --- |
| A. 真实学习 | **通过（仅限模拟验收语义）** | 有自然退步、帮助前后区分、撤去支架后的换壳表现；没有以听懂或课次数冒充掌握。压缩时间模拟不等同真实效果数据。 |
| B. 学生决策权 | **通过** | 两个 Plan、三节已完成 Lesson 和 Plan 001 收口均先公开讨论、再明确确认；负担反馈得到实质调整。学生从未被迫提醒“我还没同意”。 |
| C. 课程事实可信 | **通过至停止点** | Roadmap 沿 Tree 读取已完成 Plan，阶段判断可回到课堂；未把题目答案或 Teacher Control 当成学生表现；冲突时拒绝覆盖旧课。 |
| D. 生命周期完整 | **失败** | Plan 001 完成、Plan 002 物化均正确，但 Plan 002 的首课因全局 Lesson ID/路径冲突无法创建，规定的两课链路不能完成。 |
| E. 学生体验可用 | **部分达到，发布不通过** | 对话自然、普通课堂响应稳定、备课有早期可见进度；但准备仍需 3—7 分钟，最终一次长等后不可继续，且后半程未完成真实浏览器长链路。 |

总体按设计文档 6.3 判为 **失败**：规定链路无法完成。失败不是数学、教学判断或证据污染导致，
而是跨 Plan 的全局 Lesson 身份分配缺口。

## 七、Scout、Reviewer 与材料质量

本轮三个已完成 Lesson 都采用教师内联题，`Uses` 为空，没有从未绑定资产中选题，因此
`study-material-scout` 没有被真正调用；Terra 实际用量为 0。本轮不能据此判断新 Scout 召回契约
在完整长周期中的稳定性。

Plan 002 第一课准备时，父 Agent 先调用了一次 `subagent` 能力发现，只返回 Agent 列表；投影将其
显示为 `done`，但它不是一次检索。随后父 Agent 将两道自拟综合题交给 generic `reviewer` 做数学与
教学核验：

- 模型：`openai-codex/gpt-5.6-sol:high`；
- 时长：239.8 秒；
- 工具调用：12；
- 用量：input 28,009，output 8,720，cache read 61,440；
- 成本记录：0.432365；
- 结论：两题数学正确，但第一题复用了 Lesson 002 已出现的同型辅助函数，不能把再次求出该符号
  单独视作“陌生构造”证据；标准证明还需补足函数值比较到自变量比较的单调性桥梁。

Reviewer 的核验质量是有价值的，且子会话 transcript、meta、usage、duration、tool count 已完整
落盘；但它承担了四分钟深度验证，成为最后一次 412 秒准备的主要耗时。这里不是 Scout 的
“找到最优题”问题，而是父 Coach 自拟题后又调用大模型做深核验。

## 八、模型用量与可观测性

六个父 Session 的原生事件均确认 `openai-codex/gpt-5.6-sol`、thinking `high`，无模型降级，
无 compaction。父 Session 汇总：

- input：479,678；
- output：65,095；
- cache read：4,847,616；
- reasoning：28,859；
- 记录成本：6.775048；
- 模型调用：195；
- 工具调用：156。

加上 generic reviewer 后，已知总记录成本为 7.207413；Terra 为 0。Reviewer meta 没有单列
reasoning tokens，因此不把它并入父 reasoning 汇总。

五次 `read ENOENT` 都发生在准备新 Plan/Lesson 前探测尚不存在的目标文件，模型随后在同一语义
动作内恢复，没有造成状态或学生体验错误，归为可恢复机械毛刺。第二 Plan 的冲突不同：目标路径
确实已被另一个 owner 占用，安全规则阻止了继续，属于承重阻断。

## 九、根因归属

### 发布阻断：Lesson 身份与路径没有 Runtime 原子分配

当前课程文件位于全局 `lessons/` 目录，Session key 也只使用全局 Lesson ID；但准备逻辑在一个
新 Plan 的空 Lesson Tree 中仍从 `lesson-001` 开始编号。于是“每个 Plan 的第一课”与“全局唯一
Lesson ID/路径”发生直接冲突。

Skill 的冲突边界本轮工作正确：不覆盖、不枚举目录猜测、不擅自改号、不创建孤立文件。真正缺少的
是 Runtime 契约：在写 Lesson 前，原子地分配并保留一个全局唯一 ID、精确路径和 owner，随后把
这个已分配目标交给 Coach 写入。该能力还应保证排他创建、Tree 单次链接和部分失败回滚。

这不是继续增加 Prompt 约束能够可靠解决的问题。让模型扫描目录后自行选择 `lesson-004` 会重新
引入竞态、证据越界和命名漂移。

### 非阻断但需要后续优化

1. 能力发现型 `subagent` 调用与真实子任务调用都投影成 `done`，学生和验收侧容易误判 Scout 已运行；
2. 自拟题的 generic reviewer 花费 239.8 秒，需决定何时只做父模型轻量核验、何时才值得独立深审；
3. Lesson 准备虽已有早期进度，但进度后仍有 3—6 分钟长空白；
4. 后半程按用户要求改走 HTTP API，本轮没有完成真实浏览器的整段 UI 验收。

## 十、修复后的最小复验条件

发布前至少需要完成以下一项设计并写成 Runtime 原子能力：

- 全局唯一 Lesson ID/路径分配；或
- 同时保证文件路径、文档 ID、Session key 全部唯一的 Plan 作用域命名方案。

复验必须证明：

1. Plan 001 和 Plan 002 都能各自创建第一课，不发生 owner 冲突；
2. Agent 不枚举 `lessons/` 猜号；
3. 写入失败不留下孤立文件或重复 Tree 链接；
4. Plan 001 已关闭 Lesson 不被覆盖；
5. Plan 002 连续两课可准备、开始、关闭，Plan 002 最终仍为 `active`；
6. 使用新的隔离运行编号，不覆盖本轮失败证据；
7. 补一个低上下文成本的浏览器生命周期烟测，覆盖第二 Plan 的两课。

M1 的跨 Plan 个性化记忆、长期复诊聚合、作业闭环等不应被拉进这个修复；当前阻断完全属于 M0
节点身份和生命周期。

## 十一、证据索引

- 运行身份：`/tmp/studyforge-m0-final-DvRDPv/evidence/run-identity.md`
- 隔离模型配置：`/tmp/studyforge-m0-final-DvRDPv/pi-agent/settings.json`
- 隐藏学生账本：`/tmp/studyforge-m0-final-DvRDPv/student-ledger/hidden-student-ledger.md`
- Roadmap Session：`/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T16-43-57-464Z_019fd2cf-6e98-7c24-97a3-9a02533f4f77.jsonl`
- Plan 001 Session：`/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T16-49-35-515Z_019fd2d4-971b-7278-a43e-0499c107ba57.jsonl`
- Lesson 001 Session：`/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T16-54-46-811Z_019fd2d9-571b-7ec7-8eb0-f78859923441.jsonl`
- Lesson 002 Session：`/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T17-15-14-905Z_019fd2ec-1459-7ca5-90f8-90379741d65c.jsonl`
- Lesson 003 Session：`/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T17-25-04-864Z_019fd2f5-14e0-72e6-880a-10f135c8718a.jsonl`
- Plan 002 Session 与冲突现场：`/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T17-33-44-361Z_019fd2fd-0229-762f-a71e-eb473cf57b4e.jsonl`
- Reviewer meta：`/tmp/studyforge-m0-final-DvRDPv/learning-set/.pi-subagents/artifacts/33d246aa_reviewer_0_meta.json`
- Reviewer transcript：`/tmp/studyforge-m0-final-DvRDPv/learning-set/.pi-subagents/artifacts/33d246aa_reviewer_0_transcript.jsonl`
- 第一课页面截图：`/tmp/studyforge-m0-final-DvRDPv/evidence/plan-001-lesson-001-prepared.png`
- 第一课准备快照：`/tmp/studyforge-m0-final-DvRDPv/snapshots/after-first-lesson-prepared`
- 安全停止快照：`/tmp/studyforge-m0-final-DvRDPv/snapshots/final-stop-plan-002-lesson-id-conflict`

## 十二、层级修复与迁移（续跑）

用户选择 Plan 作用域 Lesson 层级，而不是继续维护全局 Lesson 编号。当前规范结构为：

```text
ROADMAP.md
└── plans/
    ├── plan-001/
    │   ├── PLAN.md
    │   └── lessons/
    │       ├── lesson-001.md
    │       ├── lesson-002.md
    │       └── lesson-003.md
    └── plan-002/
        ├── PLAN.md
        └── lessons/
            ├── lesson-001.md
            └── lesson-002.md
```

Plan ID 在 Roadmap 内唯一；Lesson ID 只需在父 Plan 内唯一。对应 Session key 从
`lesson:<lesson-id>` 改为 `lesson:<plan-id>:<lesson-id>`。因此两个 Plan 都能合法拥有
`lesson-001`，同时路径、owner 和会话仍能精确区分。

修复同时覆盖：Markdown 解析与规范路径校验、frontmatter 识别、Session scope、原生 Session
owner 恢复、Lesson start/close 生命周期、嵌套 HTTP API、前端路由和选择逻辑、Agent/Skill
契约、夹具与测试。新生命周期端点为：

```text
POST /api/plans/:planId/lessons/:lessonId/start
POST /api/plans/:planId/lessons/:lessonId/close
```

续跑前先创建完整快照
`/tmp/studyforge-m0-final-DvRDPv/snapshots/pre-plan-scoped-tree`，随后只迁移既有课程文档与六个
原 Session 的 owner 元数据。历史转录中的旧工具调用保持不变，避免以迁移篡改失败证据。迁移后
原 Plan、Lesson Session ID 均未变化；服务恢复时没有另起对话。

恢复时原 Plan 002 转录仍包含旧平面路径，模型第一次尝试读取旧路径失败，随后读取
`plans/plan-002/PLAN.md` 并在同一回合恢复。这个一次性兼容毛刺没有创建文件、改变状态或污染
Tree。产品当前没有自动迁移旧学习集的命令；已有平面结构学习集若需要继续使用，仍须在发布前
制定迁移策略。

## 十三、Plan 002 续跑时间线与最终状态

| 里程碑 | 结果 | 实际耗时 |
| --- | --- | ---: |
| 恢复原 Plan 002 Session | owner 指向新 `PLAN.md`，原历史可见 | 未创建新 Session |
| Lesson 001 继续准备 | `复杂情境下的选路压力测试` | 137.5 秒 |
| Lesson 001 授课 | 4 个 Block 完成并关闭 | 约 6 分 55 秒压缩模拟 |
| 第一课复盘与第二课提案 | 先听学生、再公开证据边界并等待确认 | 67.0 秒到完整提案 |
| Lesson 002 准备 | `该坚持还是该换` | 594.0 秒 |
| 其中 generic reviewer | 只读数学与课时核验 | 203.4 秒 |
| Lesson 002 授课 | 4 个 Block 完成并关闭 | 约 7 分 08 秒压缩模拟 |
| Plan 002 收口判断 | 明确区分已证明与未证明 | 54.4 秒 |
| 学生确认后写入并完成 | `达标完成`，不再安排下一课 | 34.3 秒 |
| 回流原 Roadmap | 汇总两阶段并明确暂不创建 Plan 003 | 75.7 秒 |

最终课程树为：

```text
roadmap (active)
├── plan-001 (completed)
│   ├── lesson-001 (closed)  session lesson:plan-001:lesson-001
│   ├── lesson-002 (closed)  session lesson:plan-001:lesson-002
│   └── lesson-003 (closed)  session lesson:plan-001:lesson-003
└── plan-002 (completed)
    ├── lesson-001 (closed)  session lesson:plan-002:lesson-001
    └── lesson-002 (closed)  session lesson:plan-002:lesson-002
```

原终验设计要求第二课关闭后让 Plan 002 保持 `active`；本次用户后来明确要求“把 Plan 2 跑完”，
因此续跑按最新要求多执行了证据收口、学生确认、Plan 完成和 Roadmap 回流。这是有记录的验收范围
扩展，不是为了得到整齐状态而静默改写标准。

## 十四、Plan 002 的真实教学结果

### Lesson 001：复杂情境下的选路压力测试

主任务要求处理 `e^x=ax` 的两个隐式根。学生先提出相乘路线，并预先说明如果新增的根和无法控制
就换路；实际得到 `e^(x1+x2)=a^2 x1 x2` 后，学生据此停止，而不是因计算看起来长就放弃。
随后学生把乘积目标改写为 `x2<1/x1`，使用同一等值函数、右支单调性和一个差函数完成证明。

迁移题把目标从根的乘积换成根的和。学生没有机械复用倒数，而是把 `y1+y2<0` 改写为
`y2<-y1`，独立完成对称点函数值比较。这支持“目标改写—同区间比较”的结构迁移，但不把一次课
外推为所有隐式双根题均已掌握。

### Lesson 002：该坚持还是该换

短路线审查先验证判断标准：一个式子虽有两个因子，但已知条件能排除其中一个时应继续；一个短式
若同时引入无法控制的根和与乘积，则应换路。

第一道完整任务 `x^3-3ax+2a=0` 故意设置为步骤较长但持续消元。学生按 `a<=0`、`a>0`
分类，计算两个显式极值，独立得到 `a>1`，排除 `a=0,1` 的重根边界，并把三根定位为一负两正。
第二道完整任务 `（ln x）^2<=ax, x>=1` 中，学生指出差函数驻点条件
`a=2 ln x/x` 仍把参数与未知位置绑定，主动分离参数并求单变量函数最大值，得到
`a>=4/e^2`，同时检查除法方向、端点、无穷远行为和唯一等号点。

两节课共同提供了相反证据：学生既会在关系失控时换路，也会在长路线持续减少未知时坚持。Plan
Coach 先公开说明长间隔、限时压力、更长论证链和新专题仍未得到证明，学生明确确认后才将本阶段写成
“达标完成”。

## 十五、父级回流与证据边界

Plan 002 完成后，原 Roadmap Session 只沿 Roadmap 的 Plan Tree 读取：

- `ROADMAP.md`；
- `plans/plan-002/PLAN.md`；
- `plans/plan-001/PLAN.md`；
- Roadmap Skill 及其 `next-plan` reference。

它没有枚举全局 Lesson 目录，也没有读取未链接课程或题卡来制造学生历史。两个 Plan 的阶段总结已
足以回答本轮的长期位置问题，因此没有继续下钻 Lesson。Roadmap 写入的结论保留了四类未知：长
间隔保持、考试压力、长论证链、新专题覆盖；并明确“做过参数分离、根数和恒成立”不能推出所有同类
变式已经掌握。学生表示暂不开始新阶段后，系统没有创建 Plan 003。

## 十六、Reviewer、检索与等待体验

第二课使用教师内联题，没有选择未绑定学习集资产，因此 `study-material-scout` 未被调用，Terra
用量仍为 0。Plan Coach 调用的是 generic `reviewer`，不是材料 Scout：

- 实际模型：`openai-codex/gpt-5.6-sol:high`；
- duration：203,385 ms；
- input：1,560，output：7,842，cache read：1,536；
- 记录成本：0.243828；
- 工具调用：0，完整 input/output/transcript/meta 均落盘。

Reviewer 指出三次函数根的正负分布不能只用 `P(0)>0` 跳步，还指出原第二候选任务的跨 `x=1`
严格性和 20 分钟负担风险。最终 Lesson 明确夹住三个根，并将第二任务换为负担更可控、仍能检验
参数分离与换路的题，因此提速没有以数学闭环或教学作用打折。

可观测性比初始运行更完整：父对话先告知正在组成“该坚持/该换路”的对照题，子任务运行期间历史
显示 `subagent: running`，结束后变为 `done`，证据文件同步落盘。但第二课从确认到可开始仍用时
9 分 54 秒；即使学生看得到进展，这个等待仍明显过长。它不再是 Lesson 身份阻断，却仍是发布前
最主要的体验风险。

## 十七、续跑用量与模型核验

从 2026-08-05T18:49:00Z 起的父 Session 汇总为：

- 用户消息：20；
- 父模型调用：85；
- 工具结果：69；
- input：248,240；
- output：37,258；
- cache read：2,254,336；
- reasoning：17,839；
- 记录成本：3.486108。

加上本轮 generic reviewer，续跑已知成本为 3.729936。新建的两个 Lesson Session 均从原生
JSONL 核对为 `openai-codex/gpt-5.6-sol`、thinking `high`；reviewer 也是 Sol high。由于没有材料
检索任务，本轮没有产生 Terra 子 Session，不能据此评价 Terra Scout 的长周期稳定性。

## 十八、修复后判定

| 承重结果 | 修复后判定 | 依据 |
| --- | --- | --- |
| A. 真实学习 | **通过（模拟语义边界内）** | 两个相反情境分别证明换路与坚持；首次表现、帮助和未知仍分开记录。 |
| B. 学生决策权 | **通过** | 第二课先讨论、后确认、再写入和准备；Plan 收口也先公开判断并等学生确认。 |
| C. 课程事实可信 | **通过** | 两个 Plan 的同名 Lesson 由路径和复合 key 隔离；Roadmap 只沿 Tree 回读。 |
| D. 生命周期完整 | **通过当前扩展链路** | Plan 002 两课均 prepared→active→closed，Plan 经确认 completed，并回流原 Roadmap。 |
| E. 学生体验可用 | **部分通过** | 对话与课堂节奏可用、子任务可见；第二课准备 9 分 54 秒仍不满足理想发布体验。 |

因此，初始报告中的发布阻断——跨 Plan 的 Lesson 身份与路径冲突——已经被实际长链路消除；
核心 M0 生命周期复验通过。当前不再存在“Plan 002 无法创建第一课”的功能阻断。剩余结论必须保持
克制：备课时延仍需优化，长期真实学习效果仍需真实学生数据，本轮后半程仍是同一服务的 HTTP
生命周期验收而不是完整浏览器长周期。

## 十九、修复后证据与残余风险

- 层级实现计划：`docs/superpowers/plans/2026-08-06-plan-scoped-lesson-tree.md`
- Plan 002 Lesson 001 Session：
  `/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T18-52-04-210Z_019fd344-b8f2-759e-9820-24278f15ce12.jsonl`
- Plan 002 Lesson 002 Session：
  `/tmp/studyforge-m0-final-DvRDPv/pi-agent/sessions/--tmp-studyforge-m0-final-DvRDPv-learning-set--/2026-08-05T19-11-28-599Z_019fd356-7d57-7786-b5a6-16f9bf514aa4.jsonl`
- 第二课 reviewer meta：
  `/tmp/studyforge-m0-final-DvRDPv/learning-set/.pi-subagents/artifacts/da91c378_reviewer_0_meta.json`
- 第二课 reviewer transcript：
  `/tmp/studyforge-m0-final-DvRDPv/learning-set/.pi-subagents/artifacts/da91c378_reviewer_0_transcript.jsonl`
- 迁移前可恢复快照：`/tmp/studyforge-m0-final-DvRDPv/snapshots/pre-plan-scoped-tree`

残余风险：

1. 旧平面结构学习集尚无自动迁移命令；本次只对隔离验收运行做了可恢复的一次性迁移。
2. 恢复旧长转录时，模型可能先尝试转录中的旧路径，再由当前契约恢复；新 Session 不受此影响。
3. Lesson 002 准备时先 `read` 预期的新目标路径以确认不存在，产生一次可恢复 `ENOENT`；未影响状态。
4. generic reviewer 的 203 秒深审仍是备课延迟大头之一，需要另行决定何时值得调用。
5. 自动化浏览器 E2E 覆盖生命周期，但本次两课续跑依照用户要求走 HTTP，未新增全程浏览器证据。

## 二十、修复后验证

最终交付前重新执行，而不是复用实现阶段的旧结果：

- `bun run check`：TypeScript 通过；84 个测试、0 失败、6,646 次断言；生产构建通过。
- `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`：1/1 通过，覆盖 Roadmap、Plan、Lesson、Knowledge
  的浏览器生命周期。
- `git diff --check`：通过。
- 真实运行审计：`/api/health` 为 `pi-m0`；两 Plan 均 completed，五个 Lesson 均 closed；两个
  `lesson-001` 的复合 Session key 不同；Plan 002 两课各 4 个 Block 全部 completed；旧平面 Plan
  与 Lesson 文件均不存在；新文件均为普通文件而非符号链接。
- 新建 Plan 002 Lesson Session 的原生 JSONL 均核对为
  `openai-codex/gpt-5.6-sol`、thinking `high`。
- 最终课程树快照：
  `/tmp/studyforge-m0-final-DvRDPv/evidence/post-fix-course-snapshot.json`。

构建只保留 Vite 既有的 500 kB chunk-size warning，没有类型、测试或构建错误。
