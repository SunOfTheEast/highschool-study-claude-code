# Session 绑定的 Tutor 工具契约设计

状态：讨论定稿，书面自审完成，待用户复核

日期：2026-07-22

## 一、问题

导数学习集的真实课堂已经证明 Tutor 能完成教学闭环，但它会在调用工具时反复猜测本不该由模型决定的运行时参数。一次真实 Lesson 中出现了四类失败：

1. 首次读取 Lesson 时，把实际文件 `lessons/lesson-003.md` 猜成 `lessons/lesson-003/lesson.md`。
2. 调用 `classroom_update` 时传入绝对 `lessonPath`，被学习集路径边界拒绝为 `OUTSIDE_LEARNING_SET`。
3. 调用 `trace_append` 时把多个题卡步骤拼成一个 `cardStepId`，形成不存在的复合 ID 并触发 `INVALID_TRACE`。
4. 先用 `classroom_update(action: complete)` 携带 Reflection 与 Summary，但这两个字段在该分支被静默忽略；随后又调用缺少二者的 `close`，触发 `CLOSE_REQUIRES_REFLECTION_AND_SUMMARY`。

这些失败不是课堂推理本身太难，而是工具契约把两类信息混在了一起：

- **运行时事实**：当前 Session 属于哪个 Lesson、真实文件路径是什么。这些事实已经由前端和 `WorkspaceRegistry` 确定，不应再让 Tutor 填写。
- **教学决定**：当前 Block、评价、支持情况、路线调整、Reflection 与 Summary。这些才是 Tutor 应填写的内容。

当前 `classroom_update` 还把节点推进、路线变化、暂停和结课六种条件不同的动作装进一个满是可选字段的对象。模型必须靠记忆猜测“这个 action 此刻究竟需要哪些字段”，失败后再依据错误信息修正，造成课堂节奏中断。

## 二、目标与非目标

### 目标

- 以 Session 已绑定的真实 `ownerPath` 作为所有 Tutor 写操作的唯一 Lesson 路径。
- 从 Tutor 可见参数中删除它不应决定、也容易填错的 `lessonPath` 与 `cardStepId`。
- 保留已经稳定工作的 Block 推进和 Route Change，不为每个动作增加独立工具。
- 把结课收束为一个窄而明确的 `lesson_close` 调用，一次写入 Reflection、Lesson Summary 与关闭状态。
- 让 Tutor 在资源上下文中直接看到当前 Lesson 的准确文件路径，降低首次 `read` 猜路径的概率。
- 不新增裁判 Agent、状态机、输出门或兼容层。

### 非目标

- 本设计不解决“一题多解时，题卡声明方法不等于学生实际使用方法”的 Trace 语义问题。
- 本设计不修改 attempt 级能力投影、BKT 聚合或 Planner Attention 的含义。
- 本设计不实现 Coach 的 `plan_update`；它只复用同一个 `ownerPath` 基础。
- 本设计不实现前端 `safe` / `raw-stream` 消息投影，也不解决内部矩阵或工具旁白泄漏。
- 本设计不拆分 `activate`、`complete`、`skip`、`route`、`pause` 为五个工具。
- 本设计不迁移或重写已经存在的历史 Trace；旧记录中的 `cardStepId` 保持原样。

## 三、核心原则：Session 拥有路径，模型只填写教学事实

运行时新增统一的 Session 所有权上下文：

```ts
type StudySessionScope = {
  role: 'coach' | 'tutor';
  ownerId: string;
  ownerPath: string;
};

type SessionFactoryInput = StudySessionScope & {
  sessionFile: string | null;
};
```

`ownerPath` 必须满足以下约束：

- 它是 learning set 根目录内的规范相对路径；
- 它来自 `readPlanWorkspace` 返回的真实 `plan.path` 或 `lesson.path`；
- `WorkspaceRegistry` 在打开 Session 时传入它；
- Session factory、resource loader 与 session-local tools 只消费它，不根据 `ownerId` 重新拼接路径；
- Tutor 和模型均不能通过工具参数覆盖它。

因此，即使未来 Lesson 从扁平路径移动到 `lessons/unit-a/lesson-003.md`，只要 workspace 索引指向该文件，Tutor 的写操作仍会落到真实文件上。

