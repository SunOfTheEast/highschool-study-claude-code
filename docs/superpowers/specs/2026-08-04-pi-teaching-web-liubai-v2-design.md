# Pi 教学前端「留白新中式 v2」设计稿

- 日期：2026-08-04
- 状态：已定案，待实现
- 视觉基准（原型页）：`apps/pi-teaching-web/preview/`（双击 `index.html` 即可查看，零构建）
- 与既有文档的关系：本文档扩展 `2026-07-21-pi-teaching-web-frontend-design.md` 的页面结构，并取代 `2026-07-22-pi-teaching-web-liubai-theme-design.md` 中被两条 2026-08-04 修订覆盖的部分（限量朱砂、字体策略）。未提及的部分 —— 事件投影与 safe 模式、防剧透边界、URL 恢复、失败处理、人设系统 —— 继续以 07-21 / 07-22 两份文档为准。

## 1. 背景与目标

现行前端在视觉质感、学习动线、进度可见性三个方面被认为「差了点什么」（交互反馈不在本次范围）。审计结论：

1. **视觉质感**：主题规格写了字体策略但从未加载任何 webfont，楷体全靠系统回退；字号从 `.55rem`(8.8px) 到 `6.8rem` 全部 ad-hoc，无阶梯；无 favicon 与品牌印记。
2. **学习动线**：07-21 设计的首页「继续学习」入口与能力星图摘要从未实现；无面包屑，学生在 Roadmap → Plan → Lesson 层级中不知自己在哪里。
3. **进度可见性**：全站无 Plan 级进度、无 Lesson 内 Block 进度；首页不呈现任何学习状态。

本设计稿以 `preview/` 原型页为视觉基准修复上述三点。原型页已锚定真实学习集内容（`examples/derivative-demo`）评审通过。

## 2. 已定案决策

| 决策 | 内容 | 规格修订 |
|---|---|---|
| 品牌章 | **B · 限量朱砂**：新增 `--seal #9e4f3d`，仅用于品牌章与「继续学习」印章两处；永不出现在状态、错误、教学语义附近（与 `--danger` 砖红 `#a8674f` 不同色、不并排） | 已写入 07-22 主题规格 §3 修订 |
| 字体 | **全站统一霞鹜文楷**：标题、长文、题面、对话正文同体；等宽字体只用于 Session ID、题卡别名、时间戳等零件 | 已写入 07-22 主题规格 §4 修订 |
| 纸层 | 新增 `--paper-mid #f6f1e7`，三栏 = 三张纸（左 deep / 中 paper / 右 mid） | 本文档 §3 |
| 字号 | 11 级阶梯，**全站不出现小于 11px 的文字**；次要性靠 `--ink-faint` 颜色而非缩小字号 | 本文档 §3 |

## 3. 设计 Token

### 3.1 颜色（写入 `theme-liubai.css`，既有 token 不动名不动值）

新增两个：

| token | 值 | 用途 |
|---|---|---|
| `--paper-mid` | `#f6f1e7` | 右栏纸层 |
| `--seal` | `#9e4f3d` | 朱砂印章（仅品牌章与继续学习） |
| `--seal-deep` | `#8a4132` | 印章 hover |

### 3.2 字体

```css
--font-ui: "LXGW WenKai Screen", "LXGW WenKai", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-display: "LXGW WenKai Screen", "LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", ui-serif, serif;
--font-reading: "LXGW WenKai Screen", "LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", ui-serif, serif;
--font-mono: "SF Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
```

- 三个字体 token 第一优先全部是霞鹜文楷 —— 这是定案的核心：全站一个声部。
- **文楷只有一个字重**：保留全局 `font-synthesis: none`，禁止浏览器合成假粗体（发虚）。`<strong>` / `<b>` 渲染规则改为颜色强调：

```css
strong, b { font-weight: inherit; color: var(--accent-deep); }
```

