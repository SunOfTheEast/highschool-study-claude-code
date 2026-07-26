# StudyForge App 功能与面板完善设计

状态：设计已确认，等待书面复核

日期：2026-07-26

## 一、结论

StudyForge 单人本地内测版继续使用现有 Markdown-first 教学内核、Coach/Tutor Session 边界和 Pi Web runtime。本设计不重写现有前端，也不增加第二套学习状态；它只完善学生真正接触的入口、课堂舞台和辅助面板。

第一版同时覆盖四层体验，但完成深度不同：

1. **学习闭环完整**：从继续学习、Coach、备课、Tutor、Trace 到课后复盘必须连贯。
2. **学习可观测突出**：课堂路线、能力变化、证据和深度任务成为产品招牌。
3. **内容探索好用**：题卡、知识节点和材料可以统一搜索和安全预览。
4. **陪伴感可感知**：人设、主题和轻量反馈存在，但不建设养成或游戏经济系统。

顶级页面只保留两个：

- 继续学习首页；
- Plan 三栏工作台。

内容探索、证据透镜、课堂回放、长期记忆确认和人设设置都从当前学习情境打开，不建设后台式功能大厅。

## 二、现有基线

以下能力已经存在，实施时直接复用，不重新设计：

- `SessionTree`：Coach 父会话与 Lesson 子会话导航；
- `ChatPanel`：Coach/Tutor 对话、图片上传、LaTeX 和输入路由；
- `LessonNotebook`：课堂节点、学生安全内容、题卡与结课摘要；
- `AbilityMap`：基于 active Trace 的方法证据投影；
- `EvidenceLens`：从能力节点回到 Trace 与题卡元数据；
- `TaskRail`：深度工作流状态、预算、来源和确认/取消；
- `ReplayTimeline` 与 `RouteMap`：完整回放或 evidence-only 降级；
- Session owner、URL 恢复、事件流重连、安全消息投影和主动能力刷新；
- 现有课堂人设选择。

本设计不改变这些组件背后的教学语义。真正需要新增或改造的界面差异只有：

1. 以继续学习为中心的新首页；
2. 中栏顶部固定的当前 ActivityBlock；
3. 将现有课堂、能力、证据和任务投影组合成纵向右栏；
4. 学生可用的内容探索器；
5. Plan 完成后的长期记忆确认界面；
6. 带预览的人设与显示设置抽屉。

## 三、设计原则

### 3.1 学生先学习，不先管理

首页只有一个主要操作。Plan 工作台中，左栏负责“我在哪里”，中栏负责“我现在做什么”，右栏负责“为什么这样推进、发生了什么变化”。

### 3.2 结构化课堂不等于更多面板

ActivityBlock 是当前学习对象，不应淹没在消息流中。右栏可以展示多种投影，但各区块保持紧凑、可折叠，不把作答区挤成仪表盘。

### 3.3 可观察结论必须能回到来源

能力、路线变化、课后结论和长期记忆都必须能够回到 Lesson、ActivityBlock、active Trace、学生原始作答或真实题卡。断链时显示断点，不补造路径或内容。

### 3.4 展示层不取得教学权

前端不决定 mastery、不自行改变 Plan、不重写 Lesson，也不根据动画或点击生成 Trace。Coach/Tutor 和既有 Session-bound 工具仍是正式写入者。

## 四、信息架构

```text
继续学习首页
  └── Plan 工作台
      ├── Coach Session
      ├── Tutor Lesson Session
      └── Closed / Abandoned Lesson Replay

上下文入口
  ├── 内容探索器
  ├── 证据透镜
  ├── 课堂回放
  ├── 长期记忆确认
  └── 人设与显示设置
```

内容探索器、证据透镜和人设设置使用工作台覆盖层；长期记忆确认使用 Coach 工作台中的确认弹层；Replay 使用工作台中栏的只读模式。关闭覆盖层或完成确认后，界面返回原 Session 与原滚动位置。

## 五、继续学习首页

### 5.1 主要结构

首页按照以下优先级排列：

1. 唯一主按钮：继续最近有效的 Coach 或 Tutor 位置；
2. 当前 Plan 与 Coach 的一句话建议；
3. 当前 Plan 的压缩路线；
4. 最近发生变化的能力与证据；
5. 最近课堂回放入口；
6. 学习集概述和设置等次要入口。

首页不展示完整能力图、题卡列表、工作流历史或大面积统计图。

### 5.2 继续目标

继续目标是 UI 导航偏好，不是新的学习事实。浏览器以本地 UI 偏好 `lastVisitedRoute` 保存最后访问的位置，不写入 learning set。选择顺序为：

1. 浏览器保存的最近有效 Plan/Lesson 路由；
2. Roadmap 中第一个 active Plan 内，按 Lesson Index 选择第一个 `active` Lesson，其次选择第一个 `paused` Lesson；
3. 同一 active Plan 中第一份 `prepared` Lesson；
4. 同一 active Plan 的 Coach；
5. Roadmap 中第一个未完成 Plan 的 Coach。

