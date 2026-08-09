# StudyForge 学生正文与教师批注分离设计

状态：已批准，待实施

日期：2026-08-01

## 一、结论

StudyForge 不再把“教师如何教”和“学生现在看到什么”写在同一份自由文案中。Roadmap、
Plan、Lesson 三层统一采用：

```text
学生正文 + 教师批注增量 + 课堂事实
```

- **学生正文**是公开教学内容的唯一持久 owner；
- **教师批注**只保存相对学生正文新增的教学判断；
- **Trace 与 Handoff**记录学生实际上发生了什么，不回填成备课判断；
- 首页、课程树、课堂页面、聊天恢复和学生 API 只消费学生正文及其可重建投影；
- Coach 与 Tutor 按当前节点装配少量教师批注，但不得向学生引用或改写其中尚未揭示的
  结论。

这不是两份等长的书。它更接近“学生教材加教师批注层”：公开内容只保存一次，教师
侧通过相同节点 ID 或 Block ID 附加教学意图、观察重点和介入原则。

## 二、问题与根因

真实课程中，Coach 在题卡检索和私有路线比较后调用 `plan_update`，把方法名、预设
卡点和换路判断写入了学生可见的 `Current Position`、`Plan Summary` 或 Candidate
说明。安全消息投影隐藏了工具参数，却无法识别已经落入公开字段的教师文案；页面刷新
随后从 Plan Markdown 正常重建并显示这些内容。

现有 Lesson 已有 `Student View / Teacher Control`，但二者仍位于同一份文档、同一次
自由生成中。它解决了基本揭示顺序，没有彻底解决三件事：

1. Roadmap 与 Plan 没有相同的教师/学生文案边界；
2. 同一自由文本写入可以把私有判断放入公开字段；
3. Context 组装容易把整份教师内容和整份学生内容同时注入。

因此，根因不是 `card_search` 之后能否继续写 Plan，也不是关键词过滤不够严，而是
教师文案和学生文案没有各自的持久 owner、读取范围和写入通路。

## 三、与既有设计的关系

本设计延续：

- 学习节点树的父子控制权、激活冻结和 Handoff 证据继承；
- Markdown-first 的事实治理；
- 题卡、方法图谱、材料和全局 Trace Pool；
- Lesson 的逐 Block 揭示、提示阶梯和 Tutor Session 连续性；
- 默认学生安全投影和可选 authoring/raw 调试面。

本设计明确修订两项既有决定：

1. `2026-07-29-student-safe-plan-projection-design.md` 中“不增加 Plan 的第二份
   public/private 文件”不再适用。该设计的学生安全投影仍保留，但其输入改为天然公开
   的学生正文，而不是从混合 Plan 文案中猜测安全内容。
2. Lesson 的 `Student View / Teacher Control` 揭示语义继续保留，但持久位置拆开。
   学生正文保存公开 Block；原 `Teacher Control` 的教学增量迁入对应教师批注文件。

教师批注是节点附件，不是新的学习节点，不改变 Roadmap → Plan → Lesson →
ActivityBlock 的树结构。

## 四、目标与非目标

### 4.1 目标

- 在 Roadmap、Plan、Lesson 三层建立一致的教师/学生文案边界；
- 保留学生正文的自然语言自由度，不把教学内容改造成庞大表单；
- 私有检索可以继续影响备课和规划，但不能静默改变学生已经确认的公开方向；
- Tutor 保留单 Session 连续教学和即时自然表达；
- 教师批注按当前节点或当前 Block 注入，不把上下文扩大为两份全文；
- 让公开写入、教师批注写入和课堂事实写入拥有不同职责；
- 让缺少关键备课信息的诊断类 Block 在开课前被发现；
- 让前端不再把已经正确写入教师批注的内容重新当成学生文案；模型直接生成的学生正文
  与课堂口语仍由教学 Skill 和真实课程验收约束。

### 4.2 非目标

- 不增加第二个常驻 Tutor、逐回复审查 Agent 或独立语言润色模型；
- 不复制完整题面、学生进度或公开目标到教师文件；
- 不建立关键词、公式、方法名或“疑似剧透”规则引擎；
- 不阻止拥有本地文件权限的开发者主动打开教师批注；
- 不把教师批注当作学生表现事实或 BKT 证据；
- 不允许父节点在子节点 active 后继续改写其备课内容；
- 不为旧的混合 Lesson/Plan 格式增加长期兼容读取路径；
- 不改变公共 Claude Code 插件现有四个 MCP 工具。

