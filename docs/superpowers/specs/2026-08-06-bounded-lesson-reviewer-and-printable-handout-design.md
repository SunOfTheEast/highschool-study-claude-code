# 有界 Lesson Reviewer 与可打印讲义设计

**状态：** 已逐段确认，待用户审阅书面规格

**日期：** 2026-08-06

**目标分支：** `codex/gentle-judgment-isomorphic-acceptance`

## 一、背景

M0 长周期终验中，Plan 002 的第二课从学生确认到 Lesson 可开始共用时 9 分 54 秒。其中
generic `reviewer` 单独用时约 203 秒，并返回了完整标准解答、提示梯度、替代证明与课时
分析。父 Coach 随后又重新做了一轮选材、修正与 Lesson 生成。数学核验本身有价值，但
generic Agent 的职责、输出和工具面都远大于当前备课所需。

同一次运行还暴露了权限边界问题：StudyForge 只打包了
`study-material-scout`，但加载完整 `pi-subagents` 扩展后，Plan Coach 仍能发现并调用 Pi
内置的 `reviewer`、`worker`、`planner` 等通用 Agent。当前测试只证明 Plan 具有
`subagent` 工具，没有证明它只能执行产品允许的子 Agent。

讨论同时澄清了 `Worker` 的产品职责。它不是备课执行器，也不替 Coach 编写 Lesson。
Worker 是出版能力：把 Coach 已经选定的公开内容排成学生能在现实中打印、书写和携带的
学习产物。第一版只实现可打印讲义，但边界应允许以后增加题单、复习册或阶段报告，而不
提前猜测完整产物目录。

## 二、目标与非目标

本轮同时完成两个彼此独立的产品改造：

1. 用 StudyForge 专用的风险核验 Reviewer 取代误用的 generic `reviewer`，缩短风险题
   核验路径，同时保留数学与教学质量；
2. 实现第一版出版 Worker：Lesson 准备完成后，经学生同意，把 Coach 点名的
   `Student View` 内容排成可打印讲义。

本轮不做：

- 不让 Reviewer 重新设计整节课、寻找最优题或写 Lesson；
- 不让 Worker 搜索、选材、补写、删改或总结教学内容；
- 不直接生成服务端 PDF、DOCX 或引入 Chromium 渲染队列；
- 不建立第二套教学事实、导出正文副本或长期产物数据库；
- 不穷举未来所有值得生成的学习产物；
- 不用固定秒数替代真实的质量与等待体验比较。

## 三、两条独立链路

```text
备课链路
Coach → 按风险调用 Lesson Reviewer → Coach 物化 Lesson → Lesson 可开始

现实交付链路
Lesson 已准备好 → Coach 询问是否需要讲义 → 学生确认
→ artifact_export → 打印页面 → 学生打印或另存为 PDF
```

Reviewer 位于 Lesson 可开始之前，只在风险确实值得独立核验时进入关键路径。Worker 位于
Lesson 已经可以开始之后；它成功、失败或尚未完成，都不得改变 Lesson 状态或阻塞开课。

## 四、专用 Lesson Reviewer

### 4.1 触发责任

是否调用 Reviewer 是 Coach 的普通教师判断，不建立复杂评分表。以下情形通常值得调用：

- Coach 新自拟了一道数学题；
- 对已有题目做了会改变数学关系或解题路线的实质改编；
- 定义域、参数范围、分类讨论、等号条件或证明闭环存在明显风险；
- 某个数学结论是否成立，会直接改变该 Lesson 的训练目标或活动设计。

原样采用的可信题卡、普通教学编排、措辞微调和纯排版导出不调用 Reviewer。Reviewer
不是每课必经仪式，也不能因为“还可以再检查一下”而不断追加调用。

### 4.2 Reviewer 输入

Coach 提交一份自足的短 brief，只包含完成核验所需的信息：

- 候选题目或活动的完整公开内容；
- 它在本课中的教学作用；
- Coach 预期的结论与主要路线；
- 预计工作量；
- 本次最需要核对的风险点。

Reviewer 不需要重新读取整个 Plan、Lesson Tree、题库或父对话。若 brief 不足以核验，
Reviewer 只指出缺少的决定性信息，不自行扩大搜索范围。

### 4.3 Reviewer 输出

Reviewer 只返回决策所需的短核验：

```text
结论：可用 / 修改后可用 / 不建议使用
决定性问题：只列会改变结论或教学可用性的发现
最低必要修正：指出需要修到哪里
```

