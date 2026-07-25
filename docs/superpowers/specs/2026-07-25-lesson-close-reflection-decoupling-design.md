# Lesson 关闭与 Reflection 解耦设计

## 背景

当前 Pi Tutor 把两条本应独立的状态轴耦合在一起：

- Lesson 生命周期：`active`、`paused`、`closed`、`abandoned`；
- 课堂 Block 流程：`pending`、`active`、`completed`、`skipped`。

`lesson_close` 当前只接受“恰好一个 `Kind: reflection` 且
`Status: active` 的 Block”，随后把该 Block 改为 `completed`，再写入顶层
`## Reflection`、`## Lesson Summary` 和 Lesson 的 `status: closed`。

真实课堂已经证明该契约依赖学生在哪一轮表达结束：

- 学生在 Reflection 回答中同时要求结束时，Reflection 仍为 `active`，
  `lesson_close` 一次成功；
- 学生先完成 Reflection、下一轮再确认结束时，Reflection 已为
  `completed`，`lesson_close` 失败；
- 学生在 problem Block 中提前结束时，active Block 不是 Reflection，
  `lesson_close` 失败。

这不是参数错误、旧 Skill、前端竞态或 Provider 中断。新版 Tutor Skill 已在
新 Session 中正确加载；错误来自运行时对 active Reflection 的固定前置条件。

## 设计原则

### 两条状态轴互不代替

Reflection Block 是课程安排的一部分，与 problem、material、dialogue 一样由
模板、依赖、`required` 和课堂路线决定。

`lesson_close` 是学生随时可以触发的 Lesson 生命周期动作。它不表示课程模板已
正常走完，也不表示能力标准已经达成。

因此：

- Block 是否必做，不限制学生结束 Lesson；
- Lesson 已关闭，不把未完成 Block 伪装成已完成；
- Coach 根据真实 Block 状态、Trace 和 Lesson Summary 判断课程完成度；
- Plan 是否完成仍由后续 Plan 审计决定。

### 本次不重设计模板

当前 Blueprint 和 prepared admission 全局要求恰好一个 Reflection Block。
该规则未来应由课堂模板语义单独审视，但它不是本次关课失败的必要修改。

本次保持以下内容不变：

- 六种 canonical template；
- `ActivityKind: reflection`；
- “恰好一个 Reflection Block”的现有 Blueprint 与 admission 校验；
- Block 的 `required`、依赖、顺序和路线语义；
- 顶层 `## Reflection` 与 `## Lesson Summary` 两个持久化 section。

这样可以只验证关闭契约，不把模板重构混入同一次修改。

## 新的 `lesson_close` 契约

### 调用条件

Tutor 只有在学生明确选择结束 Lesson 后调用 `lesson_close`。

调用前只需：

1. 结清已经接受的纠正；
2. 写完必须先于总结持久化的 Trace 或另解事实；
3. 从现有 active evidence、直接来源和真实课堂过程生成关闭复盘与 Coach
   handoff。

不需要：

- 把当前 Block 完成或跳过；
- 路由到 Reflection；
- 激活 Reflection；
- 把 completed Reflection 重新激活；
- 为满足关课前置条件而改变任何 Block。

### 输入

本次保留现有两个文本字段：

- `reflection`：Tutor 对本 Lesson 已发生事实的结课复盘。它不是
  Reflection Block 已执行的证明；提前结束时必须明确记录未进行的环节和证据
  空缺。
- `summary`：给 Coach 的紧凑 Lesson handoff。

保留字段可以把本次变更限制在生命周期语义。顶层 `## Reflection` 的命名及其
是否应与 Lesson Summary 合并，是独立的持久化 schema 议题。

### 原子写入

`lesson_close` 在一次写入中只执行：

1. 更新顶层 `## Reflection`；
2. 更新顶层 `## Lesson Summary`；
3. 将 Lesson frontmatter `status` 设为 `closed`。

它不读取 Reflection Block 状态，也不修改任何 Block 状态。

成功回执保持：

```json
{
  "ok": true,
  "ownerPath": "lessons/lesson-xxx.md",
  "status": "closed"
}
```