## 五、信息所有权

| 事实 | 唯一持久 owner | 写入者 | 学生默认可见 |
| --- | --- | --- | --- |
| 公开目标、课程目录、活动要求 | 学生正文 | 当前 Coach 或准备工具 | 是 |
| 题目公开题面与已揭示材料 | 卡片/材料及学生课堂投影 | Runtime/Tutor | 按揭示状态 |
| 选材理由、预判路线、教学意图 | 教师批注 | Coach/备课流程 | 否 |
| 观察重点、介入原则、提示阶梯 | 教师批注 | Coach/备课流程 | 否 |
| 学生作答与支持事实 | Trace | Tutor，经 Runtime 绑定 | 经学生投影 |
| 子节点压缩结论 | Handoff | 终态节点的封存流程 | 按 reader 投影 |
| 长期偏好 | 已确认画像 | Plan 周期复盘与学生确认 | 是 |
| 页面卡片、进度视图 | 可重建投影 | Runtime | 是 |

教师批注不能重复保存学生正文。它可以用“当前 Block”“候选 A”等运行时已知的短别名
引用公开对象，但不得重新抄写题面、公开目标、Block 顺序、节点状态或学生进度。

教师批注也不能记录“学生已经掌握”“学生总是粗心”等纵向结论。真实课堂观察进入
Trace；跨课聚合、画像和 BKT 投影仍由其现有 owner 负责。

## 六、文件结构

现有公开路径保持为学生正文。新增 `teacher/` 镜像目录，只保存教师增量：

```text
learning-set/
├── ROADMAP.md
├── plans/
│   └── route-selection.md
├── lessons/
│   └── lesson-001.md
└── teacher/
    ├── ROADMAP.md
    ├── plans/
    │   └── route-selection.md
    └── lessons/
        └── lesson-001.md
```

镜像路径由 Runtime 从当前 Session owner 推导，模型不填写 learning-set 根目录、真实
ownerPath、父节点路径、Session ID 或教师文件路径。

教师文件的 frontmatter 由 Runtime 写入 owner kind、owner ID 和公开文档引用。模型只
提供不可推导的教学判断。节点状态、版本和父子关系仍以学生正文及学习节点 Runtime 为
准，教师文件不保存第二份状态。

### 6.1 Roadmap 教师批注

只保存长期规划层面的增量，例如：

- 当前规划假设；
- 需要继续观察的矛盾；
- 为什么暂时选择某个 Plan 方向；
- 哪些结论证据不足，不应写入长期画像。

### 6.2 Plan 教师批注

只保存本周期教学设计增量，例如：

- 当前诊断与选课逻辑；
- 各候选 Lesson 的选择理由与使用条件；
- 后续备课要关注的反证；
- 对子 Lesson Handoff 的教学解释。

### 6.3 Lesson 教师批注

按 Runtime 分配的 Block ID 对齐。每个需要批注的 Block 最少包含：

```text
教学意图
观察重点
介入原则
```

可选包含：常见错误、提示阶梯、备选路线、判断依据和 Trace 注意事项。参考答案和题卡
解法仍由真实卡片/材料拥有；教师批注优先引用稳定 alias 或 step，不复制完整答案。

## 七、条件式批注要求

教师批注不是每个 Block 的形式化填空。

| Block 类型 | 批注要求 |
| --- | --- |
| orientation、material、video、free-dialogue | 可选 |
| problem、assessment、diagnostic | 必需 |
| reflection | 由课堂模板是否声明复盘目标决定 |

需要判断学生表现的 Block 缺少最小批注时，不得进入 active。普通介绍或材料活动没有
批注时，Teaching Frame 为空，Tutor 按学生正文、学习集原则和当前对话正常进行。

## 八、三条写入通路

### 8.1 学生正文通路

`roadmap_update`、`plan_update` 和 Lesson 准备流程继续负责公开目标、节点安排、当前
位置和活动骨架。学生正文只写学生已经同意或此刻可以看见的内容。

公开方向的改变必须发生在正常学生对话中。私有选卡发现材料与原目标不匹配时，Coach
先向学生解释需要调整的方向；学生确认后再更新学生正文。不存在“调用过搜索后永久
禁止更新 Plan”的时间型规则。

### 8.2 教师批注通路