- 回退语义：断网或字体缺失时，UI 落系统黑体、标题/长文落系统楷体，布局不依赖字体成立。

### 3.3 字号阶梯（根 16px，替换 styles.css 全部 ad-hoc 值）

| token | 值 | 用途 |
|---|---|---|
| `--text-micro` | 11px | 仅等宽元数据：session id、时间戳、题卡别名；不得承载关键内容 |
| `--text-label` | 12px | 状态小字、标签 |
| `--text-meta` | 13px | 树次要行、消息角色 |
| `--text-body-sm` | 14px | 按钮、输入、树节点主文字、活动行标题 |
| `--text-body` | 16px | 聊天正文基准 |
| `--text-lead` | 18px | 首页 overview、题面首段 |
| `--text-h3` | 20px | 题卡标题、继续学习主行 |
| `--text-h2` | 24px | 面板标题 |
| `--text-h1` | 32px | 页面标题 |
| hero | `clamp(40px, 5.6vw, 56px)` | 首页 H1 |

行高：正文 1.75–1.85；楷体标题 1.15–1.3。**清理目标**：styles.css 现存的 `.52rem`–`.67rem` 小字号（工作流预算、replay code、任务角色等）全部提升到阶梯内。

### 3.4 间距（九档）

`--space-1: 4px` → `--space-9: 96px`（4/8/12/16/24/32/48/64/96）。组件内距只用这些值。

## 4. 字体加载（实现方式）

- **以 npm 依赖自托管，不依赖运行时 CDN**：`bun add lxgw-wenkai-screen-webfont`，在 `src/client/main.tsx` 顶部 `import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css'`（先于本地样式）。该包按 unicode-range 分包，浏览器只下载实际用到的分片；vite 会把分片作为静态资产发出。
- 本应用是本地优先（127.0.0.1），离线必须可用 —— 这是选自托管而非 CDN 的原因。原型页用 CDN 仅为免构建。
- KaTeX 字体现状不变（已是 npm 依赖）。
- 构建产物体积会增大（文楷分包总量约十余 MB），本地应用可接受；在 README 补一句说明。

## 5. 共同骨架与组件

1. **顶部墨线**：工作区页面顶端 3px `--ink` 实线（现状保留）。
2. **面包屑条**（新组件，三个工作区页面共用）：高 44px，`--paper` 底、下缘发丝线。左侧 `路线图 › {Plan 名} › {Coach | Lesson 00X · 标题}`，楷体 14px，分隔符 `›` 用 `--ink-faint`；当前段 `--ink`，可点击段 hover 变 `--accent-deep`。右侧槽位：Plan 页放 Plan 进度，Lesson 页放「上课中」状态点，回放页放「已完成 · 只读」。
3. **三层纸**：左栏 `--paper-deep` / 中栏 `--paper` / 右栏 `--paper-mid`。不新增浮卡与投影（证据透镜既有左侧投影除外）。
4. **发丝线进度条**（新组件）：轨道 2px `--rule`，填充 `--accent`，右端等宽数字（`--text-micro`）。三种用法见 §6。
5. **状态点**：7px 圆点；`较稳`黛青实心 / `观察中`暗金实心 / `待观察`灰描边空心 / `上课中`黛青 + `breathe` 呼吸动画（`prefers-reduced-motion` 下静止）。
6. **印章组件**（新）：正方形圆角 3–4px，`--seal` 底、`--paper` 字、内描边 `rgba(250,247,241,.5)`，楷体单字。三个尺寸：30/36/44px。用法铁律见 §2 —— 全站仅两处：品牌章（左栏品牌行、首页品牌区、favicon）与「继续学习」的「继」字章。
7. **favicon**：内联 SVG data-URI，朱砂方章 + 纸色「学」字（原型页每页 `<link rel="icon">` 即实现，可直接抄）。
8. **消息强调**：见 §3.2，`<strong>` 用 `--accent-deep` 颜色，不加粗。

## 6. 页面规格

