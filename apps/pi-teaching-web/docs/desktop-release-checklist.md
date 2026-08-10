# StudyForge macOS 内测发布清单

适用范围：Apple Silicon、macOS 13 及以上、单窗口私有内测。当前包采用 ad-hoc 签名，未做 Apple 公证、自动更新、Intel 架构或云同步。

## 每次构建必须通过

- `bun run check`：TypeScript、全部非浏览器测试与生产前端构建。
- `bun run test:e2e`：M0–M1d 与桌面首启浏览器闭环。
- `bun run desktop:build`：生成自包含 DMG。
- `bun run desktop:verify`：挂载 DMG，检查 arm64 App、双 sidecar、离线教程、教学资源与严格签名。
- `bun run desktop:smoke`：以 hardened runtime 自签名副本在空 `PATH` 下验证编译后的 Plan Scout、子 Pi 扩展、PDF 文本提取、Bedrock 实现、Pi、Runtime 与 OAuth 引导。

## 新用户手动闭环

使用一个新的 macOS 测试账户或全新的 StudyForge Application Support/Documents 目录：

1. 从 DMG 拖入“应用程序”，按离线教程完成 Gatekeeper 的“仍要打开”。
2. 从空白建立学习集，确认文件落在 `Documents/StudyForge`。
3. 在 StudyForge 自己的设置里登录 Provider；确认普通 Pi 的凭据和 Session 没有被读取或改写。
4. 明确选择主教师与检索 Scout；不可用模型必须显示诊断，不能静默替换。
5. 开启自由学习，保存一份 Note，退出并重新打开后仍能读取。
6. 复制导数示例，触发一次真实 Scout；确认子进程来自包内 `studyforge-pi`。
7. 打开设置与帮助，确认五张图片离线显示；检查公式、键盘焦点与 1280×800 布局。
8. 在“减少动态效果”开启后重新打开，确认纸页显现动画被禁用。

## 发布记录

- 记录 DMG 文件名、SHA-256、Git commit、构建机 macOS/Rust/Bun 版本。
- 记录真实 Provider、主教师/Scout 模型与一次真实调用结果；没有凭据时必须写“未验收”，不能用 mock 替代。
- 明确告知内测者：此包未公证，只能从可信私有链接获取；若不确认来源，不应点击“仍要打开”。
- 反馈中不得收集 API Key、OAuth 一次性代码或完整私人学习集。
