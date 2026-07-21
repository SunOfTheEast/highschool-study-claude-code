# 导数学习集试用教程

这是从 StudyForge 导数学习集迁出的公开试用版，包含 519 张题卡、知识图谱、Roadmap、当前 Plan、三节 Lesson、两条历史 Trace 和三份 memory 文件。教材 PNG、整书文本、旧系统快照和可识别会话信息没有进入公开仓库。

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
继续“定义域完整性的系统加固”这个 Plan。
先读取 Roadmap、当前 Plan、前三节 Lesson 和已有 Trace，
区分确定证据与待核验观察，告诉我目前学到哪里。
先不要直接上课，先和我讨论下一步安排。
```

当前示例状态：

- Lesson 001：诊断中发现遗漏对数真数约束，追问后自行纠正；
- Lesson 002：独立写出 `a>0`，阶段 `1a` 通过；
- Lesson 003：已备课，等待完成 `1b` 连续性核验；
- 建议题卡：`mst_p0032_ex22`；
- 两份长期偏好画像仍为空，因为还没有完成 Plan 级学生确认。

## 4. 上课时会发生什么

Lesson 003 由 orientation、两道未见验收题、按需插入的可选修复和 reflection 组成。这些 Block 是按依赖组织的课堂积木，不是固定流水线。Claude Code Task List 只显示当前步骤；你可以随时选择是否进入可选修复，并可暂停或结束。

有证据的课堂活动会通过 `trace_append` 追加到 `learning-set/lessons/lesson-003.md`。读题卡时，该卡过去绑定的 active Trace 会一并返回。

## 5. 查看与更正

查看进度：

```text
/highschool-study:inspect-progress
```

更正旧记录：

```text
/highschool-study:correct-learning-record
```

旧 Trace 不会被覆盖；系统追加带 `Supersedes` 的新事件，再重建受影响的摘要和备课提醒。

## 6. Plan 结束与长期记忆

只有当能力标准满足、并且你明确选择完成 Plan 后，插件才会读取本 Plan 全部 Lesson，提出学生偏好和教学偏好的新增、修改、删除列表。你可以逐项修改或拒绝；确认前不会写入两份 profile。

## 7. 关于公开素材

题卡保留了原迁移数据中的来源元数据，但公开仓库不附教材图片或整书原文，因此部分外部教材路径会显示为缺失。这不影响题卡搜索、题卡步骤解析、Trace 双向查询与完整学习闭环。`materials/demo-notes.md` 是本示例课堂记录的公开、去标识化来源。

## 8. 学习集概述与展示人设

首次进入、且没有课堂 Trace 时，`study` 会先展示 `ROADMAP.md` 中的 Learning Set Overview；已有 Trace 时，只有你要求时才会展开这份概述。

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
