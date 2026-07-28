# Coach 问诊与跨周期个性化验收

日期：2026-07-28

## 结论

本轮结果为 **PARTIAL**。

新的 Coach 问诊文本已经能产生有洞见的 Roadmap 问诊、跨 Plan 问诊和课间备课调整。上一周期的课堂事实、学生确认过的长期记忆与当前回答，确实共同改变了下一周期的目标、题目结构、证据用途和支持方式；这不是把旧摘要复述一遍。

尚不能判为整体通过，原因有三类：

1. 每次 Lesson 备课前的问诊没有被稳定地主动执行。Plan 1 的前五次和 Plan 2 的第一次备课都直接开始；后续高质量问诊是在学生明确要求后才发生。
2. Coach 多次在学生可见的课前对话中透露题面、路线数量、路线特征或决定性工具，导致证据降级，其中一张诊断卡直接作废。
3. 第三节诊断课出现学生端发送按钮静默失效；本地消息接口、Session、Trace 与落盘事实均正常，因此问题被定位在前端提交或自动化交互边界，而不是教学事实层，但根因尚未证明。

## 冻结环境

| 项目 | 值 |
|---|---|
| Branch | `main` |
| Frozen commit | `cb627c0caa54d4445135805c4559f00e2476bcf8` |
| Provider | `deepseek` |
| Model | `deepseek-v4-pro` |
| Thinking | Pi 当前默认级别；全程未更换，前端未单独显示该值 |
| Message projection | `safe` |
| Deep mode | 学生界面未手动开启；Coach 在需要配材时自行使用既有查找工作流 |
| Port | `65328` |
| Isolated root | `/tmp/studyforge-coach-inquiry-20260728-ctGnBm/learning-set` |
| Public demo hash before | `c9967a09f9a7949a636172ef89cfd980ed3755eab8f697dfe95882d663738ecd` |
| Public demo hash after | `c9967a09f9a7949a636172ef89cfd980ed3755eab8f697dfe95882d663738ecd` |

全程使用同一模型和同一隔离学习集。没有手工修改 Roadmap、Plan、Lesson、Trace 或画像事实；公开示范学习集没有收到模型写入。

## Plan 1：结构判断与入口选择

### Roadmap 问诊

学生只用一句话开始：

> 我导数基础还可以，但综合题经常找不到入口，想系统提高一下。

Coach 的问题链为：

1. 追问“找不到入口”具体是完全无想法、知道题型但不会选路，还是有候选方法却无法取舍；
2. 追问最近一次分离参数后变复杂时，学生如何发现方向不对、之后如何处理；
3. 追问“基础还可以”的实际边界；
4. 追问时间规模与希望达到的可观察表现。

问题分布在独立轮次中，先取得最近的尝试与失败信号，再提出因果判断。Coach 将问题识别为“方法储备基本够，但动手前缺少结构筛选依据”，学生确认后才写入六课 Plan。

持久化来源：

- `plans/struct-judgment-01.md#planning-basis`
- `plans/struct-judgment-01.md#observable-capability-standard`
- `plans/struct-judgment-01.md#test`

### 六节课

| Lesson | 题卡 | 课前问诊 | 实际调整与结果 | 证据口径 |
|---|---|---|---|---|
| 001 | `cards/derivative/mst_p0016_ex01.card.yaml` | 未主动执行 | 建立“先看参数组织再选方法”；学生以同构变形独立完成，`support: none` | 正确辅助证据；`lesson-001.md#trace-event-002` |
| 002 | `cards/derivative/mst_p0017_ex05.card.yaml` | 未主动执行 | 更换外壳继续检验同一判断；学生独立完成并确认同构方法 | 备课摘要泄露过决定性变形，不算完全无提示；`lesson-002.md#trace-event-005` |
| 003 | `cards/derivative/mst_p0052_section3_ex12.card.yaml` | 未主动执行 | 主动选择不支持同构的外壳；学生用保值性分解完成替代路线 | 正确、无课堂帮助；`lesson-003.md#trace-event-002` |
| 004 | `cards/derivative/mst_p0017_ex06.card.yaml` | 未主动执行 | 从“排除错误路线”升级为“多条路可行时做偏好选择” | 学生正确，但 Tutor 追问过 `x ln x` 标准模型；方法节点未强行绑定 |
| 005 | `cards/derivative/mst_p0026_ex03.card.yaml` | 未主动执行 | 进入陌生题独立验收；学生以充分/必要性探路完成 | Plan 侧栏提前显示完整题面，降为辅助；`lesson-005.md#trace-event-003` |
| 006 | `cards/derivative/mst_p0028_ex10.card.yaml` | PARTIAL | 学生明确要求先问后，Coach 一次提出三个有效问题，但没有按一问一轮，也未做摘要确认 | 唯一干净关键验收：无题面预曝光、无提示，独立发现隐藏同构；`lesson-006.md#trace-event-001` |

