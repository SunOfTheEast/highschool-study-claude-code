# Teaching Session 课末断线恢复与持久幂等设计

状态：核心方案已确认，实施细节草案待复核

日期：2026-08-08

适用范围：当前正式 Lesson 的课末恢复，以及正式 Lesson / 自由学习都可复用的记忆提交恢复核心

关联设计：

- `2026-08-06-m1-teacher-notebook-memory-design.md`
- `2026-08-07-atomic-lesson-memory-consolidation-design.md`
- `2026-08-07-m1b-semantic-learning-set-growth-design.md`
- `2026-08-08-studyforge-m1b-north-star-architecture-design.md`

## 一、只解决一个真实故障

正常课末流程已经明确：

```text
自然短回顾
→ 先听学生
→ 教师形成有边界的判断
→ 静默固化课堂痕迹与对象记忆
→ 用普通教师语言总结
→ 接受学生纠正
→ 学生结束本课
```

本设计不重做这套教学顺序，只处理其中一个真实故障窗口：

```text
记忆文件已经提交成功
→ 进程退出、网络断开或浏览器错过后续事件
→ tool result、公开总结或关闭回执没有被可靠看见
→ 重开后模型再次调用固化工具
→ 同一课堂变化可能被第二次写入对象历史
```

这不是“旧 Log 能否修改”的问题。旧 Log 和对象 `Learning History` 的旧条目仍然只追加、
永不回写。问题是 Runtime 如何知道一次已经成功的提交只是没有被看见，而不是一份尚未
发生的新证据。

## 二、当前系统已经保护了什么

现有实现不是整体不可靠；它已经覆盖了大部分失败位置：

| 失败位置 | 当前结果 | 是否会重复记忆变化 |
| --- | --- | --- |
| 候选生成或校验失败 | 正式文件未写入 | 否 |
| 多文件替换中途崩溃，manifest 仍为 `prepared` | 下次打开时按精确 manifest 回滚 | 否 |
| 全部候选替换完成，manifest 已为 `committed` | canonical 文件已经成功 | 正常不重复 |
| 同一进程重放同一个 `toolCallId` | 内存 `Map` 返回原回执 | 否 |
| 进程重启后重放 | 内存 `Map` 丢失 | **存在缺口** |
| Lesson 已变为 `closed`，但关闭 HTTP 回执丢失 | 第二次严格 `active → closed` 报错 | 数据不重复，但学生体验错误 |
| WebSocket 断开后重连 | 只恢复连接状态，不主动补读历史与节点状态 | 可能看不见已完成结果 |

因此，不需要推翻现有多文件事务。真正需要补的是事务成功之后的**持久成功凭据**、Pi
会话中的缺失工具结果恢复、关闭接口的重复调用语义，以及前端重连后的只读同步。

## 三、目标与非目标

### 3.1 目标

1. 同一 Teaching Session、同一学生证据轮次至多成功固化一次。
2. 进程重启后，原工具结果即使丢失也能从成功凭据恢复；模型不需要重新猜测这次提交是否
   发生过。
3. 学生后来真的纠正教师时，允许形成新的 Log、新的对象历史条目和新的当前判断修订。
4. 正式 Lesson 与自由学习的记忆提交复用同一个恢复核心，但各自保留不同生命周期。
5. 记忆提交、自然语言总结和 Session 关闭仍是三个独立步骤。
6. 关闭请求可以安全重试；学生不因为回执丢失而看到“结束失败”。
7. WebSocket 重连后补读 canonical 状态与 Pi 历史，不重新运行模型。
8. 新机制不增加模型字段，不要求学生理解“幂等、revision、receipt”等内部概念。

### 3.2 非目标

- 不把课末语义判断交给 Runtime。
- 不用一个 `memory_committed: true` 布尔值封死后续纠正。
- 不把记忆、总结和关闭合成一个大事务。
- 不增加 `consolidating / summarized / closing` 等持久生命周期状态。
- 不在异常关闭后让后台模型猜测并补写一份从未形成的教师判断。
- 不用超时把学生离开解释为“已经学完”。
- 不解决云端多用户同时修改同一学习集的全局并发；这里只约束本地 Teaching Session。

