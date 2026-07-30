# Pi 教学前端：中文设计说明

状态：核心功能已实现并通过当前验收；本文保留产品与交互设计背景

更新：2026-07-28，已纳入续学优先首页、学习总览/学习顾问/课堂导师术语、固定当前课堂、文档式课堂情境、研习资料、Plan 长期记忆确认卡、Session 级陪伴风格与浏览器本地展示偏好

正式技术设计：[Pi 教学 Web 前端设计](../superpowers/specs/2026-07-21-pi-teaching-web-frontend-design.md)

当前可运行功能、安装方式和教学协议以[完整说明书](完整说明书.md)为准；本文中的界面描述用于解释设计意图，不替代实现契约与验收报告。

## 这是什么

这是 Highschool Study 面向学生的本地 Web 前端。它使用 Pi 作为 Agent runtime，但不把 Pi 终端或 Markdown 编辑器直接搬到浏览器里。

学生看到的是一套真正的学习界面：

- 从上次位置继续的学习集首页，以及 Roadmap“学习总览”、Plan“学习顾问”和 Lesson“课堂导师”三层入口；
- 自然的多轮对话；
- 固定显示唯一 active ActivityBlock 的当前课堂；
- 以连续文档组织课堂脉络、方法进展和近期记录的课堂情境；
- 按当前 Session 权限检索真实题卡、方法、材料和学习记录的研习资料；
- 可导航的课堂节点与实时变化的方法进展；
- 会根据课堂表现调整的学习路线；
- 可恢复、逐项决定的 Plan 长期记忆确认卡；
- Session 级陪伴风格与仅属于当前浏览器的页面呈现偏好；
- 能显示多 Agent 深度会诊进度的任务轨道；
- 能回到原题、原回答和原始证据的课后回放。

底层仍然是可阅读、可编辑、可用 Git 管理的 learning set。没有数据库，也不把学习状态锁在某个前端里。

## 视觉基线：留白新中式

学习总览、学习顾问、课堂导师和课后 Replay 共用一套“留白新中式”视觉基线：暖白纸色承担大面积背景，墨黑保证正文阅读，低饱和青绿表达当前状态与主要动作，暗金只保留给需要注意但不紧急的提示。各学习表面的区别来自内容节奏，而不是互不相干的皮肤：规划更克制，课堂更聚焦当前活动，Replay 更强调时间与证据。

设计约束如下：

- 不使用大面积渐变、玻璃拟态和浮空卡片墙；
- 信息分组优先依靠留白、细分隔线和字体层级；
- 人设色只出现在头像等局部身份标记，不覆盖教学状态语义；
- 题目、Trace、能力证据和课堂节点仍使用统一的语义 token；
- 窄屏允许 Lesson 节点局部横向滚动，但页面本身不得产生横向溢出。

前端根节点使用 `data-theme="liubai-xinzhongshi"`，工作区同时用 `data-view="roadmap | coach | tutor | replay"` 标识当前学习表面。主题 token 只有一个来源，避免以后调整配色时让首页、课堂和回放再次分裂。

## 学生三层术语与底层 Session

学生不需要直接理解 Agent 类型。界面固定使用三层名称：

- **学习总览**：Roadmap 层，负责首次目标商议、跨 Plan 回看和开启新学习周期；
- **学习顾问**：Plan 层，负责当前周期的方向、复盘、进度解释和备课；
- **课堂导师**：Lesson 层，负责当前课堂的多轮教学、提示、评价、节点推进和 Trace 写入。

底层仍只有 Coach 与 Tutor 两种技术角色。Roadmap 与 Plan 都使用 Coach，但 Session
owner 不同；Lesson 使用 Tutor。每个 Session 只有一条
`studyforge.session-owner.v2`，由
`nodeKind + nodeId + nodePath + parentId + parentPath` 决定身份。Roadmap Coach
绑定 `roadmap / ROADMAP.md`，Plan Coach 绑定当前 Plan，Tutor 绑定当前 Lesson；
展示名称不参与 Session 复用判断。

每个 Plan 同时显示课程学习树和已经真实建立的 Session：

```text
Roadmap
└── 定义域完整性 Plan
    ├── Lesson 001 · 已完成
    ├── Lesson 002 · 已暂停
    └── Lesson 003 · 待开始

Session 历史
├── 学习顾问
├── Lesson 001 · 课堂回放
└── Lesson 002 · 课堂导师
```

