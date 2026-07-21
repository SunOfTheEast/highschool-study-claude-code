# Pi 教学前端：中文设计说明

状态：父子 Session 修订已确认，等待文档复核

正式技术设计：[Pi 教学 Web 前端设计](../superpowers/specs/2026-07-21-pi-teaching-web-frontend-design.md)

## 这是什么

这是 Highschool Study 面向学生的本地 Web 前端。它使用 Pi 作为 Agent runtime，但不把 Pi 终端或 Markdown 编辑器直接搬到浏览器里。

学生看到的是一套真正的学习界面：

- 学习集概述、Roadmap 与 Plan；
- 自然的多轮对话；
- 结构化题目、视频、材料和作答组件；
- 可导航的课堂节点；
- 实时变化的能力星图；
- 会根据课堂表现调整的学习路线；
- 能回到原题、原回答和原始证据的课后回放。

底层仍然是可阅读、可编辑、可用 Git 管理的 learning set。没有数据库，也不把学习状态锁在某个前端里。

## 两个 Agent，一个 Plan 会话工作区

前端只使用两个 Agent：

- **Coach**：以 Plan 为周期，负责学习方向、复盘、进度解释和备课。备课是 Coach 按需加载的 Skill。
- **Tutor**：以 Lesson 为周期，负责当前课堂的多轮教学、提示、评价、节点推进和 Trace 写入。

每个 Plan 显示为一棵很小的会话树：

```text
定义域完整性 Plan
├── Coach · 方向、备课与复盘
├── Lesson 001 · 已完成
├── Lesson 002 · 已暂停
└── Lesson 003 · 待开始
```

Coach 是父 Session；Plan 的 `Lesson Index` 中每个 Lesson 对应一个 Tutor 子 Session。学生始终使用同一个聊天外壳，从侧边栏点击 Coach 或某一节 Lesson 即可切换。点击只改变当前输入被发送到哪里，不会合并两份聊天历史。

这里的“父子”表示归属和导航，不表示上下文继承。Tutor 不读取 Coach transcript，Coach 也不读取 Tutor transcript；两者只通过 Lesson 文件、课堂摘要和带来源的 Trace 交接。结束 Lesson 后默认返回原 Coach Session，学生也可以随时主动返回。

## 重新备课

- Lesson 还没有正式开始时，Coach 可以直接修改原教案；Lesson ID 和侧边栏条目不变。
- 学生确认“开始上课”后，这份 Lesson 就与其 Tutor Session 和课堂历史绑定，不能再用新教案覆盖；只查看无剧透预览仍可原地修改。
- 此时返回 Coach 重新备课，旧 Lesson 标记为“已中止”，原对话、节点、作答和 Trace 全部保留。
- Coach 使用新编号生成一节 Lesson，侧边栏增加新的“待开始”子节点；新旧 Lesson 不共用 Tutor Session。

因此重新备课不需要创建 Designer Agent，也不需要更换 Coach，只是父 Session 再次加载备课 Skill。

## 三个页面

### 学习集首页

展示学习集概述、Roadmap、Plan 进度、最近 Lesson、能力星图摘要和“继续学习”入口。

### Plan 会话页

Coach、备课进度和 Tutor 课堂共用同一个页面外壳。侧边栏显示 Coach 根节点和全部 Lesson 子节点；输入框上方始终标明当前接收消息的是 Coach 还是哪一节 Lesson。普通消息保持自然对话；题目、视频、选择、数学输入、图片和工具状态使用结构化组件。

课堂节点抽屉保存课程结构，所以长课不会退化成只能不停向上翻的消息瀑布。

### 备课本

学生可以查看课堂安排、节点和无剧透备课摘要。开发者使用显式 authoring 模式启动时，才可以查看 Teacher Control、题卡答案、提示阶梯和原始工具事件。

已结束课程的回放也放在备课本中，不增加新的顶级页面。

## 五项旗舰功能

### 1. 实时能力星图

题卡上的主方法和次方法会连接到能力节点。每次课堂 Trace 写入后，证据信号从题卡流向方法节点：主方法影响较大，次方法影响较小。