## 四、比较过的三种方案

### 方案 A：记忆、总结与关闭合成一个大事务

它表面上最完整，但总结是学生可见的自然语言，关闭是生命周期动作，记忆是多文件 canonical
写入。三者无法用同一种事务真正原子提交。强行捆绑还会让学生纠正变成“修改已关闭事务”，
破坏已经确认的课堂习惯。

不采用。

### 方案 B：增加完整课末状态机

例如：

```text
active → consolidating → summarized → closed
```

它能表达每个中间位置，却把一次低频故障扩散到 Agent 提示、Skill、Markdown schema、前端
和生命周期路由。模型需要同时顾及更多状态，学生也更容易看见机械流程。

不采用。

### 方案 C：三个步骤各自持久幂等（采用）

- 记忆固化用持久 receipt 证明已经成功；
- Pi 会话用 receipt 补回崩溃时丢失的 tool result；
- 关闭接口把“已经关闭”视为同一请求的成功终态；
- 前端重连后重新读取历史与节点状态。

这与原生 `edit` 的可靠性思路一致：模型仍然只表达一次意图，Runtime 负责让机械动作在重放
时保持同一个结果。

## 五、四条承重不变量

### 5.1 Receipt 不是第二份教师记忆

canonical 教学事实仍然只有这些位置：

- Classroom Log 保存正式课堂中真实发生的事实；
- 原生 Pi Session 保存自由学习中真实发生的对话；
- `memory/` 保存对象当前判断、流变概述、直接引用来源的学习历史、能力假设与明确偏好；

Receipt 只保存 Runtime 已经完成哪一次机械提交的最小凭据：稳定 ID、摘要、版本和改动路径。
它不保存学生原话、教师判断正文或资产内容，不能参与召回，也不能成为教师证据。

### 5.2 一次成功固化绑定一轮真实学生输入

Pi Session 的每个条目已经拥有稳定 `id`、`parentId` 和时间。Runtime 不使用“当前最新消息”
进行猜测，而是：

1. 找到包含当前记忆提交工具调用（`lesson_memory_commit` 或
   `free_learning_memory_commit`）的 assistant entry；
2. 沿当前选中分支向前找到最近的 user entry；
3. 把该 entry 的稳定 ID 记为 `sourceTurnId`。

这使一次固化绑定到真正触发它的学生轮次。模型不提交 `sourceTurnId`，也不能伪造它。

同一学生轮次内，第一次**成功**固化后：

- 相同请求重放：返回原回执；
- 新 `toolCallId` 但请求内容相同：返回原回执；
- 新 `toolCallId` 且提交内容不同：拒绝再次写入，提示该轮已经固化。

校验失败不生成 receipt，因此模型仍可在同一轮修正格式后重试。

### 5.3 证据版本只由原始证据组成

Runtime 为 Teaching Session 生成确定性的 `evidenceRevision`：

- 正式 Lesson：Lesson 身份、按顺序排列的 Block 身份与 Classroom Log 条目；课末工具要追加
  的 `closingFact` 先进入内存候选，再参与提交后版本计算；
- 自由学习：原生 Pi Session 身份、当前分支上截至本次提交的真实 entry，以及本 Session
  实际绑定的不可改写作答事件或资产 revision。

明确排除：

- 对象记忆、能力假设和偏好文件；
- Session Summary；
- 节点状态；
- receipt 与事务 manifest；
- 可重建索引和图谱投影。

序列化使用带版本号的确定性结构和 SHA-256，不做同义词归并、教学分类或模糊去重。Runtime
只回答“这些来源字节是否变化”，不回答“学生是否表达了同一个意思”。

### 5.4 学生纠正必须形成新事件

公开总结后，学生若说“不是，我刚才其实还不会独立找出这个结构”，这是新的 user entry，
因而拥有新的 `sourceTurnId`。Tutor 可以再次调用固化工具：

```text
新学生轮次
→ 追加纠正 Log
→ 追加对象 `Learning History` 的纠正条目
→ 修订对象当前判断与流变概述
→ 旧 Log 和旧历史条目不变
```

