# StudyForge 架构审计问题收口设计

状态：待审阅

日期：2026-07-30

## 一、背景

Claude Fable 5 对 StudyForge 的当前架构契约、Pi 运行时、教学 Agent / Skill、
Claude Code 插件、Markdown 样例和六课真实验收进行了独立审计。主审计使用 76 份
文件；补充审计又读取了路线重放、学生投影与真实前端消费端，并撤回了首轮两项过重
判断：

- 本地单人版中，原始 Workspace API 不是保密边界；它是学生渐进呈现与数据最小化
  问题，上云前才会升级为权限阻断项。
- Route Changes 能够生成 effective replay；问题不是“路线不生效”，而是课堂
  Block 状态缺少局部不变量，且 Replay 将调整后路线称为“实际路线”会说得过满。

经代码复核后，当前问题应分成三类：

1. **会破坏事实完整性的缺陷**：一条 Trace 可以错误 supersede 同 Lesson 中另一个
   Block 的事件。
2. **会影响课堂与 Agent 可执行性的缺陷**：Block 状态缺少唯一 active、依赖和合法
   转换校验；普通 Lesson source 未验证；Learning Review 的拒绝信息不能帮助 Coach
   恢复；跨周期自然语言可能再次过度归纳。
3. **尚未被当前本地版阻塞的风险**：学生 API 数据最小化、跨文件原子性、generic
   文件工具越权和历史设计文档漂移。

本设计只处理前两类，并为第三类明确后续门槛。它不把一次静态审计扩张成新的安全
平台、规则引擎或课堂工作流系统。

## 二、设计结论

本轮采用五个局部收口：

1. `supersedes` 必须指向同一 Lesson、同一 Block、同一卡片绑定的 active Trace；
2. `classroom_update` 在一次 Lesson 文件写入中执行最小 Block 转换与 Route Change；
3. `lesson_prepare` 验证本地普通 source 的路径和 fragment 可定位性；
4. `plan_update(complete)` 的失败信息返回当前 Plan 可用的 key-evidence anchors；
5. Roadmap / 下一周期 Skill 在说“稳定、反复、通常、已经掌握”前核对次数、support、
   是否真实触发和原始方法名。

持久 schema、公共 MCP 工具数、Agent 数量和 Session 分层全部不变。

## 三、目标

### 3.1 更正保持局部

一条 Trace 更正只能关闭自己所在 Block attempt 的当前 active 事件。另一个 Block、
另一个题卡绑定或已经失效的事件不能成为 `supersedes` 目标。

### 3.2 课堂状态不自相矛盾

Lesson 在任一时刻最多有一个 active Block。完成、跳过、重复、重新插回和移动都必须
符合当前 Block 状态与依赖。一次 route 操作需要同时写入路线决定及其确定的状态
效果，不能留下“路线说跳过、Block 仍 pending”的半套事实。

### 3.3 来源承诺与实际校验一致

`lesson_prepare` 只在本地 source 确实存在、没有越出 learning set、fragment 可以
解析时返回成功。外部 HTTP(S) source 可以登记，但只表示外部引用，不表示内容已经
联网验证。

### 3.4 运行时 gate 可恢复

Learning Review 仍由 Coach 判断，运行时仍只检查客观资格。但当 key evidence 不合格
时，Coach 能从同一次错误中知道原因和当前 Plan 的合格候选，不再机械替换来源。

### 3.5 长期综合不依赖学生充当审计员

跨周期结论在首次表述时保留真实次数、帮助条件、是否触发和方法原名。证据不足时使用
单次、受支持、未覆盖或待复现表述，不把自然语言润色升级成稳定能力结论。

## 四、非目标

本轮不增加：

- 数据库、向量库、后台索引或统一 `study_context_get`；
- 新 Agent、裁判 Agent、自动 mastery 判决或自然语言事实检查器；
- 新持久字段、Route occurrence ID、独立课堂事件文件或持久 Blueprint；
- 第五个公共 MCP 工具；
- 通用状态机框架、LangGraph 或 Route 图编辑器；
- 学生端认证、租户、角色和云端授权；
- Plan / Roadmap 双文件事务或后台修复任务；
- 对历史非规范 Trace、Lesson 或 Plan 的兼容迁移；
- Agent / Skill 文案逐字测试。

