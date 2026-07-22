# 能力投影实时刷新与页面 URL 恢复设计

状态：讨论定稿，书面自审完成，待用户复核

日期：2026-07-22

## 一、问题

当前后端已经能在 `trace_append` 成功后重建 `memory/planner-attention.md`，`GET /api/abilities` 也会按 active Trace 重新计算能力投影。但是前端只在 Plan ID 变化时请求一次 `/api/abilities`。课堂产生新 Trace 或 superseding Trace 后，文件与 API 已经更新，右侧能力图仍停留在旧快照。

代码中虽然已经声明 `ability-update` 事件，却没有 writer，客户端也没有消费它。这个断点不需要新的投影层，只需要把已有新结果推送到页面。

页面恢复存在类似的单点断裂：服务端已经会为 `/plan/domain-integrity` 等浏览器路径返回 SPA shell，但 React App 从不读取或更新 `location.pathname`。当前 Plan 和选中的 Coach/Tutor 只存在于组件内存中，刷新页面后必然回到学习集首页。

## 二、目标与非目标

### 目标

- 每次成功写入或 supersede Trace 后，立即把完整能力投影推送到前端。
- 前端用完整新投影替换旧能力图，不维护第二套增量算法。
- 用稳定的 Plan ID 与 Lesson ID 表达当前浏览器位置。
- 页面刷新、直接访问深链和浏览器前进/后退都能恢复对应学习界面。
- URL 恢复继续读取 Markdown、WorkspaceRegistry 与 Pi Session 的真实状态，不复制 Lesson 状态或聊天记录。

### 非目标

- 不修改能力聚合、BKT、Planner Attention 或一题多解的计算语义。
- 不增加轮询、文件监听、前端缓存或能力增量 patch。
- 不引入 React Router 或其他路由依赖。
- 不使用 `localStorage` 或 `sessionStorage` 保存当前页面。
- 不把 Lesson status、Session ID、当前 Block、Persona、深度模式或弹窗状态写入 URL。
- 不改变点击 Session 时现有的暂停、启动和回放判定。

## 三、能力刷新

### 3.1 事件契约

把当前未使用且字段不完整的 `ability-update` 事件收束为完整投影：

```ts
type StudyViewEvent =
  | {
      type: 'ability-update';
      projection: AbilityProjection;
    }
  | /* existing events */;
```

事件直接复用 `/api/abilities` 返回的 `AbilityProjection`，包含每个节点的：

- `method`
- `state`
- `score`
- `evidenceCount`
- `sources`

服务端和客户端不再维护一份只有 `method/state/evidence/sources` 的近似事件结构。

### 3.2 发送时机

在当前 Session 事件订阅链中观察 `trace_append` 的工具结束事件：

```text
trace_append 写 Trace
  → appendTraceWithProjection 重建 planner-attention.md
  → tool_execution_end(isError = false)
  → readAbilityProjection(root)
  → EventHub.publish(ability-update)
```

发送规则只有两条：

- `trace_append` 成功时发送一次；普通新证据与 supersede 使用同一路径。
- `trace_append` 失败时不发送。

先发布现有 `work-status: done`，再发布 `ability-update`。这样页面展示顺序仍是“证据记录完成 → 能力图刷新”。不监听任意工具结束，也不在 `card_search`、`classroom_update` 或普通消息后重复刷新。

### 3.3 客户端消费

`App` 的 WebSocket handler 遇到 `ability-update` 时直接调用：

```ts
setAbilities(event.projection);
```

能力数据继续保留在现有独立 state 中，不为这一项搬入通用聊天 reducer。收到事件时即使当前正在 Tutor 页面，也先更新内存；学生返回 Coach 后直接看到最新能力图。

打开 Plan 时仍调用一次 `GET /api/abilities` 取得初始值。实时事件只负责当前浏览器连接内的后续变化，不替代初始读取，也不新增缓存恢复协议。

## 四、URL 模型

页面只使用三种路径：

```text
/                                         学习集首页
/plan/:planId                             当前 Plan 的 Coach
/plan/:planId/lesson/:lessonId            当前 Plan 的 Lesson
```

其中 Plan ID 和 Lesson ID 使用 `encodeURIComponent` 写入、`decodeURIComponent` 读取。Lesson URL 不区分 prepared、active、paused、closed 或 abandoned；这些状态仍以 Lesson Markdown 为准。

增加一个没有 React 依赖的窄模块，例如 `client/routes.ts`：

```ts
type BrowserRoute =
  | { kind: 'home' }
  | { kind: 'coach'; planId: string }
  | { kind: 'lesson'; planId: string; lessonId: string };

parseBrowserRoute(pathname: string): BrowserRoute | null;
formatBrowserRoute(route: BrowserRoute): string;
```