没有问题时，简短说明成立即可。Reviewer 不交付完整标准答案、整套提示梯度、替代讲法、
整节课重写稿或候选优劣排行。若一个致命问题只能通过极短的反例或关键推导说明，可以
给出该必要证据，但不能借此扩写成完整讲义。

Reviewer 不编辑文件、不物化 Lesson，也不拥有课程方向。Coach 负责理解核验结果、决定
修正或换用可信材料，并对最终数学、教学作用和持久化内容负责。

### 4.4 Agent 配置

新增打包 Agent `lesson-risk-reviewer`：

- 使用 `openai-codex/gpt-5.6-sol`，thinking 为 `high`；
- 使用 fresh context，不继承父对话、项目上下文或 Skills；
- brief 必须包含核验所需内容，因此不给文件写入、题库搜索或子代理能力；
- 最终输出遵守 4.3 的短核验边界；
- 原生子 Session 继续记录 model、thinking、duration、usage 和 transcript，供验收审计。

第一版先通过缩小任务和最终输出降低时延，不为了速度直接降低 Reviewer 的模型能力。

### 4.5 失败处理

Reviewer 调用失败不等于题目通过。Coach 可以改用已经核验的题卡，或重新处理自己已经
识别的风险点；不能静默跳过后仍声称“已经核验”。系统不自动重试 Reviewer，也不向学生
展开内部审计流水账，只用自然语言说明题目仍在确认。

## 五、Plan 子 Agent 权限边界

### 5.1 允许的 Agent

Plan Session 中，`subagent` 只允许执行：

- `study-material-scout`：按 Coach 的材料意图做浅召回；
- `lesson-risk-reviewer`：对 Coach 点名的风险内容做局部核验。

Pi 内置的 generic `reviewer`、`worker`、`planner`、`oracle`、`scout`、`researcher`、
`delegate` 和 `context-builder` 均不属于教学产品能力。

### 5.2 Session 内运行时守卫

`pi-subagents` 的 `disableBuiltins` 依赖用户级或项目级 settings。StudyForge 不为此修改
用户全局 Pi 配置，也不向 learning set 写入 `.pi/settings.json`。本轮增加一个只随 Plan
Session 加载的运行时守卫，在 `subagent` 真正执行前检查调用：

- 直接调用和并行 `tasks` 中的每一个 Agent 都必须在上述允许列表中；
- chain、任意 generic Agent 和 `list/create/update/eject/disable` 等管理动作全部拒绝；
- 被拒绝的调用立即返回明确错误，不启动子进程，也不产生数分钟等待；
- Scout 的并行浅召回和 Reviewer 的单次 fresh-context 核验继续复用原生
  `pi-subagents` 执行、可观测性和 Session artifact。

Skill 直接写明可用 Agent，不再通过 `subagent(action: "list")` 做能力发现。守卫是实际权限
边界，Prompt 是正确使用说明；两者不互相替代。

## 六、出版 Worker 与讲义触发

### 6.1 产品角色

出版 Worker 只负责表现层：标题层级、内容顺序、分页、留白、答题框和打印样式。Coach
负责选择哪些已有内容进入讲义。Worker 不搜索、不判断哪些内容更值得学习、不补题、不写
讲解，也不把聊天总结成新内容。

第一版的 Worker 是 Runtime 中的轻量出版服务，不是 Pi 内置 generic `worker`，也不需要
大模型重新生成一份正文。

### 6.2 触发时机

`prepare-approved-lesson` 只有在以下事实都成立后才询问讲义：

1. Lesson 已成功写入精确路径；
2. Lesson 已链接进当前 Plan 的 Lesson Tree；
3. Coach 重读后确认 Lesson 可解析并处于 `prepared`；
4. Coach 已经向学生报告课程可以开始。

随后 Coach 自然问一句是否需要可打印讲义，并可用一句话说明准备放入哪些公开内容。
不弹出配置向导，也不要求第二轮形式化确认。学生用“要、可以、嗯”等明确语言同意后，
Coach 才调用导出工具；拒绝、暂时不要或未回应都不影响开课。

学生确认后仍可立即开始 Lesson。讲义链路不改变 Lesson 的 `prepared` 状态，不参与
Lesson 的启动门。

## 七、`artifact_export` 与来源边界

### 7.1 工具输入

Plan Session 新增节点绑定工具 `artifact_export`。第一版只接受一种产物
`lesson-handout`，输入包含：