所以这里没有“每个 Session 永远只能提交一次”的限制。真正的边界是：**同一学生证据轮次
不能因机械重放固化两次；新的真实证据可以产生新的固化。**

Runtime 不跨不同学生轮次做语义去重。如果模型把后来一句无关的话错误解释成新认知证据，
又生成了一份措辞不同的提交，这仍是教师判断错误，不是 Runtime 能靠哈希可靠识别的机械
重放。设计通过补回原 tool result 让这种误判没有正常发生的理由，但不为追求“绝对去重”
引入相似度阈值或让 Runtime 阅读学生语义。

## 六、持久 Receipt

### 6.1 位置

建议位置：

```text
.studyforge/memory-receipts/<runtime-safe-session-key>/<source-turn-id>.json
```

其中 Session 路径段由 Runtime 从 Teaching Session 身份派生并转成安全、不透明的文件名；
不得直接使用模型输入或未经校验的路径。`sourceTurnId` 来自 Pi Session 条目。

Receipt 与本次 canonical 记忆候选放进**同一个现有多文件事务**。因此：

- 事务在 `prepared` 阶段崩溃：记忆与 receipt 一起回滚；
- 事务进入 `committed`：记忆与 receipt 必然同时存在；
- 不会出现“有 receipt 但记忆没写”或“记忆写了但没有持久成功凭据”的正常状态。

### 6.2 最小结构

示意结构如下；字段名可在实施时按现有 TypeScript 风格调整，但语义不得扩张：

```json
{
  "version": 1,
  "sessionKind": "lesson",
  "teachingSessionId": "lesson:lesson-001",
  "piSessionId": "...",
  "sourceTurnId": "a1b2c3d4",
  "toolCallId": "...",
  "requestDigest": "sha256:...",
  "evidenceRevisionBefore": "sha256:...",
  "evidenceRevisionAfter": "sha256:...",
  "commitId": "...",
  "createdAt": "2026-08-08T00:00:00.000Z",
  "result": {
    "objectIds": {},
    "preferenceIds": {},
    "bucketIds": {},
    "changedPaths": []
  }
}
```

`requestDigest` 是工具语义输入的确定性 JSON 摘要，只用于判断是不是同一次机械请求；receipt
不复制请求正文。`changedPaths` 只列 canonical 教学文件，不把 receipt 自己暴露给模型。

`commitId` 在候选生成前由 Runtime 分配，并同时用于事务与回执，确保恢复出来的 tool result
与第一次正常返回完全指向同一提交。

## 七、固化算法

一次正式 Lesson 或自由学习的记忆固化按以下顺序执行：

1. 恢复学习集内遗留的 `prepared` 多文件事务。
2. 从绑定的 Pi Session 当前分支解析当前 assistant tool call、`sourceTurnId` 与 Session 身份。
3. 计算 `evidenceRevisionBefore`。
4. 读取该 `sourceTurnId` 对应的 receipt：
   - 不存在：进入新提交；
   - 存在且 `requestDigest` 相同：返回原结果，并标记 `replayed: true`；
   - 存在且摘要不同：返回 `MEMORY_TURN_ALREADY_COMMITTED`，不写任何文件。
5. 若本轮尚无 receipt，再比较本 Session 最近一次成功提交：当前证据版本仍等于它的
   `evidenceRevisionAfter`，且 `requestDigest` 也相同，说明只是跨学生轮次的精确重放；返回
   原结果，但不占用当前 `sourceTurnId`。学生若在本轮给出了真实纠正，Tutor 仍可用变化后的
   提交内容再次调用。
6. 按现有语义提交单生成 Log、对象、偏好、bucket 和 INDEX 候选；若有
   `closingFact`，只在内存候选中追加一次。
7. 从候选中的来源 Log 计算 `evidenceRevisionAfter`。
8. 分配稳定 `commitId`、对象 ID 等机械身份，生成 receipt 候选。
9. 用现有多文件事务一次提交 canonical 候选与 receipt。
10. 返回紧凑结果；正常首次提交为 `replayed: false`。

工具结果保持教学负担之外的机械信息：