解析器只识别上述三种完整路径。多余片段、空 ID 或解码失败均返回 `null`。

## 五、页面恢复与导航

### 5.1 首次加载和刷新

App 启动时先读取学习集概述，再解析当前 `location.pathname`：

- `/`：显示学习集首页。
- Coach 路径：读取对应 workspace，选择 Coach，并读取 Coach Session history。
- Lesson 路径：读取对应 workspace，确认 Lesson 确实属于该 Plan，再选择 Lesson。

Lesson 后续展示完全复用当前状态规则：

- `prepared`：显示开始课程 gate，不提前打开 Tutor Session。
- `active` / `paused`：读取或恢复该 Tutor Session history。
- `closed` / `abandoned`：显示只读回放。

恢复过程不把 URL 当成 Lesson 状态来源。URL 只告诉 App “要打开谁”，workspace snapshot 决定“现在应显示什么”。

现有 `GET /api/sessions/:key/history` 在需要 live Coach 或 active/paused Tutor history 时，先通过 WorkspaceRegistry 打开或复用对应 Session，再返回 history。它继续使用 Markdown 中的 session ID 和现有 Pi session file 恢复机制，不增加新 endpoint。prepared Lesson 不调用该接口，closed/abandoned Lesson继续走 replay。

### 5.2 用户导航

以下用户动作在目标数据成功加载后调用 `history.pushState`：

- 从首页进入 Plan；
- 从 Coach 进入某个 Lesson；
- 在 Lesson 之间切换；
- 从 Lesson 返回 Coach；
- 从 Plan 返回学习集首页。

URL 写入和界面切换共用同一组导航函数，不能由点击处理器与恢复处理器各自复制一套 fetch 逻辑。

### 5.3 自动导航

Lesson 关闭后的 workspace snapshot 会自动把当前选择交还给所属 Coach。这个变化使用 `history.replaceState` 写回 `/plan/:planId`，因为它是当前课堂状态的收束，不应让浏览器“后退”重新进入已经关闭的活动课堂。

开始、暂停或继续同一个 Lesson 时不改变路径。

### 5.4 浏览器前进与后退

注册一个 `popstate` listener，解析新的 `location.pathname` 并调用同一恢复函数。浏览器导航与点击侧边栏遵守同样的 Session 切换规则；listener 本身不再次调用 `pushState`，避免历史循环。

## 六、无效路径

以下情况视为无效深链：

- URL 形状无法解析；
- Plan ID 不存在；
- Lesson ID 不存在；
- Lesson 存在但不属于 URL 中的 Plan。

处理方式统一为：

1. 清空当前 workspace 与选中 Session；
2. `history.replaceState` 到 `/`；
3. 显示简短错误提示；
4. 保留已经成功读取的学习集首页。

不猜测最接近的 Plan/Lesson，不自动打开第一项，也不把错误路径写入本地存储。

## 七、测试

### 7.1 能力刷新

1. 成功的 `trace_append` 在 `work-status: done` 后发布一次完整 `ability-update`。
2. 失败的 `trace_append` 不发布能力事件。
3. superseding Trace 发布新投影，旧 active 证据不再出现在结果中。
4. 客户端收到事件后直接替换 AbilityProjection，保留 score、evidenceCount 与 sources。
5. 非 Trace 工具结束不触发能力刷新。

### 7.2 路由单元测试

1. home、Coach、Lesson 三种 route 均能 format/parse round-trip。
2. 带空格或中文的合法 ID 能正确编码和解码。
3. 多余片段、空 ID 与非法 URI 编码返回无效。

### 7.3 浏览器验收

1. 从首页进入 Plan 后 URL 变为 Coach 路径。
2. 点击 prepared、active/paused、closed Lesson 后 URL 变为对应 Lesson 路径，界面分别显示 gate、Tutor 或 replay。
3. 在上述每种路径刷新页面，仍恢复相同 Plan、Lesson 与页面类型。
4. 浏览器前进/后退与点击侧边栏的结果一致。
5. Lesson 自动关闭后选择 Coach，URL 使用 replace 变为 Coach 路径。
6. 无效 Plan、无效 Lesson 和跨 Plan Lesson 深链均返回首页并显示错误。
7. Tutor 成功写入 Trace 后无需刷新页面；返回 Coach 时能力图已经更新。

## 八、保持简单的边界

本设计只接通两条已经基本存在的链：

```text
Trace 成功写入 → 已有能力投影 → WebSocket → AbilityMap
URL 中的对象身份 → 已有 workspace/session reader → 当前页面
```

它不增加新的事实文件、Agent、Skill、MCP 工具、路由框架、缓存或后台任务。能力的事实来源仍是 active Trace，页面状态的事实来源仍是 Markdown 与 WorkspaceRegistry；WebSocket 和 URL 只负责把这些现有事实及时送到正确界面。
