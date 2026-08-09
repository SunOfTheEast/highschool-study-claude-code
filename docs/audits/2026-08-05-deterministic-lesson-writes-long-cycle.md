# Deterministic Lesson Writes：真实长周期验收

- 日期：2026-08-05
- 分支：`codex/gentle-judgment-isomorphic-acceptance`
- 工作区：`gentle-judgment-isomorphic-acceptance` worktree
- 模型：`deepseek/deepseek-v4-flash`，thinking level `high`

## 结论

本轮实现通过了“从 Roadmap 制定到第一个 Plan 完成”的真实长周期验收。最终学习集保持为：

- Roadmap：`active`
- `plan-001`：`completed`
- `lesson-001`、`lesson-002`、`lesson-003`：全部 `closed`
- Roadmap 已回读完成的 Plan 并提出下一阶段建议，但学生未确认，因此没有创建 `plan-002`

结构化 Lesson 写入没有把模型负担推到不可用：三节课共调用 29 次课堂写工具，26 次成功，
3 次无效调用被 Runtime 拒绝；模型均在同一轮或下一段自行恢复，没有损坏文档、制造重复
链接、越权改变 Lesson 生命周期或污染课堂证据。教学闭环本身完成，但三次可见失败说明工具
语义仍不够自然，不能把本轮写成“零问题通过”。

## 运行隔离与证据

- 独立运行根目录：`/tmp/studyforge-deterministic-long-cycle.oQ3sv0`
- 学习集：`/tmp/studyforge-deterministic-long-cycle.oQ3sv0/learning-set`
- 独立 Pi 配置与会话：`/tmp/studyforge-deterministic-long-cycle.oQ3sv0/pi-agent`
- CoT 导出：`/tmp/studyforge-deterministic-long-cycle.oQ3sv0/evidence`
- 本地服务：`http://127.0.0.1:65437`

共 24 条学生消息、95 个 assistant segment、138,305 reasoning tokens。Roadmap 首次问诊到
回到 Roadmap 复诊约 63 分钟；这包含浏览器操作、人工式学生作答、备课 Scout 与逐边界校验，
不是单次模型延迟。

## 实际学习情境

模拟的是一个真正“不知道该怎么学”的学生，而不是照脚本确认的测试用户：

- 导数基础题尚可；综合题换壳后会同时想到多个方法，却拿不准选哪条；
- 听老师改写后觉得懂，自己遇到新题仍不会变形；
- 希望每课少题精做、先独立尝试、卡住后只给方向、作业从轻。

运行中保留了会改变教学判断的真实分支：

1. 首课第一题零提示完成，推翻了“熟悉外壳下选路前变形是主要断点”的初始假设。
2. 首课第二题被学生认出为刚做过的学校卷题，Lesson 将其标为 `skipped`，明确不算迁移证据；
   它没有扫描题库临时换题，而是把缺口交回 Plan。
3. 第二课第一题零提示完成；第二题在辅助函数判号处只获得一次方向提示，日志没有把它洗成
   独立完成。
4. Plan 没有因两节课表现好就提前宣称完全掌握，而是指出幂指混合仍无有效证据；学生确认后
   动态增加第三节检验课。
5. 第三课用陌生幂指混合题检验。学生零提示完成，并独立迁移了上一课受帮助的辅助函数判号
   动作；绝对值备选因主测证据充分而 `skipped`，没有为了覆盖数量凑题。
6. Plan 给出“达标完成”建议，同时把绝对值未测、构造路与分离路的代价选择未被单独逼出、
   时间压力未测明确留为证据边界。学生确认后，结论先写进 Plan，再由界面完成生命周期。

## 验收门

| 验收门 | 结果 | 证据 |
| --- | --- | --- |
| Roadmap 先讨论、确认后才创建 Plan | 通过 | 学生确认恒成立与选路方向及课堂节奏后，才写入并挂接 `plan-001` |
| Plan 先讨论、写入批准设计后才备课 | 通过 | 三节课都先公开草案并取得明确确认，再更新 Plan、调用 Scout、创建 Lesson |
| Lesson 生命周期只归界面/Runtime | 通过 | Lesson agent 只管理 Block；`prepared → active → closed` 均由界面动作完成 |
| Lesson 只有确定性课堂写工具 | 通过 | 三个 Lesson 会话只调用 `read`、`classroom_log_append`、`classroom_update`，没有 `edit` / `write` |
| 课堂证据诚实 | 通过 | 见过的题不计证据；一次方向提示被明确记录；未启用备选为 `skipped` |
| 证据读取沿 Tree | 通过 | Plan 复盘读取显式 Lesson；Roadmap 收口后先读已完成 Plan，再沿其 Lesson Tree 下钻；未枚举孤立 Lesson |
| 学生停止后不加题 | 通过 | 三节课均在学生明确停止后只补日志并交还界面；第三课绝对值备选未启用 |
| Plan 动态调整课次 | 通过 | 从预计弧线动态收敛为三节课，不硬凑 5–6 节，也不因第二课顺利就草率收口 |
| 写先于备、结论先于完成 | 通过 | 每节批准设计先落父文档；最终收口结论先落 Plan，随后学生界面才设为 `completed` |
| 完成后 Roadmap 复诊且不抢跑 | 通过 | Roadmap 给出 Plan 002 公开设计并等待学生确认；最终树中只有 `plan-001` |
| 每个边界后仍可严格解析 | 通过 | `readCourseTree`、`readPlan`、`readLesson` 在创建、激活、Block 推进、关闭与 Plan 完成后均成功 |

