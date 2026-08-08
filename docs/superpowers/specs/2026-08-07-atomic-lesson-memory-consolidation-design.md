# Lesson 课末记忆原子固化设计

> **历史设计，语义契约已被取代。** 本文保留原子多文件事务形成过程，不能再作为现行
> 记忆 schema、工具字段或召回链路的依据。当前契约见
> [`2026-08-08-remove-consolidated-learning-traces-design.md`](./2026-08-08-remove-consolidated-learning-traces-design.md)
> 与 `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`。

状态：已确认并实施

日期：2026-08-07

## 一、问题不是 Markdown 慢，而是模型在执行多文件事务

M1a 长周期中，五次课末固化分别用了 83.1—144.6 秒、9—14 次工具调用和 7—11 次
模型调用；M0 对应收尾只用了 9.8—22.6 秒。逐项核对原生 Session 后，真正的文件工具
执行总计只有 28—66 毫秒。等待主要来自同一个语义判断被拆成多轮：

```text
读课末流程与当前 Lesson
→ 读 INDEX、对象、分桶、偏好
→ 追加 Classroom Log
→ 追加 Lesson Trace
→ 改对象当前判断
→ 改对象时间线
→ 改 bucket
→ 改根 INDEX
→ 必要时修路径、exact-end 或 active Block 错误
```

其中五次固化全部先把绝对路径交给原生 `edit`，被 Lesson 写入守卫拒绝；另有一次
`exact end` 重试，以及一次因为没有 active Block 而临时插入、启动、记录、推进 Reflection
Block。模型并不是在这些轮次中持续获得新的教学认识，而是在充当一个不可靠的事务执行器。

这已经满足此前架构计划为跨文件事务设置的触发条件：真实运行出现了稳定的扇出、重复机械
错误和部分写入恢复用例。需要优化的是课末记忆的**提交路径**，不是撤销 Markdown 记忆，
也不是把教学判断交给 Runtime。

## 二、目标与非目标

### 目标

1. Tutor 对本课证据只形成一次有边界的语义判断，再用一次工具调用提交本轮全部记忆变化。
2. Runtime 绑定当前 Lesson、时间、稳定 ID、路径、链接、源版本和文件写入顺序。
3. 模型继续独占对象边界、合并与拆分、当前判断、能力信号、偏好和语义分桶决定。
4. 新对象无法可靠分桶时允许明确暂缓，仍能从根索引到达，随后由 Plan Coach 归类。
5. 任一候选不合法或来源已变化时，整个提交不留下可见的半套记忆。
6. 旧 Trace、旧 Classroom Log 和既有偏好原话继续只追加、不回写。
7. 把典型课末固化压回少量模型轮次，不以降低教学事实质量换速度。

### 非目标

- 不让 Runtime 根据关键词、标题、题卡 graph 或 embedding 推断对象与 bucket。
- 不引入掌握等级枚举、能力分数、BKT 字段或统一学生画像。
- 不把 Markdown 换成数据库，不新增通用 recall 工具。
- 不把 Plan / Roadmap 的跨对象与跨 Plan 判断塞进 Lesson 工具。
- 不在本设计中解决学习集全局并发编辑或云端多用户事务。
- 不把测试运行器中 Session 立即切换误写为真实“间隔学习”；时间验收另行校正，不能据此
  扩建一套教学时间状态机。

## 三、三个可行方案

### 方案 A：模型提交原生 Markdown patch bundle

模型一次给出多个精确路径、旧文本和新文本，Runtime 只做批量校验与应用。

优点是实现最薄、Markdown 形状完全自由。缺点是绝对路径、exact-end、完整旧正文重传、稳定
ID 和相对链接仍由模型处理；它只把多次 `edit` 包成一次，并没有移走真实毛刺来源。对象文件
越长，模型还要反复输出整份正文。

### 方案 B：语义提交单 + Runtime 确定性渲染（采用）

模型填写教学上不可约的自然语言，并显式声明对象、Trace、偏好与路由之间的关系；Runtime
分配 ID、解析既有引用、生成 Markdown 链接、局部修改对应章节并可恢复地提交全部文件。