保存的路由失效时按后续规则降级，不修改 Plan 或 Lesson。

### 5.3 首页信息来源

- Coach 一句话建议来自当前 Plan 的 `Plan Summary`、`Current Position` 和 `Next Lesson Candidate`，不在每次打开首页时重新调用模型生成。
- Plan 路线来自现有 Plan Lesson Index；它是导航投影，不成为自动记忆路由。
- 最近能力变化来自现有 ability projection。
- 最近证据来自 active Trace。
- 最近回放来自已关闭 Lesson 与其 Pi Session/证据回放。

首页只显示最近变化和下一步，不制造“欠课”“落后”或倒计时焦虑。

## 六、Plan 三栏工作台

### 6.1 左栏：位置

左栏沿用 `SessionTree`：

- 当前 Plan 标题与能力标准；
- Coach 根会话；
- Lesson Index 中的 Lesson 子会话与状态；
- 当前 Plan 的简洁进度；
- 返回继续学习首页。

Plan 路线可以由 Coach 调整，但 UI 路线不参与 Tutor 历史注入，也不自动决定该召回哪些旧课。

### 6.2 中栏：当前工作

Coach、Tutor 和 Replay 共享中栏外壳，但内容不同：

- **Coach**：方向讨论、Plan 决策、备课结果和课后复盘；
- **Tutor**：当前 ActivityBlock、围绕它的对话和作答输入；
- **Replay**：课堂时间线、消息、图片、路线变化与 Trace 定位。

Tutor 中栏顶部固定当前 ActivityBlock 的 Student View。它可以是题目、材料、视频、互动讲解、小测或 reflection。固定区域只读取已经公开的安全内容，不返回 Teacher Control、答案、未揭示提示或 alternatives。

当前 Block 下方才是围绕它的自然对话。切换 Block 时：

- 新 Block 替换固定区域；
- ActivityBlock 的结构化 Student View 只由固定区域渲染一次，消息流不再重复同一题目或材料正文；
- 旧对话仍留在 Session 历史；
- 右栏 Notebook 保留所有课堂节点供回看；
- 不重写或压缩当前 Tutor Session 的已有前缀。

### 6.3 右栏：上下文纵向堆叠

右栏采用纵向堆叠而非单一面板。所有区块可折叠；“存在”不等于“全部展开”。

Tutor 默认顺序：

1. 课堂路线；
2. 当前相关能力信号；
3. 最近证据；
4. 深度任务。

Coach 默认顺序：

1. Plan 路线与当前位置；
2. Planner Attention；
3. 相关旧课摘要与来源；
4. 备课或证据工作流。

Replay 默认顺序：

1. 回放定位；
2. 初始路线与实际路线；
3. 课前/课后能力变化；
4. 证据链。

默认展开当前最相关区块；其他区块显示一行摘要。工作流仅在存在 proposed/running artifact 或最近一份 completed artifact 时出现，不能用空面板或完整历史占据课堂空间。

## 七、内容探索器

### 7.1 功能

内容探索器统一搜索：

- 真实题卡；
- 主方法、次方法和其他现有图谱节点；
- 学习材料与视频切片。

题卡结果必须返回真实路径、安全元数据和完整 active Trace 历史。Trace 结果能够反查真实题卡。空结果保持为空，不生成编号、别名或路径。

首版只读，不提供 YAML、Markdown 或图谱编辑器。

### 7.2 防剧透范围

不同界面使用不同可见范围：

- **Tutor active/paused**：只搜索已经公开的题卡、材料和方法节点；
- **Coach**：可以浏览整个学习集的学生安全投影；
- **Replay**：可以浏览整个学习集的学生安全投影，并优先突出本 Lesson 来源。

“已经公开”指当前或已完成 Block 的 Student View 已经呈现的来源，以及学生自己的 active Trace 已经确认的方法节点。仅存在于 Teacher Control、未开始 Block、卡片答案、未揭示提示或 alternative sidecar 的内容不属于已公开范围。

无论在哪个界面，学生模式都不返回题卡答案、rubric、Teacher Control、未揭示提示、私有证据矩阵或存储的另解正文。

## 八、证据、回放与长期记忆

### 8.1 证据透镜

现有 `EvidenceLens` 扩展为通用覆盖层，可以从能力节点、Trace、题卡、课堂路线变化和课后结论打开。它展示：

```text
Plan 目标
  → Lesson / ActivityBlock
  → active Trace
  → 学生原始作答
  → 真实题卡
  → 已确认的方法节点
```

透镜不推断缺失边，也不维护第二份知识图谱。

### 8.2 回放

继续复用 Pi Session、Lesson、Route Changes 和 active Trace 重建回放。Pi Session 不可用时明确降级为 evidence-only。回放不复制完整事件日志。

### 8.3 长期记忆确认

Plan 完成后，Coach 读取该周期的 Lesson Summary、必要的 active Trace 和来源，生成长期记忆候选差量。确认界面允许学生：

- 接受一条；
- 修改表述后接受；
- 删除一条；
- 暂不处理。

