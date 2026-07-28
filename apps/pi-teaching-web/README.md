# StudyForge Pi 教学前端

这是 `highschool-study` Markdown 学习集的本地 Pi 前端。学生界面使用三层术语：Roadmap 是“学习总览”，Plan Coach 是“学习顾问”，Lesson Tutor 是“课堂导师”。底层仍保留 Coach/Tutor 技术角色：每个学习集可以有一个 Roadmap Coach Session，每个进入过的 Plan 对应一个长期 Coach Session，每节已开始 Lesson 对应一个独立 Tutor Session。各 Session 的历史不会互相复制，只通过 Roadmap、Plan、Lesson、active Trace 和带来源摘要交接。

## Message projection

学生 Session 默认使用 `safe`：纯文本消息完成后才显示；包含工具调用的混合消息改为结构化工作状态。Pi 原始 Session JSONL 不会被修改。

`raw-stream` 只用于本地诊断，因为它可能显示混合工具文本：

`bun run start -- --message-projection raw-stream`

等价环境变量为 `STUDYFORGE_MESSAGE_PROJECTION=raw-stream`。

## 视觉主题

默认主题为“留白新中式”：暖白纸色、墨黑正文和低饱和青绿强调色组成同一套学习总览、学习顾问、课堂导师与 Replay 视觉语言。界面优先保留阅读空间和信息层级，不使用大面积渐变、浮空卡片或角色全局染色；陪伴风格只影响头像及局部点缀，不改变教学状态的语义颜色。

主题 token 集中在 `src/client/theme-liubai.css`，页面结构和状态样式保留在 `src/client/styles.css`。根视图通过 `data-theme="liubai-xinzhongshi"` 与 `data-view="roadmap | coach | tutor | replay"` 标记当前界面，后续视觉调整应继续复用这些语义入口。

## 当前界面与路由

- `/` 是续学优先首页。页面只保留一个“从上次的位置继续”主入口：先按 Roadmap 顺序选择第一个含可续 Lesson 的未完成 Plan（若没有，则选择第一个未完成 Plan），再在该 Plan 内按 `active Lesson → paused Lesson → prepared Lesson → 学习顾问` 选择目标；没有未完成 Plan 时才进入学习总览。学习集概述、研习要领、其他 Plan、最近回放和学习总览都保持为次级入口。
- `/roadmap` 是“学习总览”，对应 Roadmap-scoped Coach Session，用于首次目标商议、跨 Plan 回看和开启新学习周期，不承担具体 Plan 的日常备课。
- `/plan/<planId>` 是该 Plan 的“学习顾问”。左侧会话树把它作为父会话，并列出 Lesson 课堂导师子会话。
- `/plan/<planId>/lesson/<lessonId>` 根据 Lesson 状态显示待开始课堂、active/paused 课堂导师或 closed/abandoned 只读 Replay。刷新、后退、前进和深链都会从 Markdown 状态与 owner 匹配的 Pi Session 恢复。

课堂进行时，唯一 active ActivityBlock 的 Student View 和已揭示题卡固定在聊天上方；未开始内容不会随聊天提前出现。右侧 `ContextStack` 是一列文档式情境：课堂导师下显示课堂脉络、方法进展、近期学习记录和深入查找，学习顾问与 Replay 使用同一结构显示各自需要的上下文。研习资料、陪伴风格和证据来源以 overlay 打开；长期记忆确认卡留在原聊天时间线。它们都不会创建第二套路由，也不会替换当前 Session。

## 环境

- Bun 1.3 或更新版本
- Pi（本仓库当前使用 `@earendil-works/pi-coding-agent`）
- 已配置的 Pi 模型；只浏览学习集和运行无模型测试时不需要模型凭据

安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

## 安装与验证

从仓库根目录执行：

```bash
cd apps/pi-teaching-web
bun install
bun run check
bunx playwright install chromium
bunx playwright test
```

如果网络使用额外 CA，可把本机 CA 文件传给 Chromium 安装命令：

```bash
NODE_EXTRA_CA_CERTS=/path/to/ca.pem bunx playwright install chromium
```

## 直接启动网页

```bash
cd apps/pi-teaching-web
STUDY_LEARNING_SET="$PWD/../../examples/derivative-demo/learning-set" bun run start
```

打开 <http://127.0.0.1:65000>。服务只监听本机，Bun 同时提供 API、WebSocket 事件流和构建后的前端。

开发模式使用两个进程：

