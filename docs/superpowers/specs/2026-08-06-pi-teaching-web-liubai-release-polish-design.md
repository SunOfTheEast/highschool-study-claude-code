# Pi Teaching Web 留白新中式发布润色设计

**状态：** 已批准，待实施计划

**日期：** 2026-08-06

**目标应用：** `apps/pi-teaching-web`

**视觉母版：** Kimi 工作树 `frontend-redesign` 中尚未提交的
`apps/pi-teaching-web/preview/`。实现时以其中的 `screen-home.html`、
`screen-plan.html`、`screen-lesson.html`、`screen-replay.html` 与
`styles/liubai-preview.css` 为只读母版，不在生产页面直接加载这些静态 HTML。

## 一、背景

M0 的教学链路已经可以从 Roadmap 讨论运行到第二个 Plan，并支持课堂对话、后台选材、
课后核验与可打印讲义。发布前剩余的主要工作不是重做业务，而是让产品的视觉层级、页面
密度和学习位置感达到已经获得认可的 Kimi 原型质量。

当前 React 前端已有完整的 M0 数据与交互，但仍有四个发布问题：

1. `/course` 直接进入 Roadmap 对话，缺少一个稳定的学习概览与“继续学习”入口；
2. Course、Plan 与 Lesson 共用一套偏稀疏的工作区，层级身份和当前进度不够清楚；
3. Knowledge 与打印讲义虽然可用，但尚未统一到 Kimi 原型的纸张、字体和信息节奏；
4. 公式输入存在多种分隔符，而生产渲染器与 Kimi 原型识别的语法不同，导致公式有时
   正常、有时原样显示或排版溢出。

本轮是 **M0 发布润色**。目标是复用 Kimi 原型已经验证的视觉语言，同时完整保留现有
Runtime、Session、课程树、教学状态、Student View、防剧透边界和讲义投影。

## 二、方案选择

讨论过三种整合方式：

1. **只换颜色与字体。** 改动最小，但无法获得原型中的三张纸结构、学习概览和清晰的
   Roadmap / Plan / Lesson 层级，效果不足；
2. **移植 Kimi 视觉外壳，绑定当前业务内核。** 复用原型的 DOM 分区、设计 token、
   排版比例和组件形态，由现有 React 组件、API 与契约提供数据和行为；
3. **按静态原型重写整个前端。** 视觉还原直接，但容易复活原型中的旧 Replay、能力投影
   等已经不符合当前 M0 契约的假数据与旧产品逻辑。

采用第二种。这里的“复用”不是看着截图重新仿写，而是优先迁移 Kimi 原型中的布局结构、
CSS token、纸层、线条、字号与可复用视觉零件；只有静态 HTML 与当前 React 数据结构不一致
的部分才做适配。

## 三、设计原则与边界

### 3.1 保留业务内核

以下内容不因视觉润色改变：

- `CourseSnapshot`、`KnowledgeSnapshot`、Lesson handout 等现有契约；
- Roadmap、Plan、Lesson 三种独立 Session 及其 URL 深链接；
- Plan 只管理自己目录下 Lesson 的层级边界；
- 节点生命周期动作与状态门；
- `ChatPanel` 的消息、材料检索、Lesson Reviewer、讲义活动和工具事件；
- Lesson 的 Block 状态与 Student View / Teacher Control 分离；
- 讲义只投影已选择 Block 的公开内容；
- WebSocket 刷新、加载、错误和重连行为。

不为视觉稿新增个人掌握度、长期记忆、Trace 聚合或第二套 Replay 数据模型。属于 M1 的
学生建模继续留到 M1。

### 3.2 视觉语言

沿用 Kimi 原型的“留白新中式”：暖纸底、墨色正文、黛青主强调、少量朱砂、发丝线分区，
不引入通用 Dashboard 卡片海洋、厚阴影或高饱和状态色。

主要约束：

- 正文、标题和对话以霞鹜文楷形成统一声部；Session ID、题卡 ID 和工具元数据保留等宽体；
- 三栏工作区表现为三张相邻纸面，而不是三个浮动面板；
- 信息层级主要依靠字号、留白、线条和墨色深浅，不依靠堆叠胶囊标签；
- 朱砂用于品牌和少量决定性锚点，不承担错误、成功或掌握度语义；
- KaTeX 的数学字体独立于中文字体系统，不能被文楷全局样式覆盖。

为避免未提交母版丢失，核心 token 固化如下；实现时优先沿用这些值和命名：