本轮也不让 effective route 自动替 Tutor 选择下一 Block。学生与 Tutor 仍可在同一
Session 中改变方向；运行时只拒绝客观矛盾的写入。

## 五、事实与权限边界

```text
Tutor 教学判断
  → 选择 action、Block、路线理由、评价与 support
  → Session-bound tool
      ├─ runtime 绑定 lessonPath、真实 Block、题卡 alias 和 active Trace
      ├─ runtime 校验局部不变量
      └─ 单次写入 Lesson
            ├─ Block Node State
            ├─ Route Changes
            └─ Trace

Plan Coach 教学判断
  → 选择 Plan decision、自然语言结论和来源分层
  → plan_update
      ├─ runtime 绑定 planPath
      ├─ runtime 重建 Lesson Index 与来源资格
      └─ 写 Plan，并同步 Roadmap 状态
```

模型继续拥有不可推导的教学内容；运行时拥有身份、路径、当前状态、引用和枚举。

## 六、Trace supersede 局部性

### 6.1 Domain 层约束

`plugins/highschool-study/server/src/traces.ts / appendTrace()` 在解析完真实卡片绑定后，
对非空 `supersedes` 强制：

1. 目标事件存在于当前 Lesson；
2. 目标事件当前 active；
3. 目标事件的 `blockId` 等于新事件的 `blockId`；
4. 目标事件的 `cardPath` 等于新事件解析出的 `cardPath`；
5. 目标事件不能是自己或已经被其他 active 链关闭的旧事件。

这层同时保护公共 MCP 和 Pi，因为两者最终都写入同一 Trace domain。

公共 MCP 仍可在同一 Block 下记录 card-step 事件；本轮只限制“更正谁”，不把 Pi 的
一 Block 一 attempt 规则扩张为公共 MCP 的新限制。

### 6.2 Pi attempt 约束

Pi `assertProblemAttemptBoundary()` 进一步使用 Session-owned Lesson：

- 当前 problem Block 没有 active Trace时：
  - 不传 `supersedes`：允许第一次记录；
  - 传 `supersedes`：拒绝 `TRACE_SUPERSEDES_WITHOUT_ACTIVE_ATTEMPT`。
- 当前 Block 恰有一个 active Trace时：
  - `supersedes` 必须精确等于该事件；
  - 省略或指向其他事件都拒绝。
- 当前 Block 已经出现多个 active Trace时：
  - 拒绝继续写入并报告现有事件，不猜测哪一条应该保留。

所有校验必须在追加文件和重建 Planner Attention / Ability 之前完成。失败时 Lesson
字节和投影保持不变。

### 6.3 不增加的复杂度

不建立全局更正图，不自动改写 Lesson Summary、Plan、alternatives sidecar 或确认
画像。合法 supersede 成功后仍只重建已有派生投影，后续摘要通过正常 Coach review
更新。

## 七、课堂 Block 与 Route Change

### 7.1 两类事实不合并

- **Block status**：当前课堂执行事实，回答“哪个节点正在进行、已经完成或被跳过”。
- **Route Changes**：带来源的路线决定，回答“为什么改变了初始路线，以及调整后的
  顺序是什么”。

Route Changes 继续通过 `initial route + append-only changes` 重放。它不是第二套
Block 状态，也不成为自动调度器。

### 7.2 `classroom_update` 决定联合

工具 schema 改为 action-specific union，避免一个满是可选字段的对象：

```ts
type ClassroomUpdateInput =
  | { action: 'pause' }
  | {
      action: 'activate' | 'complete' | 'skip'
      blockId: string
    }
  | {
      action: 'route'
      routeAction: 'insert' | 'skip' | 'move' | 'repeat'
      blockId: string
      before?: string
      after?: string
      reason: string
      source: string
    }
```

`lessonPath`、Lesson status 和允许的 Block ID 仍由 runtime 与动态 schema 绑定。

### 7.3 普通 Block 转换

运行时只接受：

| 动作 | 前置状态 | 写入结果 |
|---|---|---|
| `activate` | Lesson active；目标 pending；没有其他 active；依赖均 completed / skipped | 目标 active |
| `complete` | 目标是唯一 active Block | 目标 completed |
| `skip` | 目标是唯一 active Block | 目标 skipped |
| `pause` | Lesson active | Lesson paused；Block 状态不变 |

