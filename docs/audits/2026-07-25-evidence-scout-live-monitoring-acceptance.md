# Evidence Scout 180 秒与实时监控验收

## Run Identity

- 受验代码：`main@38c3656`
- 源分支：`codex/lesson-close-reflection-decoupling`，受验前后 clean
- 隔离运行根：`/tmp/studyforge-scout-live-PFRcRc`
- 学习集：导数示例学习集的独立副本
- 前端：`http://127.0.0.1:65036`
- Provider / Model：`deepseek / deepseek-v4-pro`
- Coach Session：`019f9970-20b4-72cc-9923-b41600c51613`
- Evidence Scout Session：`019f9971-290c-7773-8b87-c90065eb4fce`
- Workflow：`wf-14341942-f442-469a-af7d-d46eae11ac7a`

隔离运行仍保留，等待用户审阅；报告不包含 API key、隐藏提示词、完整子任务转录或思考内容。

## Automated Baseline

| 检查 | 结果 |
|---|---|
| `plugins/highschool-study: bun run release:check` | PASS：52 tests、TypeScript、MCP bundle、Claude 严格插件校验 |
| `apps/pi-teaching-web: bun run check` | PASS：161 tests、TypeScript、production build |
| `apps/pi-teaching-web: bun run test:e2e` | PASS：12 Playwright tests |

## Real-Model Evidence

Coach 在可见页面中启用深度模式，并请求一个只读 Quick Evidence Scout 检索当前 Plan 的题卡、前三节 Lesson 与 active Trace。

| 项目 | 观察 |
|---|---|
| 预算 | `180000ms`、`50000 Token`、单 Scout |
| 终态 | `completed` |
| 实际耗时 | `84119ms`，成功越过旧 45 秒边界 |
| 消耗 | `26120 Token`、9 次工具 |
| 紧凑结果 | 4 张题卡、20 个来源；8 个唯一来源文件全部存在 |
| 运行中任务轨 | 显示安全活动名、`12 / 180 秒`、`20,196 / 50,000 Token`、9 次工具和“来源完成后汇总” |
| 完成后任务轨 | 显示 4 张题卡、20 个来源 |
| Coach 交接 | Scout 完成后才显示紧凑中文摘要 |

任务轨由 `pi-subagents` 事件驱动更新。最后一次工具事件之后，模型进入纯生成阶段，页面不会凭空推算新的 Token 或活动；因此运行中最后一次可见耗时停在 12 秒，终态审计记录为 84.119 秒。这不影响超时或结果，但如果以后需要每秒跳动的时钟，应另行设计客户端插值或运行时 heartbeat。

## Integrity Audit

| 层 | 结果 | 证据 |
|---|---|---|
| Provider / Model | PASS | 父、子 Session 都记录 `deepseek-v4-pro` |
| Session owner | PASS | Coach owner 为 `plans/domain-integrity.md` |
| Workflow runtime | PASS | final snapshot 为 `completed`，任务指标完整 |
| Student projection | PASS | 运行中没有显示检索参数、思考或半成品结论 |
| Parent JSONL | PASS | `recentOutput`、`recentOutputLines`、`currentToolArgs` 命中数为 0 |
| Source authenticity | PASS | 所有题卡和 evidence ref 指向的文件均存在 |
| Read-only boundary | PASS | Scout 启动后，`.pi-subagents` 之外的学习集文件写入数为 0 |
| Route recovery | PASS | 刷新后仍位于 `/plan/domain-integrity`，完成态工作流与 Coach 摘要均恢复 |
| User worktree | PASS | 原有 dirty 文件保持原样，没有被验收过程修改 |

子 Agent 原始 JSONL 保留完整审计记录；Student View 与父工作流投影只接收安全指标和最终紧凑结果。子模型最终输出带了一句前导文本和 fenced JSON，现有解析器按既定兼容路径正确提取，未影响 UI 或事实结果。

## Result

本轮验收 **PASS**。180 秒上限解决了旧的固定 45 秒取消问题；事件驱动的安全监控、最终压缩交接、只读边界和刷新恢复均在真实 DeepSeek 会话中成立。

