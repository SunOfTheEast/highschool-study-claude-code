# Highschool Study Markdown

这是一个面向 Claude Code 的高中个性化学习插件。学习计划、课堂过程、证据和已确认偏好都保存在可读、可审查、可用 Git 追踪的 Markdown learning set 中；题卡和知识图谱继续使用真实 YAML 资产。它不使用数据库，也不会把 Agent、Skill、Task 或工作流输出当作学习记忆。

## 四层职责

1. **Markdown learning set**：`ROADMAP.md`、`plans/`、`lessons/` 和 `memory/` 是学习状态的事实来源；Lesson 内的 Trace 只追加，更正通过 `Supersedes` 关闭旧事件。
2. **原生 Agent / Skills / Tasks**：`study-coach` 是唯一面向学生的入口；Skills 负责规划、备课、教学、反思、进度和更正；Task List 只是当前 Lesson block 的界面投影，不代表能力达标或完成。
3. **四工具 MCP**：只负责严格、可验证的数据边界——搜索真实题卡、搜索 active Trace、追加 Trace、解析来源。它不预编译整套学习上下文。
4. **可选 Dynamic Workflow**：仅在直接证据不足、且至少有两项互相独立的搜索可并行时使用。分支原始 JSON 留在当前会话；只有被采用且带来源的结论可以写回 Lesson。

## 安装与初始化

在插件目录安装依赖：

```bash
cd highschool-study-markdown
bun install
```

为项目创建一个 learning set，并复制需要的学科资产：

```bash
cp -R learning-set-template /path/to/project/learning-set
cp -R subject-packs/highschool-math/cards/. /path/to/project/learning-set/cards/
cp -R subject-packs/highschool-math/graph/. /path/to/project/learning-set/graph/
export STUDY_LEARNING_SET=/path/to/project/learning-set
```

`STUDY_LEARNING_SET` 必须指向 learning set 根目录。作为 Claude Code 插件运行时，`.mcp.json` 默认使用 `${CLAUDE_PROJECT_DIR}/learning-set`；直接启动 MCP server 或测试其他目录时，显式设置该环境变量。

## 精确的四个 MCP 工具

- `card_search`：按真实题卡路径、内容和 metadata 做确定性词法搜索；每个 CardHit 都携带该卡完整的 active `traceHistory`。
- `trace_search`：过滤 active Trace，并在 `cardsByPath` 中反向解析、去重实际引用的题卡；cardless Trace 仍可按文本命中。
- `trace_append`：验证 Lesson、精确 block、Lesson-local alias、题卡、可选 card step 和同 Lesson supersession 后，只追加一个 Trace event。
- `source_resolve`：解析 learning-set 内的 Markdown heading 或 YAML card step，并拒绝越界、缺失文件和缺失 fragment。

不存在 `study_context_get`。召回由原生文件读取与这四个窄工具共同完成。

## Learning Set Overview 与展示人设

没有课堂 Trace 时，`study` 会展示 `ROADMAP.md` 的 Learning Set Overview；已有 Trace 时，只有学生要求才展开这份概述。

学习集可以在 `.claude/personas/<id>.md` 添加专属人设，或用同名文件覆盖内置人设。临时人设选择不写文件；持久选择写入 Git 忽略的 `CLAUDE.local.md`。人设只改变面向学生的表达，绝不改变能力判断、题卡、Trace、测试或备课。

### 自适应课堂与防剧透

备课会根据当前目标和 Trace 选择一个主模板：诊断课、概念新授课、专项训练课、错因修复课、能力验收课或复习整合课。模板只是 ActivityBlock 的默认组合，学生仍可增删、跳过和重排。

Planner 先确定热身、核心、变式、迁移、补救或挑战等题目角色，再分别搜索真实题卡；不会找到第一题就停止。真实卡片不足时会缩减题组或调整课堂目标，不会临时编卡。

题目 Block 分为 `Student View` 与 `Teacher Control`。Coach 只展示当前 Student View，并按三种模式揭示：`zero` 在诊断和验收首次尝试前不给提示；`ladder` 在学生尝试并同意后每轮只给一级提示；`worked-example` 可以完整讲示例，但学生目标题必须是另一张真实卡。Teacher Control、题卡答案和解法步骤不会被整段转述给学生。

视频优先使用本地 `materials/`。外部视频只有在备课侧核验真实标题、链接、相关片段、教学目的和文字替代后才会加入；解决目标题的视频不会放在首次尝试之前。

## 七类召回及顺序

`recall-study-memory` 按以下顺序工作：

1. 用 `Glob` / `Grep` / `Read` 定位 Roadmap、目标 Plan 和当前或下一 Lesson；
2. 按索引读取同一 Plan 中较早的 closed Lesson Summaries；
3. 只读取与当前依赖、方法或决策相关的 earlier Plan Summaries；
4. 备课和教学都完整读取 `student-profile.md` 与 `teaching-profile.md`；
5. 仅备课读取可重建的 `planner-attention.md`；
6. 题卡候选使用 `card_search`，跨题卡或其他证据问题使用 `trace_search`；
7. 只有需要核验结论时，才沿已有链接调用 `source_resolve` 回到原文。

信息足够时直接返回路径、摘要和来源，不启动额外分支。

## 题卡、Trace 与长期记忆

题卡与 Trace 是双向关系：`card_search` 先读取 active Trace 一次，构建一次请求内 `Map<cardPath, TraceRecord[]>`，再把完整历史挂到候选卡；card limit 只限制卡片数量，不截断单卡历史。`trace_search` 先筛选 active Trace，再读取每个唯一题卡一次并生成去重的 `cardsByPath`。这个索引只存在于当前请求，不写入持久缓存、索引或数据库。

长期偏好只在 Plan 层收敛：必须先有满足 observable capability standard 的直接证据，学生再明确选择完成 Plan。系统随后提出带原始来源的 `add / revise / delete` 差量；只有学生逐项确认后，才分别写入唯一 owner 的 `student-profile.md` 或 `teaching-profile.md`。Lesson closure、Task completion、方法分数或模型推断都不能绕过这道确认门。

如果 `card_search` 返回空数组，立即停止题卡搜索并说明缺少的内容或资产；不得编造题卡、题目、来源或 session ID。

## 验证与启动

```bash
cd highschool-study-markdown
bun install
bun run release:check
STUDY_LEARNING_SET="$PWD/tests/fixtures/learning-set" bun run start:mcp
```

`release:check` 运行类型检查、测试和严格插件验证。最后一条命令以前台 stdio 方式启动 MCP server，适合检查启动错误；正常情况下它会等待 MCP client 输入。

## 手动 smoke prompts

在包含 learning set 的 Claude Code 项目中，从 `/highschool-study:study` 开始：

- `规划“圆锥曲线最值”学习目标，并先让我确认 Roadmap 和 Plan。`
- `为当前 Plan 准备下一课；只使用真实题卡，card_search 为空就停止。`
- `开始当前 Lesson，逐个 block 教学，并把有证据的活动追加为 Trace。`
- `查看当前进度，分开说明能力证据、Lesson/Plan 状态、方法信号和已确认偏好，并给出来源。`
- `更正 event-001：保留原事件，用 Supersedes 追加更正并重建受影响摘要。`
- `如果 Plan 已达标，展示 profile 差量；未经我明确确认不要编辑两份 profile。`