结构化字段只描述拓扑和写入意图，不尝试把教学判断离散化。这既能消除路径与链接错误，又
不会把 Runtime 变成分类器。

### 方案 C：先写 pending manifest，再由模型二次确认 commit

两阶段提交最容易审计，但会增加一次模型往返、一个临时事实面和 pending 清理规则。课末
判断已经在学生反思后形成，再让同一模型批准自己的 manifest 没有新增证据。本阶段不采用。

## 四、所有权边界

| 决定或事实 | 唯一所有者 | Runtime 可以做什么 |
| --- | --- | --- |
| 是否有值得固化的新事实 | Tutor | 不自动创建 Trace |
| 一次还是多次教学事件 | Tutor | 为已声明事件分配 Trace ID |
| 对象是已有、新建、暂定、应合并或应分开 | Tutor；复杂合并留给 Plan | 校验引用存在，创建稳定文件 |
| Current Judgment、Evolution Overview、边界 | Tutor | 按固定章节写入模型原文 |
| 单对象能力信号 | Tutor | 放进对应 Trace，不升级为能力文件 |
| 是否是明确偏好、适用范围与当前 cue | Tutor | 追加来源，更新模型声明的 cue |
| bucket 选择、新 bucket 含义、暂缓分桶 | Tutor；后续重归类由 Plan | 只执行 `keep` / `assign` / `defer` |
| 当前 Lesson、Plan/Lesson ID、源路径 | Runtime | 从 Session scope 绑定，工具参数不暴露路径 |
| 记录时间、稳定 ID、相对链接、Markdown 排版 | Runtime | 机械生成并校验 |
| 哪些 Classroom Log 支持本次判断 | Tutor 选择 | 校验 Block 属于当前 Lesson；按声明追加一条课末事实 |
| 多文件版本、暂存、回滚和回执 | Runtime | 提供应用层原子语义 |

核心禁令只有一条：**Runtime 不得从模型文本、题卡字段或目录结构推断一个对象属于哪个
bucket。** `assign`、`defer` 都必须由 Tutor 明说；Runtime 只把这个决定落成链接。

## 五、学生可见流程保持不变

原有亮线继续成立：

```text
自然短回顾
→ 先听学生
→ 有边界的判断
→ 静默固化
→ 自然总结
→ 接受学生纠正
```

改变的只有“静默固化”内部：

1. Tutor 从当前 Lesson 和常驻 `memory/INDEX.md` 开始，只读取本次判断需要的对象、bucket
   或偏好文件；不为构造提交单扫描目录。
2. 若课末反思产生需要补记的课堂事实，把事实文本和它所属的 Block 一起放进同一次提交；
   Runtime 只负责追加，不生成内容。
3. Tutor 一次调用 `lesson_memory_commit`，提交本轮 Classroom Log、Trace、对象、偏好和
   路由变化。
4. Runtime 返回稳定 ID、改动文件和耗时；Tutor 不回读刚写入的记忆。
5. Tutor 用普通教师语言总结并等待学生决定是否纠正或结束。
6. 学生纠正时再调用一次新的 `lesson_memory_commit`：追加一条纠正 Log 与新 Trace，并修订
   当前判断，不改写第一次提交。

课堂生命周期仍由界面和现有 Runtime 关闭接口控制。记忆提交成功不等于 Lesson 已关闭，
工具也不接收 `close: true` 或学生确认布尔值。

## 六、工具何时出现

`lesson_memory_commit` 是当前 Lesson Session 绑定的本地工具：

- 它闭包绑定学习集根目录与当前 `scope.nodePath`，不接收 `lessonPath`、`planId`、绝对路径
  或目标文件路径；
- 只有学习集存在 `memory/INDEX.md` 时注册。该文件缺失时，系统结构性地按 M0 运行；
- Roadmap 和 Plan Session 不获得该工具；
- Lesson 的模型工具列表直接移除原生 `edit/write`；课堂调整已有 `classroom_update`，课末记忆
  已有 `lesson_memory_commit`，Tutor 不再有其他合法写入用途。旧守卫保留为纵深防线，若未来
  扩展意外重新暴露文件工具，仍明确拒绝 Lesson Trace 与 `memory/` 原生写入；
