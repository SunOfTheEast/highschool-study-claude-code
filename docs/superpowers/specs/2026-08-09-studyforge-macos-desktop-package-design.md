# StudyForge macOS 桌面安装包与首次使用教程设计

**日期：** 2026-08-09  
**状态：** 已确认  
**首发范围：** macOS Apple Silicon 内测版

## 1. 背景

StudyForge M1 已经具备空白自由学习、学习资产、教师记忆以及
`Roadmap → Plan → Lesson` 正式课程闭环。当前发布方式仍要求用户安装 Bun、Pi、仓库依赖，
再从命令行指定 learning set 启动本地 Web App。这适合开发和验收，不适合学生首次使用。

本切片把现有产品封装成可拖入 Applications 的 macOS App，并补齐两篇面向内测者的教程。
桌面封装只负责安装、配置、文件选择与进程生命周期，不复制或改写教学判断。

## 2. 目标

1. 用户安装一个 DMG 后即可使用，不需要预装 Bun、Node 或 Pi。
2. StudyForge 使用独立的 Pi Agent Home、凭据、模型设置与 Session，不读取或修改普通 Pi。
3. 用户可以从空白学习集、已有学习集或导数示例开始。
4. Pi 已支持的 Provider、认证方式和模型都可从 GUI 配置；主教师与 Scout 独立选型。
5. learning set 继续是用户可见、可复制、可 Git 管理的 Markdown 文件夹。
6. 关闭、重开、升级 App 都不误改学习生命周期，也不删除学习资产。
7. 安装与首次学习都有不依赖网络的中文教程。

## 3. 非目标

- 不重写现有 React 教学界面。
- 不把 Roadmap、Plan、Lesson、记忆或资产迁入数据库。
- 不引入第二套 Agent、Skill 或教学 Runtime。
- 不做云同步、账号系统、遥测、内置备份或多设备冲突处理。
- 不做后台常驻、托盘菜单、多窗口并行学习集或自动更新。
- 首版不支持 Intel Mac、Windows、Mac App Store 或已公证的公开分发。
- 不自动导入、复制或继承用户现有的 `~/.pi` 配置。

## 4. 技术方案

采用 **Tauri 2 + Bun/Pi Sidecar**。

```text
StudyForge.app
├── Tauri 桌面壳
│   ├── 现有 React 界面与首次启动界面
│   ├── 原生文件夹选择、Finder、外部 OAuth
│   └── Sidecar 启动、健康检查、切换与关闭
└── studyforge-runtime
    └── Bun 编译的现有 Server + Pi + Agent + Skill
```

Tauri 只持有桌面职责。所有教师回答、工具调用、文档变更与 Session 语义仍由现有
TypeScript Runtime 完成。Rust 层不得解析或修改 Roadmap、Plan、Lesson、记忆或资产内容。

React 源码保持一份。桌面构建和现有浏览器开发模式可以使用不同宿主，但不得分叉页面、
路由或教学行为。

Agent、Skill、教学核心、模板和导数示例作为 App Bundle 内的只读 Resources 随版本发布，
Sidecar 通过显式资源根读取。它们不安装进普通 Pi，也不在首次启动时复制到 `~/.pi`。

选择 Tauri 的原因：它原生支持捆绑外部 Sidecar；Bun 可以把 TypeScript 入口、运行时和 npm
依赖编译为目标平台独立可执行文件。Electron 可以更快形成 JavaScript 桌面壳，但会额外携带
Chromium；SwiftUI 会让未来 Windows 支持重写桌面壳。

## 5. 进程与启动协议

### 5.1 冷启动

1. Tauri 解析自己的 Application Support 目录并加载桌面配置。
2. 没有完成首次启动时，先显示首次启动界面；不伪造 learning set。
3. 需要认证或读取模型目录时，以 StudyForge Agent Home 创建 Pi `ModelRuntime`。
4. 选定 learning set 后，Tauri 启动 `studyforge-runtime`，显式传入：
   - StudyForge Agent Home；
   - StudyForge Session Home；
   - 当前 learning set 精确路径；
   - 随机 loopback 端口或端口 `0`；
   - 仅本次进程有效的启动令牌。
5. Sidecar 只监听 `127.0.0.1`，完成恢复和初始化后通过 stdout 输出一条机器可读的 ready
   回执。回执只包含协议版本、端口和健康状态，不包含凭据、学习内容或内部提示。
6. Tauri 完成健康检查后显示现有 React App。

启动令牌只存在内存，用于桌面前端访问本次 Sidecar 的 HTTP/WebSocket API；不得写入 URL
历史、日志、learning set 或 Pi Session。它属于本地进程边界，不进入模型上下文。

### 5.2 正常退出与异常退出

- 关闭窗口时，Tauri 先请求 Sidecar 停止接收新回合；正在执行的原子写入获得一个有界完成
  窗口，随后结束子进程。未完成事务仍由现有恢复机制处理。
