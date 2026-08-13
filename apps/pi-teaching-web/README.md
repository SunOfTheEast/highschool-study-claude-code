# StudyForge 本地教学 App

这是仓库中唯一受支持的 StudyForge Runtime 与学生桌面 App。产品以本地 Markdown/YAML
学习集为事实源，使用原生 Pi Session 承载教师对话，并同时支持三种入口：沿 PDF 原书
学习、开放式自由学习、`Roadmap → Plan → Lesson` 正式课程。

面向学生的安装和操作说明请看：

- [在 macOS 上安装 StudyForge](resources/help/macos-installation.md)
- [第一次学习](resources/help/first-learning.md)

本文只说明开发、架构和验证。

## 快速启动

要求：

- Bun 1.3+
- Pi `@earendil-works/pi-coding-agent`
- 至少一个已配置的模型 Provider

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run build
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run start
```

打开 <http://127.0.0.1:65000>。服务默认只监听 `127.0.0.1`。

开发模式：

```bash
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run dev:server
bun run dev:client
```

Vite 默认运行在 <http://127.0.0.1:65001>，并代理本地 API 与 WebSocket。

也可以作为本地 Pi Package 安装：

```bash
pi install "$PWD"
```

随后在包含 `learning-set/` 的目录启动 Pi，运行 `/study-web`；也可以向命令传入学习集路径。

## 桌面构建

桌面端基于 Tauri 2，并把前端、StudyForge Runtime 与 Pi sidecar 一起放入 App：

```bash
bun run desktop:build
bun run desktop:verify
bun run desktop:smoke
```

当前打包目标是 Apple Silicon、macOS 13 及以上、ad-hoc 签名的 DMG。构建前需要 Rust、
Tauri 所需的 macOS 工具链和已经安装的 Bun 依赖。完整人工边界见
[macOS 发布清单](docs/desktop-release-checklist.md)。

桌面端使用独立的 App Home、Pi 配置和 Session 目录，不读取或改写普通 Pi 的配置。
学习集默认位于 `~/Documents/StudyForge/`。

## 运行结构

```text
PDF Material
├── immutable original revision
├── derived page/outline projections
└── exact page locators ───────────────┐
                                       │
Free Learning Session ──→ Note / Problem Card ──→ semantic tag sidecars
          │                            │
          └─────────────→ object memory
                                       │
Roadmap Session                        │
  └── Plan Session                     │
      └── Lesson Session ──────────────┘

calendar + asset review + focus cycle + footprint = projections and activity facts
```

核心边界：

- 原始 PDF 和被替代的 Material revision 不回写；目录、页转写和来源树是可重建投影。
- 笔记、题卡及其 revision 是学生可见资产；语义标签存放在独立 sidecar 中。
- 保存资产不等于掌握。学习判断只能引用学生真实表现，并保留认知变化的来源。
- 自由学习、Meta、Roadmap、Plan、Lesson 各自拥有独立原生 Pi Session，不复制父子 transcript。
- Runtime 负责路径、身份、生命周期和机械写入边界；Skill 负责教学判断与自然语言。
- 学生明确选择的资产和页段才进入新对话；整本书不会作为默认上下文注入。

## Source-first PDF

导入 PDF 后，系统先保存原文件并建立物理页索引。若 PDF 自带书签，则直接形成初始目录；
否则学生可以指定少量目录页，由视觉读取整理章节目次。正文同样按页渐进处理：

1. 优先使用 PDF 原生文本；
2. 原生文本不足时，使用当前配置的图像模型读取所选页面；
3. 页面转写只服务查找与讨论，原始页面始终是视觉事实源；
4. 一次自由学习最多携带受限的连续页段，避免整书污染上下文。

自动视觉选择优先复用已经连接、支持图像输入且成本较低的模型；也可以在桌面设置中明确
指定视觉模型。视觉读取是一次性 worker，不是新的 Pi Session，也不拥有学生记忆或工具。

## Learning set 契约

空白学习集只要求 `LEARNING_GUIDE.md` 与 `memory/INDEX.md`。其余目录按真实使用生长：

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md                              # 可选
├── plans/<plan-id>/
│   ├── PLAN.md
│   └── lessons/<lesson-id>.md
├── memory/
│   ├── INDEX.md
│   ├── indexes/
│   ├── objects/
│   ├── capabilities/
│   └── preferences/
├── materials/<material-id>/
│   ├── manifest.yaml
│   ├── revisions/<revision>/original.pdf
│   └── projections/<revision>/
│       ├── book-index.yaml
│       └── pages/page-0001.txt
├── notes/*.note.yaml
├── cards/m1b/*.card.yaml
├── semantics/assets/<kind>/<asset-id>.tags.yaml
└── activity/
    ├── problem-attempts/
    └── asset-reviews/
```

