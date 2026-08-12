# M2 桌宠皮套导入实施计划

> **实施约束：** 按测试驱动逐项完成；不打包私有皮套或 Cubism Core；不扩展到 ZIP、多角色或皮套市场。

**目标：** 干净安装没有皮套时不显示桌宠，并让用户从设置页导入已解压的 VTube Studio 皮套与一次性的 Cubism Core。

**架构：** Runtime 拥有 App Home、皮套状态和原子安装；Tauri 只提供原生路径选择及窗口控制；React 设置页呈现短流程。现有 CLI 与桌面 API 共用一个安装模块。

**技术栈：** Bun/TypeScript、React、Tauri 2/Rust、Bun test。

---

## Task 1：无皮套时完全隐藏

**修改：**

- `apps/pi-teaching-web/src-tauri/tauri.conf.json`
- `apps/pi-teaching-web/src/client/components/PeerEmbodiment.tsx`
- `apps/pi-teaching-web/tests/m2/companion-shell.test.ts`
- `apps/pi-teaching-web/tests/m2/peer-playback.test.tsx`

**步骤：**

1. 先把测试改为要求 companion 初始 `visible: false`，且资源缺失时不存在 `.peer-portrait-placeholder`。
2. 运行两个聚焦测试，确认 RED。
3. 修改 Tauri 配置；让 `PeerEmbodiment` 在 Live2D 与静态头像均不可用时返回空表现，不再构造“夏”字占位符。
4. 再运行聚焦测试，确认 GREEN。

## Task 2：提取可复用安装器并支持首次 Core 安装

**新增：**

- `apps/pi-teaching-web/src/desktop/peer-live2d-installer.ts`
- `apps/pi-teaching-web/tests/m2/peer-live2d-installer.test.ts`

**修改：**

- `apps/pi-teaching-web/scripts/desktop/import-peer-live2d.ts`
- `apps/pi-teaching-web/src/desktop/peer-live2d-package.ts`
- `apps/pi-teaching-web/tests/m2/peer-live2d-import.test.ts`

**步骤：**

1. 用临时 App Home 与最小 VTube fixture 写 RED：缺失状态、外部 Core 首次导入、共享 Core 再次导入、无效来源保持旧安装。
2. 将 CLI 里的读取、复制、纹理收敛和 staging 逻辑移入安装器。
3. 新增共享 Core 路径；接受可选的用户所选 Core，并兼容旧皮套内已有 Core。
4. 用同一 staging 完整验证后再替换；回滚副本只活在事务期间。
5. CLI 改为薄封装，保持现有命令可用。
6. 运行安装器与原 normalizer 测试，确认 GREEN。

## Task 3：桌面 API 与原生选择器

**修改：**

- `apps/pi-teaching-web/src/server/desktop-app.ts`
- `apps/pi-teaching-web/src/client/desktop/api.ts`
- `apps/pi-teaching-web/src-tauri/src/lib.rs`
- `apps/pi-teaching-web/src/client/desktop/bridge.ts`
- `apps/pi-teaching-web/tests/desktop/desktop-api.test.ts`
- `apps/pi-teaching-web/tests/e2e/desktop-onboarding.spec.ts`

**步骤：**

1. 写 API RED：读取皮套状态，导入时接收 `source` 和可选 `core`，将已知导入失败映射为稳定的 422 错误。
2. 给 Tauri bridge 增加皮套目录选择和 `.min.js` 文件选择；取消时返回 null。
3. Runtime 路由调用 Task 2 安装器；不把绝对路径回显到响应或 UI。
4. 客户端 API 暴露 `peerSkinStatus()` 与 `importPeerSkin()`。
5. 运行桌面 API 与 TypeScript 类型检查。

## Task 4：设置页短流程与热刷新

**修改：**

- `apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- `apps/pi-teaching-web/src/client/companion/contracts.ts`
- `apps/pi-teaching-web/src/client/companion/bridge.ts`
- `apps/pi-teaching-web/src/client/companion/CompanionRoot.tsx`
- `apps/pi-teaching-web/src/client/companion/CompanionStage.tsx`
- `apps/pi-teaching-web/src/client/styles/desktop.css`
- `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`
- `apps/pi-teaching-web/tests/m2/companion-projection.test.tsx`

**步骤：**

1. 写 UI RED：未安装、等待 Core、导入中、已安装和友好失败五种可见结果。
2. `DesktopRoot` 加载皮套状态，并在缺失时请求隐藏 companion。
3. 设置页接入选择目录、选择 Core、导入与更换；取消选择不显示错误。
4. 导入成功后向 companion 发送刷新信号，再显示窗口；companion 用 revision 重新挂载 Live2D。
5. 错误只使用三条已确认的学生语言，不暴露错误码和路径。
6. 运行 UI 与 companion 聚焦测试。

## Task 5：发布边界与真实桌面验收

**修改（仅在测试需要时）：**

- `apps/pi-teaching-web/tests/m2/peer-package.test.ts`
- `apps/pi-teaching-web/tests/m2/live2d-audio-boundary.test.ts`

**步骤：**

1. 运行 `bun run check`。
2. 运行 `cargo check --manifest-path src-tauri/Cargo.toml`。
3. 运行现有桌面打包验证，确认 DMG 仍拒绝 `.moc3`、模型纹理与 Cubism Core。
4. 用独立干净 App Home 启动，确认没有 companion 窗口。
5. 通过设置页导入私有“水色小狗”目录与本机 Core，确认无需重启即可出现，重启后仍存在。
6. 尝试无效目录，确认当前皮套未损坏。
7. 检查 `git status` 和 DMG 内容，确保私有资产与测试产物未进入版本控制。
