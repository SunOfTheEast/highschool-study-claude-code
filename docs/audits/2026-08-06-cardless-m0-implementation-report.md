# 无题卡 StudyForge M0 实现与验收报告

日期：2026-08-06

结论：**PASS**。公开默认 Learning Set 只含两个必需 Markdown 文件时，完整确定性门、真实构建
服务烟测与 `Roadmap → Plan → 两节 Lesson → Plan completed` 真实模型闭环均通过。私有资产丰富
的 `examples/derivative-m0/learning-set` 语料继续通过回归且该 learning-set 目录树未改动；本轮没有
修改产品行为。

## 设计、计划与范围

- [已确认设计](../superpowers/specs/2026-08-06-optional-static-learning-assets-design.md)
- [实施计划](../superpowers/plans/2026-08-06-optional-static-learning-assets.md)
- 验收起点：`5488329`；真实模型运行源码：`32d4de67780f6bf0c0b208136ce565df10bbc8bb`
- 分支：`codex/studyforge-private-release-hardening`；运行前工作树干净
- 本报告之外，Task 6 没有产品修复或提示词追加

实现提交按顺序为：

1. `5488329` `docs: design cardless StudyForge learning sets`
2. `9a16ba3` `docs: plan optional StudyForge assets`
3. `73b67a8` `feat: allow cardless StudyForge learning sets`
4. `e966fb9` `feat: present cardless learning sets honestly`
5. `491272c` `feat: add a public cardless starter`
6. `7e65d70` `test: prove the public cycle needs no card corpus`
7. `eb5a64a` `docs: explain optional StudyForge assets`
8. `32d4de6` `docs: enforce optional asset failure semantics`

本报告由后续独立提交 `docs: report cardless M0 acceptance` 添加；不把提交自身 SHA 写回报告，
避免自引用改写。

验收后的最终 review-fix 仅修正私有语料的明确选择说明、对应文档契约测试，以及本报告对 harness、
确认门和不可变语料范围的表述；产品架构与 `examples/derivative-m0/learning-set` 均未改动。

## 文件清单

`5488329..32d4de6` 共修改或新增 37 个文件（`+1376/-99`）；本报告是 Task 6 唯一新增文件。

### Core

- `apps/studyforge/src/shared/contracts.ts`
- `apps/studyforge/src/study/knowledge.ts`
- `apps/studyforge/src/study/markdown.ts`
- `apps/studyforge/src/study/static-assets.ts`（新增）
- `scripts/lib/doctor.ts`

### UI

- `apps/studyforge/src/client/App.tsx`
- `apps/studyforge/src/client/components/AppShell.tsx`
- `apps/studyforge/src/client/components/PrimaryViewNav.tsx`
- `apps/studyforge/src/client/pages/KnowledgePage.tsx`
- `apps/studyforge/src/client/styles/knowledge.css`

### 公开启动集

- `examples/math-starter-m0/LICENSE`（新增）
- `examples/math-starter-m0/README.md`（新增）
- `examples/math-starter-m0/learning-set/LEARNING_GUIDE.md`（新增）
- `examples/math-starter-m0/learning-set/ROADMAP.md`（新增）

### Tests 与公开 fixtures

- `apps/studyforge/tests/e2e/fixture-server.ts`
- `apps/studyforge/tests/e2e/m0-cycle.spec.ts`
- `apps/studyforge/tests/fixtures/card-recall-learning-set/cards/public-sample.card.yaml`（新增）
- `apps/studyforge/tests/fixtures/card-recall-learning-set/graph/card-recall-index.tsv`（新增）
- `apps/studyforge/tests/fixtures/m0-cardless-learning-set/LEARNING_GUIDE.md`（新增）
- `apps/studyforge/tests/fixtures/m0-cardless-learning-set/ROADMAP.md`（新增）
- `apps/studyforge/tests/fixtures/m0-cardless-learning-set/plans/plan-001/PLAN.md`（新增）
- `apps/studyforge/tests/fixtures/m0-cardless-learning-set/plans/plan-001/lessons/lesson-001.md`（新增）
- `apps/studyforge/tests/m0/card-recall-index.test.ts`
- `apps/studyforge/tests/m0/course-ui.test.tsx`
- `apps/studyforge/tests/m0/derivative-demo.test.ts`
- `apps/studyforge/tests/m0/knowledge-ui.test.tsx`
- `apps/studyforge/tests/m0/markdown-domain.test.ts`
- `apps/studyforge/tests/m0/server-api.test.ts`
- `tests/release/docs-contract.test.ts`
- `tests/release/doctor.test.ts`