## 课堂写工具轨迹

| Lesson | 成功 | 被拒绝 | 被拒绝原因 | 最终状态 |
| --- | ---: | ---: | --- | --- |
| lesson-001 | 10 | 0 | — | 2 completed + 1 skipped；全部日志可回读 |
| lesson-002 | 9 | 1 | `advance` 已原子激活 block-002，模型又调用一次 `start` | 3 completed；无重复状态变化 |
| lesson-003 | 7 | 2 | 先记日志后启动 Block；`advance` 多传了 `blockId` | 主测/复盘 completed，备选 skipped |
| 合计 | 26 | 3 | 均为调用顺序或参数形状问题 | 无损坏、无越权、无孤立产物 |

三次失败都证明 Runtime 的拒绝边界有效，但也暴露两个真实可用性问题：

1. `advance` 同时“结束当前 Block + 激活下一 Block”的语义不够显然，模型会把它理解成只结束，
   随后再调用 `start`。
2. 模型偶尔会把“开始活动”和“记录开场事实”放在同一批工具调用里但顺序写反，或者给
   `advance` 补一个它直觉上认为应该存在的 `blockId`。

这里不建议继续堆提示词约束。当前 Runtime 已把错误限制为可恢复的原子拒绝；后续若要消除
可见失败，应优先让工具动作名称/参数更接近模型直觉，或由 Runtime 为“启动并记录开场”提供
一个自然的原子入口，再用真实模型对比首击守住率。

## 教学与会话结果

### 做对的部分

- Roadmap 的初次问诊从学生真实叙述出发，没有把四个内部判断写成必问清单。
- Plan 能公开修正自己的早期诊断，并让学生决定是否多上一节检验课。
- Lesson 没有在学生独立思考时偷给路线；实际求助时只给了一个方向提示。
- 记录区分了独立表现、受帮助表现、记忆题和未测边界。
- 最终形成了一条真实证据链：起点假设被推翻 → 收尾闭合形成 → 一次受帮助动作跨外壳独立迁移。
- Roadmap 返回时没有把 Plan 结论当永久标签，而是基于已证能力和未证边界提出下一阶段建议。

### 仍需关注

1. **课堂工具可见失败**：3/29 次调用被拒绝。安全性通过，但学生界面会看到失败卡片，需继续
   做真实模型稳定性试验。
2. **备课等待过长**：第三课从学生确认到准备完成约九分钟，主要耗在材料 Scout 穷尽候选。
   Plan 虽在前后给了进展，但长 Scout 期间仍只有“老师正在思考”，学生体验不够好。
3. **Plan 备课过程偏技术化**：它公开了槽位、Scout、卡片编号和筛选细节。透明度有价值，但可
   压缩为学生能理解的进度与取舍，不必直播内部选材流水账。
4. **能力结论有明确范围**：本轮支持带对数与幂指混合外壳下的选路和闭合；不支持宣称绝对值、
   构造路代价比较或时间压力已经掌握。Plan/Roadmap 已正确保留这些边界。

## 实施提交

- `59a95ba` — safe Lesson source mutations
- `ea16e61` — atomic document writes
- `bdc136b` — deterministic Lesson tools
- `e530c98` — Lesson session tool scoping
- `a25b70a` — write-boundary enforcement
- `8529cc3` — public tool-surface assertions

设计与实施计划：

- `7b69dbb` — deterministic Lesson write design
- `164d4a7` — implementation plan

## 最终验证

完成长周期后重新执行，结果如下：

- `bun run check`：exit 0
  - `tsc --noEmit` 通过
  - 73 tests passed，0 failed，326 assertions
  - Vite production build 通过；仅保留已有的单 chunk 大于 500 kB 警告
- `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`：exit 0，1/1 passed（3.4s）

以上均为长周期完成后的新运行结果，不是实施中途的旧输出。
