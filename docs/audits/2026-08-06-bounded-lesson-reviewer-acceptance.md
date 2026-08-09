# 有界 Lesson Reviewer 真实模型验收

日期：2026-08-06

结论：**PASS**。可信原题没有支付 Reviewer 成本；教师自拟风险题只经过一次约 15 秒的
专用核验，最终 Lesson 的数学闭环与一小时教学负担均成立。通用 Agent 的真实管理调用被
运行时立即拒绝，确定性测试覆盖 generic Agent、混合批次、chain 与管理动作。

## 运行身份

- 分支：`codex/gentle-judgment-isomorphic-acceptance`
- 起始提交：`b48ab6b`
- 工作树：存在大量既有未提交改动；本轮没有提交或覆盖无关改动
- 主 Coach：`openai-codex/gpt-5.6-sol:high`
- Lesson Reviewer：`openai-codex/gpt-5.6-sol:high`，fresh context
- 隔离根：`/tmp/studyforge-review-handout-cRlwtl`
- 正式对照 learning set：`control2-learning-set`，端口 `65431`
- 正式风险 learning set：`risk2-learning-set`，端口 `65432`
- 所有课程文档、Pi Session 和子 Session 均在上述仓库外隔离根内；未改写示例学习集

本报告只比较两次定向验收与既有 M0 基线，不把单次样本包装成统计结论。两次新运行的题目
与工作量不同，因此时间差只用于确认路径量级和是否发生重复深审。

## 正式结果

| 场景 | 首次学生可见回应 | 确认到 Lesson 可开始 | Reviewer | 父 Session 用量 | 结果 |
| --- | ---: | ---: | --- | --- | --- |
| 原样可信题卡 | 28.3 秒 | 162.3 秒 | 0 次 | input 50,096；output 5,298；reasoning 1,893 | 3 Blocks，完整 60 分钟 Lesson |
| 教师自拟风险题 | 13.9 秒 | 181.3 秒 | 1 次，15.0 秒 | input 37,885；output 5,811；reasoning 2,082 | 3 Blocks，完整 60 分钟 Lesson |
| 既有 generic reviewer 基线 | — | 594.0 秒 | 203.4 秒 | Reviewer output 7,842 | 完整课，但重复深审明显 |

风险组 Reviewer 本身：1 个回合、0 次工具调用、input 1,490、output 445、reasoning 235，
输出正文约 631 bytes，记录成本 0.0208。它没有搜题、重写 Lesson、设计整套提示梯度或比较
候选；只核对一个已点名风险并给出最低必要措辞修正。

## 数学与教学质量

### 可信题卡对照

原题为 `e^x-ax` 在 `a>e` 时的零点个数。最终 Lesson 正确完成：

- 由导数得到在 `ln a` 左减右增，且极小值 `a(1-ln a)<0`；
- 用 `f(0)>0` 夹出并唯一确定左侧零点；
- 右侧保留一半指数，控制 `x/e^(x/2)<=2/e`，取 `2 ln a` 得到正值点；
- 介值定理负责存在性，单调性负责唯一性，结论为恰有两个零点；
- 15 分钟首试、35 分钟右侧取点、10 分钟撤支架复述，题量没有被 Reviewer 改造或扩张。

Coach 没有调用 Scout、Reviewer 或其他子 Agent；题卡路径已绑定后直接完整读取并核验。

### 自拟风险题

题目为：求所有实数 `a`，使 `ln x <= a(x-1)` 对任意 `x>0` 恒成立。Reviewer 正确指出：

- 直接代入固定点 `x=1` 只得到恒等式，不能单独锁定参数；
- 令 `g_a(x)=a(x-1)-ln x`，全域非负且 `g_a(1)=0`，才使内点 `x=1` 成为极小点；
- 由 `g_a'(1)=0` 必要地得到 `a=1`；
- `ln x<=x-1` 给出全定义域充分性，唯一等号点为 `x=1`。

最终 Lesson 把这条措辞修正落实进首次作答、充分性核验和一句话迁移检查，没有改变学生已
批准的题目、活动形态、工作量或提示方式。定义域、必要性、充分性与等号边界全部闭合。

## 验收中发现并修复的调用契约缺口

第一次自拟题运行中，父 Coach 给只读 Reviewer 显式选择了 `checked` acceptance。
`pi-subagents` 因 Reviewer 没有代码命令证据而把数学上正确的输出标为失败。根因不是模型
核验错误，而是调用 reference 没有固定只读核验的 acceptance 级别。

修复只包含两点：

- Reviewer Agent 默认声明 `acceptance.level: none`；
- 风险核验 reference 要求直接调用并显式传入带 reason 的 `acceptance: { level: none }`。

聚焦测试先按预期失败，再在修改后通过。全新 `risk2` Session 实际传入该对象，子运行的
acceptance 状态为 `not-required`，15 秒正常返回，不再注入代码验收模板或误报失败。

## 权限边界

- 真实风险 Session 曾尝试 `subagent(action: "list")`，运行时在启动子进程前返回
  `STUDY_SUBAGENT_NOT_ALLOWED`；随后只有 `lesson-risk-reviewer` 子 Session 被创建。
- 自动化测试还覆盖 direct generic `reviewer`、`worker`、混入 generic Agent 的并行
  tasks、空 tasks、chain、`list/create/update/eject/disable`；全部 fail closed。
- 允许列表仅有 `study-material-scout` 与 `lesson-risk-reviewer`，Roadmap/Lesson Session
  不加载 `subagent`。

模型仍偶发先做一次能力列表查询，这是非阻断习惯毛刺；它没有启动 generic Agent、没有形成
额外子 Session，也没有造成分钟级等待。当前运行时边界已经承担实际权限责任。

## 五个验收问题

| 问题 | 结论 |
| --- | --- |
| 普通可信材料是否避开 Reviewer 成本？ | 是，0 次子调用 |
| 风险题是否得到一次有用的有界核验？ | 是，1 次、15.0 秒、631 bytes 正文 |
| 重复深分析是否实质减少？ | 是，Reviewer 不再解整课；父 Coach只吸收决定性措辞修正 |
| 数学与教学质量是否保持？ | 是，两份 Lesson 的数学闭环、目标和一小时负担均成立 |
| generic 子代理是否 fail closed？ | 是，真实管理调用与确定性 generic/mixed/chain 测试均被拒绝 |

## 证据索引

- 对照 Plan Session：`/tmp/studyforge-review-handout-cRlwtl/pi-agent-control2/sessions/--tmp-studyforge-review-handout-cRlwtl-control2-learning-set--/2026-08-06T03-51-35-292Z_019fd532-aa7c-7671-9714-359981a8bb2d.jsonl`
- 对照 Lesson：`/tmp/studyforge-review-handout-cRlwtl/control2-learning-set/plans/plan-001/lessons/lesson-001.md`
- 风险 Plan Session：`/tmp/studyforge-review-handout-cRlwtl/pi-agent-risk2/sessions/--tmp-studyforge-review-handout-cRlwtl-risk2-learning-set--/2026-08-06T04-00-52-810Z_019fd53b-2c4a-7517-b75a-9aa710c78d42.jsonl`
- 风险 Reviewer Session：上述 Plan Session 目录下 `2c8e88fc/run-0/session.jsonl`
- 风险 Lesson：`/tmp/studyforge-review-handout-cRlwtl/risk2-learning-set/plans/plan-001/lessons/lesson-001.md`

保留隔离根供本轮审阅；其中含本地 Provider 配置，不能提交或公开打包。
