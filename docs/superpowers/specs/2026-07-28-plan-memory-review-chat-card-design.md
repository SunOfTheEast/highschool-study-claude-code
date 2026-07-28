# Plan 长期记忆确认聊天卡片设计

状态：设计已通过，等待书面复核

日期：2026-07-28

## 一、问题

StudyForge 已经确定长期记忆的语义：

- `student-profile.md` 只保存经学生确认、跨 Lesson 仍有用的学习偏好、习惯和现实约束；
- `teaching-profile.md` 只保存经学生确认的 Tutor 互动、提示、等待和讲解要求；
- 能力判断、单题表现和当前备课提醒分别留在 active Trace、Plan Summary 与
  Planner Attention，不进入长期画像；
- Plan 完成时才汇总本周期课堂记录，并由学生逐项确认画像差量。

Claude Code 插件已经有 `consolidate-plan-memory` Skill，但当前 Pi 学生前端没有一条
完整、结构化的确认路径。Coach 可以在聊天中描述候选，却没有可靠的逐项选择界面；
候选、学生决定和真实画像写入状态也容易混在普通消息中。

旧分支 `codex/app-function-panels` 曾实现一版 Plan memory review，但它从
`731dfb9` 分叉，当前主线已经继续演进 48 个提交，增加了严格 Plan、Roadmap Coach、
新的 Session scope 和课后 Plan 审阅语义。旧实现只作为参考，不直接合并或
cherry-pick。

## 二、设计结论

本切片只补齐以下闭环：

```text
学生确认完成 Plan
  → Plan Coach 将 Plan 写成 completed 并重读
  → Coach 生成带真实来源的长期记忆候选
  → 聊天流出现结构化“长期记忆待确认”卡片
  → 学生打开面板并逐项采用、改写后采用或不采用
  → 决定保存在同一个 Plan Coach Session
  → 隐藏结构化事件唤醒同一个 Coach
  → Coach 编辑画像并重新读取
  → Coach 根据读回结果报告
```

候选和学生决定是 Plan Coach Session 中的临时工作状态，不是正式学习事实。两份
画像仍是唯一的已确认长期记忆。前端不直接编辑画像，也不显示未经 Coach 读回确认的
“写入成功”。

本设计不迁移旧分支的继续学习首页、课堂固定舞台、上下文栏、内容探索器或人设抽屉。
这些能力按后续纵向切片分别设计和移植。

## 三、触发与生命周期

### 3.1 触发条件

只有 Plan-scoped Coach 可以提出长期记忆候选，并且必须同时满足：

1. Session owner 是真实 `plans/<plan-id>.md`；
2. 该 Plan 已由学生确认完成；
3. `plan_update` 已把 Plan 和 Roadmap 状态写成 `completed`；
4. Coach 已重新读取写回后的 Plan。

Roadmap Coach、Tutor、active Plan 和尚未进入的 Plan 均不能提出确认单。Plan 完成与
长期记忆确认保持解耦：学生选择“稍后处理”不会把 Plan 改回 active，也不会阻止进入
其他 Plan。

### 3.2 空差量

并非每个 Plan 都会产生值得常驻的偏好。没有合适候选时，Coach 直接说明本周期无需
更新长期记忆，不调用提议工具，也不显示空确认卡片。

### 3.3 暂缓与恢复

候选生成后，聊天流自动出现入口，但不强制打开遮罩层。学生点击“稍后处理”只收起
当前关注状态，关闭确认面板同样不改变 Session artifact 或画像。刷新页面、重启服务
或重新进入同一个 Plan Coach 时，卡片和候选仍可恢复。

## 四、长期记忆候选语义

### 4.1 允许进入画像的内容

`student` owner 只用于：

- 稳定的学习偏好；
- 反复出现的学习习惯；
- 跨课仍有效的现实约束。

`teaching` owner 只用于：

- Tutor 应怎样等待、追问或介入；
- 学生确认有效的讲解与互动方式；
- 需要跨 Lesson 保持的教学要求。

以下内容不得作为长期记忆候选：

- “某方法已经掌握”或“某知识点薄弱”等能力结论；
- 单题正误、某次提示依赖或一次临时状态；
- Planner Attention 中尚未核查的备课提醒；
- 展示人设、主题或纯 UI 偏好；
- 没有原始来源的模型印象。

### 4.2 候选字段

每条候选具有最小、无歧义的结构：

```ts
type MemoryReviewItem = {
  id: string;
  operation: 'add' | 'revise' | 'delete';
  owner: 'student' | 'teaching';
  currentText: string | null;
  proposedText: string | null;
  sources: string[];
  rationale: string;
  counterEvidence: string;
  scope: string;
};
```

字段规则：

- `add`：`currentText` 为空，`proposedText` 非空；
- `revise`：两者均非空；
- `delete`：`currentText` 非空，`proposedText` 为空；
- `revise` 与 `delete` 的 `currentText` 必须能在对应当前画像中找到；
- `sources` 至少包含一个当前 learning set 内可解析的 Plan、Lesson、
  ActivityBlock 或 active Trace 来源；