| token | 值 | 作用 |
|---|---|---|
| `--paper` | `#faf7f1` | 中央主纸 |
| `--paper-deep` | `#f1ece1` | 左侧深纸 |
| `--paper-mid` | `#f6f1e7` | 右侧中纸 |
| `--ink` | `#1b1916` | 主墨色 |
| `--ink-soft` | `#4a463d` | 次正文 |
| `--ink-faint` | `#9a917f` | 元数据与弱提示 |
| `--accent` | `#3f5b54` | 黛青主强调 |
| `--accent-deep` | `#314a44` | 黛青深色 |
| `--seal` | `#9e4f3d` | 朱砂品牌强调 |
| `--attention` | `#b6a06a` | 需要注意但非错误 |
| `--danger` | `#a8674f` | 错误语义 |

字号阶梯沿用母版的 11 / 12 / 13 / 14 / 16 / 18 / 20 / 24 / 32px；间距阶梯沿用
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px。布局允许按真实 React 内容微调，但不重新
回到每个组件各写一套 ad-hoc 数值。

## 四、信息架构与路由

### 4.1 `/course` 成为稳定学习概览

用户已选择“先看 Kimi 风格的概览，再进入 Roadmap 对话”。因此：

- `/course`：学习概览，无聊天输入框；
- `/course/roadmap`：Roadmap Session 对话；
- `/course/plan/:planId`：Plan Session；
- `/course/plan/:planId/lesson/:lessonId`：Lesson Session；
- `/knowledge`：静态学习资产；
- 现有 handout URL 保持不变。

学习概览直接使用现有 Roadmap 文档和课程树，不新增后端接口。页面包含：

1. 品牌行与 Roadmap 标题、长期目标、概述；
2. 一个强主入口：根据课程树状态确定“继续学习”；
3. Plan 序列，每个 Plan 显示状态、阶段目标与已结束 Lesson / 总 Lesson 数；
4. “与老师讨论路线”入口，进入 `/course/roadmap`；
5. 没有 Plan 时的真实空态：说明先与老师厘清目标，不虚构课程目录。

“继续学习”按可解释的课程状态决定，不建立新的记忆系统：

1. 当前 active Lesson；
2. active Plan 中第一个 prepared Lesson；
3. active Plan 本身；
4. 第一个 prepared Plan；
5. 都不存在时进入 Roadmap 对话。

同一层有多个候选时按课程树顺序取第一个。这个规则只负责导航，不推断学生掌握情况。

### 4.2 工作区层级身份

Roadmap、Plan、Lesson 继续复用同一个三栏 React 工作区，但外观随节点类型明确变化：

- 左纸：课程树与层级位置；
- 中纸：节点标题、当前状态、对话与后台活动；
- 右纸：Roadmap / Plan 的节点原文，或 Lesson 的课堂 Block；
- 顶部路径条显示 `学习概览 › Roadmap`、`学习概览 › Plan` 或
  `学习概览 › Plan › Lesson`，父层可返回；
- 生命周期按钮继续由真实 `status` 决定，不因视觉稿常驻显示。

Closed Lesson 不建立新的 Replay 页面。它仍使用同一 Lesson URL，显示“已结束 · 只读”，
保留真实对话历史与 Block 状态，并禁用输入。Kimi 的 `screen-replay.html` 只提供只读状态、
时间节奏和颜色参考。

## 五、页面设计

### 5.1 全局框架

`AppShell` 保留课程 / 知识两项主导航和连接状态，但改成 Kimi 原型的细墨线品牌栏：

- 左侧朱砂“学”章、StudyForge 与学习集标题；
- 中部主导航；
- 右侧本地连接状态，弱化为辅助信息；
- 通知条继续保留，错误与重连使用现有语义色而不是朱砂品牌色。

字体由 npm 资产自托管，离线仍可使用；缺失时回退系统楷体 / 黑体。正文最小可读字号为
12px，关键教学正文为 16px 左右，弱信息通过颜色和位置降级，不继续压缩到 8–10px。

### 5.2 学习概览

复用 `screen-home.html` 的双区构图：

- 左侧为 Roadmap Hero 与“继续学习”纸片；
- 右侧为 Plan 序列与 Lesson 进度；
- “继续学习”是本页唯一强 CTA；Roadmap 讨论是清楚但克制的次入口；
- 不显示尚无真实数据来源的能力星图或掌握度；
- Plan Tree 为空时明确显示“尚未形成学习阶段”，而不是枚举目录或制造占位课程。

### 5.3 Roadmap / Plan 工作区

复用 `screen-plan.html` 的三纸比例、树节点、对话排版、细线分组和后台活动节奏：