### 6.1 学习集首页（原型：`screen-home.html`）

现状：sticky 大标题 + Plan 列表。改为左右两区（`minmax(0,1.04fr) / minmax(340px,.96fr)`，≤1100px 单栏）：

- **顶部品牌行**（新）：朱砂「学」章 + 「StudyForge / 高中数学 · 本地学习集」字标，下缘发丝线。
- **左 · Hero**：eyebrow 标签「学习路线 · ROADMAP」→ 楷体 H1（学习集标题）→ `--font-reading` 18px/1.85 概述（现状 overview 渲染保留，改字号阶梯）。
- **左 · 「继续学习」卡片**（新，全页唯一强 CTA）：白底、1px 发丝线边框、**左侧 3px 黛青脊 + 底部 2px 墨线**；内容三行 —— 状态行「上次学到 · {日期} · {Lesson 状态}」(12px faint) / 主行「继续学习 · {Lesson 短标题}」(楷体 20px) / 副行「{Plan 名} · 已完成 x/y 节」(13px soft)；右侧 36px 朱砂「继」章。整块 `<a>`，href 为上次学习位置（§7.2）。
- **右 · 学习周期列表**：每 Plan 一行（上/下发丝线分隔）：等宽序号 + 楷体标题 + 状态（含状态点）+ 一句目标 + 发丝线进度条「x/y 节」。**没有第二个已批准 Plan 时，显示「待商定」占位行**（62% 不透明度）：「下一学习周期 · 待商定 —— Lesson 00X 复盘后，与 Coach 依据课堂证据商定方向」。一次只物化一个 Plan，占位行不是真实 Plan 数据。
- **右 · 能力星图摘要**（新）：方法节点行（状态点 + 方法名 + 状态字 + 等宽证据数），底部一行说明「未校准的备课信号，非掌握度断言」。数据方案见 §7.3。
- **页脚**：「519 张题卡 · 本地学习集」等一行灰字。

### 6.2 Coach 工作区（原型：`screen-plan.html`）

三栏骨架不变，改动：

- **面包屑条**：`路线图 › {Plan 名} › Coach`，右端 Plan 进度条「x/y 节」（与左栏树上下文中的一致）。
- **会话树**：Plan 名下加同款进度条；节点主文字提升到 14px、状态小字 12px；Coach 节点用楷体。其余现状保留（左脊选中态、状态色）。
- **聊天区**：消息正文 16px/1.8；学生消息保持 2px 黛青左线 + wash 底；`<strong>` 按 §3.2 颜色强调。
- **工作流轨道**：任务行字号提升到 13–14px（消灭现状 `.55rem` 预算小字），状态字形色不变。
- **右栏能力星图**：节点行同 §6.1 摘要样式；保留「点击节点由证据透镜回到原题 Trace」。

### 6.3 Tutor 课堂（原型：`screen-lesson.html`）

- **面包屑条**：`路线图 › {Plan 名} › Lesson 00X · {标题}`，右端「上课中」呼吸状态点。
- **右栏课堂本**：头部加 **Block 进度**（发丝线条 + 「必做 x/y」，口径 = Required Block 数）。块行五态：已完成（灰字）/ 进行中（黛青左脊 + wash 底 + 呼吸点）/ 待进行 / 已跳过 / 可选块（`可选` 描边胶囊）。当前展开块下方渲染题卡：白底卡片、等宽别名行（`Q-DOMAIN-EX22 · mst_p0032_ex22`）、`--font-reading` 题干、双列选项（≤760px 单列）。
- **课堂路线**（右栏下方，保留现状 RouteMap 数据）：初始/实际两行，跳过项删除线 + 暗金说明。
- 聊天区与 §6.2 同款。composer 保持墨线顶边。

### 6.4 课后回放（原型：`screen-replay.html`）