- 当前 Plan 下一个已链接的 `lessonId`；
- Coach 按希望展示顺序选定的 `blockIds`。

当前 Plan ID 和路径来自 Session owner，不由模型重新填写。工具沿当前 Plan 的 Lesson Tree
解析目标 Lesson，不能枚举其他 Plan 或全局目录寻找同名 Lesson。

### 7.2 Runtime 验证

工具执行时必须确认：

- Lesson 是当前 Plan Tree 中的直接子节点；
- Lesson 路径与父子 owner 一致且能通过严格解析；
- 首次创建讲义链接时 Lesson 处于 `prepared`；链接创建后，即使 Lesson 后续进入
  `active` 或 `closed`，同一打印 URL 仍可继续读取其稳定公开内容；
- 每个 Block ID 存在于该 Lesson，且没有重复；
- 返回顺序只来自请求中的已验证 Block ID。

验证失败时不产生链接，也不寻找替代内容。成功结果只包含产物种类、Plan/Lesson ID、
Block ID 顺序、公开标题和打印 URL；不把 `Student View` 正文复制进工具结果。

### 7.3 单一事实源

第一版不创建导出 Markdown、PDF、manifest 数据库或 `.studyforge/exports`。打印 URL 表达
已经确认的导出意图，并随原生工具结果保存在 Plan Session 历史中。打开页面时，Runtime
重新读取原 Lesson，并只投影：

- Lesson 标题；
- Lesson goal；
- 所选 Block 的标题、activity kind 与 `Student View`。

`Teacher Control`、`Classroom Log`、聊天记录、父模型推理和未选 Block 永远不进入讲义
API。即使学生修改 URL 参数，服务端也必须重新验证 Plan、Lesson 和 Block 关系。

如果来源后来损坏或不存在，页面明确显示来源失效，不扫描目录猜测替代。Lesson 的公开
内容仍是唯一事实；打印页只是可重新生成的只读投影。

## 八、打印页面与对话投影

### 8.1 对话中的讲义卡片

`artifact_export` 的开始、成功和失败事件投影成专用讲义活动，不使用 generic tool 详情。
成功时在对话中显示“查看并打印讲义”卡片；卡片只包含公开标题和链接。重新打开 Plan
Session 时，从原生工具历史恢复同一张卡片。

Reviewer 活动与材料检索活动也分开投影：学生只看到“正在核验题目”及完成或失败状态，
不能看到 Reviewer brief、私有发现或子 Session transcript。`study-material-scout` 继续使用
现有材料检索进展表示。

### 8.2 打印页

新增独立的 utility route，用现有 React Markdown、KaTeX 和打印 CSS 渲染讲义。它不是新的
主导航视图，也不显示 Course Tree、聊天或 Teacher Control。页面包含：

- Lesson 标题与目标；
- 姓名、日期书写区；
- Coach 选择的 Block，保持指定顺序；
- 按活动类型提供的合理作答留白；
- “打印 / 另存为 PDF”按钮。

CSS 使用 A4 尺寸、适当页边距和 `@media print`，避免标题与紧随内容被分页拆开，并隐藏
屏幕操作按钮。公式沿用现有 KaTeX 渲染。第一版不启动服务端浏览器生成 PDF；学生使用
系统打印对话框直接打印或另存为 PDF。

由于第一版只验证并返回来源链接，出版过程通常即时完成，不为它伪造后台队列。产品层面
仍保持非阻塞：Lesson 在调用前已经可开始，任何导出失败都不回滚课程。

## 九、Skill 与 Agent 文本变更

`prepare-approved-lesson` 增加两条阶段行为：

1. 备课中只有遇到 4.1 所述实质风险时，才把点名内容交给
   `lesson-risk-reviewer`；父 Coach 不要求完整解答或整课重写；
2. 完成写入、链接、重读和公开交付后，简短询问学生是否需要讲义；明确确认后才调用
   `artifact_export`。

材料准备 reference 删除 `subagent(action: "list")` 能力发现建议，并继续只把材料槽位交给
`study-material-scout`。Agent 角色文本只说明 Plan 拥有这两类有界子任务和一个出版动作；
不把触发细节重复写进多个常驻文件。

不增加固定话术测试。真实行为验收关注首次是否正确选择 Reviewer、是否等学生确认讲义，
以及是否在 Lesson 已经可开始之后才导出。

## 十、失败与恢复