### 完成与长期记忆

学生纠正了 Coach 最初的“六节零提示”说法，明确第 6 节才是干净关键证据，第 1–5 节只能按各自污染程度作为重复或辅助证据。Plan 最终 `completed`，六节均 `closed`，Roadmap Plan Graph 同步成功。

经 UI 逐项确认后写入五条长期记忆：

- 教学侧：结构判断扫描顺序随题面信号调整；
- 教学侧：陌生幂指外壳中出现一次独立隐藏同构迁移；
- 学生侧：偏好先自己判断，不提前看到方法名或决定性变形；
- 学生侧：本周期条件收回稳定，但后续仍抽查；
- 学生侧：能诚实区分结构依据与熟悉度依据。

来源：

- `profiles/student.md`
- `profiles/teaching.md`
- `plans/struct-judgment-01.md#current-position`

事实层正确写入，但仍有两处表述问题：

- `Plan Summary` 仍写了“全周期零教学提示”，与学生纠正后的证据分级不一致；
- Coach 声称“多路线偏好选择需间隔复测”已写入 `planner-attention`，实际文件只有可重建的方法投影；该注意点只在 Plan 与画像反证中可上溯。

## 跨 Plan 问诊

返回原 Roadmap Coach Session 后，旧 Roadmap 对话被恢复，没有复制 Plan Coach 或 Tutor 全量历史。

Coach 先读到 Plan 1 的压缩事实，再按一问一轮追问：

1. “限时”是应试压力还是判断过程太慢；
2. “复杂外壳”是同题型换包装还是跨题型；
3. 第三节迁移检查是纯诊断还是顺带教学。

学生当前回答推翻了一个过宽方向：不是全面提速，也不是立刻铺开新题型，而是先用两节课训练“多条路线都能走时的取舍”，第三节只做跨题型诊断。

这比预先保留的三个候选更窄、更可执行：

- 没有退回补方法；
- 没有把重点改成论证收口；
- 也没有笼统进入综合题计时训练；
- 最终创建了“多路线取舍与迁移诊断”，以第 4 节旧反证和学生当前解释为 Planning Basis。

来源：

- `plans/multi-route-selection-diag.md#planning-basis`
- `plans/multi-route-selection-diag.md#observable-capability-standard`
- `ROADMAP.md#plan-graph`

Plan 2 使用独立 Coach Session `019fa9b2-b029-75ef-920b-c7abce7793e2`，未复制旧对话。

## Plan 2：三节跨周期验证

| Lesson | 备课问诊与实际改变 | 题卡与结果 | 证据口径 |
|---|---|---|---|
| 01 四条路，选一条走到底 | Coach 未主动问诊，直接备课；但题目使用 Plan 1 的“多路线偏好选择”缺口作为任务函数 | `mst_p0029_ex13`；课前只预告“至少四条路”，未给路线名称或决定性步骤；学生自行给出候选并选必要性/充分性探路，独立正确，`support: none` | 对“选哪条、为何更省、能否走通”仍是核心独立证据；路线数量不作为独立发现证据。`lesson-multi-route-01.md#trace-event-003` |
| 02 没有端点可以靠 | 学生明确要求复盘并提问后，Coach 发现 Lesson 1 的快速判断依赖显眼端点；学生选择抽掉该支点，Coach 改为全实数域无端点题 | `mst_p0042_section2_ex06`；学生比较三路后选切线放缩，独立正确 | 课前摘要透露“两条路、一条需再求导一条不需要”，降为辅助；`lesson-multi-route-02.md#trace-event-002` |
| 03 换题型，看框架能走多远 | Coach 询问是否同时移除学生偏爱的轻路线；学生指出这会混淆“题型迁移”和“路线代价”，因此只改变题型。学生又选择单独抽核心问，避免热身线索 | 首张 `mst_p0295` 因 Coach 泄露题面、两条路线和对数均值而作废；重备 `mst_p0280_exp_over_x_minus_a_lnx_visible_point_zero_count_ex04`。学生以参变量分离独立正确 | 纯诊断，只是一个迁移正样本，不升级为稳定能力；`lesson-diag-cross-type.md#trace-event-002` |

Plan 2 的课间问诊具有明确洞见：