- Roadmap 标题强调长期方向，Plan 标题强调当前阶段目标；
- 左树只渲染 `CourseSnapshot.tree` 已链接节点；
- Plan 进度由其直接 Lesson 子节点状态计算；
- 学生消息用轻纸色或左细线区分，老师消息保持开放排版；
- 材料检索、Reviewer 和讲义生成继续 inline 出现在对话时间线中，不能被视觉层隐藏；
- 模型工作时保留学生可见的“正在思考 / 正在查找 / 正在核验”反馈。

### 5.4 Lesson 工作区

复用 `screen-lesson.html` 的课堂本：

- 右纸显示 Block 顺序、必做 / 可选、pending / active / completed / skipped 状态；
- active Block 的 Student View 同时在中栏对话上方形成当前课堂焦点；
- Block 进度只按当前 Lesson 的 required Blocks 计算；
- prepared Lesson 显示开始按钮，active Lesson 显示结束按钮，closed Lesson 进入只读；
- 不把 Teacher Control、隐藏答案或未激活题面带进学生区域。

### 5.5 Knowledge

现有三栏结构与 Kimi 视觉天然一致，保留方法树 / 题卡 / 材料的真实数据与筛选行为，只做：

- 纸层、字体、字号、选中线和标题节奏统一；
- 搜索结果数量和当前方法保持可见；
- ID 与路径仍用等宽体；
- 不把静态方法图谱包装成学生掌握度。

### 5.6 可打印讲义

保留现有 A4 投影与打印按钮，复用 Kimi 的纸张、标题、序号、发丝线和留白：

- 屏幕态像一张置于桌面的纸，打印态去除阴影与操作栏；
- 题目、材料、反思区继续来自 Lesson Student View；
- 答题留白按 activity kind 保留现有差异；
- 页面断点优先避免标题与其正文分离；
- 公式在浏览器与打印结果中使用同一渲染链路。

## 六、统一公式渲染

### 6.1 已确认的根因

生产组件 `MarkdownView.tsx` 使用 `remark-math + rehype-katex`。当前可靠输入是
`$...$` 与 `$$...$$`。Kimi 静态原型则通过 KaTeX auto-render 显式支持 `\(...\)` 与
`$$...$$`。模型和内容文件可能输出 `$...$`、`$$...$$`、`\(...\)` 或 `\[...\]`，所以
同一段内容在原型与生产 App 中会出现不同结果。

现有测试只用 `$f(x)$` 断言出现 `katex`，没有覆盖其他分隔符、块公式、长公式、打印或
错误输入，因此没有及时发现这个差异。

### 6.2 单一入口

所有 Markdown 教学内容继续通过 `MarkdownView`，不在各页面分别调用 KaTeX。该边界接受
四种常见写法：

- `$...$`：行内；
- `$$...$$`：块级；
- `\(...\)`：行内；
- `\[...\]`：块级。

进入 `ReactMarkdown` 前，用一个有状态的轻量规范化器把后两种转换为前两种。规范化器
必须跳过 fenced code、inline code 和已经是 dollar math 的区段，不能用跨全文的贪婪
正则替换。持久化内容保持原样；规范化只发生在渲染边界。

KaTeX 显式采用非崩溃模式：单个坏公式保留可见原文或错误标记，不能让整条消息、整张
讲义或 React 页面消失。未闭合分隔符按普通文本保留。

### 6.3 字体与溢出

- 中文容器可以继承霞鹜文楷，但 `.katex` 内部字体由 KaTeX 自己控制；
- 禁止使用会覆盖 `.katex *` 的全局 `font-family` 通配选择器；
- `.katex-display` 在窄屏允许横向滚动，不把公式强行逐字符折行；
- 打印样式取消交互滚动条，并以可读缩放和页面宽度容纳代表性长公式；
- 行内公式与中文基线、行高和前后空白需要在实际消息与讲义中目测验收。

## 七、组件与文件映射

