# Teaching Session 工具结果恢复与结课边界设计

状态：待用户复核

日期：2026-08-08

适用范围：正式 Lesson 与自由学习的记忆提交断线恢复，以及正式 Lesson 的结课边界

关联设计：

- `2026-08-06-m1-teacher-notebook-memory-design.md`
- `2026-08-07-atomic-lesson-memory-consolidation-design.md`
- `2026-08-07-m1b-semantic-learning-set-growth-design.md`

## 一、问题边界

本设计只修复一个机械故障窗口：

```text
Pi Session 已持久化 assistant tool call
→ 记忆文件已经原子提交
→ 进程在 tool result 持久化前退出
→ 重开后同一工具调用看起来没有结果
```

如果模型因此重新生成一次记忆提交，同一课堂变化可能被追加两次。

这个问题不等于以下三个问题：

- 学生是否已经完成正常课末反思；
- 一节课是否形成了值得固化的新对象记忆；
- 学生点击“结束本课”代表正常收尾还是中途退出。

工具结果恢复不能替这些教学与产品边界作决定。

## 二、事实所有权

| 事实 | 唯一所有者 | 生命周期 |
| --- | --- | --- |
| 课堂真实表现 | Lesson Block 的 Classroom Log，或原生自由学习 Session | 长期 |
| 对象判断、认知流变、明确偏好 | `memory/` | 长期 |
| Pi assistant tool call 与 tool result | 原生 Pi Session | Session 长期 |
| 一次已提交但尚未写回 Pi 的机械结果 | Runtime 临时恢复记录 | 只活到 tool result 被确认持久化 |
| Lesson 是否关闭 | Lesson 顶层状态 | 长期 |

临时恢复记录不是教师记忆、课堂证据或召回来源。它不进入模型上下文，也不参与教学判断。

## 三、方案选择

### 方案 A：永久 Teaching Receipt

以 `sourceTurnId`、提交前后 `evidenceRevision`、跨轮请求摘要和永久 receipt 判断重复。

不采用。它把一次工具执行故障扩张成了 Teaching Session 语义系统，还要求 Runtime 判断
不同 tool call 是否表达同一次教师意图。

### 方案 B：从 canonical 记忆反查

在对象历史中持久化操作键，或在重试时搜索对象、偏好、bucket 与索引来判断是否已经写入。

不采用。它污染教学文件；一次提交可能跨多个文件，也可能创建 Runtime 才分配 ID 的新对象，
不能从一个稳定位置完整恢复原工具结果。

### 方案 C：按原生 `toolCallId` 保存临时结果（采用）

Pi 在执行工具前已经持久化包含 `toolCallId` 的 assistant entry。Runtime 只保证同一个原生
工具调用在崩溃重放后仍得到同一个机械结果，不跨不同 tool call 做语义去重。

这与原生文件工具的边界一致：同一次调用必须可恢复；两个不同调用就是两个不同动作。

## 四、临时恢复记录

### 4.1 位置

```text
.studyforge/pending-tool-results/<runtime-safe-session-key>/<runtime-safe-tool-call-key>.json
```

两个路径段都由 Runtime 从当前绑定 Session 与原生 `toolCallId` 做确定性安全编码；不直接把
外部字符串拼入路径。模型不提交 Session ID、路径或恢复字段。

### 4.2 最小结构

```json
{
  "version": 1,
  "toolName": "lesson_memory_commit",
  "toolCallId": "call-123",
  "requestDigest": "sha256:...",
  "commitId": "commit-456",
  "result": {
    "ok": true,
    "objectIds": {},
    "preferenceIds": {},
    "bucketIds": {},
    "changedPaths": []
  }
}
```

只保存恢复原 tool result 所需的稳定机械值：

- `requestDigest` 是工具语义参数的确定性 JSON 摘要，只防止一个 `toolCallId` 对应不同参数；
- `commitId`、稳定 ID 与改动路径使用第一次提交时已经分配的值；
- 不保存学生原话、对象判断正文、证据副本、时间线摘要或完整请求；
- `durationMs` 属于遥测，不进入可恢复结果。

### 4.3 提交

一次记忆工具执行按以下顺序完成：

1. Runtime 从绑定的 Pi Session 验证当前 `toolCallId` 确实存在于当前分支，工具名一致；
2. 若分支已经存在对应 tool result，校验参数摘要后直接返回其中的稳定结果；
3. 若临时恢复记录已经存在，摘要相同就直接返回其中的稳定结果，摘要不同则拒绝；
4. 两处都不存在时，生成并校验 canonical 记忆候选；
5. Runtime 预分配 `commitId` 与所有新对象 ID；
6. 生成临时恢复记录候选；
7. 使用现有多文件事务，把 canonical 候选与恢复记录一次提交；
8. 返回恢复记录中的稳定 `result`，由 Pi 正常持久化 tool result；
9. 只有在 Session 分支中已经能读到匹配的 tool result 后，Runtime 才删除临时恢复记录。