```bash
STUDY_LEARNING_SET="$PWD/../../examples/derivative-demo/learning-set" bun run dev:server
bun run dev:client
```

前端地址为 <http://127.0.0.1:65001>。需要查看完整 Lesson 源文档时，可给服务端命令增加 `--authoring`；普通学生模式永远不返回 Teacher Control、答案、rubric 或解法字段。

## 作为 Pi Package 安装

本地路径安装不会复制项目，因此先保留仓库并安装依赖、构建前端：

```bash
cd /path/to/highschool-study-claude-code/apps/pi-teaching-web
bun install
bun run build
pi install "$PWD"
pi list
```

进入包含 `learning-set/` 的目录：

```bash
cd /path/to/study-project
pi
```

然后在 Pi 中运行：

```text
/study-web
```

也可以指定学习集路径：

```text
/study-web ./examples/derivative-demo/learning-set
```

该命令启动本地服务、打开浏览器，并在 Pi Session 结束时关闭服务进程。

## 学生使用流程

1. 从首页唯一的续学主入口回到原位置；查看学习集概述、研习要领或学习总览不会覆盖这个位置。
2. 在 Plan 的“学习顾问”中讨论方向、复盘旧课或请求备课；没有 Plan 或需要跨 Plan 规划时，进入“学习总览”。
3. 从会话树打开已准备的 Lesson；开始前只显示无剧透课堂本，通过机械准入后才创建或恢复独立的课堂导师 Session。
4. 上课时，当前 active ActivityBlock 固定在聊天上方，课堂导师只推进已经揭示的 Student View。右侧课堂情境保留整节课的文档脉络，学生也可以上传 PNG、JPEG 或 WebP 草稿。
5. “研习资料”搜索真实题卡、方法、材料和学习记录。active/paused 课堂导师只能访问当前已揭示资产与本课允许的 active Trace；学习顾问和 closed/abandoned Replay 可以访问完整的学生安全资产集；未启动 Tutor 和学习总览不开放这项搜索。
6. 在 Plan 会话树中从 active 课堂导师切到学习顾问或其他 Session 时，前端先把 Lesson 暂停；重新打开后沿原 ActivityBlock 和原 Session 继续。
7. 学生确认结束后，课堂导师写入结课时 Lesson Summary 并关闭 Lesson。页面停留在只读 Replay，保留最终消息、真实停止节点和关课快照；只有学生点击“返回学习顾问”才进入复盘。closed Replay 可以通过 URL 恢复，但不会覆盖首页保存的 active、paused 或 prepared 续学位置。

“方法进展”只是 Trace 主/次方法的加权投影。点击任一节点都能回到原始 Trace 和安全题卡元数据；它不是独立的掌握度事实。

## Session、证据与重新备课

- Roadmap Coach Session 的 owner 是 `@roadmap` / `ROADMAP.md`；它在学生界面显示为“学习总览”，只负责全局方向、跨 Plan 回看和注册学生确认的新 Plan。
- Plan Coach Session 的 owner 是当前 Plan；它在学生界面显示为“学习顾问”。正常备课通过 `lesson_prepare` 提交一次性结构化课堂骨架，由运行时绑定路径、状态和 Lesson Index 并编译成 Markdown；最终 `active / complete / replan` 决定通过 `plan_update` 一次写回，再重读 Plan 后回复。
- Tutor Session 的 owner 是当前 Lesson；它在学生界面显示为“课堂导师”。模型不填写 `lessonPath`、`cardStepId` 或 Session ID。
- 每个 Pi Session 只有一条 `studyforge.session-owner.v1`，由 `role + ownerId + ownerPath` 决定身份；只有三项完全匹配才复用 frontmatter 中的 Session ID，Coach/Tutor 展示名不参与身份判断。
- Tutor 在评价前只冻结学生已经亲自给出的数学内容。缺决定性证明时写 `incomplete`，不能把 Tutor 的补全冒充成学生证据。
- `support` 记录最终答案实际采用的帮助。提示出现但未提供/未被采用决定性内容时仍可为 `none`；采用 Tutor 首次给出的关键内容时为 `tutor`。
- 题卡方法只是候选。学生确认节点贴切后才写实际方法；拒绝、无精确节点或暂不决定时保留未映射路线。
- 只有某一整题或一问的完整核心路线真正不同才落盘另解；写入顺序是 active correct Trace → `card_alternative_append` → 学生回复。
- 学生异议成立或后续补全同一 attempt 时，新的 Trace 必须 supersede 准确的 active event。

