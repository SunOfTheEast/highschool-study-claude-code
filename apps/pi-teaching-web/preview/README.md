# 前端原型页 · 留白新中式 v2（已定案）

本目录是 Pi 教学前端 redesign 的**视觉基准原型**：静态 HTML、零构建、双击即开。

**实现请以设计稿为准**：`docs/superpowers/specs/2026-08-04-pi-teaching-web-liubai-v2-design.md`（含 token 全表、页面规格、契约方案、文件级实现映射、分阶段落地与验收）。本目录负责呈现「看起来是什么样」。

## 打开方式

双击 `index.html`（无需构建、无需启动应用）。字体（霞鹜文楷，分包按需）与 KaTeX 公式渲染走 CDN，需要网络；无网络时回退系统楷体/黑体、公式显示 LaTeX 源码，布局仍然成立。正式实现改为 npm 依赖自托管（设计稿 §4），不依赖运行时 CDN。

## 页面 ↔ 真实视图

| 文件 | 对应真实视图 |
|---|---|
| `screen-home.html` | `/` 学习集首页（`LearningSetHome`） |
| `screen-plan.html` | `/plan/:planId` Coach 工作区 |
| `screen-lesson.html` | `/plan/:planId/lesson/:lessonId` Tutor 课堂 |
| `screen-replay.html` | 同上 URL 的 closed Lesson 回放视图 |
| `tokens.html` | 设计系统对照（色板 / 字号阶梯 / 间距 / 纸层 / 品牌章 A·B 记录） |
| `fonts.html` | 字体候选对照记录（定案：全站霞鹜文楷） |
| `styles/liubai-preview.css` | 全部样式；token 名与 `src/client/theme-liubai.css` 一致，新增 token 有注释 |

## 已定案决策（2026-08-04）

- **品牌章 B · 限量朱砂**：`--seal #9e4f3d`，仅品牌章与「继续学习」印章两处，永不靠近状态/错误/教学语义。主题规格 §3 已修订。
- **全站统一霞鹜文楷**：标题、长文、题面、对话正文同体；等宽只留给 Session ID、题卡别名、时间戳。文楷单字重，禁止合成假粗体 —— `<strong>` 用 `--accent-deep` 颜色强调（原型已按此渲染）。主题规格 §4 已修订。

## Mock 内容声明（与真实学习集的关系）

内容锚定 `examples/derivative-demo/learning-set/`，有意的偏差仅为演示界面状态：

- **Lesson 003 显示为「上课中」**：真实状态是 `prepared`（等待开始）；
- **题面为示意重建**：`Q-DOMAIN-EX22`（别名真实，指向 `mst_p0032_ex22.card.yaml`）的题干与选项是按其类型重写的示意内容，不是原卡文字；
- **「下一学习周期 · 待商定」**：真实 ROADMAP 目前只有 1 个 Plan，该行演示「一次只批准并物化一个 Plan」的界面语义；
- **时间、日期、事件计数**为示意。

其余（Plan 目标、三节课标题与状态、能力节点与证据数、复盘措辞、块结构、卡片别名）均来自真实文件。

## 目标态清单（当前契约没有的数据）

| 元素 | 落地路径 |
|---|---|
| 「继续学习」入口 | 不改契约：前端 localStorage 记住最近 planId/lessonId（设计稿 §7.2） |
| 首页 Plan 行内进度 | 先用最近工作区快照缓存推算；契约扩展 `PlanSummary.progress` 列为后续（§7.3） |
| 首页能力星图摘要 | 同上，契约扩展列为后续（§7.3） |

其余所有新元素（面包屑、Plan 页进度、课堂本 Block 进度、树状态、能力节点）现有契约数据已足够。

## 范围声明

不假装可交互（除悬停与页面链接外无行为）；无路由/状态/动画 JS；无 npm 依赖；无图片资源（印章、手写图均为 CSS/SVG/文字占位）；不改 `src/`、`vite.config.ts`、`tests/`；本目录对应用构建与测试完全惰性。暗色模式、移动端专页、空态专页、回放拖拽、ErrorBoundary 等均不在本期（设计稿 §11）。