- 原生 `Read` / `Grep` 继续承担渐进式召回，没有 `read_memory` 或 `recall_memory`。

## 七、最小语义提交契约

下面的 TypeScript 只表达字段边界；实现使用当前项目的 TypeBox 定义。自然语言字段保持为
自然语言，不增加“掌握/未掌握”等枚举。

```ts
type ExistingOrNew =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; key: string; title: string };

type TraceDraft = {
  key: string;                 // 仅在本次提交中引用，不是持久 ID
  situation: string;
  firstPerformance: string;
  actualHelp: string;
  laterPerformance: string;
  capabilitySignal?: string;
  evidenceBlockIds: string[];  // Tutor 选择，Runtime 校验
};

type BucketRef =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; key: string; title: string };

type RoutingDecision =
  | { kind: 'keep' }
  | { kind: 'assign'; buckets: BucketRef[] }
  | { kind: 'defer'; reason: string };

type ObjectMutation = {
  target: ExistingOrNew;
  currentJudgment: string;
  evolutionOverview: string;
  boundaries: string[];
  traceEntries: Array<{
    traceKey: string;
    meaning: string;
  }>;
  routing: RoutingDecision;
  frontierSummary?: string;
};

type PreferenceCue =
  | { kind: 'keep' }
  | { kind: 'upsert'; summary: string }
  | { kind: 'remove' };

type PreferenceMutation = {
  target: ExistingOrNew;
  currentJudgment: string;
  scope: string[];
  explicitStatements: Array<{
    text: string;
    evidenceBlockId: string;
  }>;
  evolutionEntry: string;
  cue: PreferenceCue;
};

type LessonMemoryCommit = {
  closingFact?: {
    blockId: string;
    note: string;
  };
  traces: TraceDraft[];
  objects: ObjectMutation[];
  preferences: PreferenceMutation[];
};
```

空数组表示这一类没有新证据，不是缺字段。整个提交至少包含一项写入操作；工具不要求每课
凑齐对象、能力、偏好三类。

`closingFact` 解决一个真实的课末时序问题：学生可能在既有 Reflection Block 完成后，才补充
“其实没有提醒我还会继续硬算”之类的决定性事实。Tutor 明确选择当前 Lesson 中的 Block 并
提供事实文本；Runtime 允许向 active Block，或已经 completed 的 reflection Block，**只追加**
一条 Classroom Log。它不重开 Block、不改变状态、不创建新的教学活动。其他 completed Block
仍不能借此继续写入。若 Lesson 根本没有可承载的 active / reflection Block，Tutor 才使用现有
课堂路由决定是否需要一个真实反思活动；Runtime 不替教师发明 Block。

### 7.1 本地 key 与稳定 ID

模型只为同一提交中的新产物提供短 `key`，例如 `route-choice`。Runtime 在校验全部引用后
分配稳定 ID：

- Trace：`trace-<plan-id>-<lesson-id>-<nn>`；
- 对象：`obj-<nnn>`；
- 偏好：`pref-<nnn>`；
- 新 bucket：分配稳定文件 ID，标题仍使用模型给出的语义标题。

模型不猜下一个编号，也不拼相对路径。回执返回 `key → stable ID/path` 映射。既有对象和
偏好通过文件标题中的稳定 ID 引用；既有 bucket 通过 `memory/INDEX.md` 已公开的稳定文件
ID 引用，Runtime 将 ID 解析为精确路径。

### 7.2 Trace 与对象的关联只声明一次

`ObjectMutation.traceEntries` 已经声明哪条 Trace 关联哪个对象。Runtime 机械反转这组关系，
生成 Trace 的“关联对象”字段，并把对应 Trace 链接追加到对象时间线。模型无需在两个位置
重复抄 ID；没有对象时间线入口的 Trace 不会被悄悄挂到对象上。