现有 `commitDocumentCandidates` 需要支持由调用者传入经过校验的预分配 `commitId`，以保证
事务、恢复记录和返回结果指向同一次提交。未传入时仍可保持原来的自动分配行为。

删除恢复记录不是教学事务的一部分。删除前再次退出只会留下一个可安全清理的内部文件，
不会重复 canonical 改动。

## 五、Session 打开时恢复

每次打开已存在的 Teaching Session 时，Runtime 先恢复遗留的 `prepared` 多文件事务，然后：

1. 读取当前 Pi 分支；
2. 找到记忆提交工具中只有 assistant tool call、没有对应 tool result 的调用；
3. 按当前 Session 与精确 `toolCallId` 查找临时恢复记录；
4. 校验工具名、`toolCallId` 和当前工具参数的 `requestDigest`；
5. 匹配时用 `SessionManager.appendMessage` 追加原 tool result；
6. 再次读取分支，确认结果已存在后删除恢复记录；
7. 不匹配时不伪造成功；孤立调用没有恢复记录，说明 canonical 提交没有成功，追加一个
   `INTERRUPTED_BEFORE_COMMIT` 错误 tool result，后续由模型在真实下一轮决定是否重试。

如果 Pi 分支已经含有对应 tool result 而临时记录仍在，只删除临时记录，不追加第二条结果。
恢复动作不调用模型、不生成教师总结、不修改 Lesson 状态。

## 六、重放边界

- 同一个 `toolCallId`、同一参数：返回或补回第一次的稳定结果，不再次写文件；
- 同一个 `toolCallId`、不同参数：返回机械冲突，不写文件；
- 不同 `toolCallId`：视为新的工具动作，Runtime 不做语义去重；
- 学生后来纠正教师：产生新的 Pi entry 与新的工具调用，正常追加新的课堂事实和对象历史；
- 模型无理由地用新 `toolCallId` 重复同一判断：属于模型行为问题，不靠哈希相似度或
  “同一学生轮次只能提交一次”规则猜测拦截。

正常情况下，孤立 tool call 会在 Session 打开时先被恢复，因此模型不会因为看不见第一次
成功结果而被迫生成第二次调用。

## 七、结课与恢复记录相互独立

记忆提交成功不等于 Lesson 已关闭；Lesson 关闭也不以恢复记录存在为前提。

正式 Lesson 的关闭接口只负责节点生命周期：

| 当前状态 | 行为 |
| --- | --- |
| `active` | 等待当前 Agent turn idle，再执行一次 `active → closed`，释放 Session，返回父 Plan |
| `closed` | 清理可能残留的内存 Session，返回同一个成功路由，不再修改文件 |
| `prepared` | 拒绝 |
| 节点不存在或归属不匹配 | 拒绝，不扫描目录猜测 |

学生可能中途退出，也可能在一节课里没有形成新的对象记忆，所以 Runtime 不得用“没有记忆
提交”阻止关闭。若产品需要区分“正常收尾”和“中途退出”，应单独设计学生交互，不能把
临时恢复记录冒充结课批准门。

关闭 HTTP 响应丢失时，第二次请求看到 `closed` 仍返回成功。它不需要读取记忆恢复记录。

浏览器发生过断线后，重连只重新读取当前 Pi history 与节点 snapshot，并以 snapshot 替换本地
投影；不调用模型、不创建新消息。这样 tool result 或 close 响应即使没有被旧连接看见，界面
仍以 canonical 状态恢复。

## 八、课末新证据只走正常课堂日志

删除 `lesson_memory_commit.closingFact` 特殊通道。

课末处理只保留两种情况：

1. 课末交流没有产生新的决定性表现：对象记忆直接引用本课已经存在的真实 Block；不为形式
   完整创建 Reflection Block。
2. 课末交流真的产生了会改变判断的新表现：Tutor 使用现有 `classroom_update` 动态插入并
   开始一个短 Reflection Block，用 `classroom_log_append` 记录事实，再正常完成该 Block；
   对象记忆引用这个 Block。

因此正式 Lesson 的证据链始终只有一种：

```text
真实课堂活动 → Block Classroom Log → 对象记忆 Learning History
```

Runtime 不再允许记忆工具绕过正常课堂日志，向已完成的普通 Block 追加一条课末事实。