| 失败 | 产品行为 |
| --- | --- |
| generic Agent 调用 | 运行时守卫立即拒绝；不启动子进程 |
| Reviewer Provider 或执行失败 | 不视为通过；Coach 改用可信材料或重新处理风险，不自动重试 |
| Reviewer 判为需修改或不建议使用 | Coach 负责最小修正或换题；若改变已批准的实质安排，回到学生讨论 |
| `artifact_export` 指向跨 Plan Lesson | 拒绝并报告当前 Plan 不拥有目标 |
| Block 不存在、重复或来源损坏 | 拒绝生成链接；不扫描猜测 |
| 打印页来源后来失效 | 显示来源失效；不暴露其他内容 |
| 讲义生成或渲染失败 | Lesson 保持可开始；学生可稍后重试 |

## 十一、自动化验证

### 11.1 Reviewer 与守卫

- StudyForge 自有子 Agent 目录与 Skill 只声明 `study-material-scout` 和
  `lesson-risk-reviewer`；不把 Pi 内置 Agent 当成产品能力；
- Reviewer 使用 Sol high、fresh context、无写入或搜索能力；
- 守卫允许目标全部来自允许列表的直接调用与并行 tasks；
- 守卫拒绝 generic Agent、混入 generic Agent 的并行 tasks、chain 和管理动作；
- 被拒绝的调用不会启动 child run；
- 对话投影把 Reviewer 与材料检索分开，且不暴露内部 brief 或输出。

### 11.2 讲义工具与服务端

- 当前 Plan 的合法已链接 Lesson 与 Block 顺序可生成公开 URL；
- 跨 Plan、未链接 Lesson、未知 Block、重复 Block 和损坏文档全部失败；
- API 只返回标题、goal、activity kind 和所选 `Student View`；
- API 响应与 HTML 中不出现 `Teacher Control`、`Classroom Log` 或未选 Block；
- 工具历史可恢复讲义卡片，不需要第二份 manifest；
- 打印 route 正确渲染 Markdown、公式、留白和 print controls；
- 讲义失败不修改任何 Roadmap、Plan 或 Lesson 文件。

### 11.3 回归

运行：

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
git diff --check
```

浏览器 E2E 增加一条讲义路径：准备 Lesson、生成讲义投影、打开打印页、确认只见公开内容，
随后仍能正常开始 Lesson。现有 Roadmap、Plan、Lesson 和 Knowledge 主流程不得退化。

## 十二、真实模型验收

在仓库外的隔离 learning set 中，用相同 Sol high 主模型完成两次备课：

1. 使用一张原样可信题卡，确认 Coach 不调用 Reviewer；
2. 使用一项包含真实数学风险的自拟或实质改编任务，确认 Coach 只调用一次专用 Reviewer。

第二条记录从学生确认到 Lesson 可开始的分段墙钟时间、父模型用量、Reviewer duration、
Reviewer 最终输出长度和 Lesson 最终质量，并与 M0 长周期中的 9 分 54 秒、203 秒 generic
Reviewer 基线对照。验收不预设一个武断的硬秒数，但必须同时回答：

- 是否明显减少了重复深审和最终输出；
- 最终题目在定义域、参数范围、分类、等号与证明闭环上是否仍然严谨；
- 教学目标与工作量是否保持；
- 模型是否首次就守住了“风险才审、只审局部、不寻找最优方案”。

同一 Plan 中再确认一次讲义生成：Coach 在 Lesson 已可开始后询问，学生明确同意，讲义卡片
出现，打印页只含选定 `Student View`。拒绝讲义的对照轮不得调用 `artifact_export`。

真实模型验收报告结果优先，不用大量内部调用细节掩盖数学质量、等待体验和现实可打印
产物是否真正成立。一次运行用于验证完整链路，不声称统计意义上的稳定率。

## 十三、完成判定

本轮只有在以下结果同时成立时才算完成：

1. Plan 无法再执行任何 generic subagent；
2. 专用 Reviewer 在真实风险题上给出短而有效的核验，最终质量不打折；
3. 普通可信题卡不会平白支付 Reviewer 成本；
4. Lesson 准备完成后，Coach 会询问但不会擅自生成讲义；
5. 学生确认后可以打开、打印或另存为 PDF；
6. 打印投影只沿当前 Plan Tree 和指定 Block 读取公开内容；
7. Reviewer 或讲义失败都不会伪造成功或破坏 Lesson 生命周期；
8. 自动化回归、浏览器 E2E、`git diff --check` 和真实模型小闭环均通过。