- `rationale` 解释为什么值得跨课保留；
- `counterEvidence` 说明冲突、例外或当前未见相反证据；
- `scope` 限定适用场景，避免把局部偏好泛化为普遍规律。

完整 Lesson、题卡正文和课堂对话不复制进候选。候选只保存紧凑解释和来源句柄。

### 4.3 学生决定

学生可对每条候选选择：

```ts
type MemoryReviewDecision = {
  itemId: string;
  action: 'accept' | 'rewrite' | 'reject';
  text: string | null;
};
```

学生界面使用“采用 / 改写后采用 / 不采用”，避免旧版“保留 / 改写 / 删除”与
候选自身的 `delete` 操作产生歧义。

- `accept`：采用候选原本的新增、修改或移除动作；
- `rewrite`：采用学生填写的非空文本；对于删除候选，表示保留但改写旧条目；
- `reject`：不执行该候选；
- 所有条目都作出决定后才可一次提交。

## 五、界面体验

### 5.1 聊天流事件卡

候选生成后，在相应 Coach 回复后显示：

```text
长期记忆待确认                              待确认

本周期整理出 3 条可能长期有用的偏好
学生画像 2 条 · 教学画像 1 条

[逐条确认]  [稍后处理]
```

这不是 Agent 手写的 Markdown，而是由 Session custom entry 投影的结构化事件。
数量、状态和按钮不由模型生成。

点击“逐条确认”打开确认面板；点击“稍后处理”只收起当前关注状态，卡片仍留在聊天
中的首次位置，之后点击卡片即可重新打开。这个收起状态不需要持久化。学生提交后，
同一张卡片原位更新为：

```text
长期记忆确认                              已提交

3 条选择已经交回 Plan Coach
画像是否更新，以 Coach 的写入和重新读取结果为准
```

不生成第二张卡片，也不增加“已应用”状态。真实结果由随后的 Coach 回复和画像文件
共同表达。

### 5.2 确认面板

面板逐条展示：

- 新增、修改或移除；
- 学生画像或教学画像；
- 当前条目与建议条目；
- 真实来源；
- 保留理由；
- 冲突或例外；
- 适用范围；
- 采用、改写后采用、不采用。

每条候选初始均为“未选择”，不能默认采用。学生必须主动处理每一条，全部候选都有
决定后才允许提交。

未提交的输入只属于当前浏览器组件状态。关闭再打开时可以保留本次页面生命周期中的
输入；刷新后未提交的临时改写可以丢失，但正式候选不会丢失。

active Trace 来源可以复用现有 Evidence Lens 下钻。Plan、Lesson 或画像来源首版只
显示精确文件和锚点；通用 Markdown 来源预览留给后续内容探索器切片。

## 六、Session ownership 与持久化

### 6.1 Custom entry

使用 custom type：

```text
studyforge.memory-review.v1
```

同一个稳定 Review ID 采用只追加快照：

```ts
type MemoryReviewSnapshot = {
  id: string;
  planId: string;
  status: 'proposed' | 'submitted';
  items: MemoryReviewItem[];
  decisions: MemoryReviewDecision[];
};
```

第一条快照保存 `proposed`，学生提交后追加同 ID 的 `submitted`。读取时使用最新
快照作为内容，但保留首次 `proposed` 的聊天位置。Session JSONL 只保存候选与决定，
不成为第二份画像。

不创建 `memory/pending-*.md`，不使用 localStorage 保存正式候选，不增加数据库、
后台队列或事务状态机。

### 6.2 内部工具

新增 Pi 内部工具：

```text
memory_review_propose
```

它只向 Plan Coach 注册，职责仅为：

1. 验证 Session-owned Plan 已 completed；
2. 验证候选 ID、操作字段、当前画像条目与来源；
3. 保存 proposed snapshot；
4. 返回最小 receipt：`ok`、`reviewId`、`itemCount`。

它不编辑 Plan、画像、Lesson 或 Trace。Roadmap Coach 与 Tutor 的可用工具列表中不
出现该工具。Claude 插件公开 MCP 仍严格保持四个。

### 6.3 提交给 Coach

学生提交后：

1. 运行时验证决定覆盖全部候选、无重复 ID，rewrite 文本非空；
2. 追加 submitted snapshot；
3. 通过隐藏的 `studyforge.memory-review-decisions.v1` 消息，把精确决定交给同一个
   Plan Coach 并触发一次正常 turn；
4. Coach 只应用 accept 与 rewrite 的最终含义；
5. Coach 按 owner 编辑对应画像，并重新读取两份画像；
6. Coach 只根据读回结果回复。

隐藏事件不投影成一条带 JSON 的学生消息。提交只表示学生选择已经保存并交给 Coach，
不表示画像写入成功。

## 七、聊天时间线投影

现有聊天历史只有普通 `ChatMessage`。本切片将内部投影扩展为：

```ts
type ConversationItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'memory-review'; review: MemoryReviewSnapshot };
```

不新增第二个 timeline API；现有 Session 历史读取改为返回统一
`ConversationItem[]`，ChatPanel 按 kind 渲染普通消息或 MemoryReviewCard。