| 现有位置 | 设计改动 |
|---|---|
| `src/client/App.tsx` | 区分学习概览与 Roadmap 对话；保留加载、Session 历史、WebSocket 与 lifecycle |
| `src/client/routes.ts` | 新增 `/course/roadmap`，保持 Plan、Lesson、Knowledge 与 handout 深链接 |
| `src/client/components/AppShell.tsx` | Kimi 品牌栏、印章、主导航和连接状态 |
| `src/client/pages/CourseOverviewPage.tsx`（新） | Roadmap Hero、继续学习、Plan 序列与空态 |
| `src/client/pages/CoursePage.tsx` | 三纸工作区、路径条、节点身份和 closed Lesson 只读状态 |
| `src/client/components/CourseTree.tsx` | Kimi 树样式、真实状态与 Plan 课次进度 |
| `src/client/components/ChatPanel.tsx` | 对话排版；保留全部 inline 后台活动与等待反馈 |
| `src/client/components/ActivityDrawer.tsx` | Kimi 课堂本、required Block 进度与五态展示 |
| `src/client/pages/KnowledgePage.tsx` | 保留三栏数据结构，统一视觉 token 与响应式 |
| `src/client/pages/LessonHandoutPage.tsx` | 统一纸张、字号、分页和打印公式样式 |
| `src/client/components/MarkdownView.tsx` | 四类分隔符兼容、KaTeX 容错与单一渲染入口 |
| `src/client/math-markdown.ts`（新） | 不进入代码区段的分隔符规范化器 |
| `src/client/theme-liubai.css` | Kimi 颜色、纸层、字体、字号和间距 token；KaTeX 字体隔离 |
| `src/client/styles/*.css` | 按页面迁移 Kimi 母版，不把全部规则重新塞回一个文件 |
| `package.json` | 增加自托管霞鹜文楷 webfont 依赖 |

Kimi 静态母版中的 CDN KaTeX、硬编码示例数据和页面内脚本不进入 React 生产代码。

## 八、响应式、可访问性与失败处理

- 桌面保持三纸布局；约 1100px 以下左右栏作为可展开抽屉；约 720px 以下主内容单栏；
- 抽屉按钮保留可读的 `aria-label` / `sr-only`，树与导航继续使用语义元素；
- `prefers-reduced-motion` 下关闭页面入场、呼吸点与脉冲动画；
- 不用仅靠颜色表达 lifecycle、连接、工具和 Block 状态；
- 加载、空态、连接中、重连、节点不存在和讲义来源失效都保留明确文本；
- CSS 与路由改造不能让用户消息发送失败后丢失草稿。

## 九、验收

### 9.1 功能回归

- `/course`、`/course/roadmap`、Plan、Lesson、Knowledge 和 handout 可直接打开与刷新；
- Roadmap / Plan / Lesson 的 Session key、历史和 lifecycle 行为不变；
- 空 Plan Tree 不读取或展示目录中的孤立 Lesson；
- Chat 中材料检索、Reviewer、讲义和普通工具活动仍可见；
- prepared / active / completed / closed 状态对应正确按钮与只读行为；
- handout 只包含服务端允许的 Student View 内容。

### 9.2 公式矩阵

以下内容至少在 Chat、当前课堂 Student View 和 handout 三个表面验证：

| 类型 | 样例 |
|---|---|
| dollar 行内 | `$f(x)=x^2+a$` |
| TeX 行内 | `\(te^t\)` |
| dollar 块级 | `$$\frac{x^2-1}{x-1}=x+1$$` |
| TeX 块级 | `\[K_{sp}=[M^{n+}]^m[A^{m-}]^n\]` |
| 中文混排 | 公式前后有中文、标点和多个行内公式 |
| 长公式 | 375px 视口不截断页面，公式区域可查看完整内容 |
| 错误输入 | 未闭合或非法命令不导致整条消息 / 页面崩溃 |

另做一次浏览器打印预览，确认块公式不被裁切，KaTeX 字体没有被文楷覆盖。

### 9.3 视觉与工程验收

- 以 Kimi 四张原型屏为母版，在桌面宽度逐页截图对照；
- 额外检查 Knowledge、Roadmap 对话与 handout；
- 375px 窄屏无页面级横向溢出，长公式除外且只在自身容器滚动；
- 全站关键正文可读，无 8–10px 的教学信息；
- 霞鹜文楷离线加载，KaTeX 字体保持正确；
- `bun run check` 与 Playwright E2E 全绿；
- 新增路由、概览继续规则和公式规范化器均有行为测试。

## 十、实施切片

1. 固化 Kimi token、字体与基础视觉零件；
2. 实现 `/course` 概览与 `/course/roadmap` 路由拆分；
3. 移植 Roadmap / Plan / Lesson 三纸工作区；
4. 润色 Knowledge 与 handout；
5. 完成公式规范化、KaTeX 隔离与公式矩阵测试；
6. 做桌面、窄屏、打印和真实本地数据的浏览器验收。

每个切片都先保住现有行为测试，再做截图对照。视觉还原与业务回归同等属于完成条件。

## 十一、范围外

- M1 学生长期记忆、个性化、能力证据聚合和跨 Plan 认知流变；
- 新的课程、题卡或 Lesson 数据契约；
- 服务端生成 PDF / DOCX；
- 暗色模式；
- 把 Kimi 原型中的 mock 能力星图或旧 Replay 数据硬接进当前产品；
- 为公式渲染修改教学内容或要求模型永远只输出一种分隔符。