同一 Trace 可以出现在多个对象的 `traceEntries` 中，但正文仍只追加在来源 Lesson 一次。
每个 `TraceDraft.key` 必须至少被一个对象引用，每个对象时间线入口也必须指向本次真实存在的
Trace；这是引用完整性校验，不是 Runtime 在判断教学对象。

### 7.3 路由三态

- `keep`：只适用于既有对象，不重新讨论或修改现有 bucket。正常的逐课对象更新优先使用
  这一态。
- `assign`：Tutor 明确选择一个或多个既有 / 新 bucket。Runtime 只增加已声明的多对多
  路由，不根据标题补充相邻 bucket，也不替 Tutor 删除旧关系。
- `defer`：只用于新对象。证据足以建立对象，但此刻无法负责地判断语义归属；`reason` 说明
  留给 Plan 复盘的真实歧义，而不是“模型没想好”的空话。

因此，工具不会逼 Tutor 每节课重新分类已有对象，也不会为了让文件看起来完整而随便新建
bucket。

## 八、`defer` 的持久表示

根索引新增一个紧凑、可选的投影区：

```md
## Deferred Object Routing

- [obj-002：函数表示与目标之间的距离](objects/obj-002.md)
  — 暂难判断应归入“参数方程选路”还是更一般的“目标同构构造”；待本 Plan 课后复盘。
```

这不是新的学生认知事实，只是“该对象尚无稳定 bucket 入口”的显式路由状态：

- 对象文件仍持有 Current Judgment、Evolution Overview、Trace Timeline 和边界；
- 根 INDEX 直接链接该对象，所以后续 Session 不需要枚举目录；
- Plan Coach 的课后复盘先处理这一小节：选择已有 bucket、新建 bucket，或继续暂缓；
- 一旦 Plan 明确 `assign`，同一次路由修改增加 bucket 边并删除该 deferred 项；
- Runtime 不读取对象正文来猜答案。

现有根索引的四个主要区域保持不变。`Deferred Object Routing` 只有存在待分桶对象时才出现，
不会成为另一份无限增长的历史清单。

### 8.1 Plan 如何完成 deferred route

Plan Session 获得一个比 Lesson 固化更窄的 `memory_route_resolve` 工具。它只接受当前根索引
中已经存在的 deferred 对象，以及 Coach 明确选择的一个或多个既有 / 新 bucket：

```ts
type MemoryRouteResolve = {
  objectId: string;
  buckets: BucketRef[];
};
```

Runtime 校验对象确实在 `Deferred Object Routing`，然后用同一多文件事务创建必要的新 bucket、
增加对象链接、ensure 根 bucket 入口，并删除该 deferred 项。Coach 决定对象属于哪里和新
bucket 叫什么；Runtime 不读取对象正文做分类。若 Coach 仍无法判断，不调用工具，deferred
项原样保留即可。

这个工具不负责普通对象的重新分类、合并或删除。那些低频且语义更复杂的 Plan 操作仍按现有
Plan 复盘契约完成；只有本设计新增的 deferred 状态获得一条对称、可恢复的机械出口。

## 九、确定性 Markdown 变换

### 9.1 来源 Trace

Runtime 为每条 `TraceDraft` 分配 ID，使用 Runtime 时钟写“记录时间”，并在当前 Lesson 的
唯一 `Consolidated Learning Traces` 末尾追加固定形状。`evidenceBlockIds` 被渲染为当前
Lesson 内的来源 Block。Runtime 不把“另一个 Session”解释为“隔课”“延时”或保持间隔；
这些教学判断只有在输入证据明确提供时才能出现在模型自然语言中。

### 9.2 对象文件

对既有对象：

- `Current Judgment`、`Evolution Overview` 和 `Boundaries / Not Yet Demonstrated` 用模型
  本次给出的完整文本替换；
- `Trace Timeline` 只追加 Runtime 生成的时间、稳定链接与模型给出的 `meaning`；
- 旧时间线条目逐字保留。

