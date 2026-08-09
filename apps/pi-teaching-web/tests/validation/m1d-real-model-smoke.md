# M1d 真实模型界面冒烟

日期：2026-08-09

## 运行身份

- worktree：`worktree-frontend-redesign`
- 冻结基线：`4aa5bee1450b4f6a096d3bf30e080c8eb415e89f`，运行时包含尚未提交的 Task 8 验收改动；运行前 tracked diff SHA-256 为 `d1d1d1284951a8c1788d42cf8b2e829f364cd00345d3a745296089592efabc1b`
- 主模型：`openai-codex/gpt-5.6-sol`，thinking `high`
- Scout：`openai-codex/gpt-5.6-terra`，thinking `high`
- 隔离运行目录：`/private/tmp/studyforge-m1c-validation-m1d-xt0a39`
- learning-set seed SHA-256：`7de6d56c04aa56cedd436bb003eba389677174730ae01e9602949dbf77b2bafb`
- 本地端口：`65241`

运行只修改隔离 learning-set。仓库不保存 OAuth、原始 Session JSONL、完整转录、隐藏提示或私有思维链。

## 情境

使用一个已经关闭两节课、Plan 仍 active 的真实课程副本。先由学生自然表达“再找两道外表差别大的题，判断是否还值得练结构识别，但先不要替我定下来”。教师先回读证据并公开判断，没有越过批准门搜索。学生随后在真实页面明确确认两题方案，Coach 才进入备课与 Scout 检索，最终生成 `lesson-003`，状态为 `prepared`。

### 第一轮：讨论与流式回复

- 第一条可见工具活动延迟：`9,484 ms`
- 第一段 assistant delta：`38,183 ms`
- assistant 文本由 `254` 个非空 delta 在约 `6.7 s` 内连续到达
- 整轮收口：`45,293 ms`
- 回复含 `\(F(t)=te^t\)`；真实 DOM 中由生产 `MarkdownView` / KaTeX 渲染

### 第二轮：确认后的长等待

- 学生从真实 Plan 页面提交确认：`2026-08-09T07:19:26.302Z`
- 最终可见回复：`2026-08-09T07:31:48.368Z`
- 总时延：约 `12 min 22 s`
- 三批材料检索分别显示：
  - `4 / 4`，`83,305 ms`，`17` 次操作
  - `4 / 4`，`109,711 ms`，`16` 次操作
  - `2 / 2`，`70,347 ms`，`8` 次操作
- 第一批候选与上一课过近，Coach 公开说明后继续补找；一个后台分支失败，但其余候选足以完成 Lesson，最终课程树新增 `lesson-003 | 一次冷启动与一个自适应检验`

本轮所有父/子 Session 汇总用量为 `1,573,528` tokens，其中 input `584,790`、output `40,002`、cache read `948,736`、reasoning `25,315`。这是既有真实备课链的性能风险，不是 M1d 前端新增负担。

## 学生界面证据

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 流式回复 | PASS | 254 个 assistant delta；页面在最终回复前持续收到活动与文本更新 |
| 长等待进展 | PASS | 页面连续显示三批“材料检索”数量、耗时和操作数；普通思考状态作为间隙兜底 |
| 公式 | PASS | 最终 Plan 页面有 3 个 `.katex` 节点，公式无原始分隔符泄露 |
| 安全回执 | PASS | 读取显示“老师查看了相关内容”，普通完成显示“处理完成”，失败显示“这一步没有完成 / 后台任务失败” |
| 隐私边界 | PASS | 页面不含 `"path":`、`teacherRationale`、`memory/objects/` 或原始工具 JSON |
| 生命周期一致性 | PASS | 最终回复称 Lesson 003 已准备，`/api/course` 同时返回同一 Lesson 为 `prepared` |

关键截图位于被 `.gitignore` 排除的 `apps/pi-teaching-web/output/playwright/`：

- `m1d-real-model-plan-before-confirm.png`
- `m1d-real-model-scout-running.png`
- `m1d-real-model-long-wait-current.png`
- `m1d-real-model-plan-complete.png`

## 结论

**M1d 学生界面真实模型冒烟通过。** 流式 transport、长任务投影、KaTeX、安全回执与最终课程投影均在真实 provider 下成立。

保留一个非阻塞风险：本次确认后的备课用了三批检索和约 12 分 22 秒，并出现一个可恢复的后台分支失败。M1d 已证明学生不会面对静默黑箱或内部错误细节，但没有解决 Coach 选材与深核验本身的成本；该问题应在后续检索/备课性能工作中独立处理，不能用前端文案掩盖。