```text
readPlanWorkspace
  → WorkspaceRegistry 找到真实 lesson.path
  → SessionFactoryInput.ownerPath
  ├─→ Resource Loader：告诉 Tutor 准确路径
  ├─→ trace_append：闭包绑定该路径
  ├─→ classroom_update：闭包绑定该路径
  └─→ lesson_close：闭包绑定该路径
```

Coach Session 同时传入真实 `plan.path`。本次不新增 Coach 写回工具，但之后的 `plan_update` 可以直接使用该路径，不再让 Coach 猜 Plan 文件位置。

## 四、资源上下文

Tutor 的虚拟资源文档明确注入：

```text
Current Tutor: lesson-003
Current Lesson file: lessons/lesson-003.md
Learning set: <root>
```

Coach 对应注入：

```text
Current Coach: domain-integrity
Current Plan file: plans/domain-integrity.md
Learning set: <root>
```

这里的路径用于两件事：

1. session-local 写工具直接闭包绑定，不需要模型抄写；
2. Tutor 使用 Pi 内置 `read` 时有一个准确、可直接复制的路径，不必从 Lesson ID 猜目录结构。

本设计不包装或替换 Pi 的通用 `read`。因此资源上下文负责解决“首次读取猜路径”，写工具则从契约上彻底消除路径参数。

## 五、Tutor 工具契约

### 5.1 `trace_append`

Tutor 可见参数收窄为：

```ts
{
  blockId: string;
  cardAlias?: string;
  materialPath?: string;
  assessment: 'correct' | 'partially_correct' | 'incorrect' | 'incomplete';
  support: 'none' | 'tutor' | 'external';
  note: string;
  supersedes?: string;
}
```

变化如下：

- 不暴露 `lessonPath`；运行时固定使用当前 Tutor Session 的 `ownerPath`。
- 删除 `cardStepId`，不接受逗号拼接、多值数组或 `full_attempt` 等替代写法。
- `blockId` 与 `cardAlias` 继续由 Tutor 填写，因为积木式课堂中当前活动和实际使用的题卡确实是教学选择，不是 Session 身份。
- 材料活动仍可只填写 `materialPath`；题卡活动通过 Lesson alias 解析到真实 `cardPath`。
- 更正错误评价时继续使用现有 `supersedes`，不新增第二套更正协议。

底层 Trace 结构若当前仍要求 nullable `cardStepId`，runtime adapter 固定传入 `null`。这只是内部调用细节，不在新工具 schema 中保留旧字段，也不为旧调用增加兼容分支。

删除 `cardStepId` 后，课堂证据的稳定来源链为：

```text
Trace → lessonPath → Lesson
      → blockId → Lesson Block
      → cardAlias → Lesson Aliases → canonical cardPath → Card
```

学生采用了哪条路线，由该次 Trace 的事实性 `note` 描述；题卡内部步骤仍可供 Tutor 私下评价，但不再要求模型把一个整卡作答硬塞进单一 step ID。这个调整只消除错误参数，不宣称已经解决一题多解的能力归因。

### 5.2 `classroom_update`

`classroom_update` 继续负责已经稳定工作的节点与路线动作：

```ts
{
  action: 'activate' | 'complete' | 'skip' | 'route' | 'pause';
  blockId?: string;
  routeAction?: 'insert' | 'skip' | 'move' | 'repeat';
  before?: string;
  after?: string;
  reason?: string;
  source?: string;
}
```

变化如下：

- 删除 `lessonPath`，始终写入当前 Session 的 `ownerPath`。
- 删除 `close` action。
- 删除 `reflection` 与 `summary` 参数。
- `activate`、`complete`、`skip` 仍要求 `blockId`。
- `route` 仍要求 `blockId`、`routeAction`、`reason` 与 `source`，并按需使用 `before` 或 `after`。
- `pause` 不要求其他参数。

不再继续拆分这些动作。真实课堂中 Block 与 Route 调用已经成功，当前要修的是路径所有权和结课参数歧义，而不是扩建一套课堂状态机。

### 5.3 `lesson_close`

新增一个只属于 Tutor Session 的窄工具：

```ts
{
  reflection: string; // minLength: 1
  summary: string;    // minLength: 1
}
```