暂停后的继续仍由现有 `WorkspaceRegistry.startLesson()` 把 Lesson 恢复为 active，不重复
Block admission。

### 7.4 Route Change 的局部效果

所有 `blockId`、`before` 和 `after` 必须引用当前 Lesson 的真实 Block；`before` 与
`after` 不能同时出现，锚点不能等于目标。

| route action | 允许条件 | 同一次 Lesson 写入中的状态效果 |
|---|---|---|
| `move` | 目标 pending | 状态不变，只追加重排决定 |
| `skip` | 目标 pending | 追加路线决定并把目标改为 skipped |
| `insert` | 目标 skipped | 追加路线决定并把目标恢复为 pending |
| `repeat` | 目标 completed / skipped，且当前没有其他 active | 追加路线决定并把目标恢复为 pending |

`repeat` 表示回到同一课堂语义，不产生新的独立 problem attempt。若该 Block 已有 active
Trace，后续评价必须通过合法 `supersedes` 修订它；新的独立判断仍需要新的 problem
Block。

一次 route 操作必须先完成全部校验，再生成一个新的 Lesson 字符串并写一次文件。
不能先追加 Route Change、再因状态失败留下半写入。

### 7.5 前端措辞

Replay 中的第二行路线由 route decisions 推导，不等于完整消息级执行日志。
`RouteMap` 将“实际”改为“调整后”，避免把路线决定投影说成已经逐步验证的完整实际
时序。

## 八、普通 Lesson source 可定位性

### 8.1 本地 source

`LessonSource.target` 继续使用 learning-set-relative canonical target。对非 HTTP(S)
target，`validateLessonBlueprint()` 使用现有 `sourceResolve()` 语义验证：

- 路径在 learning set 内；
- 文件存在；
- Markdown heading fragment 或卡片 step fragment 存在；
- 解析结果的 canonical path 与声明 target 一致。

错误加入现有 `LessonBlueprintValidationError.issues`，例如：

```text
来源不存在：materials/missing.md
来源越出 learning set：../../private.md
来源 fragment 不存在：materials/note.md#missing
```

### 8.2 外部 source

`http://` 和 `https://` 只做 URL 语法检查并按原值渲染。运行时不抓取、不判断可用性，
也不把它描述为已验证内容。Coach 仍负责来源是否适合教学。

## 九、Learning Review 可恢复错误

### 9.1 唯一资格函数

`learning-review.ts` 增加：

```ts
export function listEligibleKeyEvidence(
  root: string,
  planPath: string,
): string[]
```

它复用现有客观资格：

- 同一 Plan 的 Lesson；
- active Trace；
- `support: none`；
- `assessment: correct`；
- Lesson 主模板为 `assessment`；
- Trace 所在 Block 为 `problem`。

`validateLearningReviewSources()` 和错误回执都调用这一函数，不能复制两套资格逻辑。

### 9.2 错误内容

key evidence 相关错误保留稳定错误码，并追加：

```text
source=<不合格来源>
reason=<客观原因>
eligible=<最多 5 个合格 source anchor，或 (none)>
```

例如：

```text
LEARNING_REVIEW_KEY_NOT_ASSESSMENT:
source=lessons/lesson-004.md#trace-event-002;
eligible=lessons/lesson-006.md#trace-event-003
```

候选只说明“有资格作为 key”，不说明它最有代表性，也不替 Coach 选择。supporting
evidence 和 open question 的现有语义不变。

### 9.3 Tool schema 与 Skill

`plan_update` 的 `keyEvidence.source` description 明写资格条件。Coach Skill 只保留
一句调用顺序：先按 key / supporting / open question 分层，再调用工具；被拒绝时只
使用返回候选重新判断，不机械轮换来源。

不新增 evidence-search 工具或完成裁判 Agent。

## 十、跨周期归纳核对

在 Pi 的 `roadmap-study` 和 `plan-next-cycle` 中加入一个紧凑的内部核对：

> 每个准备写成“稳定、反复、通常或已经掌握”的判断，先核对发生次数、最终 support、
> 行为是否真实触发及 active Trace 中的方法原名。任一项不足时，改写为单次、受支持、
> 未覆盖或待复现。

