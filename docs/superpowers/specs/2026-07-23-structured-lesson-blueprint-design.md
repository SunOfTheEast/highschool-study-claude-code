# 结构化备课本与 Lesson Blueprint 编译设计

状态：详细设计通过，进入最小试验

日期：2026-07-23

## 一、结论

当前问题不是 StudyForge 缺少更长的备课提示词，而是 Coach 同时承担了两种
性质不同的工作：

1. 判断一节课为什么这样教、选哪些题、如何提示和如何观察；
2. 手工拼接一份必须满足精确标题、字段、引用和状态格式的可执行 Markdown。

第一项需要教学判断，第二项只需要确定性排版。把两者都交给模型，导致 Coach
即使教学设计正确，也可能因为一个 Block 标题、Node State 字段或 alias 写法
不准确而反复修复 Lesson。

本设计引入一个很薄的备课中间稿 `LessonBlueprint`：

```text
课堂模板与学习证据
  → Coach 形成 LessonBlueprint
  → lesson_prepare 确定性编译
  → lesson-xxx.md
  → 现有 Prepared Lesson 准入
  → Tutor Session
```

核心边界是：

- **结构化骨架由程序保证；**
- **教学内容仍由 Coach 用自然语言表达；**
- **最终 `lesson-xxx.md` 仍是唯一持久真相源。**

`LessonBlueprint` 不保存为第二份 YAML/JSON 文件，不引入数据库，也不把 Lesson
改造成 OpenMAIC 那样的完整课件 DSL。

## 二、问题

StudyForge 已经具备六类课堂模板、积木式 ActivityBlock、Student View /
Teacher Control 分区、题卡 alias、Prepared Lesson 准入和 Tutor 运行时。但
Coach 当前仍通过通用 `write` / `edit` 直接书写 Lesson。

真实备课已经出现过以下情况：

- Block 标题不是读取器要求的 `## Block <id>（必做/可选）`；
- `Student View` 被写成加粗文本而不是三级标题；
- Node State 使用了箭头、粗体或其他近义格式；
- Reflection 的名称正确，但 `Kind` 并非 `reflection`；
- Block 使用题卡，却漏写对应 alias；
- 教学内容已经完成，但必须额外进行多轮格式修复才能启动 Tutor。

现有 `validatePreparedLesson()` 能阻止坏 Lesson 开课，但它位于流水线末端。它
适合充当安全网，不适合让 Coach 通过报错逐步学习一门 Markdown 语法。

因此需要把：

> “模型直接写可执行 Markdown”

改成：

> “模型提交课堂结构和教学文本，程序书写可执行 Markdown”。

## 三、OpenMAIC 提供的参考边界

[OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 的课程生成不是一次完成，而是：

```text
用户需求
  → SceneOutline[]
  → 大纲检查和调整
  → 每个 Scene 的完整内容
  → 播放 Actions
  → 最终课程 DSL
```

值得借用的是前半段：

- 模型先产生小而明确的结构化 Outline；
- Outline 只表达场景意图、顺序、类型和关键内容；
- 最终复杂产物由程序展开；
- 人可以在展开前检查或调整 Outline。

不借用的是后半段：

- 幻灯片元素坐标 DSL；
- 预生成播放时间线；
- JSON 自动修复链；
- 多版本迁移；
- 完整课件编辑器；
- 为长期产品分发准备的兼容层。

OpenMAIC 的最终产物需要被播放器精确执行；StudyForge 的 Lesson 只需把结构化
课堂意图交给会动态决策的 Tutor。两者不能采用相同复杂度。

## 四、方案选择

考虑过三种实现：

1. **只补一份完整 Markdown 范例。** 改动最小，但模型仍需复制精确标题、字段
   和 alias，真实备课已经证明它会在长上下文中发生漂移。
2. **加入一次性 LessonBlueprint 和确定性编译器。** 模型只提交教学判断与
   课堂拓扑，程序生成现有 Markdown；成本小，并且不改变最终治理方式。
3. **直接实现可视化 Outline 编辑器和持久课程 DSL。** 可以获得最完整的
   OpenMAIC 式体验，但当前没有足够需求支撑其状态同步、迁移和编辑复杂度。

采用方案 2。方案 1 可以继续作为 Skill 的阅读示例，但不承担正确性；方案 3
留到 Blueprint 经过真实课程验证以后。

## 五、目标与非目标

### 目标

- Coach 不再负责精确拼写 Lesson 的机器语法。
- 保留现有六类课堂模板，并允许增删、并行、依赖、跳过和重排积木。
- 保留 Student View 与 Teacher Control 中的自由 Markdown 教学文本。
- 所有 `Uses` 均绑定真实题卡 alias，并由运行时从真实 `cardPath` 生成相对路径。
- 新 Lesson 写入后自动出现在当前 Plan 的 Lesson Index 中。
- `prepared` Lesson 可以原地重新备课；已经开始的 Lesson 必须用新 ID 替代。
- 继续使用现有读取器、准入校验、Tutor、Trace、路由和前端投影。
- 保持公共 Claude Code 插件恰好四个 MCP 工具。

### 非目标

- 不建立数据库、向量索引或 Blueprint 仓库。
- 不持久化 `.blueprint.yaml`、`.lesson.json` 等第二真相源。
- 不自动判断题量、难度、教学相关性或提示质量。
- 不把六类课堂模板变成六条固定工作流。
- 不自动生成教学内容、题目或虚构缺失卡片。
- 不重写 Card、Trace、Plan、能力投影或长期记忆 schema。
- 不为旧的非规范 Lesson 增加迁移或兼容分支。
- 第一阶段不实现 OpenMAIC 风格的可视化 Outline 编辑器。
- 第一阶段只改 Pi 教学运行时；不增加公共 MCP 工具。

## 六、三个层次

### 6.1 Template：教学默认值

模板继续保存在 Skill 的 `classroom-templates.md` 中：

- `diagnostic`
- `concept`
- `deliberate-practice`
- `remediation`
- `assessment`
- `review`

模板提供默认活动角色、题目角色、材料倾向和揭示方式。它是 Coach 的教学参考，
不由运行时验证，也不直接生成固定 Block。

### 6.2 LessonBlueprint：一次备课的结构化中间稿

Blueprint 是 Coach 调用 `lesson_prepare` 时提交的一次性参数。它描述已经根据
学生情况调整后的实际课堂，不是模板本身。

Blueprint 存在于普通 Pi 工具调用记录中，但不是学习状态事实，也不是 Lesson
的第二份可编辑来源。

### 6.3 Lesson Markdown：唯一持久课堂事实

编译后的 `lessons/lesson-xxx.md` 继续承载：

- Plan 归属；
- 课堂目标；
- 实际 Block 拓扑；
- Student View；
- Teacher Control；
- 题卡 alias；
- 课堂状态；
- Reflection、Summary 和 Trace。

现有 Tutor 和前端只读取 Lesson Markdown，不读取 Blueprint。

## 七、LessonBlueprint 契约

### 7.1 类型

第一阶段采用以下最小模型契约：

```ts
type LessonCardBinding = {
  alias: string;
  cardPath: string;
  role: string;
};

type LessonSource = {
  label: string;
  target: string;
  note: string;
};

type LessonBlockBlueprint = {
  id: string;
  kind: 'dialogue' | 'problem' | 'material' | 'reflection';
  required: boolean;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
};

type LessonBlueprint = {
  lessonId: string;
  title: string;
  planContext: string;
  capabilityTarget: string;
  primaryTemplate: string;
  templateReason: string;
  adjustments: string[];
  cards: LessonCardBinding[];
  sources: LessonSource[];
  blocks: LessonBlockBlueprint[];
};
```

`primaryTemplate` 应填写当前模板目录中的规范 ID，但第一阶段只是非空字符串，
不做运行时枚举。模板选择属于教学判断，不影响 Markdown 能否执行；写错模板
名称不应成为一条新的开课门。

### 7.2 为什么只保留这些字段

`lessonId`、`title`、目标、模板理由和 Block 文本是 Coach 无法由运行时推导的
教学内容。

`cards` 同时承担三件必要工作：

- `alias` 是 Lesson 内 Tutor 与 Trace 使用的短名称；
- `cardPath` 是 `card_search` 返回的真实根目录相对路径；
- `role` 说明这张卡在本课中承担热身、示例、变式、迁移或验收等什么作用。

`sources` 只描述需要出现在备课本中的真实材料或外部链接。视频的片段、目的、
追问和替代方案仍由 Coach 按现有 Skill 写进 `note` 或对应 Block，不为视频
单独扩展一套持久 schema。

`studentView` 和 `teacherControl` 保持 Markdown 片段，而不是拆成大量字段。
它们的作者、可见范围和消费者不同，因此必须继续分开；其中的教学表述不适合
由运行时结构化。

### 7.3 明确不进入模型参数的字段

以下字段由当前 Coach Session 或编译器绑定，不允许模型填写：

- `planId`
- `planPath`
- `lessonPath`
- `kind: lesson`
- `status: prepared`
- `coachSessionId`
- `tutorSessionId`
- Block 的初始 `Status: pending`
- Reflection、Lesson Summary 和 Traces 的初始占位内容
- alias 在 Lesson 中的相对文件路径
- Plan Lesson Index 的链接路径和序号

这延续现有 Session-bound 工具原则：模型表达教学对象，运行时绑定身份、路径、
状态和所有权。

### 7.4 字段分类

| 字段 | 分类 | 作者/来源 | 持久所有者 |
| --- | --- | --- | --- |
| title、目标、模板理由、adjustments | 教学判断 | Coach | Lesson Markdown |
| card role、Block kind/依赖/uses | 教学判断与课堂拓扑 | Coach | Lesson Markdown |
| Student View、Teacher Control | 教学内容 | Coach | Lesson Markdown |
| Plan ID/path、Lesson path | 运行时权限与归属 | Coach Session scope | frontmatter/文件位置 |
| status、Block 初始状态 | 常量 | 编译器 | Lesson Markdown |
| 相对链接、Lesson Index 序号 | 可重建投影 | 编译器 | Markdown 表示 |
| Blueprint JSON | 临时写入参数 | Coach | 不作为学习事实持久化 |

不存在第二个可独立编辑的 Blueprint 文件，因此不会出现“Blueprint 已修改但
Lesson 未同步”或反向漂移。

## 八、结构化与散文的边界

程序保证的骨架：

```text
Lesson
├── frontmatter
├── Plan Link
├── Capability Target
├── Lesson Configuration
├── Sources
├── Dependencies and control
├── Blocks[]
│   ├── Node State
│   ├── Student View
│   └── Teacher Control
├── Reflection
├── Lesson Summary
├── Aliases
└── Traces
```

Coach 自由书写的散文：

- 为什么采用当前模板；
- 题目如何引入；
- 学生首先看到什么；
- Tutor 应观察什么；
- 提示何时给、给到什么程度；
- 出现不同学生反应时如何教学；
- 反思问题如何设计。

运行时不检查以下教学质量：

- 一节课是否应该有三题还是五题；
- 题目是否足够典型；
- `zero`、`ladder` 或 `worked-example` 是否选择正确；
- Teacher Control 是否写得足够细；
- 某个视频是否真正有启发性；
- 学生是否已经达到能力标准。

这些继续由 Coach、学生和真实课堂反馈决定。

## 九、确定性 Markdown 编译

### 9.1 Frontmatter

编译器从 Session scope 和 Blueprint 生成：

```yaml
---
id: lesson-004
kind: lesson
plan_id: domain-integrity
status: prepared
---
```

不复制任何既有 Lesson 的 Session ID。

### 9.2 固定顶层结构

每次编译均按固定顺序输出：

```markdown
# <title>

## Plan Link

[<真实 Plan 标题>](../plans/<plan-id>.md) — <planContext>

## Capability Target

<capabilityTarget>

## Lesson Configuration

- Primary template: `<primaryTemplate>`
- Reason: <templateReason>
- Adjustment: <adjustment>

## Sources

<由 cards 和 sources 生成>

## Dependencies and control

<由 dependsOn、required 和固定学生控制规则生成>

---

<Blocks>

## Reflection

（课堂结束后填写）

## Lesson Summary

（课堂结束后填写）

## Aliases

<由 cards 生成>

## Traces

（课堂中通过 trace_append 追加）
```

空的 `adjustments` 或 `sources` 使用一个明确的“无额外调整/无额外材料”，而
不是删除整个顶层章节。这样文件结构稳定，但不增加新的必填业务事实。

### 9.3 Block 编译

每个 Block 只能编译为：

```markdown
## Block assessment-01（必做）

### Node State

- Kind: problem
- Required: true
- Status: pending
- Depends on: orientation
- Uses: Q-DOMAIN-EX22

### Student View

<studentView>

### Teacher Control

<teacherControl>
```

`required: false` 使用 `（可选）`，其余字段均由结构化值序列化，不允许 Coach
自行改变标签、标点或层级。

`studentView` 与 `teacherControl` 是三级标题下的 Markdown 片段。为避免自由
文本逃出所在章节，第一阶段只拒绝其中以一级到三级 Markdown 标题开头的行；
不引入通用 Markdown 清洗器或 JSON 修复链。

### 9.4 Alias 编译

Coach 提交的是卡片根目录相对路径：

```json
{
  "alias": "Q-DOMAIN-EX22",
  "cardPath": "cards/derivative/mst_p0032_ex22.card.yaml",
  "role": "连续性核验"
}
```

运行时先读取真实题卡，再根据目标 Lesson 文件计算相对路径：

```markdown
- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml
```

模型不填写 `../` 路径，也不允许使用一个“看起来存在”的题卡代替真实文件。

## 十、Coach 工具

### 10.1 工具名称与权限

Pi Coach 增加 Session-local 工具：

```text
lesson_prepare
```

它只出现在 Coach 工具列表中。Tutor 不可见，公共 Claude Code 插件也不新增
第五个 MCP 工具。

Coach 的 `write` / `edit` 暂不删除，因为它们仍用于 Plan 和其他 Markdown；
Skill 将正常 Lesson 创建与重新备课统一引导到 `lesson_prepare`。

### 10.2 参数

工具参数就是第七节的 `LessonBlueprint`，不额外接受：

- owner path；
- Plan ID；
- Lesson path；
- status；
- Session ID；
- Trace；
- Reflection 或 Summary 的课堂结果。

### 10.3 执行顺序

`lesson_prepare` 固定执行：

1. 从 Coach Session scope 读取真实 Plan ID 与 owner path；
2. 校验 Blueprint 的最小机械结构；
3. 对每个 `cardPath` 读取真实 problem card；
4. 在内存中生成完整 Markdown；
5. 调用从现有准入逻辑提取出的
   `validatePreparedLessonSource(root, lessonPath, source)` 校验内存结果；
6. 写入 `lessons/<lessonId>.md`；
7. 在当前 Plan 的 `## Lesson Index` 中幂等登记该 Lesson；
8. 重读 `readPlanWorkspace()`，确认 Lesson 已可见且状态为 `prepared`；
9. 返回最小成功回执。

Lesson 文件先写、Plan Index 后登记。若登记失败，文件可能存在但不会被前端
索引为当前 Plan 的 Lesson；工具不得返回成功。这里不增加跨文件事务或回滚
框架，重试同一 Blueprint 即可完成幂等登记。

### 10.4 成功回执

```json
{
  "ok": true,
  "ownerPath": "plans/domain-integrity.md",
  "factId": "lesson-004",
  "status": "prepared",
  "lessonPath": "lessons/lesson-004.md",
  "blockCount": 5
}
```

Coach 只有收到 `ok: true`，并从重读结果看到 Lesson 后，才能告诉学生“已经
备好，可以开始”。

工具回执不返回完整 Lesson 正文，避免把 Teacher Control 和全部备课内容再次
灌回聊天上下文。Coach 如需检查细节，可按现有权限读取文件。

### 10.5 安全消息投影

前端 `safe` 模式只显示：

```text
正在整理课堂结构
```

完成后显示：

```text
课堂已准备
```

不展示工具参数中的 Teacher Control、题卡角色、未揭示提示和内部备课说明。
原始 Pi JSONL 仍保留完整工具调用。

## 十一、最小机械校验

该工具不是教学规则引擎。它只拒绝会导致 Lesson 无法被现有运行时可靠执行的
结构：

1. `lessonId` 必须是合法文件 stem，且以 `lesson-` 开头；
2. Block ID 合法且全课唯一；
3. `dependsOn` 只引用本 Blueprint 中存在的其他 Block；
4. alias 唯一，所有非空 `uses` 均指向已声明 alias；
5. 每个被使用的 alias 都绑定真实 problem card；
6. 全课恰有一个 `kind: reflection` Block；
7. title、目标、Student View 和 Teacher Control 非空；
8. 嵌入的自由 Markdown 不得声明一级到三级标题；
9. 编译结果必须继续通过 `validatePreparedLessonSource()`，写入后仍会经过现有
   `validatePreparedLesson()` 启动准入。

不检查 Block 依赖是否符合教学逻辑，不强制某个模板的题量，也不因为缺少一个
“更优”的活动而拒绝备课。

校验失败统一返回 `LESSON_BLUEPRINT_INVALID` 及短问题列表。它不启动子 Agent、
不自动搜索替代题、不猜 alias、不修复教学文本，也不建立重试状态机。Coach
根据问题修改一次 Blueprint 即可。

## 十二、创建、重新备课与替代

### 12.1 新 Lesson

目标文件不存在时：

```text
编译 Lesson
  → 写为 prepared
  → 追加 Plan Lesson Index
  → 重读确认
```

Plan Index 的链接目标由运行时生成，不能由模型选择。

### 12.2 尚未开课的重新备课

目标 Lesson 的状态为 `prepared` 时，允许使用相同 `lessonId` 全量重新编译：

- 文件路径和 Lesson ID 不变；
- 内容、卡片、Block 顺序和依赖可以全部变化；
- Plan Index 不重复追加；
- 不创建 Tutor Session；
- 不复制旧的聊天上下文。

这对应现有“备课完成后发现不合适，原地重备”的需求。

### 12.3 已经开始的 Lesson

目标 Lesson 为 `active`、`paused`、`closed` 或 `abandoned` 时，工具拒绝覆盖并
要求 Coach 使用新的 `lessonId`：

```text
旧 Lesson 保留
  → 新 Lesson 编译为 prepared
  → Plan Index 追加替代 Lesson
```

这样不会用重新备课抹掉真实课堂状态、Trace、Reflection 或 Summary。

## 十三、Plan Lesson Index 写入

新增一个窄的 `registerPreparedLesson()` 写入函数，只操作当前 Plan 的
`## Lesson Index`：

- 以规范 Lesson 相对路径判重；
- 新 Lesson 追加下一条序号；
- 已存在的 prepared Lesson 更新链接标题和 `prepared` 状态，不新增第二条；
- 不改写 Current Position、Next Lesson Candidate 或 Plan Summary；
- 不替 Coach 做 Plan 完成判决。

这与 `plan_register` 的原则一致：文件生成和被父对象索引是两个动作，但由
一个面向 Coach 的发布工具顺序完成。

`plan_update` 仍只用于 Lesson 后复盘和 Plan 最终审计，不承担备课文件注册。

## 十四、读取与运行时保持不变

编译后的 Lesson 继续满足现有读取契约：

- `read-workspace.ts` 读取 Block、Student View、状态、依赖和 Uses；
- `validate-prepared-lesson.ts` 在第一次启动前做最终准入；
- `WorkspaceRegistry.startLesson()` 把 `prepared` 改为 `active`；
- Tutor 创建独立 Lesson Session；
- `classroom_update` 推进 Block 或修改路由；
- `trace_append` 通过 alias 绑定真实题卡；
- `lesson_close` 写入 Reflection、Summary 并关闭 Lesson；
- 前端继续从 Lesson Markdown 投影侧边栏和课堂节点。

不需要修改 Tutor 的工具契约、Trace schema、能力投影或路由恢复。

## 十五、完整数据流

```text
学生与 Coach 确认本课方向
  ↓
Coach 读取模板、Plan、前序摘要、active Trace、画像与 planner attention
  ↓
Coach 先确定活动角色和题目槽位
  ↓
card_search / Evidence Scout 返回真实 cardPath 与选择理由
  ↓
Coach 组装 LessonBlueprint
  ↓
lesson_prepare
  ├─ 绑定当前 Plan
  ├─ 验证真实题卡
  ├─ 编译标准 Markdown
  ├─ 写 Lesson
  ├─ 登记 Plan Lesson Index
  └─ 重读并返回 receipt
  ↓
前端出现 prepared Lesson 子节点
  ↓
学生点击开始
  ↓
现有准入校验
  ↓
Tutor Session
```

## 十六、与现有设计的关系

### 16.1 自适应课堂模板

`2026-07-21-adaptive-lesson-templates-and-reveal-policy-design.md` 决定“教什么、
选哪类模板、需要哪些题目角色”。本设计不替代它，只把其最终实例变成可可靠
编译的 Blueprint。

### 16.2 教学产物准入

`2026-07-23-teaching-artifact-integrity-design.md` 明确运行时只检查机械事实，并
曾把“完整结构化表单或 DSL”列为非目标。

本设计不推翻这个原则，而是根据后续真实备课结果做一次窄化修订：

- 不建立持久 DSL；
- 不把教学判断交给 validator；
- 只为 Lesson 的可执行骨架增加一次性工具输入；
- 现有准入校验继续作为独立安全网。

### 16.3 Markdown-first

Markdown 仍然是：

- 人可以阅读和直接修改的学习文件；
- Tutor 的唯一课堂输入；
- Trace、Reflection 和 Summary 的持久载体；
- Git 可以审计的最终事实。

Blueprint 只是 authoring IR，不改变治理方式。

## 十七、实现边界

预计只新增或调整以下窄边界：

- `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
  - Blueprint 类型、最小结构校验和 Markdown renderer；
- `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
  - 提取可校验内存源码的纯函数，现有文件读取入口继续调用它；
- `apps/pi-teaching-web/src/study/write-workspace.ts`
  - prepared Lesson 写入与 Plan Lesson Index 幂等登记；
- `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
  - TypeBox 参数和 Session-bound Coach 工具；
- `apps/pi-teaching-web/src/runtime/session-factory.ts`
  - Coach 工具注册；
- `apps/pi-teaching-web/src/projection/projector.ts`
  - `safe` 模式状态名称；
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
  - 正常备课改用 `lesson_prepare`，成功回执后再宣布完成。

第一阶段不修改：

- 公共 MCP server；
- Tutor Skill；
- Card/Trace schema；
- Lesson 启动 API；
- 前端页面结构；
- OpenMAIC 代码或依赖。

## 十八、验证范围

只测试可执行行为，不测试 Skill 的具体措辞。

### 18.1 Renderer 单元测试

- 同一 Blueprint 总是生成相同 Markdown；
- 必做/可选、依赖、Uses 和 alias 格式正确；
- 所有 Block 初始状态均为 `pending`；
- 恰有一个 Reflection Block 时生成结果通过现有准入校验；
- 题卡根目录路径被转换为 Lesson 相对路径；
- Teacher Control 不出现在 Student View 投影字段中。

### 18.2 工具集成测试

- Coach scope 自动绑定真实 Plan；
- 模型无法覆盖 plan path、lesson path 或 status；
- 新 Lesson 写入并出现在 Plan Workspace snapshot；
- 重复提交同一个 prepared Lesson 不重复索引；
- prepared Lesson 可以原地重备；
- 已开始 Lesson 不能被覆盖；
- 假卡片路径和未声明 alias 被拒绝；
- 成功回执来自写后重读结果。

### 18.3 回归测试

- 现有手写 Lesson 仍可读取和开课；
- 现有 Prepared Lesson admission 行为不变；
- Tutor、Trace、lesson_close、路由和能力刷新测试保持通过；
- 公共插件 MCP 工具数保持四个；
- `safe` 投影不泄漏 Blueprint 中的 Teacher Control。

### 18.4 一次真实备课验收

使用复制的导数学习集，让真实 Coach：

1. 选择一种现有课堂模板；
2. 搜索并绑定至少两张真实题卡；
3. 生成包含必做、可选、依赖和 Reflection 的 Lesson；
4. 不通过 `write` / `edit` 手工修复格式；
5. 一次 `lesson_prepare` 后直接出现在 Plan 侧边栏；
6. 启动 Tutor 并完成至少一个题目 Block 的 Trace。

验收关注的是格式修复轮次是否消失，不以单节课判断教学质量已经最优。

## 十九、后续扩展，但不进入本次实现

如果最小编译路径经过多节真实课程后稳定，可以继续增加：

1. 在前端以表格或时间线预览 Blueprint；
2. 拖动 Block 调整顺序和依赖；
3. 从六类模板预填一组可编辑 Block；
4. 只重新生成选中的 Block，而不是全量重备；
5. 为视频、互动组件和小测增加专属编辑器。

这些扩展都可以复用同一 Blueprint 边界，但只有在出现真实使用需求后才加入。
当前版本先解决最核心的问题：让 Coach 专注教学设计，不再手写机器语法。