Plan 是 Lesson 的父节点；只有已经激活并拥有 owner 匹配 Session 的 Lesson 才进入
Session 历史。Candidate 没有文件或 Session，prepared Lesson 只留在课程树和就绪
入口。学生始终使用同一个聊天外壳，从侧边栏点击学习顾问或某一节已开始 Lesson
即可切换；点击只改变当前输入被发送到哪里，不会合并聊天历史。

这里的“父子”表示归属和导航，不表示上下文继承。Tutor 不读取 Coach transcript，Coach 也不读取 Tutor transcript；两者只通过 Lesson 文件、课堂摘要和带来源的 Trace 交接。在 Plan 会话树中离开 active 课堂导师时，前端先把 Lesson 暂停，之后可沿原 Block 和原 Session 继续。Lesson 关闭后页面停留在只读 Replay，不自动返回学习顾问；学生明确点击“返回学习顾问”后才进入复盘。

Coach 和 Tutor 都可以在自己的 Session 中开启“深度模式”。它不是第三个用户可见 Agent，而是父 Agent 临时组织多个只读 Subagent 完成检索、分析和交叉检查的能力。临时 Subagent 不出现在侧边栏，也不拥有长期记忆；最终仍由 Coach 或 Tutor 作出决定。

## 重新备课

- Lesson 还没有正式开始时，学习顾问可以直接修改原教案；Lesson ID 和侧边栏条目不变。
- 学生确认“开始上课”后，这份 Lesson 就与其 Tutor Session 和课堂历史绑定，不能再用新教案覆盖；只查看无剧透预览仍可原地修改。
- 此时返回学习顾问重新备课，旧 Lesson 标记为“已归档”，原对话、节点、作答和 Trace 全部保留。
- 学习顾问使用新编号生成一节 Lesson，侧边栏增加新的“待开始”子节点；新旧 Lesson 不共用 Tutor Session。

因此重新备课不需要创建 Designer Agent，也不需要更换 Coach，只是父 Session 再次加载备课 Skill。

## 路由与学习表面

### 续学优先首页 `/`

首页不是总览仪表盘，而是恢复入口。首屏只保留一个“从上次的位置继续”主动作：先按 Roadmap 顺序选择第一个含可续 Lesson 的未完成 Plan（若没有，则选择第一个未完成 Plan），再在该 Plan 内按 `active Lesson → paused Lesson → prepared Lesson → 学习顾问` 选择目标；没有未完成 Plan 时才进入学习总览。当前阶段、学习顾问写下的下一步、最近变化和最近课堂回放用于辅助判断；学习集概述、研习要领、其他 Plan 与学习总览保持次级。

浏览器可以记住最近访问的位置，但只接受仍可继续的未完成 Plan Coach 或 active、paused、prepared Lesson。closed Replay 可以刷新和深链恢复，却不会覆盖首页的续学位置。

### 学习总览 `/roadmap`

这是独立的 Roadmap Coach Session，用于建立第一个学习周期、跨 Plan 回看和讨论下一阶段。已有 Plan 时，它在首页列表末尾保持为次级入口；打开与刷新 `/roadmap` 都恢复同一个 owner 匹配会话。它不显示 Plan 会话树，也不负责具体 Lesson 的日常备课。

### 学习顾问 `/plan/<planId>`

Plan 的学习顾问、待开始 Lesson、课堂导师与 Replay 共用一个页面外壳。侧边栏显示学习顾问父会话和全部 Lesson 子会话；输入区始终归属于当前选中的 Session。学习顾问右侧使用文档式 ContextStack 展示当前位置与下一步、备课提醒、前课摘录和可选的深入查找。

### Lesson `/plan/<planId>/lesson/<lessonId>`

同一路由按 Lesson 状态呈现三种表面：

- `prepared`：显示无剧透课堂本和“开始上课”准入入口，不创建 Tutor Session；
- `active / paused`：显示课堂导师、固定当前 ActivityBlock 和课堂 ContextStack；
- `closed / abandoned`：显示只读 Replay、结课摘要、真实停止位置和来源记录。

开发者使用显式 authoring 模式启动时，才可以查看完整 Lesson 源文档。普通学生 API 不返回 Teacher Control、题卡答案、rubric、未揭示提示或原始工具参数。

## 核心交互

### 固定当前课堂与文档式 ContextStack