节点不会显示未经校准的“87% 掌握”之类伪精确数字，而是显示：

- 待观察；
- 不稳定；
- 较稳；
- 支持证据数量；
- 冲突证据和不确定性。

点击任意节点，可以看到这次变化来自哪一道题、哪次作答和哪条 Trace。

### 2. 动态课堂路线

备课时的 ActivityBlock 是一张初始路线图。上课过程中，Tutor 可以根据真实证据和学生选择插入、跳过、重排或重复节点。

路线改变时，节点会平滑移动，并显示一句无剧透说明，例如：

> 你已经无提示完成诊断，因此跳过基础讲解，直接进入迁移练习。

每次变化都会写入 Lesson 的 `Route Changes` 并链接到原始证据，因此动画不是模型随口编出的表演。

### 3. 课后学习回放

学生可以拖动时间轴回看：

- 第一次卡住的位置；
- 当时上传的手写过程；
- 提示推进到哪一级；
- 哪次修正形成了有效 Trace；
- 课堂路线何时发生变化；
- 能力星图在课前和课后的区别。

完整回放由 Pi Session、Lesson、Trace、题卡和图片共同重建。若 Session 文件缺失，页面会明确降级为证据回放，不伪造缺失对话。

### 4. 证据透镜

从一道题、一个能力节点、一条 Trace 或一项课后结论，都能打开同一个来源面板：

```text
Roadmap 能力标准
  → Plan 目标
  → Lesson / ActivityBlock
  → Trace 与学生作答
  → 真实题卡或材料
  → 主方法 / 次方法
```

任何断链都会原样显示，系统不会自动补造题目、来源或关系。

### 5. 二次元课堂皮肤

当前人设可以控制头像、配色和轻量阶段动画，例如规划、备课、讲解、等待作答、完成节点和课后复盘。

角色动画由系统阶段事件驱动，不让模型任意发动画命令。切换人设只能改变表达和视觉，不能改变题卡、评价、Trace、能力聚合或课程标准。

## 记忆如何进入不同 Session

Pi 可以加载 `AGENTS.md` / `CLAUDE.md`、按需 Skills、持久 Session 和自动上下文压缩。前端再使用独立 ResourceLoader，为两个 Agent 提供不同的记忆入口：

- Coach 读取 Roadmap、当前 Plan、两份画像和相关 Lesson 摘要；备课时才读取 planner attention、题卡和 Trace。
- Tutor 读取当前 Lesson、两份画像和本课需要的题卡/Trace；不读取 planner attention 或备课 Skill。
- `CLAUDE.local.md` 和选中人设由前端显式注入，因为 Pi 不会自动加载 `CLAUDE.local.md`。

Roadmap、Plan、Lesson、画像、题卡和 Trace 才是长期事实。Pi Session 与 compaction 只负责当前对话连续性。

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
- Pi thinking。

这能防止课堂界面意外剧透，但不是针对拥有本机文件访问权的攻击者建立安全沙箱。

## 一段完整演示

一段适合展示的真实流程可以是：

1. 打开导数学习集，能力星图显示“定义域完整性”仍不稳定；
2. 进入 Plan 后，侧边栏显示 Coach 根节点和已有 Lesson 子节点；
3. Coach 根据上一课 Trace 与学生讨论下一课方向；
4. 点击备课，页面用结构化状态显示选题和编排过程，但不泄露答案；
5. 新 Lesson 出现在侧边栏；学生查看课堂路线与安排理由，然后点击进入；
6. Tutor 呈现真实题卡，学生上传手写解题图片；
7. 学生无提示完成诊断，课堂路线现场跳过基础讲解并进入迁移题；
8. 新 Trace 写入，能力星图中的主方法节点产生证据动画；
9. 点击节点打开证据透镜，回到原题、原图和原始课堂步骤；
10. 学生主动结束课程，页面默认回到原 Coach；
11. 打开课后回放，对比初始路线、实际路线和能力星图变化。

这段演示的视觉效果来自真实教学状态，而不是预制动画或虚构数据。