## v3 草稿：m1b/c 新屏（2026-08-09 · 待评审）

自由学习闭环（M1b）与语义收敛（M1c）带来的八个页面，纳入留白体系。**同材异形**：材料（tokens / 字号阶梯 / 发丝线 / 五金件）严格共享，构图各屏签名。

| 文件 | 对应真实视图 | 签名 |
|---|---|---|
| `screen-portal.html` | `/` HomePage | 玄关 |
| `screen-talk.html` | `/learn/:id` FreeLearningPage 与 `/meta/:id` MetaPage（一屏双态） | 信纸 |
| `screen-assets.html` | `/assets` AssetsPage | 架 |
| `screen-note.html` | `/assets/notes/:id` NotePage | 笺 |
| `screen-problem.html` | `/assets/problem-cards/:id` ProblemCardPage | 卷 |
| `screen-material.html` | `/assets/materials/:id` MaterialPage | 文献 |
| `screen-footprint.html` | `/footprint` FootprintPage | 账簿 |

新屏带生产 chrome（3px 墨线 + 品牌章 + 主导航 + 连接态，对应 AppShell）。它晚于 v2 四屏，故旧屏没有 —— 不是遗漏。

**v3 新增纪律（待拍板确认后写入主题规格）**：

- 朱砂用法扩为**三处**：品牌章、「继续学习」章、「问老师」主卡章；「永不靠近状态/错误/教学语义」不变；
- **实心黛青按钮**为全站唯一实心按钮，仅限「问老师」动词（题卡页脚 / 资料页 / 资产页头）；
- 全站 hover **禁止浮起位移与投影**，只变色（修掉 v2 前入口卡与 overview-continue 的 translateY）；
- 新屏页头一律发丝线（不用 1px 墨线）；近白面统一 `#fff`（淘汰 `#fffefb`）；H1 收回阶梯（hero ≤56px / h1 32px）。

**Mock 内容声明**：叙事锚定 `2026-08-08-studyforge-m1b-north-star-architecture-design.md` §六的林然化学 Ksp 学习集（空白集，无正式课程）。有意的演示态：资产页「Ksp 与固体活度」选中态（洗色行 + 页头计数）；Note 回忆块答案折叠态；题卡答案门未开态；时间日期为示意。各屏变体（已结束线程 / 携带资产行 / 标准答案展开 / 编辑态 / 空态）以各页内 target-note 声明为准，不单独出图。

**v3 自检清单**：

1. 朱砂全站只出现在三处；「问老师」实心黛青之外无第二个实心按钮；
2. 新屏无浮起、无投影、无 <11px 文字、无阶梯外 H1；
3. 信纸与课程工作区的聊天表面同语言（发丝线消息流 + 2px 墨线输入区）；
4. 账簿分类点四色可辨：对话灰 / 资产空心 / 作答暗金 / 认知变化黛青；
5. 收窄 760px 无横向溢出；`prefers-reduced-motion` 动画归零；
6. v2 四屏与 tokens 页既有内容未被改动（v3 均为追加）。

## 自检清单

1. DevTools → Network 确认 LXGW WenKai 真实加载（只下载实际用到的分片）；无网时系统回退成立；
2. 首页「继续学习」一眼可见，且是全页唯一强 CTA；朱砂只出现在品牌与继续学习两处；
3. Plan 进度 2/3 在首页、面包屑、会话树三处一致；课堂页课堂本「必做 1/4」、进行中 Block 有黛青左脊；
4. 三个工作区页面面包屑路径一致；全站无 <11px 文字；聊天正文 16px/1.8；题卡公式 KaTeX 正常渲染；
5. `<strong>` 为黛青颜色强调，无合成粗体；
6. 三栏纸色层次（深/中/浅）成立，无浮卡重阴影；窗口收窄到 760px 无横向溢出；`prefers-reduced-motion` 下动画归零；
7. `bun run check` 与 `bun run dev` 不受影响。