Pi Runtime 提供一条 Session-bound 的内部教师批注写入能力。Runtime 根据当前节点
绑定真实 owner 和镜像路径；模型不选择写入文件。Roadmap/Plan Coach 可以写当前节点
的教师增量，不能写子节点已经 active 或 terminal 的教师文件。

Lesson 准备时，公开 Block 骨架与教师批注作为语义上分开的输入，由 Runtime 在一次
准备事务中落到两个文件。这样不增加第二次模型调用，也避免“学生版再重写一遍”的
输出消耗。必需批注验证失败时，两侧都不物化。

学生正文从学生已经确认的公开方向、公开活动类型和可揭示的卡片/材料生成，不以教师
批注为底稿执行删减或脱敏。教师批注可以引用学生正文，学生正文的生成来源不包含教师
批注自由文本。

这条内部能力不加入公共 Claude Code 插件的四工具接口。

### 8.3 课堂事实通路

Tutor 不重写教师批注。课堂中产生的新信息继续通过：

- `classroom_update` 更新执行状态；
- `trace_append` 记录真实作答和支持；
- `lesson_close` 封存 Lesson Summary 与 Handoff；
- 既有更正机制修订错误 Trace。

新发现沿 Handoff 返回父节点，成为下一次规划和备课的输入，不倒灌修改已经发生的备课
版本。

## 九、生命周期与重新备课

```text
学生确认公开方向
  → 写学生正文
  → 私有检索、选材和分析
  → 写教师批注
  → prepared
  → Tutor 激活 Lesson
  → Trace / Handoff
  → 父节点复盘并编排未来节点
```

- Candidate 可以由父节点自由重排；
- prepared 节点可在学生激活前重新备课，学生正文和教师批注作为同一版本替换；
- active 节点取得自己的控制权，父节点不得改写两侧备课内容；
- Tutor 可以调整课堂执行顺序和状态，但不把临场对话写回教师批注；
- terminal 节点只通过 Trace 更正和后续 Handoff/复盘解释新事实，不重写历史教案。

## 十、上下文装配

每次模型调用按需组装三帧：

```text
Public Frame   = 当前学生正文或当前公开 Block
Teaching Frame = 当前节点或当前 Block 的教师批注增量
Live Frame     = 当前 Session、课堂状态及相关 Trace
```

默认范围为：

| Session | Public Frame | Teaching Frame | 历史入口 |
| --- | --- | --- | --- |
| Roadmap Coach | 当前 Roadmap | Roadmap 批注 | Plan Handoff、长期记忆 |
| Plan Coach | 当前 Plan 与父层公开摘要 | Plan 批注 | Lesson Handoff、相关 Trace |
| Tutor | 当前 Lesson 的当前 Block | 对应 Block 批注 | 本课对话、绑定题卡及其 Trace |

Roadmap 不预载整个学习集，Plan 不预载所有 Lesson 原始记录，Tutor 不预载整节 Lesson
的全部教师批注。需要细节时继续沿 Handoff Claim、Trace、卡片和 scoped search 入口按需
解析。

教师批注只决定采取什么教学动作；Public Frame 与 Live Frame 决定这句话如何自然表达。
同一个 Tutor 在一次模型调用中完成判断和表达，不增加逐回复子 Agent 或第二次语言模型
调用。

## 十一、学生可见投影

学生前端、学生 API、页面刷新和 Session 恢复只读取：

- 学生正文；
- 当前节点公开状态；
- 已揭示卡片与材料；
- 公开 Trace/Handoff 投影；
- 已经生成的学生可见课堂消息。

它们不读取 `teacher/` 作为回退来源。教师批注缺失、损坏或读取失败时，学生界面降级为
现有公开说明，绝不回退显示原文件。

Coach 完成私有检索或教师批注写入后，课程就绪卡和结构化状态继续从学生正文重新读取。
包含工具调用的混合消息沿用 safe 投影；模型的教师批注内容不会成为页面标题、
`publicPurpose`、Current Position 或候选说明的数据源。

开发者显式 authoring/raw 模式可以查看教师批注和原始 Session，用于调试；这不改变
学生默认面。

### 11.1 两种不同强度的保证

- **确定性结构边界**：学生 reader、前端接口和安全投影没有读取 `teacher/` 的代码
  路径；教师批注工具也不能写入学生正文。因此，一段已经正确归档为教师批注的内容
  不会再经 Plan 页面、刷新恢复或课程卡片泄漏。