只有确认后的条目写入学生画像或教学画像。候选差量在确认前只属于当前 Coach Session，不成为长期学习事实；Session 丢失时由 Coach 从同一批正式来源重新生成，不新增 pending-memory 存储。每条确认记忆保留到 Lesson Summary、Trace 或原 Session 的来源句柄。

## 九、陪伴与人设

现有人设选择升级为带预览的设置抽屉，展示：

- 头像或静态立绘；
- 主题配色；
- 语言与等待风格说明；
- 轻量阶段动效；
- 节点完成反馈。

人设按现有 Session 资源视图生效。它不得改变教学事实、评分语义、提示权限、工具权限或 Coach/Tutor 职责。资源缺失时回退到中性主题。

首版不增加好感度、抽卡、虚拟货币、每日任务或强制连续学习机制。

## 十、状态与数据流

App 继续使用现有事实所有权：

| 数据 | Owner |
|---|---|
| Roadmap、Plan、Lesson | Markdown learning set |
| 题卡、图谱、材料 | `cards/`、`graph/`、`materials/` |
| 学生作答证据 | active Trace |
| 已确认长期偏好 | `memory/` |
| Coach/Tutor 对话与工作流原始记录 | Pi Session JSONL |
| 首页、能力、路线、回放与面板 | 可重建投影 |

更新链路保持为：

```text
学生操作
  → 当前 Coach 或 Tutor Session
  → Session-bound 工具写入事实
  → runtime 重读正式 owner
  → 生成 Student-safe snapshot/event
  → 中栏与右栏同步刷新
```

Lesson Summary 继续作为 Coach 的检索入口，不自动注入 Tutor。Coach 编译出的当前 Lesson 仍是 Tutor 唯一的正式 Handoff。

## 十一、失败与降级

继续复用已有重连、路由恢复、安全投影、工具 receipt 和 evidence-only 回放。新增界面只遵循以下最小原则：

- 辅助区块读取失败时只降级该区块，不阻塞聊天或当前课堂；
- 内容来源断链时显示断点；
- 写入失败前不显示成功状态；
- 最近保存路由失效时使用首页继续目标的确定性降级顺序；
- 内容探索器空结果保持为空；
- 不增加消息队列、后台对账、第二套事件日志或复杂重试状态机。

## 十二、首版非目标

- 多用户、班级、教师后台与权限系统；
- 云端账号、支付和用量计费；
- 学习集内容编辑器；
- 新的长期记忆数据库、向量库或后台索引；
- 第三个顶级 Agent；
- 拓扑驱动的旧课 Handoff 自动注入；
- 让 UI 或规则引擎代替 Coach 调整 Plan；
- 离线模型运行；
- 游戏经济与重型 Live2D 运行时。

## 十三、实施边界

实现应以现有组件为中心：

| 新增或改造 | 复用 |
|---|---|
| 继续学习首页 | `LearningSetHome`、现有 route restore |
| 固定 ActivityBlock 舞台 | `ChatPanel`、`StudentNotebook` 的安全 Block |
| 纵向 Context Stack | `LessonNotebook`、`AbilityMap`、`TaskRail`、`EvidenceLens` |
| 内容探索器 | 现有 card/trace/source 领域模块与真实性 fence |
| 长期记忆确认 | 现有 Plan 周期聚合 Skill 与 confirmed profile |
| 人设设置抽屉 | 现有 `PersonaPresentation` 与 Session persona API |

不为了组合面板而改变持久 schema、公共四 MCP 工具或 Coach/Tutor 写权限。

## 十四、验收标准

### 14.1 自动验收

- 首页能恢复最近有效路由，并在路由失效时确定性降级；
- Tutor 中栏只固定当前 Block 的 Student View；
- Trace 写入后，右栏能力与最近证据在同一课堂中刷新；
- 深度工作流状态出现在右栏且不复制原始子 Session 内容；
- Tutor 内容探索器不能读取未公开来源或答案字段；
- Coach/Replay 内容探索器只返回学生安全投影；
- 记忆候选在确认前不修改 profile，确认后只写选中条目；
- 人设切换不改变 Lesson、Trace、Plan 或工具权限；
- 刷新后恢复原 Session、课堂节点和面板数据；折叠/展开状态允许回到各角色的默认值。

测试只覆盖可执行行为、权限、投影和持久化，不测试 Skill 文案、标题或固定措辞。

### 14.2 真实内测

使用复制后的导数学习集完成至少一个多 Lesson Plan：

1. 从首页一键继续暂停的 Lesson；
2. 在固定 ActivityBlock 中完成题目、图片或小测；
3. 观察 Trace、能力、路线和工作流在右栏更新；
4. 在 active Tutor 中验证内容探索器不能查看未公开来源；
5. 关闭 Lesson，进入 Replay，再返回原 Coach；
6. 完成 Plan，接受、修改并删除不同的长期记忆候选；
7. 重启本地服务后继续原位置。

成功标准不是面板数量，而是学生能在不接触终端和文件系统的情况下完成连续学习，并能理解“现在学什么、为什么这样安排、结论来自哪里”。