- 关闭 App 不是“结束自由学习”、不是“完成 Plan”、也不是“结课”。StudyForge 不调用这些
  生命周期操作。
- Sidecar 崩溃时，Tauri 显示诊断页并允许重启；现有原子文档与 pending tool-result 恢复机制
  继续负责事实恢复。
- Tauri 不从聊天文本推断生命周期状态。

### 5.3 切换学习集

同一时刻只运行一个 learning set。切换时停止当前 Sidecar，再以新根目录启动一个 Sidecar。
旧 learning set 的 Pi Session、记忆和资产不注入新 learning set。

## 6. 配置与数据所有权

```text
~/Library/Application Support/StudyForge/
├── agent/
│   ├── auth.json
│   ├── models.json
│   ├── settings.json
│   └── sessions/
├── app.json
└── logs/

~/Documents/StudyForge/
└── <学习集名称>/
    └── learning-set/
```

- StudyForge 显式设置 Pi 提供的 Agent 与 Session 目录覆盖点，并在创建 `ModelRuntime` 时绑定
  自己的 credential/model 路径。
- 不探测、不迁移、不回退读取 `~/.pi/agent`。
- `app.json` 只保存桌面偏好、最近 learning set、当前 learning set，以及主教师/Scout 的模型
  选择；不保存教学事实或凭据。
- Provider 凭据沿用 Pi Credential Store，但只写入 StudyForge Agent Home。秘密不得出现在
  日志、错误页、前端状态持久化或 learning set。
- 运行日志只记录桌面启动、Sidecar 状态和脱敏错误；完整模型内容继续留在受管 Pi Session。
- learning set 位于 App Bundle 之外，因此覆盖安装或删除 App 不删除学习资产。

首版不自动导入已有 Pi 登录。用户可以使用同一服务账号重新登录，但生成的是 StudyForge
自己的 credential 条目。

## 7. 首次启动

首次启动是一个三步引导。

### 7.1 从哪里开始

提供三个入口：

1. **空白开始**（主按钮）：输入名称后在 `~/Documents/StudyForge` 创建最小 learning set，
   随即可以“问老师”。最小集只有有效的 `LEARNING_GUIDE.md` 与 `memory/INDEX.md`，不伪造
   Roadmap、Plan、Lesson、资产或学生结论。
2. **打开已有学习集**：使用原生文件夹选择器。打开前只验证当前 Runtime 需要的最小结构，
   失败时说明缺失或不兼容项，不静默迁移、修复或重写。
3. **使用导数示例**：把 App 内只读示例复制为用户目录中的个人副本，再打开副本。所有课堂、
   记忆和新资产只写入副本。

### 7.2 连接 Provider

Provider 与认证能力直接来自 Pi 注册表。GUI 通用渲染 Pi 的：

- OAuth 浏览器登录；
- API Key/secret 输入；
- device code；
- manual code；
- 文本、选择、进度和错误事件。

不得为每家 Provider 复制一套认证状态机。OAuth URL 使用系统默认浏览器打开；回调或设备码
结果返回 StudyForge 窗口。Provider 可以分别登录、退出和重新认证。

### 7.3 安排模型

- 主教师与检索 Scout 分别选择 Provider、Model 和思考强度。
- 默认尝试主教师 `openai-codex/gpt-5.6-sol` + `high`，Scout
  `openai-codex/gpt-5.6-terra` + `high`。
- 默认不可用时要求用户明确选择；不得静默换 Provider、模型或思考强度。
- 选择器只展示 Pi 注册表中当前可用的模型与该模型支持的设置。
- 设置页可随时修改。新选择只影响之后新建或重新装载的 Session，不改写已经持久化的对话。

配置和 learning set 均有效时，再次启动直接进入学习首页。

## 8. 桌面界面

### 8.1 保持单窗口

首版只有一个主窗口，不做托盘、后台 daemon 或多窗口。现有学习首页、学习资料、课程脉络、
足迹和知识关系界面保持原样。

桌面层新增且只新增：

- 首次启动引导；
- Provider 与模型设置；
- 最近 learning set 与切换入口；
- “在 Finder 中显示”；
- 启动/崩溃诊断页；
- “帮助”菜单。

### 8.2 失败体验

Sidecar 未 ready 时不得显示空白教学页。诊断页根据实际状态提供：

- 重试启动；
- 重新选择 learning set；
- 打开模型设置；
- 打开脱敏日志；
- 退出 App。

模型登录失败、模型不可用、learning set 无效和端口启动失败必须分开呈现，不合并为“启动
失败”。普通用户错误不显示堆栈；日志保留诊断细节但不包含秘密。

模型正在回复时不强制重启 Sidecar。若用户修改需要重新装载的设置，界面说明它何时生效。

## 9. 分发与升级

首个内测构建只产出 Apple Silicon DMG。App 与所有嵌套可执行文件使用 ad-hoc 签名，并在
构建后验证签名和 Bundle 完整性。