- **教学表达边界**：Coach/Tutor 仍是能看见教师信息的自然语言模型，理论上仍可能在
  学生正文或课堂口语中主动说漏。此边界由 Frame 提示、揭示策略和真实课堂验收改善，
  本设计不声称用 schema 完全判定所有数学剧透。

两者必须分别验收，不能用结构测试通过来证明模型教学表达永远安全。

## 十二、失败处理与一致性

1. 可选批注缺失：Teaching Frame 为空，正常运行。
2. 必需批注缺失：准备或激活前返回明确缺口，Coach 补充后重试。
3. 批注引用不存在的 Block：拒绝写入，不猜测最相近节点。
4. Lesson 双侧写入任一失败：准备事务不物化 Lesson，也不修改父 Plan 索引。
5. Roadmap/Plan 教师批注写入失败：已确认的学生正文保持有效；私有写入可重试，不回滚
   学生已经确认的公开事实。
6. 学生正文改变导致旧批注失配：prepared 阶段重新备课时替换同版本批注；active 后
   禁止父节点修改。
7. 孤立或失配的教师批注只在 authoring/audit 面报告，学生投影忽略。
8. 任何失败都不得把教师文件、工具参数或私有 Session 文本作为学生回退内容。

## 十三、Token 与缓存

本设计不生成两份完整文案：

- 学生正文只保存公开内容；
- 教师批注只保存差量，不复述公开事实；
- Lesson 准备仍可在一次模型调用中同时给出两类语义字段；
- Tutor 只注入当前 Block 的两侧片段；
- 历史细节继续按来源按需读取；
- 不增加每轮学生回复的第二个模型调用。

因此新增消耗主要是持久化原本停留在备课 Session 中的少量教学判断，而不是把原
Roadmap、Plan、Lesson 全量复制一遍。真实验收关注 Context Frame 实际尺寸和缓存命中，
不设置脱离内容差异的固定 token 上限。

## 十四、迁移

本项目不保留旧混合格式兼容层。实施时执行一次明确迁移：

1. 保留现有公开 Roadmap/Plan 内容，并清理其中已经识别的私有备课用语；
2. 将 Lesson 的公开 `Student View` 编入学生正文；
3. 将 `Teacher Control` 的教学增量迁入 `teacher/lessons/`；
4. 题面、答案和解法仍由真实题卡拥有，不在迁移中复制；
5. 更新学习集模板、导数示例和运行时 fixture；
6. 新 Runtime 不再从学生 Lesson 文件读取旧 `Teacher Control`。

迁移只处理仓库内当前规范学习集和测试资产，不实现旧用户文件的自动猜测式升级。

## 十五、验收标准

### 15.1 确定性契约

- 教师镜像路径、owner、节点 ID 和版本均由 Runtime 绑定；
- 教师批注不能修改学生正文、节点状态、父子索引或 Trace；
- 学生 API、Course/Knowledge/Memory 页面和刷新恢复不返回 `teacher/` 内容；
- problem、assessment、diagnostic 缺少最小批注时不能激活；
- `lesson_prepare` 双侧写入原子成功或原子失败；
- 当前 Block 的 Context Frame 不包含其他 Block 的全部教师批注；
- public Claude Code MCP 工具数量保持不变。

### 15.2 真实课堂验收

至少覆盖：

1. Coach 私有检索后更新教师批注，Plan 页面没有方法名、卡点或选材理由；
2. Tutor 使用教师批注发现学生路线中的关键缺口，但先追问而不是复述隐藏结论；
3. 学生给出意外正确路线时，Tutor 能基于 Live Frame 调整，而不被预设答案绑死；
4. 无批注的普通材料 Block 可以自然运行；
5. 必需批注缺失时返回 Coach 补充，不生成半份 Lesson；
6. 重新备课、页面刷新和 Session 恢复后两侧仍指向同一节点版本；
7. 对比实施前后 Context Frame，确认没有两份全文注入；
8. 学生可见语言自然，不出现 Teacher Control、内部矩阵、工具旁白或验收报告式措辞。

Skill 文本不做逐句测试。测试集中在持久 owner、工具写入边界、原子准备、reader 投影、
Context Frame 范围和真实模型课堂行为。

## 十六、最终原则

> 学生正文规定现在可以公开什么；教师批注帮助 Agent 决定怎样教；Trace 与 Handoff
> 记录学生实际上发生了什么。三者互相引用，但不互相冒充。
