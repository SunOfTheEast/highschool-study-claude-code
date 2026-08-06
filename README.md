# StudyForge

StudyForge 是一个本地运行、Markdown-first 的一对一教学 Agent：它不只回答一道题，而是和学生共同确认长期方向、阶段计划与每节课，在真实课堂中留下可复查的过程证据，再据此调整下一步。M0 已实现从 Roadmap 到 Plan-local Lesson 的完整课程闭环、节点独立 Pi Session、受控材料检索、确定性课堂写入与学生掌握启停权的 Web 工作台。

> **截图 / Demo 位**：未来若准备公开导出，将补充不含私有题卡、学生记录与模型凭证的演示图。当前私有 beta 仓库不提交真实课程截图。

## 一个课程，不是一串聊天

```text
LEARNING_GUIDE.md                  学习集教学原则
ROADMAP.md                         长周期能力方向 · Roadmap Session
└── plans/<plan-id>/PLAN.md        讨论确认后创建 · Plan Session
    └── lessons/<lesson-id>.md     Plan-local 一对一课堂 · Lesson Session
```

Roadmap、Plan、Lesson 是三种不同的会话尺度。学生必须明确确认课程方向和将被物化的子节点；浏览页面、继续做题或模型回复都不会被解释成批准。父节点需要历史时只沿已链接的课程树读取原始 Markdown，不扫描目录猜测“学生以前说过什么”。

`graph/`、`cards/` 和 `materials/` 是三个彼此独立的可选静态资产切片。它们可以加速知识浏览和备课检索，但不是课程模型；Course、Session 与 Lesson 仍由必需 Markdown 和课堂过程驱动。三类切片都缺失或为空时，Knowledge 显示稳定空状态。任一可选切片一旦存在就必须通过严格解析；内容无效时启动失败，而不是按缺失处理。

## 快速开始

当前验收平台是 macOS 与 Linux，需要 Git、Bun 1.3+，以及已通过 OAuth 或 API Key 配置可用模型的 Pi。克隆仓库后从根目录运行：

```bash
bun install --frozen-lockfile
bun run doctor
bun run start:demo
```

打开 <http://127.0.0.1:65000>。默认 `start:demo` 使用公开、无预置题卡的 `examples/math-starter-m0`；它只需 `LEARNING_GUIDE.md`、`ROADMAP.md` 与可写目录即可开始，Plan 会在学生确认后创建。`doctor` 只读检查平台、Bun、App、Learning Set、写权限、Pi 可用模型和端口；不会打印凭证内容或认证文件路径。

需要显式使用仓库中不获公开再分发许可的私有 beta 评估集时：

```bash
STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run start:demo
```

需要指定自己有权使用的学习集时：

```bash
STUDY_LEARNING_SET=/absolute/path/to/learning-set bun run doctor
STUDY_LEARNING_SET=/absolute/path/to/learning-set bun run start:demo
```

详细说明见[学习集契约](docs/guides/learning-set.zh-CN.md)和[手动设置指南](docs/guides/agent-assisted-setup.zh-CN.md)。

## 让 Work Agent 帮你配置

把下面这段原样交给仓库内的 Coding Agent / Work Agent。它可以检查、安装仓库依赖并启动，但不能替你读取凭证或改全局 Pi 配置：

```text
请在这个 StudyForge 仓库里协助我完成本地启动：
1. 只安装仓库 package.json 与 bun.lock 声明的依赖；
2. 运行 bun run doctor，逐项解释 platform、bun、app、learning-set、write、model、port；
3. 如果 model 失败，只指导我在 Pi 中自行完成 OAuth 或 API Key 配置，不要读取、打印或改写任何凭证；
4. 未经我确认，不修改全局 Pi 配置，不暴露服务到 127.0.0.1 之外；
5. Doctor 全部可运行后执行 bun run start:demo，并用 /api/health 验证服务。
```

## 当前产品闭环

主界面只有课程脉络与知识山河。课程 URL 是当前节点选择的来源：

```text
/course
/course/plan/:planId
/course/plan/:planId/lesson/:lessonId
/knowledge
```

Plan 只经历 `prepared → active → completed`；Lesson 只经历 `prepared → active → closed`。开始、结束和完成均由学生在 UI 中操作，终态节点不会偷偷重开。每个节点恢复自己的 Pi Session，兄弟节点和父子节点之间不复制转录。

一次真实备课和上课包含这些已实现能力：

- **Material Scout** 在独立子上下文中按题卡特征做小批浅召回，Coach 负责最终深读、数学核验与选材；
- **Lesson Reviewer** 只在材料可能剧透、矛盾或不适合学生时做有界风险复核，不接管教学决策；
- Lesson 没有原生 `edit/write`，只能用节点绑定的 `classroom_log_append` 与 `classroom_update` 做确定性、原子化课堂写入；
- Markdown 支持行内与块级 TeX，并通过 KaTeX 渲染；畸形公式保持可见而不会打崩页面；
- Plan 可以在备课完成、学生需要时导出只含 `Student View` 的可打印讲义；私有 `Teacher Control` 和 `Classroom Log` 不进入讲义。

运行时与责任边界详见 [M0 架构](docs/architecture/m0-runtime.zh-CN.md)。

## 本地数据与隐私

StudyForge M0 只监听 `127.0.0.1`，并校验浏览器写请求与 WebSocket 的本地 Origin。Learning Set Markdown 保存课程状态；Pi 管理模型凭证与节点 Session JSONL。StudyForge 不把凭证写进仓库，也不提供云同步、多用户隔离或远程部署承诺。

学习集可能包含未成年学生的敏感记录。真实学生数据不得提交到公开 Git、Issue、测试 fixture 或示例包。当前 `examples/derivative-m0` 是保留在私有 beta 仓库中的评估语料，不受 Apache-2.0 许可，也未获准公开再分发；见[第三方与数据边界](THIRD_PARTY_NOTICES.md)。

## M0 的边界，M1 的方向

M0 故意没有长期学生画像、能力分数、跨 Plan 派生记忆、向量库、后台索引或学习效果声明。事实以 Roadmap、Plan-local Lesson、Block Classroom Log 和原始 Session 为准。M1 才会研究可追溯的认知流变、跨周期个性化与真实学习效果评估；在重复课堂证据出现之前，不提前发明第二套事实系统。

研究愿景见[认知结果型 Agent](docs/vision/cognitive-outcome-agent.zh-CN.md)。

## 开发与参与

```bash
bun run check
bun run test:e2e
```

贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)；安全问题按 [SECURITY.md](SECURITY.md) 私下报告。项目代码和项目原创文档采用 [Apache License 2.0](LICENSE)，依赖与私有评估语料边界见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

English: [README.en.md](README.en.md)。App 开发细节见 [apps/studyforge](apps/studyforge/README.md)。