这属于教学判断，不进入 runtime schema。Skill 不重复工具错误码、字段枚举或固定表格，
也不增加逐字测试。

Claude 插件已经要求以 active Trace 和真实 support 为准；本轮不复制 Pi 专有的
Learning Review 工具协议。若之后发现 Claude 路径同样反复过度归纳，再单独修改其
对应 Skill。

## 十一、明确延后的事项

### 11.1 学生 API 与上云

本地单人版不把浏览器网络响应当保密边界，因此本轮不拆 `PlanWorkspaceSnapshot`。
上云前必须单独完成：

- 认证、学生归属、角色与 learning-set 授权；
- student-only projection DTO；
- 不向学生响应发送 Teacher Control、未揭示题卡、私有 Plan 字段或其他 Session
  内容；
- 对 Workspace、History、Evidence、Notebook 和 Content Search 逐端点授权。

没有完成该独立设计前，当前服务不能直接作为多用户云服务发布。

### 11.2 Plan / Roadmap 跨文件原子性

当前没有真实损坏案例。本轮保留已有“每次 Plan audit 重建 Lesson Index、同步 Roadmap
状态”的修复能力，不复制画像双文件 rollback。只有故障注入或真实运行证明存在残留
分叉时，再设计 temp / rename / rollback。

### 11.3 Generic 文件工具

先在 learning-set 副本上验证 Roadmap Coach 是否能通过 Pi 原生 `write/edit` 修改既有
Lesson、Plan 或 profile。只有确认能绕过 owner-bound 工具后，才设计仅允许
`ROADMAP.md` 和尚未注册新 Plan 的路径 allowlist。本轮不预设 Pi 原生工具一定越权。

### 11.4 历史文档

在 `docs/design/architecture.zh-CN.md` 首段增加一条现行契约指针，说明该文档记录
Claude 插件的原始 Markdown-first 设计；Pi 当前契约以 `AGENTS.md`、完整说明书和
可执行 runtime 为准。不重写全部历史文档。

## 十二、错误与失败语义

- Trace、Block、route、source 和 Learning Review 校验均在写入前完成；
- 校验失败不写 Lesson、Plan、Planner Attention 或 Ability；
- 错误必须使用稳定码和当前真实 ID，不返回虚构修复；
- Agent 收到结构错误后修正当前调用或返回 Coach，不搜索替代文件、不猜路径；
- 合法写入继续返回现有最小 receipt；不把普通失败包装成成功结果。

## 十三、验证

### 13.1 自动测试

必须覆盖：

- 跨 Block、跨卡、stale supersede 拒绝，同 Block active 修订成功；
- 第二个 active Block、未满足依赖、非法 complete / skip 拒绝；
- route 的真实目标、锚点、状态条件与一次写入；
- valid / missing / outside / missing-fragment / external source；
- Learning Review 错误包含合格候选且无候选时明确 `(none)`；
- RouteMap 使用“调整后”；
- 插件公共 MCP 工具仍为四个。

### 13.2 全套验证

```bash
cd plugins/highschool-study
bun run release:check

cd ../../apps/pi-teaching-web
bun run check
bun run test:e2e
```

### 13.3 真实短课

在导数学习集副本运行一节包含：

1. 一个普通 Block 完成；
2. 一个 pending Block 被 route skip；
3. 一个可选 Block 被重新 insert；
4. 一次同 Block Trace 补全；
5. 结课与 Plan review。

验收只检查真实文件、工具 receipt、学生可见投影和错误恢复，不要求模型使用固定措辞。

## 十四、复杂度自审

### 必须保留

- Domain 层 supersede 局部性；
- Session-bound owner；
- Block status 与 Route Changes 分工；
- Learning Review 客观资格 gate；
- Skill 中的教学归纳核对。

### 可以局部增加

- 一个纯课堂转换模块；
- 一个 key-evidence 候选函数；
- 现有 Blueprint validator 中的 source resolution。

### 明确不增加

- Route occurrence、自动调度、通用状态机、额外 Agent、数据库和云端权限代码。

本设计新增的复杂度均直接关闭一个已经证实的事实或执行缺口；没有一项仅用于低概率
产品化防御。