```ts
{
  ok: true,
  commitId: string,
  replayed: boolean,
  recovered?: boolean,
  objectIds: Record<string, string>,
  preferenceIds: Record<string, string>,
  bucketIds: Record<string, string>,
  changedPaths: string[],
  durationMs: number,
}
```

模型的工具 schema 不新增 `sourceTurnId`、revision、receipt 路径、关闭状态或重试布尔值。

## 八、Pi 会话缺失 Tool Result 的恢复

仅有 receipt 仍不足以还原模型上下文。Pi 的执行顺序是先持久化含 tool call 的 assistant
message，再执行工具，最后持久化 tool result。因此存在一个很窄但真实的窗口：

```text
assistant tool call 已在 Pi Session
→ 记忆与 receipt 已提交
→ 进程在 tool result 写入 Pi Session 前退出
```

Teaching Session 每次打开时执行一次机械对账：

1. 读取当前 Pi 分支；
2. 找到没有真实 tool result 的记忆提交工具调用；
3. 沿该调用定位 `sourceTurnId`；
4. 优先匹配该 `sourceTurnId` 的 receipt；若本次调用原本是一次跨轮精确重放，也可以用调用
   参数摘要、当前证据版本和最近 receipt 按 §七第 5 步重新证明它指向旧成功；
5. 直接匹配要求 receipt 中的 `toolCallId` 与孤立调用一致；跨轮精确重放允许二者不同，但
   Session 身份、请求摘要和证据版本必须全部匹配。追加时使用当前孤立调用的 `toolCallId`，
   结果正文仍返回旧 receipt 的 `commitId` 与稳定 ID，并标记
   `replayed: true, recovered: true`；
6. 找不到上述任一持久证明时，不得伪造成功，保留现有失败／重试路径；
7. 追加前再次检查同一 `toolCallId` 是否已有结果，因此恢复动作自身也可重复执行。

这次 Pi Session 追加不需要与旧事务重新原子绑定：receipt 是可重复重建依据。若进程在补写
tool result 后再次退出，下次打开会看到结果已经存在，不再追加。

恢复只补机械结果，不自动生成教师总结，也不自动关闭课堂。这样不会在学生不知情时启动
一次新的模型推理。若总结尚未产生，Lesson 仍是 active，学生可以继续原 Session；模型会从
已恢复的成功 tool result 之后完成自然收尾，而不会重新提交同一对象变化。

## 九、关闭接口的幂等语义

记忆固化成功不等于课堂关闭。学生始终可以结束课堂，关闭也不以 receipt 存在为硬门。

正式 Lesson 的 `close` 采用以下语义：

| 当前状态 | 行为 |
| --- | --- |
| `active` | 先中止并等待当前 Agent turn 真正 idle，再重新读取状态，执行一次 `active → closed`，释放 Session，返回父 Plan 路由 |
| `closed` | 清理可能残留的内存 Session，直接返回同一个成功路由，不再修改文档 |
| `prepared` | 拒绝；尚未开始的课不能被“结束” |
| 节点不存在或归属不匹配 | 拒绝，不扫描目录猜测目标 |

两个并发关闭请求若都曾读到 `active`，第二个在状态竞争失败后重新读取；若 canonical 状态
已经是 `closed`，仍返回成功。不得通过创建第二个节点、改名或重写文件来“修复”。

`abort` 必须等待当前 Agent turn idle 后再转状态。这保证学生在工具执行中点击“结束本课”时，
Runtime 不会让关闭写入与记忆多文件事务同时改同一 Lesson 文件。

## 十、浏览器重连不是一次新教学轮次

当前 WebSocket `onopen` 只把连接标为 open。实施后，**仅在发生过断线的重新连接**时：

1. 重新读取当前路由对应的 course / free-learning snapshot；
2. 重新读取当前 Pi Session history；
3. 用 snapshot 替换客户端暂存对话，而不是把旧事件再次 append；
4. 若 canonical Session 已关闭，把页面协调到确定的返回路由；
5. 若 Session 仍 active，保持输入可用，继续同一 Session。

这一步只读，不调用模型，不创建新 user entry，不触发记忆工具，也不把网络重连记录成学习
痕迹。