Tutor 只有收到当前 ownerPath 的成功回执后才能宣布正式结课。

## 关闭后的状态解释

关闭时保留所有 Block 的真实状态：

- `completed`：关闭前已经完成；
- `active`：学生结束时所在的课堂节点；
- `pending`：尚未进行；
- `skipped`：课堂中已经明确跳过。

`closed` 是 Lesson 级终态，因此 closed Lesson 中的 `active` 不表示仍有运行中
Session。学生若只是暂时离开，应使用 `pause`，而不是 `close`。

前端在 closed Lesson 的回放中，把 `active` 的展示标签投影为“结束时所在节点”，
避免显示为“进行中”。该变化只属于展示投影，不写回 Markdown。

## Skill 语义

Tutor Skill 的 closure 段落改为一条高层语义：

- 学生明确选择结束后，停止新的教学和 Reflection 问题；
- 结清已接受纠正和必要事实；
- 根据真实证据生成结课复盘与 Lesson Summary；
- 调用一次 `lesson_close`；
- 不为了关闭 Lesson 而改变 Block 路线或状态；
- 只有成功回执后才宣布关闭。

Skill 不描述运行时错误恢复，不要求模型维护 active Reflection 技术令牌。

## 代码范围

修改：

- `apps/pi-teaching-web/src/study/write-workspace.ts`
  - 删除 `activeReflectionBlockId`；
  - `closeLesson` 不再调用 `replaceBlockStatus`。
- `apps/pi-teaching-web/src/runtime/lesson-close.ts`
  - 工具描述删除 active Reflection 前置条件；
  - 参数与成功回执保持不变。
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
  - 关闭协议改为与 Block 无关。
- `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
  - closed Lesson 的 active Block 显示“结束时所在节点”。
- 若仍被使用，`ActivityDrawer.tsx` 应采用相同投影规则。
- 对应 executable tests。

不修改：

- classroom template catalog；
- Blueprint 与 prepared Lesson 的 Reflection 数量校验；
- `classroom_update` schema；
- Trace、能力投影、Plan 审计；
- 公共 Claude Code MCP；
- Lesson Markdown 的顶层 section 结构。

## 测试

不测试 Skill 固定措辞，只测试可执行契约。

### 持久化测试

1. Reflection active 时关闭：
   - Lesson 变为 closed；
   - Reflection Block 仍为 active；
   - 顶层 Reflection 与 Lesson Summary 正确写入。
2. Reflection completed 时关闭：
   - 一次成功；
   - Reflection Block 仍为 completed。
3. problem active 时提前关闭：
   - 一次成功；
   - problem 仍为 active；
   - Reflection 和后续 Block 保持原状态。
4. 缺少顶层 Reflection 或 Lesson Summary 时：
   - 整次写入失败；
   - 文件字节不变。

### 工具测试

1. `lesson_close` 可从任意当前 Block 返回标准 owner receipt。
2. schema 仍只有 `reflection` 与 `summary`，不暴露路径、Block ID 或关闭状态
   选择权。
3. `classroom_update` 不参与关闭。

### 前端测试

1. active Lesson 的 active Block 仍显示“进行中”；
2. closed Lesson 的 active Block 显示“结束时所在节点”；
3. closed Lesson 仍可完整回放，刷新后保持原 Lesson 路由。

### 真实模型验收

在复制的 learning set 上至少覆盖三种对话：

1. Reflection 回答与结束请求在同一轮；
2. Reflection 回答后，下一轮单独确认结束；
3. problem Block 中提前结束。

三种路径都必须只调用一次 `lesson_close`，没有为了关课而发生的
`classroom_update`，且最终文件保留真实 Block 状态。

## 成功标准

- 学生在哪一轮、哪一个 Block 选择结束，不再影响 `lesson_close` 是否成功；
- Lesson 关闭不再暗示 Reflection Block 完成；
- 模板与 Block 仍表达正常课程安排；
- Lesson Summary、Trace 和原始 Tutor Session 继续为 Coach 提供可上溯证据；
- 不增加新字段、新工具、新 Agent、规则引擎或兼容层。