### Docs 与仓库契约

- `AGENTS.md`
- `README.md`
- `README.en.md`
- `docs/architecture/m0-runtime.zh-CN.md`
- `docs/guides/agent-assisted-setup.zh-CN.md`
- `docs/guides/learning-set.zh-CN.md`
- `docs/superpowers/plans/2026-08-06-optional-static-learning-assets.md`（新增）
- `docs/audits/2026-08-06-cardless-m0-implementation-report.md`（本报告，新增）

## 完整确定性门

全部命令从仓库根目录原样执行：

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `bun install --frozen-lockfile` | 0 | Bun 1.3.14；检查 402 packages，无变更 |
| `bun run check` | 0 | release tests `22 pass / 0 fail`；App tests `142 pass / 0 fail`；TypeScript 与 Vite build 通过 |
| `bun run test:e2e` | 0 | Playwright `3 passed` |
| `STUDY_LEARNING_SET=examples/math-starter-m0/learning-set bun run doctor -- --json` | 0 | `ok: true`；七项均 `pass` |
| `STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run doctor -- --json` | 0 | `ok: true`；七项均 `pass` |

两个 Doctor 的 `learning-set`、`write`、`model` 与 `port` 均为 `pass`；模型检查发现五个可用
provider，默认端口 65000 可用。Vite 的 chunk-size 提示与 Playwright 的 `NO_COLOR/FORCE_COLOR`
提示均为非失败基线信息，不记作本任务缺陷。原始命令日志保存在
`.superpowers/sdd/task-6-runtime/deterministic/`（git ignored）。

## 真实构建服务烟测

公开启动集被复制到 `.superpowers/sdd/task-6-runtime/service/learning-set/`；源启动集未写入。
构建服务在未占用的 `127.0.0.1:64579` 启动，记录 PID `2684`，并验证监听 PID 与启动 PID
一致。

| 请求 | 结果 |
|---|---|
| `GET /api/health` | `200`，`ok: true`，runtime 为 `pi-m0` |
| `GET /api/course` | `200`，`knowledgeAvailable=false`，Plan Tree 子项为 0 |
| `GET /api/knowledge` | `200`，methods/cards/materials 均为 0 |

断言完成后再次核对命令行与监听 PID，只向 PID `2684` 发送 `SIGTERM`；进程退出且端口释放。
结构化结果位于 `.superpowers/sdd/task-6-runtime/service/smoke-results.json`。

## 真实模型两节无题卡闭环

第二份公开启动集副本位于 `.superpowers/sdd/task-6-runtime/model/learning-set/`。为满足会话、日志
均留在任务隔离根的要求，忽略目录中的运行时 harness 复制了 session factory/bootstrap 接线以改用
隔离存储目录，提供了自定义 lookup/read adapters，并在响应中追加验收审计元数据；未改动的生产
资源组装、角色 Skill、工具面、默认 ModelRuntime、Lifecycle 与 HTTP handler 均直接导入当前实现。
它不是产品改动，也没有替换模型或提示词。

- provider/model：`openai-codex/gpt-5.6-sol`
- 服务：`127.0.0.1:65213`，PID `4426`
- Roadmap Session：`019fd6b5-2dda-79c6-81e0-2c4b315af710`
- Plan Session：`019fd6b8-862f-7566-b547-3971ca524279`
- Lesson 1 Session：`019fd6bc-2dde-7f0e-9ede-3b7d87d57c32`
- Lesson 2 Session：`019fd6c2-ecff-7dce-b175-4d4e1256d07c`

学生从自然的不确定陈述开始；每一轮只根据学生可见教师回复选择下一句，没有要求模型调用
工具或制造验收结果。生命周期始终通过六个学生端 HTTP action 完成：start Plan、start/close
Lesson 1、start/close Lesson 2、complete Plan。最终 Course Tree 为一个 `completed` Plan 和两个
`closed` Lessons。

