# StudyForge Windows x64 内测验收清单

适用范围：Windows 10/11 x64、当前用户安装、未签名 NSIS 内测包。安装和使用不依赖
系统预装 Git、Bash、Node.js、Bun 或 Rust。

## 每次构建必须自动通过

GitHub Actions 的 `Windows desktop package` 工作流必须在原生 Windows runner 上完成：

- 锁定依赖安装、TypeScript 检查、全部非浏览器测试与生产前端构建；
- 使用锁定的 baseline Bun 生成 Runtime 与 Pi 两枚 Windows sidecar；
- 下载后校验 PortableGit、ripgrep 与 fd 的固定版本和 SHA-256，再装入应用私有资源；
- 生成 x64 NSIS 安装包；
- 静默安装到包含空格和中文的当前用户路径；
- 从安装目录核对主程序、两枚 sidecar、私有 Bash、`rg`、`fd`、帮助与教学资源；
- 在不继承宿主 `PATH` 的环境里验证 Runtime、Pi、OAuth 引导、Plan 子代理、PDF 导入与
  私有命令运行；
- 静默卸载，并确认主程序已移除；
- 上传安装包和不含凭据的 JSON 验证回执。

任何一项失败都不得把该构建称为可分发版本。

## 首个真实 Windows 11 学生机验收

使用一台没有开发工具的 Windows 11 x64 电脑和含中文的用户名。只从对应提交的 CI
产物安装，并依次检查：

1. 记录提交、安装包文件名、版本、字节数和 SHA-256；不记录任何 API Key 或 OAuth
   一次性代码。
2. 从资源管理器双击安装包。确认 SmartScreen 提示与帮助文档一致，选择“更多信息 →
   仍要运行”后可以完成当前用户安装，不要求管理员权限。
3. 从开始菜单启动 StudyForge。确认没有命令行窗口一闪而过，设置、帮助和本地连接状态
   正常，界面中文与公式、表格可读。
4. 使用一个真实可用的主教师配置登录；另配 Scout 与资料视觉模型，重启后配置仍在。
5. 导入路径含中文和空格的真实 PDF。确认原书页先出现，原生文本页可按需读取；再用一页
   扫描内容验证视觉读取。不要把私人书页或模型转录写进公开报告。
6. 从精确书页范围开启自由学习，完成一次真实讲解，保存一份带来源的 Note 或题卡；重启
   应用后，资产仍能回到原始页。
7. 从同一本书建立 Roadmap，商议并物化一个 Plan，再准备并进入一节 Lesson；确认 Scout
   能运行，Plan 只读取自己树下的 Lesson，结束按钮和记忆固化节奏正常。
8. 完成一次自助复习、一个专注周期和一个日历约定，确认学习足迹只显示真实发生的活动。
9. 在系统没有额外 Git、Bash、`rg`、`fd`、Node.js 与 Bun 的情况下重复一次自由学习和
   Lesson 进入流程；不得弹出缺少命令或要求安装开发工具的提示。
10. 从“设置 → 应用 → 已安装的应用”卸载。确认应用程序被移除，而
    `Documents\StudyForge` 中的学生资料仍保留。

## 验收记录模板

```text
Git commit:
Workflow run:
Installer filename:
Installer SHA-256:
Windows edition/build:
Windows account path shape: 含中文与空格 / 否
Main teacher route:
Scout route:
Vision route:
Free learning Session: 通过 / 失败
Roadmap → Plan → Lesson: 通过 / 失败
Book page → asset → source return: 通过 / 失败
Review / focus / appointment: 通过 / 失败
Private command runtime with no developer tools: 通过 / 失败
Uninstall while preserving Documents: 通过 / 失败
Known issues:
```

自动 CI 回执只能证明安装包结构与无宿主工具运行，不替代上述真实 Windows 11 图形界面和
真实模型验收。