它固定作用于当前 Session 的 `ownerPath`，一次完成四件事：

1. 将当前 `Kind: reflection` 的活动 Block 标记为 `completed`；
2. 替换顶层 `## Reflection` 内容；
3. 替换顶层 `## Lesson Summary` 内容；
4. 将 Lesson frontmatter 的 `status` 改为 `closed`。

“当前 Reflection Block”严格指 Node State 同时满足 `Kind: reflection` 与 `Status: active` 的唯一 Block。`lesson_close` 不猜最后一个 Block，也不把任意 pending Block 自动当作结课节点；Tutor 应先通过 `classroom_update` 将结课 Reflection 激活。

“一次完成”是应用层的文件写入语义：runtime 先在内存中完成所有替换，确认四项都能定位后，只调用一次文件写入。任一必需结构不存在时，整个调用失败，原文件保持不变；不得先写 Summary、再因状态更新失败留下半关闭 Lesson。

`lesson_close` 不接收 `lessonPath`、`blockId`、`action` 或学生确认布尔值。学生是否确认结束仍由 Tutor 对话协议约束，不增加运行时确认门：只有学生明确表示结束后，Tutor 才调用该工具。若学生在其他 Block 提前要求结束，Tutor 先用现有课堂路线把当前节点推进到结课 Reflection，再调用 `lesson_close`。

## 六、注册与可见性

Tutor 的活动工具列表变为：

```text
read
grep
find
ls
card_search
trace_search
trace_append
source_resolve
classroom_update
lesson_close
```

Coach 不获得 `classroom_update` 或 `lesson_close`。`lesson_close` 与 `classroom_update` 都是 Web runtime 的 session-local 工具，不扩大对外发布的题卡/Trace MCP 契约。

Tutor Agent 与 `tutor-lesson` Skill 同步修改为：

- 直接读取资源上下文给出的 `Current Lesson file`；
- Trace 不填写 `lessonPath` 或 `cardStepId`；
- Block、Route 和 pause 使用 `classroom_update`；
- 学生确认结束后，使用一次 `lesson_close({ reflection, summary })`；
- 如果接受学生对评价的异议，仍须先写 superseding Trace，再生成 Reflection 与 Summary。

## 七、运行时数据流

### 启动 Lesson

1. `WorkspaceRegistry.startLesson(lessonId)` 从真实 workspace snapshot 找到 Lesson 对象。
2. 它将 `lesson.id`、`lesson.path` 和已有 `tutorSessionId` 传给 Session factory。
3. Session factory 用同一个 scope 构造资源上下文、`trace_append`、`classroom_update` 与 `lesson_close`。
4. Tutor 根据资源上下文中的准确路径读取 Lesson，展示当前 Block 的 Student View。

### 写入 Trace

1. Tutor 根据学生真实作答填写 Block、卡片 alias、评价、支持与 note。
2. `trace_append` 自动加入 `ownerPath`，再解析 alias 得到 canonical `cardPath`。
3. 现有 Trace append、active/supersede 与 Planner Attention 刷新流程保持不变。

### 结束 Lesson

1. 学生明确确认结束。
2. Tutor 先完成任何必须写入的 Trace，更正被接受的异议。
3. Tutor 组织本课 Reflection 与 Lesson Summary。
4. Tutor 调用一次 `lesson_close`。
5. runtime 在一次文件写入中完成 Reflection Block、顶层两节和 `status: closed`。
6. Tutor 向学生发送结课消息并停止该 Lesson Session。

## 八、错误边界

本设计只保留会影响事实正确性的最小错误：

- Session 的 `ownerPath` 无法读取：直接失败，说明 workspace 索引已经损坏。
- `blockId` 或 card alias 不存在：沿用现有明确错误，不猜测近似值。
- `lesson_close` 找不到唯一 active Reflection Block、顶层 Reflection 或 Lesson Summary：整次关闭失败且不写文件。
- Trace 校验失败：沿用现有一次重试规则；不能用聊天结论冒充已持久化证据。

不增加路径猜测、字段自动拼接、旧参数转换、模糊标题匹配或隐藏式重试。新 schema 本身应使正常调用直接成功。

## 九、测试