| 验收项 | 结论 | 原生 Markdown / Pi 证据 |
|---|---|---|
| 内联任务与空 Uses | PASS | 两节共 10 Blocks；6 个 problem Blocks 的 Student View 全部完整，10/10 Uses 为空 |
| 无 Scout / 无伪降级 | PASS | 四个 node Sessions、77 次工具调用、`subagent` 为 0；无 child Session |
| 不枚举缺失资产 | PASS | 学生可见回复、Student View 与工具路径均未枚举缺失的 `graph/`、`cards/`、`materials/` |
| 不声称来自题库 | PASS | 学生可见回复与公开任务无题库/卡库来源声明 |
| Lesson 2 使用 Lesson 1 | PASS | Plan 在写 Lesson 2 前读取 closed Lesson 1；明确区分四项独立成功与一次倍数方向提示后修正，并改为跨情境基准量训练 |
| 确认门 | PASS | Plan、Lesson 1、Lesson 2 与 Plan 收口均先提案、再等学生明确确认，确认前无子文档写入 |
| parent-before-prepare | PASS | Roadmap 先更新再写 Plan；Plan 每次先更新 Lesson Tree，再写对应 Lesson |
| Plan-local 路径 | PASS | 两课均为 `plans/plan-001/lessons/lesson-00N.md`，parent ID/path 与 Tree 一致 |
| 生命周期所有权 | PASS | Lesson Session 只使用 read/classroom 工具；状态只由学生 HTTP actions 推进 |
| 讲义边界 | PASS | Lesson 1 prepared 后才询问；学生请求前无导出，请求后仅一次 `artifact_export`；API 只含 5 个 Student View Blocks，无 Teacher Control |

其中 `explicitConfirmationGates` 验收项把固定 turn 文件中的结构化 mutation-order 断言，与对保留的
脱敏明确批准 turn 的人工检查结合起来；自动验收器本身不判断批准文本的语义。

每个 Lesson 的 Classroom Log 与最终状态均从原始文档复查。Lesson 1 记录一次关系方向初始错误、
一次语义追问后的自行修正，以及其余独立完成；Lesson 2 直接针对该证据改变任务形式，并在新的
价格、人数、速度和路线情境中得到独立迁移证据。

结构化验收器对 14 项检查全部返回 PASS，结果位于
`.superpowers/sdd/task-6-runtime/model/model-audit.json`。学生可见 Session 投影位于同目录的
`history-*.json`；原始 Pi JSONL 仅保留在 `.superpowers/sdd/task-6-runtime/model/sessions/`，
不得提交或公开打包。验收后再次核对 PID/命令/监听端口，只停止 PID `4426`，端口已释放。

## Diff、公开内容与隐私审计

- `git diff 5488329..HEAD --check`：退出 0，无空白错误。
- `git diff --stat 5488329..HEAD`：报告写入前 37 files，`1376 insertions / 99 deletions`。
- `git status --short`：报告写入前为空。
- 已完整阅读所有变更的生产 TypeScript/React/CSS 与 Doctor 文件，并复查公开 starter、公开
  card/index fixture、cardless fixture、README 与许可证；计划文件仅按 Task 6 范围抽查。
- 变更范围没有 `.jsonl`、凭证值、私钥或邮件地址模式，没有公开内容符号链接。
- `examples/derivative-m0/learning-set` 在 `5488329` 与当前 HEAD 的 tree hash 均为
  `257a8ed5052b75ef95698777fd5d60ffd78de462`；私有 learning-set 语料无修改。
- 未创建、修改或推送 remote、tag、仓库可见性，也未导出私有 corpus。

## 未变区域、首次失败与残余风险

Roadmap/Plan/Lesson 文档格式、Session owner、角色工具权限、Scout 协议、题卡 schema、课堂
写入工具、生命周期状态机、私有 beta learning-set corpus 与 M1 边界均未改变。确定性基础设施、
真实服务、provider 与真实模型行为没有 first-hit failure。

残余风险：

- 真实闭环只覆盖一次当前默认 provider/model，不代表跨 provider 的行为一致性。
- 两节课证明即时适应与迁移，没有证明延时保持或更长、更复杂题目的迁移。
- 模型提交给课堂日志工具的事实正文保留了冗余前导连字符，最终 Markdown 显示为 `- - ...`；
  严格解析与事实计数均正确，但属于可见的轻微格式瑕疵。
- 会话隔离依赖本轮忽略目录 harness；生产入口本身由独立构建服务烟测与完整确定性门覆盖。
