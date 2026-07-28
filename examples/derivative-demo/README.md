# 导数学习集试用教程

这是从 StudyForge 导数学习集迁出的公开试用版，包含 519 张题卡、知识图谱和三份 memory 文件。公开基线不预设学生缺陷，也不自带 active Plan 或 Lesson；第一次使用时由学生与学习商议共同确定学习方向。教材 PNG、整书文本、旧系统快照和可识别会话信息没有进入公开仓库。

## 1. 安装插件

```bash
claude plugin marketplace add SunOfTheEast/highschool-study-claude-code --scope user
claude plugin install highschool-study@studyforge-learning --scope user
```

确保 `bun --version` 可用。

## 2. 复制成独立学习项目

从仓库根目录运行：

```bash
cp -R examples/derivative-demo ~/derivative-study-demo
cd ~/derivative-study-demo
claude
```

复制出去是为了让 `${CLAUDE_PROJECT_DIR}/learning-set` 精确指向这个示例，而不是指向插件仓库根目录。

## 3. 开始学习

进入 Claude Code 后运行：

```text
/highschool-study:study
```

推荐第一句话：

```text
我想开始一个新的高阶导数学习阶段。
请先读取学习集概述和方法图谱，概括可以选择的主干方向。
不要根据旧课堂假设我的薄弱点；先询问我希望强化什么，
再和我共同确定第一个 Plan 的可观察能力标准与检验方式。
先不要备课，也不要直接上课。
```

当前示例状态：

- 519 张题卡与高级方法图谱已经就绪；
- `LEARNING_GUIDE.md` 已提供公开研习原则和内部导数教研要领；
- Roadmap 尚未建立个性化学习阶段；
- `plans/` 与 `lessons/` 为空；
- 两份长期偏好画像和备课关注列表均为空；
- 第一个 Plan、Lesson 和课堂记录将在真实讨论与学习后产生。

## 4. 建立第一阶段并开始上课

学习商议先根据你的目标，从同构变形、切线与公切线、参变量分离、数形结合、局部逼近等主干方向中确定一个阶段。阶段文档必须写明长期目标、可观察能力标准和真实题目检验方式。

方向确认后再准备第一课。课堂可以包含说明、材料、示例、独立练习、迁移、可选回顾和课堂回望等环节；环节可以依赖、重排或略过，不是固定流水线。每次读取题卡都会同时读取其已有学习记录；找不到合适真实题卡时缩减课堂目标，不临时编卡。

产生课堂表现后，系统会把学习记录绑定到真实题卡和课堂环节。完成一个 Plan 后，才会汇总本周期课堂记录并请学生确认长期偏好。

## 5. 查看与更正

查看进度：

```text
/highschool-study:inspect-progress
```

更正旧记录：

```text
/highschool-study:correct-learning-record
```

旧 Trace 不会被覆盖；系统追加带 `Supersedes` 的新事件，再刷新方法投影和备课提醒，并列出可能已经过时的摘要或决定。系统不会自动改写已经落盘的 Lesson Summary、Plan 或长期画像。

## 6. Plan 结束与长期记忆

只有当能力标准满足、并且你明确选择完成 Plan 后，插件才会读取本 Plan 全部 Lesson，提出学生偏好和教学偏好的新增、修改、删除列表。你可以逐项修改或拒绝；确认前不会写入两份 profile。

## 7. 关于公开素材

题卡保留了原迁移数据中的来源元数据，但公开仓库不附教材图片或整书原文，因此部分外部教材路径会显示为缺失。这不影响题卡搜索、题卡步骤解析、Trace 双向查询与完整学习闭环。`materials/demo-notes.md` 是本示例课堂记录的公开、去标识化来源。

## 8. 学习集概述与陪伴风格

首次进入、且没有课堂 Trace 时，`study` 会先展示 `ROADMAP.md` 中的 Learning Set Overview；已有 Trace 时，只有你要求时才会展开这份概述。

入口还会展示 `learning-set/LEARNING_GUIDE.md` 的 `Student Learning Principles`。它提醒你先看结构再运算、说明方法选择、区分不同失误，并用陌生题检验迁移。该文件的 `Internal Teaching Notes` 只供备课和必要的课堂判断使用，不会作为学生说明直接展开。

Coach 会结合这些导数教研要领、当前 Plan 和真实课堂记录确定本课最值得改变的认知；Tutor 再根据你现场写出的路线决定等待、追问、提示或讲解，不要求每节课走固定流程。

本学习集默认使用冷静学姐（`calm-senpai`）。人设只会改变面向学生的表达，不会改变能力判断、题卡选择、Trace、测试或备课。

你可以自然地说：

```text
这节课换成元气同桌。
以后这个学习集都用冷静学姐。
恢复学习集默认人设。
关闭人设。
```

- 临时选择只对当前会话生效，不写任何文件。
- “以后”这样的持久选择会写入被 Git 忽略的 `learning-set/CLAUDE.local.md`。
- 可在 `learning-set/.claude/personas/<id>.md` 添加学习集专属的人设，或用同名文件覆盖内置人设。
- 人设只改变展示方式，绝不改变能力判断、题卡、Trace、测试或备课。

### 自适应课堂与防剧透

备课会根据当前目标和 Trace 选择一个主模板：诊断课、概念新授课、专项训练课、错因修复课、能力验收课或复习整合课。模板只是 ActivityBlock 的默认组合，学生仍可增删、跳过和重排。

Planner 先确定热身、核心、变式、迁移、补救或挑战等题目角色，再分别搜索真实题卡；不会找到第一题就停止。真实卡片不足时会缩减题组或调整课堂目标，不会临时编卡。

题目 Block 分为 `Student View` 与 `Teacher Control`。Coach 只展示当前 Student View，并按三种模式揭示：`zero` 在诊断和验收首次尝试前不给提示；`ladder` 在学生尝试并同意后每轮只给一级提示；`worked-example` 可以完整讲示例，但学生目标题必须是另一张真实卡。Teacher Control、题卡答案和解法步骤不会被整段转述给学生。

视频优先使用本地 `materials/`。外部视频只有在备课侧核验真实标题、链接、相关片段、教学目的和文字替代后才会加入；解决目标题的视频不会放在首次尝试之前。