自签名不冒充 Developer ID，也不承诺绕过 Gatekeeper。首次启动教程明确说明：第一次尝试
打开后，在“系统设置 → 隐私与安全”选择“仍要打开”。不要求用户安装自签根证书或关闭
Gatekeeper。

第一版不做自动更新。用户下载新 DMG 并覆盖 Applications 中的 App；Application Support 与
Documents 中的数据保持不动。扩大公开分发前再加入 Apple Developer Program、Developer ID、
Hardened Runtime、公证与 ticket stapling。

## 10. 教程交付

两篇中文教程同时存入仓库和 App 离线资源，“帮助”菜单可随时打开。

### 10.1 《安装与首次启动》

面向第一次安装的内测者，按任务顺序说明：

1. 下载 DMG、拖入 Applications；
2. 首次 Gatekeeper 放行；
3. 登录一个或多个 Provider；
4. 选择主教师、Scout 与思考强度；
5. 空白、已有、导数示例三种入口；
6. learning set 与 StudyForge 配置各自保存在哪里；
7. 启动失败时如何使用诊断页；
8. 如何覆盖安装新版和卸载。

教程不要求终端命令。源码开发与手工启动继续留在开发者 README，不混入学生教程。

### 10.2 《第一次学习》

用一个真实、普通而不要求学生懂产品术语的闭环说明：

1. 从“问老师”开始一次自由学习；
2. 在需要时选择 Note、题卡或资料作为上下文；
3. 与老师讨论，理解保存前为什么需要查看并确认内容；
4. 保存 Note 或题卡；
5. 对题卡先作答或选择不会，再查看答案并再次问老师；
6. 学生需要长期路径时，理解 Meta、Roadmap、Plan、Lesson 各自出现的时机；
7. 显式结束自由学习线程；
8. 区分“关闭 App”和“结束学习”。

教程以界面动作和预期结果为主，不解释内部 Markdown schema、Agent prompt 或 Runtime 工具。
涉及 Gatekeeper、首次启动、模型选择、开始学习和保存确认的步骤使用最终 DMG 实际截图；
不得使用设计稿冒充成品界面。文字必须在隐藏截图时仍能独立完成操作。

## 11. 验收

### 11.1 自动化

- 现有 `bun run check` 与浏览器 E2E 必须继续通过。
- Tauri/Rust 单测覆盖桌面配置路径、最近 learning set、Sidecar 启停和 ready 回执解析。
- Runtime 测试覆盖显式 Agent/Session Home、模型设置读取、随机端口和启动令牌。
- 首次启动测试覆盖空白创建、示例复制、已有 learning set 验证和三类失败分流。
- 配置解析测试确认所有 Pi 路径都落在显式 StudyForge Agent/Session Home，且不会解析到
  `~/.pi`；集成测试再用临时 HOME 的 `~/.pi` 哨兵确认没有任何写入。
- 编译出的 Sidecar 必须在没有系统 Bun/Node/Pi 的环境中启动并通过 health check。
- 构建验收挂载 DMG、检查 `.app` 结构，并对嵌套可执行文件和最终 Bundle 执行签名验证。

不为 Tauri 重复现有教学语义测试；桌面测试只验证新边界。

### 11.2 真实内测冒烟

使用一个没有 Bun、Node、Pi 配置的新 macOS 用户环境：

1. 安装 DMG 并完成一次 Gatekeeper 放行；
2. 完成真实 Provider 登录；
3. 创建空白 learning set；
4. 进行自由学习并经确认保存一份 Note；
5. 退出 App，重开并恢复同一线程和资产；
6. 切换到导数示例副本；
7. 从长期方向讨论进入正式课程入口；
8. 检查普通 `~/.pi` 哨兵、学习集路径、Session 路径和日志脱敏。

真实冒烟失败时先定位为安装、签名、Provider、Sidecar、learning set、Session 或教学层，不用
增加提示词去掩盖桌面 Runtime 故障。

## 12. 发布完成标准

满足以下条件才生成供内测者下载的 DMG：

- 无外部 Bun、Node 或 Pi 依赖；
- StudyForge 与普通 Pi 配置隔离；
- 三种 learning set 入口都可用；
- Provider/模型设置可由 GUI 完成；
- 关闭、重开与切换不越权改变学习生命周期；
- 两篇离线教程已按最终界面逐步核验；
- 自动化、打包检查和真实模型冒烟均通过；
- 已知的 Gatekeeper 首次放行限制在下载页和安装教程中明确说明。

## 13. 参考

- [Tauri：Embedding External Binaries](https://tauri.app/develop/sidecar/)
- [Bun：Single-file executable](https://bun.sh/docs/bundler/executables)
- [Apple：Developer ID](https://developer.apple.com/support/developer-id/)
- [Apple：Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Apple：Open a Mac app from an unknown developer](https://support.apple.com/guide/mac-help/mh40616/mac)