- 面包屑右端「已完成 · 只读」。
- **时间轴**：1px 发丝线竖轴 + 7px 分类圆点（对话灰 / 证据黛青 / 路线暗金 / 图片灰描边空心）；时间戳等宽 11px。现状 ReplayTimeline 数据不变，按此换样式。
- **右栏**：路线对比同 §6.3；「证据变化」列出本课产生的 Trace 节点（达成 / 待观察 + 证据计数），底部一行「『完成一节课』不等于『达标』」。

### 6.5 响应式与动效

- 断点沿用 1100px / 760px：≤1100px 右栏移到中栏下方；≤760px 单栏、树内 Lesson 节点横向滚动、消息角色行转置顶。
- 动效：`page-in` / `message-in` / `breathe` 保持 160–320ms；`prefers-reduced-motion` 全局归零（现状写法保留）。

## 7. 数据与契约

### 7.1 现有契约已足够（直接落地）

面包屑全部字段（`learningSet.title` / `plan.title` / `lesson.title` / `block.title`）、Plan 页进度（`PlanWorkspaceSnapshot.lessons[].status` 计数）、课堂本 Block 进度（`StudentNotebook.lesson.blocks[].status` + `required` 计数）、树状态、能力节点（`AbilityProjection`）。

### 7.2 「继续学习」入口（localStorage，不改契约）

前端在每次路由变化时把 `{ planId, lessonId?, updatedAt }` 写入 localStorage；首页读取渲染卡片。无记录时回退：第一个 active Plan 的下一节 prepared Lesson；都没有则不渲染卡片。恢复 URL 语义沿用 07-22「URL 不保存模型生成内容」。

### 7.3 首页 Plan 进度与能力摘要（先推算，契约扩展列为后续）

- 近期方案：首页仅对「最近打开的 Plan」显示进度与能力摘要，数据来源是该 Plan 工作区快照的本地缓存（localStorage 或内存缓存，标注「目标态」样式不要求）。
- 后续契约扩展（另立小设计）：`LearningSetSnapshot.plans[]` 增加 `progress: { closed: number; total: number }`；首页快照增加能力投影摘要。**本次实现不许为此改后端**。

### 7.4 不变的边界

学生 API 只返回 Student View 的防剧透边界、`safe` 消息投影、`data-theme` / `data-view` / `data-persona` 语义钩子，全部不变。

## 8. 实现映射（文件级）

| 文件 | 改动 |
|---|---|
| `src/client/theme-liubai.css` | 新增 `--paper-mid` / `--seal` / `--seal-deep` / 字号阶梯 / 间距阶梯；三个字体 token 换文楷栈 |
| `src/client/main.tsx` | 顶部 import 文楷 CSS（§4） |
| `index.html` | favicon data-URI（朱砂「学」章，原型页可抄） |
| `src/client/styles.css` | 全面替换 ad-hoc 字号为阶梯（消灭 <11px）；三栏纸色改 `--paper-mid`；新增面包屑条 / 进度条 / 状态点 / 印章 / 继续学习卡片样式；`strong` 颜色强调 |
| `src/client/App.tsx` | 工作区三页挂面包屑条组件；首页继续学习数据（localStorage） |
| `src/client/components/BreadcrumbBar.tsx`（新） | §5.2 |
| `src/client/components/SealMark.tsx`（新） | §5.6 |
| `src/client/components/ProgressLine.tsx`（新） | §5.4 |
| `src/client/components/LearningSetHome.tsx` | §6.1 整页（Hero / 继续学习 / Plan 行 + 待商定占位 / 能力摘要 / 页脚） |
| `src/client/components/SessionTree.tsx` | 字号阶梯 + Plan 进度条 |
| `src/client/components/ChatPanel.tsx` | 消息字号行高；`strong` 样式确认 |
| `src/client/components/TaskRail.tsx` | 字号提升到 ≥12px |
| `src/client/components/LessonNotebook.tsx` | 头部 Block 进度；块行五态样式 |
| `src/client/components/StudentCard.tsx` | 白底卡片 + 字号阶梯 |
| `src/client/components/AbilityMap.tsx` | 节点行样式（状态点 / 状态字 / 等宽证据数） |
| `src/client/components/ReplayTimeline.tsx` | 发丝线竖轴 + 分类圆点样式 |
| `src/client/components/RouteMap.tsx` | 删除线跳过样式 |
| `src/client/components/ActivityDrawer.tsx` | **删除**（死代码，全仓库无引用） |
| `tests/client/liubai-theme.test.ts` | 同步断言：`--seal` / `--paper-mid` token 值、字体栈含 LXGW WenKai、文楷 import 先于本地样式、无 <11px 字号 |
| `package.json` | 新增依赖 `lxgw-wenkai-screen-webfont` |