`lesson_close` 只接收一份学生可见的 Lesson Summary，写入该快照和 `status: closed`，不会完成、跳过或重排任何 Block。Lesson Summary 是结束时的检索入口，不取代 active Trace；更正 Trace 后可以重建能力图与 Planner Attention，但不会自动改写 Summary、Plan、另解 sidecar 或已确认画像。Plan 状态和复盘结论只由 Coach 正常审阅后调用 `plan_update` 改变。

`LessonBlueprint` 只存在于普通工具调用记录中，不是第二份学习状态；`lesson-xxx.md` 仍是 Tutor、Trace 和前端共同读取的唯一课堂事实。仍为 `prepared` 的 Lesson 可以由 Coach 保持 ID 原地重新编译。Tutor 已启动后再要求重新备课，旧 Lesson 保留并标为 `abandoned`，Coach 使用新 ID 创建替代 Lesson。

Trace 写入成功后，服务端主动发布完整能力 snapshot；刷新、前进/后退和 Plan/Lesson 深链会从 Markdown 与已绑定 Pi Session 恢复 Coach、Tutor 或 closed Replay。Replay 优先使用真实 Pi 历史；历史不可用时明确显示 evidence-only。

## Coach 问诊与教学判断

首次 Roadmap 规划、Plan 完成后的下一周期规划，以及每节 Lesson 备课前，Coach
都会先和学生做一段简短商议：每轮只问一个问题，通常连续问几个真正会改变安排
的问题。下一问从学生刚说的模糊处继续，先问清是哪类题、什么情境、卡在哪一步、
最近的具体例子或当时先试了什么，再讨论原因；它不是固定问卷，也不会把 Coach
尚未验证的判断塞进问题里。

历史记录可以减少重复追问，但不能替代学生此刻的理解、意图和限制。Coach 会先
复述自己的理解和暂定判断，让学生纠正；备课时还会给出无剧透的课堂意图，学生
确认或调整后才检索题卡并写出 Lesson。一个有效判断必须有学生原话或学习来源，
实际改变 Plan 或 Lesson，并说明什么后续表现会支持或推翻它。学生可以随时要求
结束问诊，由 Coach 带着明确的不确定性继续。

具体执行分别由 `roadmap-study`、`plan-next-cycle` 和 `coach-study` 三份 Skill
负责，不增加问卷 schema、诊断分数或新的 Agent。

## 长期记忆与界面偏好

completed Plan 的学习顾问可以把带来源的 `add / revise / delete` 长期记忆候选放进原聊天时间线。候选默认都不选择；学生逐项采用、改写后采用或不采用，也可以稍后处理。提交只表示决定已保存并交回同一个 Plan Coach，不表示画像已经更新；学习顾问应用选择、重读 `student-profile.md` 与 `teaching-profile.md` 后，才能报告最终结果。Roadmap Coach、课堂导师和未完成 Plan 不能提出这张确认卡。

“陪伴风格”按 Coach/Tutor Session 单独保存到 Pi Session custom entry，不复制到其他 Session，也不改变题卡、评价、Trace 或学习标准。柔和动效与完成反馈只保存在当前浏览器的 `studyforge.presentation.v1`，不会进入 learning set、Session 或模型上下文；系统要求减少动态效果时优先关闭动效。

## 深度模式与动态工作流

深度模式按 Coach/Tutor Session 单独开启，默认关闭。信息足够时，父 Agent 仍直接回答；跨题卡、跨 Lesson 或 Plan 级检索会把大体量证据留在一个临时 Evidence Scout 中，多个任务只用于真正独立、且结论可能改变下一步教学动作的问题。

- `quick` 最多三个无依赖任务，最长 180 秒，可以直接运行；Token 总预算由父 Agent 显式声明，单个 Plan 级 Evidence Scout 约定使用 50,000，因为子任务输入和题卡/Trace 工具结果都计入预算；
- `deep` 可以包含依赖波，但必须先在任务轨显示目标、并发、Token 与时间上限，由学生确认后才运行；
- proposed/running 工作流可以取消；已经完成的分支结果会保留，未完成任务不会自动重试；
- 任务状态保存在父 Pi Session JSONL 的 custom entries，Lesson、Trace、Plan 和画像等正式学习状态仍保存在 Markdown；
- 父 Agent 只向 Evidence Scout 传证据问题和范围，不先批量读取同一范围；子进程的 `card_search` / `trace_search` 只返回题卡路径、标题、目标、方法元数据和 active Trace，不返回题干正文或解析；
- Quick 的紧凑结果直接回到当前父 Agent 工具调用；确认后的 Deep 通过隐藏的 `studyforge.workflow-result.v1` 消息恢复父 Agent 综合；
- 子任务原始 JSON 与运行 artifact 只供父 Agent/runtime 检查；Student View 运行中只显示安全化活动名、耗时、Token 和工具次数，完成后才显示召回题卡数与来源数；
- 本地 MVP 不宣称账号隔离或操作系统级沙箱。临时 `study-scout` 不具备写入工具，但学习集仍应视为本机可信文件。