恢复算法按 Pi Session JSONL entry 顺序工作：

1. 普通可见消息按现有 safe/raw 规则投影；
2. 遇到 proposed custom entry 时暂存；
3. 下一条可见 Coach 回复完成后，将卡片插在该回复之后；
4. 如果该轮没有可见 Coach 回复，则在 turn 结束或历史末尾插入；
5. 后续同 ID submitted entry只更新首次位置的内容。

实时事件使用相同顺序：工具调用时不抢先显示卡片；下一条可见 Coach 消息结束或
agent end 时才发布。这样实时观看与刷新恢复得到相同顺序。

## 八、Skill 与事实边界

`coach-study` 增加一条简洁职责：

- Plan 完成并重读后，若存在长期偏好差量，使用 `memory_review_propose`；
- 等待学生逐项决定；
- 只应用已采用内容；
- 写入后重读两份画像再报告。

本切片不测试 Skill 的句子、标题或措辞。运行时只执行 owner、Plan 状态、来源和
结构化决定等可验证边界。

Coach 仍保留现有 Markdown 编辑能力。本阶段不增加画像专用写入工具、文件权限沙箱
或硬编码画像事务门；候选确认负责交互与可追溯性，画像事实仍以最终 Markdown 为准。

## 九、API 与前端边界

新增 Session-scoped API：

```text
GET  /api/sessions/:coachKey/memory-review
POST /api/sessions/:coachKey/memory-review/:reviewId/submit
```

GET 返回当前 Plan Coach 的最新 Review 或 `null`。POST 只接受完整 decisions，
复用现有 session-run 生命周期触发 Coach。Tutor key、Roadmap Coach key、错误 Plan
owner 或不存在的 Review 均返回直接错误，不写入任何学习文件。

前端新增：

- `MemoryReviewCard`：聊天流入口与状态；
- `MemoryReviewPanel`：逐项确认覆盖层；
- Client state 中按 SessionKey 隔离的 ConversationItem；
- 对 proposed/submitted 的原位更新逻辑。

切换 Plan、Roadmap 或 Tutor 时不复制 Review；返回原 Plan Coach 后从该 Session
恢复。

## 十、失败与降级

- Plan 未 completed：拒绝提议，不显示卡片；
- 候选为空：Coach 不调用工具；
- 来源或当前画像条目失效：拒绝整份提议，不显示部分真假混合的确认单；
- 学生决定缺失、重复或 rewrite 为空：拒绝提交，保留 proposed；
- “稍后处理”：不改变任何持久状态；
- Coach 模型调用或画像写入失败：submitted 选择仍保存在 Session，界面不宣称画像
  已写入；学生可以在同一 Coach Session 继续处理；
- 辅助卡片或面板渲染失败：不阻塞普通 Coach 聊天和已完成 Plan；
- 不自动重试、不创建补偿日志、不静默修改画像。

## 十一、迁移策略

采用纵向切片重做：

1. 从旧分支只参考 transient contract、Session store 和面板交互；
2. 以当前 main 的 Roadmap/Plan scope、Session owner、消息投影和严格 Plan 为准；
3. 不 cherry-pick 旧提交；
4. 不同时迁移其他功能面板；
5. 本切片验收并合并后，再设计课堂固定舞台与上下文栏。

旧分支保留到所有仍需能力完成迁移，避免在迁移过程中丢失参考实现。

## 十二、验收标准

自动化测试必须证明：

1. active Plan、Roadmap Coach 和 Tutor 无法提出确认单；
2. completed Plan 可以生成带真实来源的候选；
3. 提出候选不会修改两份画像；
4. 卡片位于对应可见 Coach 回复之后；
5. 关闭、刷新和重启后卡片与候选可恢复；
6. 学生必须处理全部条目才能提交；
7. rewrite 不能为空；
8. 提交后原卡片原位更新，不重复出现；
9. 提交状态不冒充画像写入成功；
10. Coach 写入并读回后，画像包含采用或改写内容，不包含不采用内容；
11. 候选与决定严格隔离在所属 Plan Coach Session；
12. Claude 插件公开 MCP 工具仍为四个；
13. 应用 typecheck、单元测试、生产构建和 Playwright E2E 全部通过。

最后在隔离学习集与真实模型上运行：

```text
完成 Plan
  → 生成候选
  → 稍后处理
  → 刷新恢复
  → 逐项改写与拒绝
  → Coach 写入
  → 重读画像
```

验收记录不得包含凭据、完整隐藏提示、私密推理或未经去标识化的课堂全文。

## 十三、非目标

- 自动从画像推断能力或 mastery；
- Plan 完成前持续聚合长期记忆；
- Roadmap Coach 代替 Plan Coach 整理候选；
- 前端直接编辑画像；
- pending memory Markdown、数据库或向量索引；
- 通用内容预览器；
- 自动切换 Plan 或阻止学生继续学习；
- 新公开 MCP 工具；
- 对旧面板分支的兼容层；
- 多用户、云同步或教师审批。
