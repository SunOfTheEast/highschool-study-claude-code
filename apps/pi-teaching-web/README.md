# StudyForge Pi 教学前端

这是 `highschool-study` Markdown 学习集的本地 Pi 前端。一个 Plan 对应一个长期 Coach Session；每节 Lesson 对应一个独立 Tutor Session。学生始终使用同一网页，但 Coach 与 Tutor 的历史不会互相复制，只通过 Lesson 文件、Trace 和带来源摘要交接。

## Message projection

学生 Session 默认使用 `safe`：纯文本消息完成后才显示；包含工具调用的混合消息改为结构化工作状态。Pi 原始 Session JSONL 不会被修改。

`raw-stream` 只用于本地诊断，因为它可能显示混合工具文本：

`bun run start -- --message-projection raw-stream`

等价环境变量为 `STUDYFORGE_MESSAGE_PROJECTION=raw-stream`。

## 视觉主题

默认主题为“留白新中式”：暖白纸色、墨黑正文和低饱和青绿强调色组成同一套 Coach、Tutor 与 Replay 视觉语言。界面优先保留阅读空间和信息层级，不使用大面积渐变、浮空卡片或角色全局染色；二次元人设只影响头像及局部点缀，不改变教学状态的语义颜色。

主题 token 集中在 `src/client/theme-liubai.css`，页面结构和状态样式保留在 `src/client/styles.css`。根视图通过 `data-theme="liubai-xinzhongshi"` 与 `data-view="coach | tutor | replay"` 标记当前界面，后续视觉调整应继续复用这些语义入口。

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

1. 首页阅读 Roadmap 概述并进入一个 Plan。
2. 在父级 Coach Session 讨论方向、复盘旧课或请求备课。
3. 从侧边栏打开 Coach 生成的 Lesson；未开始前只有无剧透课堂本。
4. 点击“开始上课”后才创建该 Lesson 的 Tutor Session。
5. Tutor 推进结构化课堂节点，学生可以上传 PNG、JPEG 或 WebP 草稿。
6. 学生确认结束后，Tutor 写一份结课时 Lesson Summary 并关闭 Lesson；界面停留在只读 Tutor Replay，保留最终消息、真实停止节点和关课快照，直到学生明确点击“返回 Coach”。

右侧“方法证据”只是 Trace 的主/次方法加权投影。点击任一节点都能回到原始 Trace 和安全题卡元数据；它不是独立的掌握度事实。

## Session、证据与重新备课

- Coach Session 的 owner 是当前 Plan；正常备课通过 `lesson_prepare` 提交一次性结构化课堂骨架，由运行时绑定路径、状态和 Lesson Index 并编译成 Markdown；最终 `active / complete / replan` 决定通过 `plan_update` 一次写回，再重读 Plan 后回复。
- Tutor Session 的 owner 是当前 Lesson；模型不填写 `lessonPath`、`cardStepId` 或 Session ID。
- Tutor 在评价前只冻结学生已经亲自给出的数学内容。缺决定性证明时写 `incomplete`，不能把 Tutor 的补全冒充成学生证据。
- `support` 记录最终答案实际采用的帮助。提示出现但未提供/未被采用决定性内容时仍可为 `none`；采用 Tutor 首次给出的关键内容时为 `tutor`。
- 题卡方法只是候选。学生确认节点贴切后才写实际方法；拒绝、无精确节点或暂不决定时保留未映射路线。
- 只有某一整题或一问的完整核心路线真正不同才落盘另解；写入顺序是 active correct Trace → `card_alternative_append` → 学生回复。
- 学生异议成立或后续补全同一 attempt 时，新的 Trace 必须 supersede 准确的 active event。

`lesson_close` 只接收一份学生可见的 Lesson Summary，写入该快照和 `status: closed`，不会完成、跳过或重排任何 Block。Lesson Summary 是结束时的检索入口，不取代 active Trace；更正 Trace 后可以重建能力图与 Planner Attention，但不会自动改写 Summary、Plan、另解 sidecar 或已确认画像。Plan 状态和复盘结论只由 Coach 正常审阅后调用 `plan_update` 改变。