若进程恰好在记忆固化后、公开总结前退出，前端可以根据 Runtime 的恢复投影显示一句中性
提示，例如“刚才的课堂记录已经保存，可以继续完成收尾”。这只是从 receipt 与 Pi 分支派生
的 UI 状态，不写入 Lesson schema，也不冒充教师总结。

## 十一、正式 Lesson 与自由学习的统一提交接口

持久幂等核心只依赖一个窄适配器：

```ts
type TeachingMemoryCommitEvidenceAdapter = {
  kind: 'lesson' | 'free-learning';
  teachingSessionId: string;
  piSessionId: string;
  projectEvidenceRevision(): EvidenceProjection;
  projectCandidateEvidenceRevision(candidate: string): EvidenceProjection;
};
```

正式 Lesson 适配器知道 Block 与 Classroom Log 的结构；自由学习适配器知道当前 Pi 分支、
绑定资产和作答事件。幂等 receipt 与工具结果恢复不理解“同构、沉淀平衡、掌握”等教学
语义，也不要求两类 Session 拥有相同证据结构。

两类记忆提交可以复用同一套故障恢复，不复制一份重试逻辑；但关闭算法不进入该适配器。
正式 Lesson 仍按节点状态返回父 Plan，自由学习由学生显式结束并返回自由学习入口，两者
不能为了代码复用而伪装成同一种 Session。

## 十二、失败复演

| 故障 | 恢复后的唯一结果 |
| --- | --- |
| 候选校验失败 | 无 receipt、无 canonical 改动；同轮可以修正后重试 |
| 替换第 N 个 canonical 文件时退出 | `prepared` manifest 回滚全部候选与 receipt；随后只成功一次 |
| canonical 文件与 receipt 已替换，但 manifest 未标 `committed` | 一并回滚；不会留下“假成功” |
| manifest 已 `committed`，tool result 写入前退出 | receipt 保留；打开 Session 时补回同一成功结果；对象历史只追加一次 |
| tool result 已写入，公开总结前退出 | 历史保留成功结果；继续后只做自然总结 |
| 公开总结已写入，关闭请求前断线 | 重连补读总结；Session 仍 active，学生可正常关闭 |
| `active → closed` 已完成，HTTP 回执丢失 | 第二次 close 返回同一路由成功 |
| WebSocket 断开但服务端继续运行 | 服务端照常完成；重连后 snapshot 补齐历史与状态 |
| 学生在公开总结后纠正 | 新 user entry、新 receipt、新纠正历史条目；旧证据逐字不变 |
| 同一 user turn 中模型换一个 `toolCallId` 重写提交 | Runtime 返回原成功或精确冲突，不生成第二份对象变化 |
| 下一 user turn 精确重放同一请求，且来源证据未变化 | 返回上一回执且不占用新轮次；之后仍可提交真实纠正 |

## 十三、模型负担与学生体验

本设计新增的全部判断都是 Runtime 可机械确定的：

- Pi entry 与 parent chain；
- 确定性摘要；
- receipt 是否存在；
- 事务状态；
- 节点当前状态；
- WebSocket 是否属于重连。

模型仍然只做原来的事情：听学生、判断什么值得记录、形成有边界的对象历史与当前判断、自然
总结。工具参数不变，Skill 不增加一串异常分支，学生也不会看到“正在同步 revision”之类的
系统措辞。

因此，可靠性不会靠增加模型负担获得；它来自 Runtime 把一次已经发生的动作识别为同一次
动作。

## 十四、实施改动面

### Runtime

- 在创建自定义 Lesson 工具时注入只读的 Pi branch accessor 与 `piSessionId`；不把它们加入
  模型 schema；
- 从 Pi 当前分支解析 tool call entry 与最近的真实 user entry；
- 新增 Teaching Session evidence revision 投影；
- 新增 receipt 解析、校验与候选生成；
- 让多文件事务接受预先分配的 `commitId`，或提供等价的稳定提交身份接口；
- 将 receipt 与 canonical 记忆候选放入同一事务；
- Session 打开时补回有 receipt 支持的孤立 tool result；
- 将 Lesson close 改为可重试成功，并在状态转换前等待 turn idle；
- 为自由学习记忆提交暴露共同的窄恢复核心，但不共享关闭状态机。

