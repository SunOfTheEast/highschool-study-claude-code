# StudyForge

**把你正在学的书放进来，老师沿着真实章节陪你学。**

StudyForge 是一个本地优先、把长期资料保存为可直接打开文件的学习工作台。它不只回答眼前的问题：
老师可以沿着教材或讲义的原始次序带你学习，把讨论中真正值得留下的内容整理成笔记、
闪卡和题卡，并在之后的自由讨论、复习和正式课程中继续使用这些历史。

当前版本是面向真实学生测试的早期预览版。它已经可以完整使用，但仍可能出现模型响应慢、
个别 PDF 版式读取不准和未覆盖的交互问题。

## 它能做什么

- **沿书学习**：导入 PDF，保留原文件、物理页码和章节顺序；目录与正文按需处理，不必先等整本书扫描完。
- **按页问老师**：原生文本优先；扫描页、公式或复杂版式可交给所选视觉模型读取，并始终保留原页供核对。
- **自由学习**：从一道题、一段话或一个想法直接开始，按需带入明确选择的书页、笔记和题卡。
- **正式课程**：需要长期推进时，用“长期路线 → 学习阶段 → 一次课堂”管理方向、安排和真实课堂。
- **学习资产**：经学生确认后保存笔记、闪卡和题卡；资产可以固定到书中原始位置，也可以跨书形成语义联系。
- **长期记忆**：教师记录学生在具体知识对象上的认知变化；保存内容本身不等于已经掌握。
- **复习与时间**：统一日历、间隔复习、专注计时和学习足迹帮助学生重新进入学习，而不是制造打卡压力。

StudyForge 的学习文件保存在学生自己的目录里。模型服务只会收到当前任务所需的消息、
明确选择的资产或页段；系统不会无条件上传整个学习集或整本书。

## 下载与安装

当前公开 Release 提供 **Apple Silicon Mac、macOS 13 及以上**安装包：

- [下载 StudyForge 0.1.0 预览版](https://github.com/SunOfTheEast/highschool-study-claude-code/releases/tag/studyforge-desktop-v0.1.0)
- 安装包：`StudyForge_0.1.0_aarch64.dmg`
- SHA-256：`2ca3fcabb4953c42b2a8461a379d327c00fc144fb069844a8969f0d6ed01cfe3`

这个版本采用 ad-hoc 签名，尚未经过 Apple 公证。请只从上面的项目 Release 下载；第一次
打开时，macOS 可能要求你在“系统设置 → 隐私与安全性”中确认“仍要打开”。完整步骤见
[macOS 安装与模型设置](apps/pi-teaching-web/resources/help/macos-installation.md)；
[Windows 10/11 x64 无签名内测包的安装方法](apps/pi-teaching-web/resources/help/windows-installation.md)
单独列在 Windows 指南中，正式上传前仍以实际内测分发说明为准。

## 第一次使用

1. 打开 StudyForge，优先选择你正在学习的 PDF 教材、教辅或讲义；也可以从空白或导数示例开始。
2. 连接设置页支持的模型服务，选择主教师、材料检索助手，并按需选择视觉读取模型。
3. 打开眼前正在学的章节或页面，点击“和老师学这里”。
4. 在对话中指出真正的困惑；老师需要更多上下文时再读取相邻页面。
5. 当一段理解或一道题值得留下时，先检查草稿，再用自然语言确认是否保存。

更完整的学生流程见[快速开始](apps/pi-teaching-web/resources/help/first-learning.md)。

## 学生帮助

- [快速开始](apps/pi-teaching-web/resources/help/first-learning.md)：从一本书或一个真实问题完成第一次学习闭环。
- [功能手册](apps/pi-teaching-web/resources/help/feature-guide.md)：按学习任务查询书籍、对话、资产、复习、课程和时间功能。
- [macOS 安装与模型](apps/pi-teaching-web/resources/help/macos-installation.md)：安装 App、连接模型、处理 PDF 与常见故障。
- [Windows 安装与模型](apps/pi-teaching-web/resources/help/windows-installation.md)：安装 Windows x64 内测版，无需另装开发工具。

## 三条学习路径

```text
一本真实的书 ──→ 沿章节学习 ──→ 笔记 / 闪卡 / 题卡 ──→ 复习与继续学习
                               │
多本书与资产 ──────────────────┴──→ 来源关系 + 语义关系

没有书 ──→ 自由学习或模型世界知识 ──→ 逐渐长成学习集

需要长期推进 ──→ Roadmap ──→ Plan ──→ Lesson
```

书提供经过编排的顺序和上下文，老师负责把这些内容和学生当前的理解连接起来；学习集则把
多本书、个人笔记和题卡中的共识与联系长期保存下来。

## 数据与隐私边界

- 学习集默认保存在 `~/Documents/StudyForge/`，替换 App 不会删除它。
- 学习集的长期事实使用可直接打开的 Markdown/YAML 文件；原始对话也保存在本机。
- 模型凭据和对话记录使用 StudyForge 独立目录，不读取或改写普通 Pi 的配置。
- 调用云端模型时，相关内容受所选模型服务商的服务条款和隐私政策约束。
- 不要在公开 Issue 中提交 API Key、OAuth 一次性代码、私人学习集或含个人信息的学生记录。

## 当前限制

- Apple Silicon macOS 已公开发布；Windows 10/11 x64 仍是无签名内测包；尚无 Linux、iOS 或 Android 版本。
- 安装包尚未公证，也没有自动更新。
- 教学质量、延迟与费用仍明显依赖所选模型和服务商。
- PDF 目录、扫描页、公式和复杂图表可能需要人工指定页段或视觉读取后核对原页。
- 这是早期预览，不应把模型输出当作考试评分、医疗建议或替代学校教师的权威结论。

## 从源码运行

需要 Git、Bun 1.3+，以及一个可用的 Pi 模型配置：

```bash
git clone https://github.com/SunOfTheEast/highschool-study-claude-code.git
cd highschool-study-claude-code/apps/pi-teaching-web
bun install --frozen-lockfile
bun run build
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run start
```

打开 <http://127.0.0.1:65000>。开发、测试和桌面打包说明见
[App 开发者文档](apps/pi-teaching-web/README.md)。

## 示例、研究与参与

- [高阶导数结构学习示例](examples/derivative-m0/README.md)：519 张题卡、方法标签和一条可继续生长的正式课程路线。
- [Cognitive-Outcome Agent 科研愿景](docs/design/cognitive-outcome-agent-research-vision.zh-CN.md)：为什么教育 Agent 的结果应当是可延迟验证的认知变化。
- [参与开发](CONTRIBUTING.md)
- [安全问题报告](SECURITY.md)

## 许可证

StudyForge 的原创代码与文档采用 [GNU Affero General Public License v3.0](LICENSE)。第三方
依赖、模型服务和用户导入的书籍或资料仍分别受其原有条款约束；导入文件不会因为进入
StudyForge 而被重新许可。