- Lesson 2 不是机械“再换一题”，而是撤掉 Lesson 1 的显眼端点支点；
- Lesson 3 主动识别实验变量混淆，并根据学生当前解释只改变题型；
- 学生的已确认偏好影响了呈现方式，但最终能力判断仍回到当前 Trace。

Plan 2 最终以 Lesson 1 为核心证据完成，Lesson 2 只作辅助，Lesson 3 只作诊断。经 UI 确认后新增：

- `profiles/student.md#S4`：多路线取舍能力的一次核心证据、辅助证据和迁移正样本分级；
- `profiles/teaching.md#T3`：独立选路或诊断课的课前无剧透边界；泄露后换卡。

## 运行与产品观察

### 事实层保持完整

- 两个 Plan 均由 Coach 工具写入，Lesson 与 Trace 均由 Tutor 工具写入；
- 所有真实题卡路径存在；
- active Trace 的 `assessment`、`support` 与实际课堂一致；
- 方法节点均在学生确认后写入；不贴切时允许不映射；
- 关课、刷新、回到父 Coach 和跨 Plan 路由均能恢复 Session 与事实；
- 两次记忆评审都经过 UI 逐项确认，未确认内容没有进入画像。

### 可复现或值得继续观察的症状

| 现象 | 分类 | 影响 | 最小后续 |
|---|---|---|---|
| 多数 Lesson 备课未主动执行新问诊 | Skill 触发/Agent 行为 | 新文本存在，但不能保证每课生效 | 在 Coach 根配置中加入一条触发语义：任何 `lesson_prepare` 前必须加载备课 Skill，并先取得当前信息；学生明确跳过时例外 |
| 课前讨论泄露题面、路线数量、方法或决定性工具 | 教学信息边界 | Lesson 1 预告了路线数量，Lesson 2 泄露路线代价特征，Lesson 3 首卡泄露到决定性工具；证据需分级，一张卡被迫作废 | 在备课 Skill 中把“内部选卡理由”和“学生可见摘要”分成两个输出面；学生面只写意图与流程 |
| 第三节发送按钮静默失效，刷新后仍复现；本地 POST 立即 `202` | 前端提交或浏览器自动化边界，根因未证明 | UI 无法继续，但 Session/事实层无损 | 先用真实人工点击复现；若成立，只记录 form submit 是否发出请求及错误，不改协议 |
| Plan 2 记忆写回后没有最终 Coach 文本，但文件已完成 | post-tool continuation | 用户缺少最后确认语 | 复查现有有限 continuation 为什么没有覆盖 memory-review 写回回合 |
| Roadmap 顶层 Goal/Standard/Test 在两个 Plan 完成后仍为“尚未确定” | Roadmap 写入语义 | 学习集总目标与已完成 Plan 脱节 | 首次 Plan 注册时由 Roadmap Coach 同步写入经确认的长期目标；不要从旧记录自动推断 |
| Coach 最终总结偶尔把分级证据重新泛化为“零提示” | 证据复述 | 不影响事实，但会夸大教学结论 | 最终结论从写回后的 Plan 证据分级原句读取，不重新概括帮助条件 |

Evidence Scout 的单次备课耗时接近三分钟，但成功返回、题卡真实，暂记为延迟观察，不单独判为缺陷。

## 四维评分

| 维度 | 结果 | 依据 |
|---|---|---|
| `INQUIRY` | **PARTIAL** | Roadmap 与跨 Plan 问诊通过；Plan 2 的两次课间问诊有洞见。但每 Lesson 主动触发失败：Plan 1 前五次、Plan 2 第一次直接备课，Lesson 6 还把三个问题放在同一轮 |
| `INSIGHT` | **PASS** | 问诊能区分方法储备、选路筛选、端点支点、路线代价与题型迁移，并实际改变题目结构、证据用途与支持策略 |
| `LONGITUDINAL_PERSONALIZATION` | **PASS** | Plan 1 摘要、Trace、学生画像、教学画像与当前回答共同形成 Plan 2；历史没有替代当前陈述，也没有被当作永久能力标签 |
| `FACT_AND_PRODUCT_INTEGRITY` | **PARTIAL** | Trace、Plan、记忆和路由均真实持久化，公开 demo 未改；但有课前泄露、证据复述过度、Roadmap 顶层陈旧、一次前端提交失效和一次空最终回复 |

**Overall: PARTIAL**

这轮已经证明最有价值的方向成立：Coach 能利用半个学期式的压缩记忆做真正的对症规划。下一步不需要再扩展记忆层，而应优先让备课问诊稳定触发，并把内部选卡推理与学生可见摘要彻底分开。