对新对象：Runtime 用同一四段模板创建文件。对象标题来自模型，ID 与路径来自 Runtime。
Runtime 不从 `currentJudgment` 自动提取边界，也不把 `meaning` 自动总结进根 INDEX。

`frontierSummary` 存在时才 upsert 根索引中的当前前沿条目；省略时不改变该对象的根前沿
状态。摘要内容完全由 Tutor 提供。

### 9.3 偏好文件

Runtime 更新模型提供的 Current Judgment 与 Scope，追加本次明确表达和一条 Evolution
History，并生成指向当前 Lesson Block 的来源链接。根索引 cue 只按 Tutor 显式给出的
`keep`、`upsert` 或 `remove` 改变；教学效果观察不能由 Runtime 自动变成偏好。

新建偏好必须同时用 `upsert` 建立当前 cue；否则新文件在现有索引结构中不可达。`keep` 与
`remove` 只用于已经存在的偏好，不让 Runtime 猜一条缺失的 cue 摘要。

### 9.4 bucket 与根 INDEX

`assign` 只确保模型点名的对象链接存在于点名 bucket；新 bucket 使用模型标题和 Runtime
路径创建。根 INDEX 只执行由提交直接声明的局部变化：

- upsert 明确给出的对象前沿摘要；
- ensure 本次明确使用的新 / 既有 bucket 入口；
- upsert 或 remove 明确给出的偏好 cue；
- add 或 resolve 明确给出的 deferred route。

它不扫描历史对象，不根据本次文本重排其他前沿，也不自动清理未触及的旧线索。更大范围的
前沿整理继续属于 Plan / Roadmap 的自然收口点。

## 十、可恢复的多文件提交

当前 `mutateDocumentAtomically` 只保护一个文件。新增的多文件 helper 提供**应用层原子语义**，
不声称底层文件系统能用一次 `rename` 同时替换不同目录下的多个文件。

一次 `lesson_memory_commit` 按下面顺序执行：

1. 获取当前学习集的记忆提交互斥锁；同一进程中不并行执行两个固化。
2. 从 Session scope 解析当前 Lesson；校验它仍为 active，且属于绑定的 Plan。
3. 解析模型点名的既有对象、偏好和 bucket；检查 ID 唯一、文件在允许目录、路径无符号链接。
4. 读取所有目标的原始字节并计算版本摘要；Runtime 此时才分配本次稳定 ID。
5. 在内存中先追加模型声明的课末 Classroom Log，再渲染 Lesson、对象、偏好、bucket 和根
   INDEX 的全部候选；校验 Lesson parser、
   必需章节、Trace 唯一性、所有相对链接和事务内引用。
6. 将候选、原始副本和只含机械元数据的 manifest 写入临时事务目录，状态为 `prepared`。
7. 再次核对每个既有目标的版本摘要；任一 stale 都在第一次替换前失败。
8. 逐个用同目录临时文件替换目标；新文件只在精确分配路径创建。
9. 全部成功后把 manifest 标记为 `committed`，再发布一次 course / knowledge invalidation。
10. 捕获到写入错误时，使用 manifest 中的原始副本恢复已经替换的文件，并删除仅由本事务
    创建、且内容仍匹配候选摘要的新文件。恢复完成前不返回成功。

进程若在第 8 步中断，下一次打开学习集或再次调用提交工具时先发现未完成 manifest，并按
原始副本回滚。恢复逻辑只触及 manifest 精确列出的路径；若某目标在崩溃后又被外部修改，
停止自动恢复并报告冲突，不扩大删除或覆盖范围。

正常完成后清理临时内容；manifest 是 Runtime 恢复材料，不是教师记忆、召回来源或第二份
事实仓库。

## 十一、失败与重试语义

- schema、ID、Block、链接、章节或 stale 校验失败：写入零个正式文件；回执给出一个精确
  错误和需重新读取的目标。
- Runtime 内部写入失败：先恢复，再返回失败；Tutor 不自行猜测哪些文件可能成功。
- 同一进程内，同一个原生 tool call 被传输层重放：Runtime 使用 tool-call ID 返回同一提交
  回执，不重复 Classroom Log 或 Trace。