旧完整题卡、旧静态 `graph/` 和旧 loose Material 仍可读取，但不会被猜测性升级成新 revision
或自动加入复习。来源引用必须固定到精确资产 revision，或精确 Material revision 与 locator。

### 课程文档

- Roadmap 长期有效，拥有长期目标、可观察标准、直接检验、Plan Tree 和当前位置。
- Plan 状态为 `prepared → active → completed`，拥有阶段目标、Lesson Tree 和下一课安排。
- Lesson 状态为 `prepared → active → closed`，拥有一个或多个 Block。
- Lesson ID 只需在所属 Plan 内唯一；Session key 为 `lesson:<plan-id>:<lesson-id>`。
- 父文档不缓存子状态，旧课堂 Log 和对象 Learning History 不回写。

一个 Lesson Block 的最小结构：

```markdown
## Block block-001：活动名称

### Node State

- Kind: dialogue | problem | material | reflection
- Required: true | false
- Status: pending | active | completed | skipped
- Depends on:
- Uses:

### Student View

学生当前可以看到的内容。

### Teacher Control

备课说明；普通课堂面板不展示。

### Classroom Log

- 课堂中真实发生的一条记录。
```

## Session 与 Agent 所有权

- **Free Learning Tutor**：开放讨论、按需诊断、经学生确认保存资产，并在真实认知变化时更新对象记忆。
- **Meta**：只讨论是否需要长期路径；学生确认完整 Roadmap 方案后才创建 `ROADMAP.md`。
- **Roadmap**：长期方向、诊断和未来 Plan；不在 Meta 中偷跑第一个 Plan。
- **Plan Coach**：复盘已关闭 Lesson，讨论并准备下一课；可委派只读 Scout 查找足够合适的材料。
- **Lesson Tutor**：按 Block 真实授课、逐级支架、记录课堂事实，并在结课时一次性固化相关记忆。
- **Material Vision Worker**：只读取当前选定的页面图像并返回结构化页证据，无工具、无学生记忆。

Plan 的 Scout 只负责召回和浅核验。父 Coach 完整读取最终候选，并独占数学正确性、教学适配
和持久化决定。达到 brief 要求的候选数量即可停止，不以遍历题库证明“最优”。

## 主要页面

```text
/home
/calendar
/learn/:sessionId
/meta/:sessionId
/assets
/assets?view=sources
/assets/notes/:noteId
/assets/problem-cards/:problemCardId
/assets/materials/:materialId
/assets/books/:materialId
/assets/books/:materialId/read/:revision/:locator
/footprint
/knowledge?focus=:semanticTag
/course
/course/roadmap
/course/plan/:planId
/course/plan/:planId/lesson/:lessonId
```

`/knowledge` 只从既有扁平标签和来源关系派生局部邻域，不保存图坐标、推断边或第二份知识
事实。来源树按 `书 → 章 → 节 → 资产` 投影；语义关系可以跨书，但必须来自已有标签和明确来源。

## 代码地图

- `src/study/`：学习集、资产、Material、记忆、复习与投影读取器。
- `src/runtime/`：Session 所有权、资源装载、工具边界和生命周期。
- `src/desktop/`：独立模型配置、视觉读取与桌面路径。
- `src/server/`：本地 HTTP/WebSocket 与桌面桥接。
- `src/client/`：学生界面、阅读器、课程、日历和设置。
- `resources/agents/`：各 Session 角色提示。
- `resources/skills/`：教学行为与按需方法。
- `resources/subagents/`：Plan 可用的只读材料 Scout / Reviewer。
- `resources/workers/`：一次性非 Session worker，例如视觉页读取。
- `tests/`：确定性单元、组件、Runtime 与浏览器闭环。

## 验证

完整确定性检查：

```bash
bun run check
bun run test:e2e
```

重点切片：

```bash
bun test tests/source-first
bun run test:e2e -- tests/e2e/source-first-book.spec.ts
bun run test:e2e -- tests/e2e/desktop-onboarding.spec.ts
```

`bun run check` 包含 TypeScript、全部非浏览器测试和生产前端构建。真实模型验收不能由 mock
代替；没有 Provider 凭据时应明确记录为未验收。