## 九、模型与学生负担

模型工具参数只做减法：移除 `closingFact`，不增加 receipt、revision、Session ID、恢复状态或
重试字段。正常成功与恢复成功返回同一稳定结果，不要求模型理解 `replayed` 或 `recovered`。

Skill 只需要说明：课末新证据先进入真实 Reflection Block；没有新证据就引用已有 Block。
断线恢复与临时记录完全留在 Runtime。

学生不会看到 receipt、commit revision 或恢复流程。前端只从重新读取的 Pi history 与节点
状态恢复正常界面。

## 十、实施改动面

### Runtime

- 给记忆工具注入当前只读 SessionManager 身份与分支；
- 增加工具参数的确定性摘要与安全恢复记录路径；
- 让多文件事务接受可选的预分配 `commitId`；
- 将 canonical 记忆候选与临时恢复记录放进同一事务；
- Session 打开时补回有精确记录支持的孤立 tool result；
- 确认 Pi 已持久化结果后清理临时记录；
- Lesson close 等待 turn idle，并把已经 `closed` 视为成功。

### Frontend

- 仅在连接曾经断开后的重连中，重新读取当前 Pi history 与节点 snapshot；
- 用完整 snapshot 替换本地投影，不重复 append，也不启动模型。

### 记忆与课堂工具

- 移除 `lesson_memory_commit.closingFact` 及对应 mutation 分支；
- 课末新增证据复用 `classroom_update` 与 `classroom_log_append`；
- 正式 Lesson 与自由学习复用相同的机械恢复 helper，但不共享关闭生命周期。

### Skill

- 更新课末固化 reference，明确有新证据时先形成 Reflection Block；
- 不向 Skill 加入任何恢复分支或术语。

### 不在本切片内

- 不新增 `consolidating`、`summarized`、`closing` 等持久 Lesson 状态；
- 不设计正常收尾与中途退出的前端交互；
- 不做不同 tool call 之间的语义去重；
- 不扩展为所有 Runtime 工具的通用执行日志；先只覆盖两个记忆提交工具；
- 不把恢复记录用于召回、审计教学效果或学生可见历史。

## 十一、验收

### 11.1 机械故障

1. 候选生成或校验失败：无 canonical 改动，也无临时恢复记录；
2. 多文件替换中退出：canonical 候选与恢复记录一起回滚；
3. manifest 已提交、tool result 写入前退出：重开后补回原结果，Learning History 只追加一次；
4. tool result 已存在、临时记录尚未删除：重开后只清理记录；
5. 恢复 result 后再次退出：第三次打开仍只有一个对应结果；
6. 同一 `toolCallId` 携带不同参数：拒绝恢复，文件字节不变；
7. 新 `toolCallId` 的真实纠正：正常形成第二次提交，旧历史逐字不变。

### 11.2 关闭

1. `active` close 成功；
2. `closed` close 再次返回同一路由成功；
3. `prepared` close 拒绝；
4. Agent turn 或记忆事务执行中请求 close：等待 idle 后再转换状态；
5. close 完成但 HTTP 响应丢失：重试不会产生第二次状态改动。
6. WebSocket 重连：重新投影 history 与节点状态，不产生新教学事件。

### 11.3 证据边界

1. 没有课末新证据：不创建 Reflection，记忆只引用已有 Block；
2. 有课末新证据：先形成 Reflection Log，再引用该 Block；
3. 不存在对象记忆声称发生了某个课末表现、但引用 Block 中没有该事实的情况；
4. 移除 `closingFact` 后，正式 Lesson、自由学习与无记忆 M0 路径保持兼容。

### 11.4 真实模型验收

真实链路至少复演：

1. 正常结束一节没有新增课末证据的 Lesson；
2. 课末出现一次会改变对象判断的新证据，由 Tutor 自然建立短 Reflection；
3. 记忆提交后立即终止服务，重启后继续同一 Session；
4. 关闭请求完成后丢弃响应，再次结束本课。

只验收学生可感知结果：课堂事实不丢不重、教师能够自然接着说、学生能够可靠离开课堂。

## 十二、本轮拟定边界

- canonical 教学事实与 Runtime 故障恢复分离；
- 临时恢复记录按原生 `toolCallId` 定位，并在 tool result 持久化后删除；
- 不再使用 `sourceTurnId`、`evidenceRevision` 或跨轮语义重放；
- 不让恢复记录决定 Lesson 是否可以关闭；
- 不让 `lesson_memory_commit` 兼任课堂事实写入；
- 学生纠正仍是新事实，旧 Log 与旧 Learning History 永不回写。