- 跨进程重启、Pi tool result 丢失和关闭回执丢失的持久幂等由后续
  `2026-08-08-teaching-session-close-recovery-design.md` 补齐：成功提交的 receipt 与本节
  canonical 候选进入同一事务，并绑定真实 Pi 学生证据轮次。
- 提交前校验失败时，模型可以在同一学生轮次修正语义或格式后重试；第一次成功提交后，
  同轮重放不得形成第二条 Trace。
- 学生在公开总结后给出真实纠正：新的 Pi 学生轮次产生新的提交和新 Trace，不覆盖旧提交。
- `defer` 不是失败，不能因为没有 bucket 而触发模型继续搜索“最优分类”。
- 提交成功后不得为了确认而回读 INDEX 或对象；回执已经是机械成功证据。

回执保持紧凑：

```ts
{
  ok: true,
  commitId: string,
  traceIds: Record<string, string>,
  objectIds: Record<string, string>,
  preferenceIds: Record<string, string>,
  bucketIds: Record<string, string>,
  changedPaths: string[],
  durationMs: number,
}
```

## 十二、旧路径的收口

实现不能只新增工具而保留旧 Skill 的逐文件操作说明，否则模型会在两条路径之间随机选择。
同一变更需要同步完成：

1. `session-scope.ts` 从 Lesson 工具列表移除原生 `edit/write`，`lesson-memory-guard` 保留拒绝
   旧写入面的纵深校验；
2. `lesson-node.md` 的权限段改成只允许 `lesson_memory_commit` 固化记忆；
3. `memory-consolidation.md` 删除路径、exact-end、手工 ID 和逐文件修复教程，改成“读取所需
   证据 → 形成一次提交 → 不回读”；
4. M1 memory contract 增加 deferred route 的语义，同时保留原生 `Read/Grep` 召回；
5. Plan 课后复盘增加处理 `Deferred Object Routing` 的入口，但不把 Lesson 工具暴露给 Plan；
6. Plan 只获得窄的 `memory_route_resolve`，不获得对象判断或 Lesson Trace 写入能力；
7. server 在新工具成功后同时发布 course 与 knowledge invalidation。

现有单文件 `mutateDocumentAtomically` 继续服务 Classroom 工具与 frontmatter，不强行改造成
所有写入的全局抽象。新的多文件 helper 只服务已经出现真实 split-write 的课末记忆事务。

## 十三、测试与验收

### 13.1 Runtime 单元测试

至少覆盖：

1. M1 Lesson 注册工具，缺失 `memory/INDEX.md` 的 M0 Lesson 不注册；
2. 既有对象 + `keep`：追加一条 Trace 和时间线，只更新显式文本，不碰 bucket；
3. 新对象 + 既有 bucket：Runtime 分配 ID，所有链接可解析；
4. 新对象 + 新 bucket：标题由模型提供，ID/path 由 Runtime 提供；
5. 新对象 + `defer`：不创建猜测 bucket，根 INDEX 可直接到达对象；
6. 一条 Trace 关联两个对象：Lesson 只保存一份正文，两个时间线均指向同一锚点；
7. 明确偏好 upsert / remove cue，教学效果观察不会自动产生偏好；
8. 学生纠正产生第二条 Trace，旧 Log、旧 Trace、旧时间线逐字不变；
9. completed reflection 可追加一条课末纠正事实，但状态和旧 Log 不变；普通 completed Block
   不能通过该入口继续写入；
10. `memory_route_resolve` 只处理根索引中真实 deferred 的对象，bucket 仍由 Coach 明确选择；
11. 不存在的 object/bucket/Block、空 `assign`、新对象使用 `keep` 全部零写入失败；
12. 绝对路径、目录逃逸、符号链接和 sibling Lesson 不存在于工具参数面或被 Runtime 拒绝；
13. stale source 在首次正式替换前失败，所有目标字节不变；
14. 对每个替换位置注入失败，验证已写目标恢复、新目标删除且不产生重复 Trace；
15. 模拟中断 manifest 后重启恢复，只触及 manifest 的精确路径；
16. 成功回执包含完整 key 映射、路径列表和耗时；
17. 新工具落地后，Lesson 工具列表没有原生 `edit/write`，守卫测试也证明无法绕回旧记忆
    写入面。