### Contract 测试

- `SessionFactoryInput` 与工具 context 必须包含 `ownerPath`。
- Tutor `trace_append` schema 不包含 `lessonPath` 或 `cardStepId`。
- `classroom_update` schema 不包含 `lessonPath`、`close`、`reflection` 或 `summary`。
- `lesson_close` schema 只包含 `reflection` 与 `summary`。
- Tutor 活动工具包含 `lesson_close`；Coach 不包含它。

### 路径绑定测试

- 使用非默认路径 `lessons/unit-a/custom-name.md` 创建 Lesson，确认三个写工具都修改该真实文件，而不是根据 owner ID 生成路径。
- 资源上下文显示同一个真实路径。
- 即使工具输入尝试携带额外 `lessonPath`，也不能改变 Session 所有权；正式 schema 不提供该字段。

### Trace 测试

- 一次题卡 attempt 只需 `blockId + cardAlias` 即可写入，并能从 Trace 反查真实卡片。
- 写出的新 Trace 不含模型生成的 step ID；底层当前仍保留字段时其值为 `null`。
- superseding Trace 仍只读取 active 记录并刷新 Planner Attention。

### 原子结课测试

- `lesson_close` 同时完成 Reflection Block、顶层 Reflection、Lesson Summary 与 `status: closed`。
- 模拟缺少任一必需 section，确认文件字节不变，不出现部分写入。
- Reflection 或 Summary 为空时由工具 schema 拒绝，不进入写文件流程。

### 回归测试

- Block activate / complete / skip、Route Change 与 pause 的现有行为不变。
- Card search、Trace search、source resolve、能力投影和前端 notebook 读取不因工具收窄而改变。
- 现有含 `cardStepId` 的历史 Trace 仍可读取；新 Tutor 调用不再生成该字段值。

## 十、真实模型验收

使用导数学习集重新开启一节真实课程，完成以下连续流程：

1. Tutor 从注入的准确路径读取 Lesson 并开始首个活动。
2. 学生完成至少两次有证据的作答，Tutor 写入两条 Trace。
3. Tutor 至少推进一次 Block；有 Route Change 时照常记录。
4. 学生确认结束后，Tutor 用一次 `lesson_close` 结束课程。
5. 检查 Pi 原始 Session JSONL、Lesson 文件、Trace 与前端状态。

通过标准：

- 没有 Lesson 路径猜测或 `OUTSIDE_LEARNING_SET` 重试；
- 没有 `cardStepId`、复合 step ID 或 step 参数重试；
- 没有 `complete` 携带结课字段、缺参 `close` 或重复关闭；
- 两条 Trace 均绑定真实 Lesson、Block 与题卡；
- Lesson 的 Reflection Block、Reflection、Lesson Summary 与 closed 状态一致；
- 从开始、两次 Trace 到关闭的整段流程中，路径、step 和结课参数错误均为 0。

## 十一、完成标准

以下条件同时满足时，本设计实现完成：

- `ownerPath` 从 workspace 真实对象进入 Session scope，并被资源上下文和所有 Tutor 写工具共同使用。
- Tutor 不再填写 `lessonPath` 或 `cardStepId`。
- `classroom_update` 只负责 Block、Route 与 pause；`lesson_close` 单独负责结课。
- 结课对同一 Lesson 文件是一次完整写入，不会留下部分状态。
- Tutor prompt 与 Skill 使用新工具契约，且没有新增确认门、裁判 Agent 或课堂状态机。
- 单元、contract、runtime 回归测试通过。
- 导数学习集真实课程达到“开始 → 两条 Trace → 关闭”且相关参数重试为 0。

## 十二、后续接口关系

这次新增的 `ownerPath` 是一个小而通用的运行时基础，但不借机实现其他功能：

- Coach 的 `plan_update` 后续绑定 Coach Session 的 `ownerPath`，解决 Plan 文件路径与自由 edit 参数问题；
- 前端 `messageProjection: safe | raw-stream` 后续独立实现，解决混合文本与 tool call 的显示边界；
- 一题多解与“实际使用方法”后续独立讨论，不能由删除 `cardStepId` 假装已经解决。

三项工作可以共享 Session scope，但必须分别设计、测试和验收。