课堂导师进行中时，聊天上方固定显示唯一 active ActivityBlock 的 Student View、活动标题和已揭示题卡。未开始的 Block 仍留在课堂脉络中，但其正文、题卡与 Teacher Control 不会提前进入当前课堂。这样既保留连续对话，也不要求学生为了找题反复向上滚动。

右侧不是卡片仪表盘，而是一列可折叠的连续文档，默认只展开第一节：

- 学习顾问看到本阶段、备课提醒、前课摘录和深入查找；
- 课堂导师看到课堂脉络、方法进展、近期学习记录和深入查找；
- Replay 看到结课定位、原定与实际路线、方法进展变化和记录来源。

ContextStack 只投影 Markdown、active Trace、当前 Session 与工作流状态，不成为新的学习事实。

### 研习资料

“研习资料”以 overlay 打开，关闭后仍留在原 Session、原路由与原页面位置。它可以用题卡内容或 active Trace 文本反查真实题卡，也可以搜索规范方法、学习集材料和相关学习记录；无结果时保持为空。

权限跟随当前学习表面：

- active/paused 课堂导师只看到已经 active 或 completed Block 揭示的资产，以及本课允许的 active Trace；
- Plan 学习顾问和 closed/abandoned Replay 可以查完整的学生安全资产集；
- prepared Lesson 尚未建立 Tutor 权限，Roadmap 学习总览也不开放研习资料。

结果只显示学生安全题卡、材料预览和当前有效记录。来源透镜作为叠层打开，关闭后保留原搜索词和结果。

### 方法进展与证据透镜

题卡上的主方法和次方法会连接到方法节点。每次课堂 Trace 写入后，服务端发布一份完整 snapshot；节点显示待观察、不稳定或较稳，以及支持记录和冲突来源，不显示未经校准的掌握百分比。

从一道题、一个方法节点或一条 Trace 可以打开同一个来源面板：

```text
Roadmap 能力标准
  → Plan 目标
  → Lesson / ActivityBlock
  → Trace 与学生作答
  → 真实题卡或材料
  → 主方法 / 次方法
```

方法进展是 active Trace 的证据投影，不是独立的掌握度事实。

### 动态课堂路线与课后回放

备课时的 ActivityBlock 形成初始路线。课堂导师可以根据真实证据和学生选择插入、跳过、重排或重复节点；变化写入 Lesson 的 `Route Changes` 并链接来源。当前 active Block 始终是页面焦点，路线文档则保留整节课的来路和停止点。

学生确认结束后，`lesson_close` 写入 Lesson Summary 与 `status: closed`，但不把未完成 Block 补成 completed。页面继续停在原 Tutor 的只读 Replay，聚合最终消息、结课摘要、Trace、路线变化和图片；原 Session 历史缺失时明确降级为 evidence-only。Replay 可以刷新、后退、前进和深链恢复，只有学生点击“返回学习顾问”才进入 Plan 复盘，而且这次查看不会取代首页原有的可续学位置。

### Plan 长期记忆确认卡

completed Plan 的学习顾问在重读 Plan 后，可以把带来源的 `add / revise / delete` 候选放进原聊天时间线。候选默认不选择；学生逐项采用、改写后采用或不采用，也可以稍后处理，刷新或重启后仍可继续。

提交只表示决定已经保存并交给同一个 Plan Coach。前端不直接编辑画像，也不会把“已提交”说成“已应用”；学习顾问应用决定并重读 `student-profile.md` 与 `teaching-profile.md` 后，才从重读结果报告。Roadmap Coach、课堂导师和未完成 Plan 不显示这张卡。

### 陪伴风格与页面呈现

“陪伴风格”只改变当前 Coach/Tutor Session 面向学生的表达、头像和局部强调色。选择写入该 Pi Session 的 custom entry，不复制到其他 Session，也不改变题卡、评价、Trace、能力标准或工具权限。

柔和动效和完成反馈属于页面呈现偏好，只保存在当前浏览器的 `studyforge.presentation.v1`。它们不进入 Session、learning set 或模型上下文；系统要求减少动态效果时，页面始终优先使用 reduced motion。

### 深度模式与动态工作流

深度模式也是 Coach/Tutor Session 级开关。现有信息足够时直接回答；单轮、无依赖的 Evidence Scout 可以作为 quick 工作流运行，有依赖波的 deep 工作流先展示目标、任务关系、Token 与时间预算，由学生确认后运行。

任务轨只显示安全化活动名、进度、耗时、Token、工具次数和完成后的来源数量，临时 Agent 的原始对话不混入学生聊天。子任务只读证据，当前父 Coach 或 Tutor 仍是自己 owner 范围内唯一的事实写入者。