## 9. 分阶段落地顺序

1. **阶段 1（纯视觉）**：token + 字体加载 + 字号阶梯清理 + 三层纸 + 面包屑条 + 印章/favicon + 会话树与聊天样式。数据全部已有。
2. **阶段 2（动线与进度）**：继续学习卡片（localStorage）+ Plan 进度（工作区页）+ 课堂本 Block 进度 + 首页待商定占位 + 回放时间轴样式。
3. **阶段 3（目标态）**：首页 Plan 进度与能力摘要的缓存推算版；契约扩展后切换为真实数据（另立设计）。

## 10. 验收

1. 对照原型页逐屏走查：首页 / Coach / 课堂 / 回放与 `preview/` 四屏一致（允许数据不同，不允许布局与字号偏差）。
2. DevTools 确认 LXGW WenKai 真实加载（Network 中只下载实际用到的分片）；断网回退成立。
3. 全站无 <11px 文字（grep styles.css 与组件内联样式）。
4. 朱砂只出现在品牌章与继续学习两处；`--danger` 场景（错误条）无朱砂。
5. `<strong>` 为黛青颜色强调，无合成粗体（`font-synthesis: none` 生效）。
6. 「继续学习」为首页唯一强 CTA；点击恢复到上次学习位置（URL 语义不变）。
7. Plan 进度在首页（阶段 3）、面包屑、会话树三处口径一致；课堂本 Block 进度 = Required 口径。
8. 收窄 760px 无横向溢出；`prefers-reduced-motion` 动画归零。
9. `bun run check`（typecheck + test + build）与 Playwright e2e 全绿；防剧透断言（开课前无题卡、仅 active Block 可见）不受影响。

## 11. 范围外（本期不做）

暗色模式；移动端专页（仅响应式收窄）；空态专页与课前门槛页重设计（现状已可用）；回放时间轴拖拽交互；ErrorBoundary / toast / 骨架屏；composer 发送事务与 Markdown GFM（属 `2026-07-23-three-real-lessons-optimization.md` 的既有 P1，不在本视觉稿内）；首页契约扩展的后端实现（§7.3 另立设计）。

## 12. 附录：原型页

`apps/pi-teaching-web/preview/`：

| 文件 | 对应真实视图 |
|---|---|
| `screen-home.html` | `/` 学习集首页（`LearningSetHome`） |
| `screen-plan.html` | `/plan/:planId` Coach 工作区 |
| `screen-lesson.html` | `/plan/:planId/lesson/:lessonId` Tutor 课堂 |
| `screen-replay.html` | 同上 URL 的 closed Lesson 回放视图 |
| `tokens.html` | 设计系统对照（色板 / 阶梯 / 纸层 / 品牌章 A·B 记录） |
| `fonts.html` | 字体候选对照记录（定案：全文楷） |

mock 偏差声明（实现时勿当成真实数据）：Lesson 003 在原型中显示为「上课中」（真实为 prepared）；题面为示意重建；「下一学习周期 · 待商定」为占位设计；时间日期为示意。其余 Plan 目标、课次标题与状态、块结构、卡片别名、能力节点均来自 `examples/derivative-demo/learning-set/` 真实文件。