服务重启时，先前停在 running 的工作流会恢复为终态：有已完成结果则为 partial，否则为 failed；未完成任务标记为 cancelled。需要继续时由父 Agent 重新提出工作流，不会自动续跑。

## 长期学情研判

当累计记录可能改变学习方向，或学生询问“下一阶段学什么”时，Coach
按需加载 `plan-next-cycle`。普通课后复盘和已选 Plan 内的备课不经过这条
重流程。

- 前序 Plan Summary 是长期轨迹的索引；只有某条事实可能改变决定时，才沿
  来源打开完整 Lesson 或 active Trace；
- 来源冲突时按 `active Trace → 带来源的 Lesson/Plan Summary → Planner Attention`
  判断：active Trace 决定作答结果、支持程度、实际方法和记录时间，摘要只是
  检索索引，Planner Attention 只是可重建的备课提示；手工维护或明确标为
  prototype 的 HEATMAP 不属于当前学情证据；
- Coach 同时读取已确认画像和 `LEARNING_GUIDE.md`，但不把偏好、方法信号
  或单次成绩直接当作瓶颈结论；
- 信息清楚时直接完成证据重建而不启动 Scout，但仍向学生复诊当前理解和意图；
  历史广、相互冲突或会改变方向时，才选择一到三个真正独立的 Evidence Scout
  问题；
- Coach 先向学生说明判断、关键来源、不确定性和可能推翻判断的后续表现；
  学生确认后才创建并注册下一 Plan；
- 新 Plan 的 `Planning Basis` 保存这次工作判断，Plan 结束时由
  `Plan Summary` 对照真实结果回看。当前 Plan 页面以“为什么这样安排”
  展示该依据。

每份 Plan 都使用当前八小节契约：`Goal`、`Observable Capability Standard`、
`Test`、`Planning Basis`、`Lesson Index`、`Current Position`、
`Next Lesson Candidate` 和 `Plan Summary` 必须各出现一次且内容非空。共享
读取器会在学习集打开或 Plan 注册前拒绝旧版或不完整 Plan。系统不自动迁移；
使用新运行时前应保留原内容和来源，手工补全缺失小节。

这条闭环不增加数据库、能力分数或自动选 Plan 的规则引擎。Planning Basis
仍是普通 Markdown，Coach 仍是唯一决策者。

## 真实模型 smoke checklist

建议先复制示例，避免测试写入仓库样例：

```bash
cp -R examples/derivative-demo /tmp/studyforge-derivative-smoke
cd /tmp/studyforge-derivative-smoke
pi
```

依次确认：

- 打开学习顾问（Plan Coach），读取并复盘上一节 Lesson；
- 让学习顾问按需加载备课 Skill，通过一次 `lesson_prepare` 准备一节至少含两张真实题卡且不剧透的 Lesson；
- 启动课堂导师（Tutor），确认它拥有独立 Session；
- 分别提交文字与一张图片；
- 让课堂导师追加一条绑定题卡/课堂步骤的 Trace；
- 暂停并继续同一个 Tutor Session；
- 由学生明确确认结束 Lesson；
- 在原 Tutor Replay 查看结课快照，再明确返回原学习顾问（Plan Coach）Session 做课后复盘。

深度模式另行确认：先运行一次单 Evidence Scout 的 quick 证据召回，再提出一次有依赖的 deep 工作流并由学生确认；启动第二个 deep 工作流后取消，确认任务轨保留已完成分支，而且临时子任务没有改动 learning-set 文件。

遇到问题时先运行 `bun run check`；模型调用失败通常需要在 Pi 中用 `/login` 或环境变量配置提供商凭据。

完整功能语义见 [`docs/zh-CN/完整说明书.md`](../../docs/zh-CN/完整说明书.md)。