```text
深入查找 · 3/5 已完成 · 2 个正在运行                  [取消]

✓ 查找相关题卡与 Trace                    找到 8 条来源
● 分析可能的知识缺口                      正在分析
● 设计下一步提示                          等待知识缺口分析
✓ 检查是否提前剧透                        通过
○ 学习顾问 / 课堂导师最终综合              尚未开始
```

工作流状态保存在父 Pi Session 中。取消会保留已完成分支；服务重启后，原 running 工作流收束为 partial 或 failed，不会自动续跑。

## 记忆如何进入不同 Session

Pi 可以加载 `AGENTS.md` / `CLAUDE.md`、按需 Skills、持久 Session 和自动上下文压缩。前端再使用独立 ResourceLoader，为不同 owner 提供不同的记忆入口：

- Roadmap Coach 围绕 Roadmap 和跨 Plan 方向工作，不备具体 Lesson，也不修改已有 Plan；
- Plan Coach 读取当前 Plan、两份已确认画像和相关 Lesson 摘要；备课时才读取 planner attention、题卡和 Trace；
- Tutor 读取当前 Lesson、两份画像和本课需要的题卡/Trace，不读取 planner attention 或备课 Skill；
- 初始陪伴风格可由 `CLAUDE.local.md` 提供，学生后续选择只更新当前 Session。

Roadmap、Plan、Lesson、画像、题卡和 Trace 才是长期事实。Pi Session 与 compaction 只负责当前对话连续性。

深度工作流发生上下文压缩时，只向父 Session 保留目标、最终结论、关键来源和 `workflow_id`；完整子任务 JSON 需要时再读取，不会常驻 Coach 或 Tutor 上下文。

## 题卡与 Trace 工具

Pi 核心没有内置 MCP，因此 Pi 版本把以下四个契约注册为原生 extension tools：

- `card_search`；
- `trace_search`；
- `trace_append`；
- `source_resolve`。

它们与 Claude Code MCP adapter 共用同一套文件领域逻辑。找不到真实题卡时仍然返回空结果，不能编卡。

## 防剧透边界

学生 API 从服务端开始就只返回 Student View，不把完整 Lesson 或完整题卡发送到浏览器后再用 CSS 隐藏。

学生模式不会收到：

- Teacher Control；
- 题卡答案与完整解法；
- rubric；
- 未揭示提示；
- 备课候选和废弃方案；
- 深度工作流的原始子 Session 对话、未采纳结论和答案性中间结果；
- Pi thinking。

这能防止课堂界面意外剧透，但不是针对拥有本机文件访问权的攻击者建立安全沙箱。

## 一段完整演示

一段适合展示的真实流程可以是：

1. 打开导数学习集，首页用唯一主入口提示从上次的 active、paused 或 prepared Lesson 继续；
2. 需要看全局时，从次级“学习总览”进入 Roadmap 对话；日常学习则回到当前 Plan 的“学习顾问”；
3. 学习顾问根据上一课 active Trace 与学生讨论下一课方向，页面同时显示“为什么这样安排”；
4. 新 Lesson 出现在侧边栏；学生查看无剧透课堂本并点击“开始上课”；
5. 课堂导师只在聊天上方固定显示当前 active ActivityBlock，右侧课堂情境保留整节课的文档脉络；
6. 学生在“研习资料”中搜索当前已揭示题卡与学习记录，pending 题卡不会提前出现；
7. 学生上传手写解题图片；面对复杂作答，课堂导师可以启动 quick 证据查找，临时 Agent 不出现在侧边栏；
8. 学生无提示完成诊断，课堂路线跳过基础讲解并进入迁移题；
9. 新 Trace 写入，方法节点刷新；点击节点可回到原题、原图和原始课堂步骤；
10. 从 active 课堂导师切回学习顾问时 Lesson 先暂停，重新打开后沿原 Block 继续；
11. 学生主动结束课程，页面留在只读 Replay，对比结课摘要、初始路线、实际路线和方法进展；
12. 查看 Replay 不改变首页续学位置；学生明确点击“返回学习顾问”后才开始课后复盘；
13. Plan 完成时，学生在原学习顾问时间线逐项确认长期记忆候选，再由学习顾问应用并重读画像。

这段演示的视觉效果来自真实教学状态，而不是预制动画或虚构数据。