跨进程 receipt、孤立 Pi tool result、关闭重试和 WebSocket 重连的故障注入不重复列在这里，
统一按 `2026-08-08-teaching-session-close-recovery-design.md` §十五验收。

### 13.2 Skill 首击验收

用真实模型分别跑四类课末：

- 更新一个既有对象，不重新分桶；
- 一条事件关联两个对象；
- 新对象能明确进入一个 bucket；
- 新对象证据成立但分类真的不清楚，选择 defer。

每个场景检查模型第一次是否：

- 保留首次表现、帮助程度、后续表现和未知边界；
- 没有创建不必要能力或偏好；
- 没有把 bucket 决定交给 Runtime；
- 只调用一次 `lesson_memory_commit`，没有原生 memory `edit/write`；
- 成功后不回读刚写入文件；
- 对学生只给自然总结，不播报内部 schema。

### 13.3 性能门

性能目标用工具扇出而不是绑定某个模型供应商的绝对秒数：

- 一次普通固化只有一次 `lesson_memory_commit`；课末补充事实包含在同一提交，不再额外插入、
  启动和推进临时 Reflection Block；
- 不再出现绝对路径、exact-end、手工 Trace ID 或部分文件猜测修复；
- 单次 Runtime commit 的机械耗时记录在回执中；
- 用相同模型与同一课末输入，对照旧路径记录首反馈、最终时间、模型调用数、usage 和语义
  结果；只有语义承重门全部守住，速度改善才算有效。

不把“必须低于 N 秒”写成单元测试，因为 Sol/high 延迟受服务端和缓存影响。M1a 终验应重点
观察模型轮次是否从 7—11 次回到接近 M0 的少量轮次，以及学生是否不再等待 1—2 分钟。

## 十四、预期实现面

实现阶段预计只触及以下边界：

- 新增 `src/study/memory-mutations.ts`：解析 / 渲染受支持的记忆 Markdown 局部结构；
- 新增 `src/runtime/multi-document-transaction.ts`：暂存、版本校验、恢复与故障注入点；
- 新增或扩展 Lesson custom tool，注册 `lesson_memory_commit`；
- 扩展 Plan custom tool，注册窄的 `memory_route_resolve`；
- 收紧 `lesson-memory-guard.ts` 和 `session-scope.ts` 的旧写入面；
- 更新 server invalidation 投影；
- 更新 M1 contract、Tutor Agent、课末固化 reference 与 Plan deferred route reference；
- 新增 Runtime、guard、Skill 和真实模型小闭环测试。

不修改 Roadmap → Plan → Lesson 树、Lesson 生命周期、召回路线、前端课程结构、题卡 schema、
Scout、能力文件所有权或旧插件清理结论。

## 十五、定稿决策

- 采用“语义提交单 + Runtime 确定性渲染”，不采用 raw patch bundle 或二次批准 manifest。
- 模型决定所有教学含义和 bucket 关系；Runtime 只掌握身份、路径、时间、ID、链接和事务。
- 新对象可以明确 `defer`，并通过根 INDEX 的独立投影保持可达；Plan Coach 后续归类。
- Plan 使用 `memory_route_resolve` 执行已经作出的归类判断；Runtime 仍不决定 bucket。
- 既有对象默认 `keep`，不在每次课末重复支付分类成本。
- 一个工具调用可以提交多条 Trace、多对象和明确偏好，但没有类别配额。
- Lesson 中的旧 Trace 与事实保持追加式；纠正是一条新提交。
- 新工具成功后关闭 Tutor 的旧原生记忆写入路径，避免双协议。
- 多文件事务采用可恢复的应用层原子语义，并诚实保留文件系统多次 rename 的底层事实。
