# StudyForge 打包运行时依赖修复设计

## 目标

让发布版 macOS Runtime 在脱离源码仓库和 `node_modules` 后，仍能可靠完成三条已经公开给学生的能力：Plan 中调用 Material Scout、PDF 文本提取、Amazon Bedrock 模型加载。

## 已确认根因

Bun 编译产物只会收进静态可追踪的依赖。当前三条路径分别在运行时通过 `import.meta.resolve`、PDF.js 的可选 Node 依赖和变量动态导入跨出了编译图，因此源码环境可用，DMG 中失败。问题不是 Tauri 漏拷了整个资源目录，也不是应该复制整棵 `node_modules`。

## 方案

### Plan / Scout

直接静态导入 `pi-subagents` 的扩展工厂，并作为 Plan 专属内联扩展交给 `DefaultResourceLoader`。保留现有 `study-subagent-guard` 和 Plan-only 权限，不再让编译后的 Runtime 现场解析 npm 包路径。

### PDF

新增一个只在 PDF 导入时加载的运行时模块。该模块静态引用 `@napi-rs/canvas` 和 `pdf.worker.mjs`，先补齐 PDF.js 在 Bun/Node 下需要的 `DOMMatrix`、`ImageData`、`Path2D`，再加载 PDF.js 主模块。`@napi-rs/canvas` 变为 StudyForge 的显式直接依赖；普通对话和文本资料导入不加载它。

### Bedrock

新增一个共享 Bun provider 注册函数，使用 `@earendil-works/pi-ai/bedrock-provider` 和 `@earendil-works/pi-ai/compat` 的公开入口注册 Bedrock 实现。Runtime 与 `studyforge-pi` 两个入口都在启动时调用它，避免父会话与 Scout 子进程能力不一致。

## 发布验收

`desktop:smoke` 在空 `PATH`、临时 HOME 下直接运行编译后的 Runtime 自检：

1. Plan ResourceLoader 实际注册 `subagent`；
2. 一页 PDF 被提取为 `pdf-text`；
3. Bedrock 官方实现已静态加载并注册。

现有 Runtime 启动、OAuth 引导、Pi 版本检查继续保留。`desktop:verify` 仍只负责最终 DMG 的文件、架构、系统动态库和签名边界。

## 边界

- 不复制整棵 `node_modules`，不做通用包扫描器。
- 不在这次修复中改 Plan/Lesson 生命周期；失败后的状态回滚另立切片。
- 不以真实 AWS 请求作为打包测试；只验证实现可加载，真实账号由后续功能验收覆盖。
- PDF 发布门先覆盖机械文本提取；复杂中文教材的字体/CMap 兼容作为独立样本集继续验证。