### Frontend

- WebSocket 首次打开不额外刷新；发生过断线后的 `onopen` 重新加载当前路由和 history；
- snapshot 替换本地对话，避免重复 append；
- canonical Session 已关闭时协调到稳定返回路由；
- 可选显示“记录已保存、收尾可继续”的派生提示，不新增持久状态。

### Skill 与 Agent 提示

正式 Lesson 的正常课末亮线顺序不变；自由学习仍可在对话中途写记忆，不增加课末结算。
最多补一条异常回执解释：`replayed: true` 代表之前的固化已经成功，继续当前教学动作，不得
再创建一份“更完整”的记忆更新。不得把 receipt、revision 或关闭重试流程写成长篇模型工作流。

## 十五、验收用例

### 15.1 单元与集成测试

1. 正式 Lesson 首次提交写入 canonical 文件与一个 receipt；
2. 同一 `toolCallId` 重放返回同一 `commitId` 和 ID 集合；
3. 同一 `sourceTurnId`、新 `toolCallId`、相同请求返回 `replayed: true`；
4. 同一 `sourceTurnId`、不同请求返回精确冲突且文件字节不变；
5. 下一 `sourceTurnId` 在证据未变化时精确重放旧请求，返回旧结果且随后仍可提交纠正；
6. 逐个替换位置注入崩溃，验证 receipt 与 canonical 文件一起回滚；
7. 在 manifest committed 后、tool result 持久化前退出，重开后只补一个成功 result；
8. 恢复 result 时再次退出，第三次打开仍只有一个 tool result；
9. 学生新纠正轮次成功生成第二个 receipt 和第二条纠正历史，旧内容逐字不变；
10. `active` close 成功；`closed` close 再次成功；`prepared` close 拒绝；
11. 两个并发 close 最终都得到同一成功路由，canonical 只转换一次；
12. Agent turn 中调用 close，验证先等待 idle，再转换状态；
13. WebSocket 重连后 history snapshot 与磁盘 Pi 分支一致，不产生新消息；
14. 服务端已关闭、关闭响应丢失时，前端重连后进入稳定父路由。

### 15.2 自由学习提交契约测试

自由学习复用第 1—9 项记忆提交与恢复测试，不复用第 10—14 项正式 Lesson 关闭契约，并
额外验证：

- 绑定题卡、Note 或作答事件只以稳定身份与 revision 进入证据投影；
- 记忆可以在对话中途写入，浏览器离开不自动结束 Session；
- 不存在 Plan、Block 或 Uses 时，恢复核心也不会去课程树猜父级。

### 15.3 真实行为验收

在真实模型链路中至少复演三次：

1. 课末工具执行后立即终止服务，再启动并继续；
2. 公开总结后断开浏览器连接，待服务端完成后重连；
3. 关闭请求完成后丢弃 HTTP 响应，再次点击结束。

最终只看三个学生可感知结果：课堂事实没有重复、教师能自然接着说、学生能够可靠离开课堂。

## 十六、已确认决策

- 采用“记忆固化、自然总结、关闭各自持久幂等”，不采用大事务或课末状态机；
- Receipt 是 Runtime 恢复材料，不是教师记忆与召回来源；
- 主幂等边界是 Teaching Session + Pi `sourceTurnId`，`toolCallId` 是精确重放辅助键；
- 同时记录提交前后 evidence revision，避免把派生记忆混入证据版本；
- `closingFact` 可以继续与记忆候选同事务追加，不要求模型先做一次额外 Log 工具调用；
- 学生纠正通过新的 user entry 形成新提交，旧 Log 与旧 `Learning History` 条目永不修改；
- Session 打开时由 receipt 补回缺失 tool result，不自动运行模型；
- 已关闭节点的 close 重试返回成功；
- WebSocket 重连只补读，不产生教学事件；
- 正式 Lesson 与自由学习共享记忆提交的机械恢复核心，但生命周期、结束动作和返回路由分开。
