# Pi 教学前端「留白新中式」视觉设计

状态：已确认  
日期：2026-07-22

## 1. 目标

在不改变 Pi 教学前端的信息架构、Agent 边界、教学协议和学习事实来源的前提下，把现有 Coach、Tutor、Replay 三块界面统一为“留白新中式”主主题。

这次改造解决的是视觉层级和长期阅读舒适度，不重做产品结构。现有三栏工作区、Coach 父 Session、Lesson Tutor 子 Session、课堂本、任务轨道、能力证据和回放入口全部保留。

## 2. 视觉来源

主题取自早期 OpenCode StudyForge 分支 `codex/studyforge-theme-liubai-xinzhongshi` 的设计语言。最终选择经过三组真实分支对照和 Coach/Tutor/Replay 三屏原型确认。

主题的核心不是堆叠传统纹样，而是以下五点：

1. 暖白纸面承载长时间阅读；
2. 近黑暖墨建立标题和主结构；
3. 单一低饱和黛青负责导航、链接和当前状态；
4. 弱金与砖红只承担学习中、提醒和错误等少量语义；
5. 使用发丝线、字体节奏和负空间区分层级，不依赖浮卡、玻璃拟态或重阴影。

## 3. 固定色板

| Token | 值 | 用途 |
|---|---:|---|
| `--paper` | `#faf7f1` | 主阅读面、聊天区、弹层 |
| `--paper-deep` | `#f1ece1` | 左右栏和轻微嵌套区域 |
| `--ink` | `#1b1916` | 正文、标题、主要分界 |
| `--ink-soft` | `#4a463d` | 次要正文 |
| `--ink-faint` | `#9a917f` | 标签、说明和时间信息 |
| `--accent` | `#3f5b54` | 当前状态、主链接、结构标记 |
| `--accent-deep` | `#314a44` | Hover 与高对比强调 |
| `--accent-wash` | `rgba(63, 91, 84, 0.07)` | 当前行的极浅底色 |
| `--attention` | `#b6a06a` | 学习中、可选和待确认状态 |
| `--danger` | `#a8674f` | 错误、需复习和破坏性提醒 |
| `--rule` | `rgba(27, 25, 22, 0.09)` | 普通发丝线 |
| `--rule-soft` | `rgba(27, 25, 22, 0.06)` | 次级分隔线 |

不加入页面级渐变、仿纸颗粒、朱砂印章和装饰性远山。主题应保持轻、平、安静。

## 4. 字体与密度

界面采用双层字体策略：

- 课程标题、问题标题、Teacher/Tutor 引导语和较短的叙述使用 `"LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", ui-serif, serif`；
- 长正文、按钮、表单和状态说明使用 `Inter, "Noto Sans SC", "PingFang SC", sans-serif`；
- Session ID、题卡别名、Trace 来源和工作流预算继续使用 `ui-monospace, monospace`。

楷体用于建立节奏，不覆盖所有正文。聊天消息和题目正文必须保持适合连续阅读的字号与行高。

## 5. 三块界面的共同骨架

桌面端继续使用三栏：

```text
Plan / Session 索引 | 当前 Coach 或 Tutor 内容 | 能力证据或课堂本
```

- 三栏之间使用 `--rule` 发丝线，不使用投影；
- 左栏使用 `--paper-deep`，中栏使用 `--paper`，右栏使用两者之间的轻微明度差；
- 顶部使用一条近黑细线固定整个工作区，不增加深色导航条；
- 当前 Session 使用黛青左脊和极淡 wash，不使用实心胶囊；
- 页面只保留一个强行动入口，其他动作表现为文字或下划线按钮。

## 6. Coach

Coach 保持“计划簿”语义：

- 左栏继续显示 Plan、Coach 根节点和 Lesson 索引；
- 中栏仍是对话，不另造 dashboard；
- 备课建议、上节复盘和工作流结果使用上下发丝线组织，而不是独立悬浮卡片；
- 右栏能力证据用黛青表示可靠证据，弱金表示仍在观察，砖红表示值得注意；
- 备课按钮是当前页唯一允许使用实心或高对比样式的操作。

## 7. Tutor

Tutor 保持“答题纸”语义：

- 当前问题和学生首答是视觉中心；
- 课堂本的 active ActivityBlock 使用黛青左脊和极淡 wash；
- 题卡继续显示真实别名，但不把 Teacher Control 或答案性内容带入学生视图；
- 一级提示、草稿纸、暂停等操作保持安静，不与“提交答案”争夺视觉注意力；
- 学生消息使用两像素黛青左线，不使用聊天气泡瀑布；
- Persona 头像可以保留自身小范围颜色，但不得重染整个界面的结构色。

## 8. Replay

Replay 保持“批注档案”语义：

- RouteMap 与 ReplayTimeline 继续来自真实 Lesson、Trace 和 Pi Session；
- 时间轴使用发丝线和小圆点，不使用统计仪表盘；
- Trace 和 route-change 使用黛青，缺失或失败使用砖红；
- 证据透镜沿用纸面侧页效果，只保留必要的轻阴影用于说明它覆盖在原页面之上；
- 不增加第二份事件日志，也不为了视觉完整伪造缺失聊天内容。

## 9. Persona 边界

人设继续控制头像文字、局部头像底色和轻量阶段动效。主题基础色、能力状态色、错误色、Trace 含义和教学内容不随 Persona 改变。

`neutral-tutor`、`calm-senpai` 和 `energetic-classmate` 可以拥有不同的 `--persona-accent`，但这个 token 只能用于头像、称呼或极小面积装饰，不能替代 `--accent`。

## 10. 动效

只保留四类短动效：

- 页面首次展开；
- 新消息出现；
- 当前 ActivityBlock 或工作流任务状态变化；
- 证据透镜进入和退出。

动效时长保持在 160–320ms。等待状态可以使用低幅呼吸，不使用持续漂浮、发光或大面积背景动画。`prefers-reduced-motion` 继续完全生效。

## 11. 响应式与可访问性

- `>1100px`：三栏；
- `761–1100px`：Session 树与主内容两栏，右栏排到主内容下方；
- `<=760px`：单栏，Lesson 索引横向滚动；
- 交互元素继续保留清晰的 `:focus-visible`；
- 小字号标签不得成为承载关键教学内容的唯一位置；
- 颜色不是状态的唯一表达，现有状态文字和 `data-status` 继续保留。

## 12. 实现边界

本次是 CSS-first 改造：

- 修改 `apps/pi-teaching-web/src/client/styles.css` 的 token 和现有组件样式；
- 在 `App.tsx` 与 `LearningSetHome.tsx` 增加稳定的 `data-theme` / `data-view` 标识，供样式和自动化检查使用；
- 补充 Playwright 对主题 token、Coach/Tutor 视图切换和响应式布局的检查；
- 不新增依赖、不增加主题设置页、不改变服务端 DTO、不修改 Pi Session、Lesson、Trace 或题卡协议。

## 13. 验收标准

1. 首页、Coach、Tutor、Replay 和证据透镜使用同一组固定主题 token；
2. 页面不存在旧的橙色主强调色或 Persona 重染全局强调色；
3. Coach、Tutor、Replay 的内容结构和所有既有交互保持可用；
4. 桌面、窄桌面和移动端没有横向页面溢出；
5. `prefers-reduced-motion`、键盘焦点和状态文字仍然有效；
6. `bun run check` 与 Playwright 前端 smoke 全部通过；
7. 人设切换只改变局部 Persona 表现，不改变教学事实或状态颜色。
