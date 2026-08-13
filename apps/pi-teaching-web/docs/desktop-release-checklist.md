# StudyForge macOS 预览版发布清单

适用范围：Apple Silicon、macOS 13 及以上、ad-hoc 签名的早期预览版。当前不包含 Apple
公证、自动更新、Intel 架构、移动端或云同步。

## 自动验证

在 `apps/pi-teaching-web/` 中运行：

```bash
bun install --frozen-lockfile
bun run check
bun run test:e2e
bun run desktop:build
bun run desktop:verify
bun run desktop:smoke
```

- `check` 必须通过 TypeScript、全部非浏览器测试和生产前端构建。
- `test:e2e` 必须覆盖桌面首启、自由学习、正式课程、资产、日历和 source-first PDF 阅读。
- `desktop:verify` 必须挂载 DMG，核对 arm64 App、双 sidecar、离线帮助、教学资源与签名。
- `desktop:smoke` 必须在空 `PATH` 下验证包内 Pi、Runtime、PDF 文本与图像路径和 OAuth 引导。

不能因为缺少真实模型凭据而把 mock 结果写成真实模型通过。

## 全新用户闭环

使用新的 macOS 测试账户，或暂时移开 StudyForge 的 Application Support 与
`~/Documents/StudyForge/` 测试目录：

1. 从新 DMG 拖入“应用程序”，完成 Gatekeeper 的“仍要打开”。
2. 导入一本真实 PDF，确认原文件落在新学习集的 Material revision 中。
3. 有书签的 PDF 应直接显示目录；无书签 PDF 应能只读取指定目录页形成目录。
4. 打开一页，确认原页立即可见；分别验证原生正文读取与一次视觉读取。
5. 从精确页段开启自由学习，保存一份带来源的 Note 或题卡，重启后仍可回到原页。
6. 从空白开启另一个学习集，确认普通寒暄不会自动诊断、写记忆或保存资产。
7. 使用导数示例完成 Roadmap → Plan → Lesson 的启动与关闭边界，并触发一次真实 Scout。
8. 创建一个日历约定，完成一次复习和专注计时，确认学习足迹只投影真实发生的动作。
9. 检查帮助、公式、表格、滚动恢复、键盘焦点、1280×800 布局和内部错误信息遮蔽。
10. 如果导入了桌宠皮套，验证显示与关闭；没有皮套时桌面不应出现占位窗口。

## 发布记录

每次发布记录：

- Git commit、tag、DMG 文件名、字节数和 SHA-256；
- 构建机 macOS、Rust、Bun 与 Tauri 版本；
- 确定性验证结果；
- 实际 Provider、主教师/Scout/视觉模型与真实调用结果，或明确写“未验收”；
- 已知限制：未公证、平台范围、模型依赖和 PDF 读取边界。

上传 Release 后重新下载一次资产，并核对字节数与 SHA-256。安装文档中的版本、链接和哈希
必须与 Release 一致。

## 数据纪律

- 不把内部设计稿、验收转录、CoT、绝对本机路径或临时输出加入公开分支。
- 不收集或发布 API Key、OAuth 一次性代码、私人学习集、学生记录或未经授权的书籍。
- 公开截图使用虚构或专门创建的学习数据，并检查窗口标题、路径与诊断信息。
- 第三方依赖和素材保留原许可证；用户导入资料不因打包或测试而重新许可。