`LessonBlueprint` 只存在于普通工具调用记录中，不是第二份学习状态；`lesson-xxx.md` 仍是 Tutor、Trace 和前端共同读取的唯一课堂事实。仍为 `prepared` 的 Lesson 可以由 Coach 保持 ID 原地重新编译。Tutor 已启动后再要求重新备课，旧 Lesson 保留并标为 `abandoned`，Coach 使用新 ID 创建替代 Lesson。

Trace 写入成功后，服务端主动发布完整能力 snapshot；刷新、前进/后退和 Plan/Lesson 深链会从 Markdown 与已绑定 Pi Session 恢复 Coach、Tutor 或 closed Replay。Replay 优先使用真实 Pi 历史；历史不可用时明确显示 evidence-only。

## 深度模式与动态工作流

深度模式按 Coach/Tutor Session 单独开启，默认关闭。信息足够时，父 Agent 仍直接回答；跨题卡、跨 Lesson 或 Plan 级检索会把大体量证据留在一个临时 Evidence Scout 中，多个任务只用于真正独立、且结论可能改变下一步教学动作的问题。

- `quick` 最多三个无依赖任务，最长 45 秒，可以直接运行；Token 总预算由父 Agent 显式声明，单个 Plan 级 Evidence Scout 约定使用 50,000，因为子任务输入和题卡/Trace 工具结果都计入预算；
- `deep` 可以包含依赖波，但必须先在任务轨显示目标、并发、Token 与时间上限，由学生确认后才运行；
- proposed/running 工作流可以取消；已经完成的分支结果会保留，未完成任务不会自动重试；
- 任务状态保存在父 Pi Session JSONL 的 custom entries，Lesson、Trace、Plan 和画像等正式学习状态仍保存在 Markdown；
- 父 Agent 只向 Evidence Scout 传证据问题和范围，不先批量读取同一范围；子进程的 `card_search` / `trace_search` 只返回题卡路径、标题、目标、方法元数据和 active Trace，不返回题干正文或解析；
- Quick 的紧凑结果直接回到当前父 Agent 工具调用；确认后的 Deep 通过隐藏的 `studyforge.workflow-result.v1` 消息恢复父 Agent 综合；
- 子任务原始 JSON 与运行 artifact 只供父 Agent/runtime 检查，Student View 的任务轨只显示状态、预算、依赖、召回题卡数和来源数；
- 本地 MVP 不宣称账号隔离或操作系统级沙箱。临时 `study-scout` 不具备写入工具，但学习集仍应视为本机可信文件。

服务重启时，先前停在 running 的工作流会恢复为终态：有已完成结果则为 partial，否则为 failed；未完成任务标记为 cancelled。需要继续时由父 Agent 重新提出工作流，不会自动续跑。

## 真实模型 smoke checklist

建议先复制示例，避免测试写入仓库样例：

```bash
cp -R examples/derivative-demo /tmp/studyforge-derivative-smoke
cd /tmp/studyforge-derivative-smoke
pi
```

依次确认：

- 打开 Coach，读取并复盘上一节 Lesson；
- 让 Coach 按需加载备课 Skill，通过一次 `lesson_prepare` 准备一节至少含两张真实题卡且不剧透的 Lesson；
- 启动 Tutor，确认它拥有独立 Session；
- 分别提交文字与一张图片；
- 让 Tutor 追加一条绑定题卡/课堂步骤的 Trace；
- 暂停并继续同一个 Tutor Session；
- 由学生明确确认结束 Lesson；
- 在原 Tutor Replay 查看结课快照，再明确返回原 Coach Session 做课后复盘。

深度模式另行确认：先运行一次单 Evidence Scout 的 quick 证据召回，再提出一次有依赖的 deep 工作流并由学生确认；启动第二个 deep 工作流后取消，确认任务轨保留已完成分支，而且临时子任务没有改动 learning-set 文件。

遇到问题时先运行 `bun run check`；模型调用失败通常需要在 Pi 中用 `/login` 或环境变量配置提供商凭据。

完整功能语义见 [`docs/zh-CN/完整说明书.md`](../../docs/zh-CN/完整说明书.md)。
