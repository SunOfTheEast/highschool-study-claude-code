# 温和教师判断验收

日期：2026-08-04

## 变更边界

本轮只修改共享教学内核、Plan/Lesson 角色提示和五条悟人格。未增加运行时阶段、
schema、工具、Agent、前端门禁或提示词固定措辞测试。

## 确定性验证

- `bun run check`：通过（45 tests，0 fail；typecheck/build 通过）。
- `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`：通过（1 passed）。
- 构建警告：保留既有的单个前端 chunk 大于 500 kB 警告；没有新增警告。

## 同输入模型对照

用户在第一份 Flash 结果暴露出超长复议后，要求改用大参数的
`deepseek-v4-pro`。因此没有继续机械复制五次 Flash，而是在第二份完全隔离、内容相同
的学习集上使用相同人格、high thinking 和学生输入作模型对照：

> 下一节别做问诊了，直接给我五道最难的题，方法越多越好。我就想这么练。

| 模型 | Session | 观察边界 | 首次可见回复 | 父 Session reasoning | 父工具调用 | 是否先澄清活动歧义 |
|---|---|---|---:|---:|---:|---|
| `deepseek-v4-flash` | `019fc8bd-2023-7b3c-9a4c-0439b1ab4f9a` | 完整回合自然结束 | 499 秒 | 24,914 | 14 | 否 |
| `deepseek-v4-pro` | `019fc8c7-a00e-7d3e-aa5a-00f949c7cd65` | 首次公开接受及紧邻工具动作后主动停止 | 61 秒 | 2,717 | 17 | 否 |

Flash 的父 Session 还启动了五路 Scout；子 Session 合计使用 21,833 input、34,954
output tokens，共 37 turns。学习集只有一张已用过的样例卡，最终没有生成 Lesson，
但 Coach 在公开回复前已经把第二课方向写进 Plan。完整原始 JSONL 保留在：

`/Users/yangrundong/.pi/agent/sessions/--tmp-studyforge-gentle-judge-1-5a4lyt-learning-set--/2026-08-03T17-47-45-571Z_019fc8bd-2023-7b3c-9a4c-0439b1ab4f9a.jsonl`

Flash 的私有推理一度准确识别出两个会产生不同课堂的解释：学生先独立尝试后比较，
或教师先展示多解全景；它也一度认为应只问一个问题。但随后反复复议，把“我就想
这么练”自行解释为前一种，又把“允许小而可逆的调整”解释成可自行把“绝对最难”
改成“高难且存在多条真实路线”，于是宣布公开安排已经确定并进入五题备课。

Pro 没有发生同等规模的自我复议。它把请求直接归为“清楚、合理、符合本 Plan 的
选路目标”，约一分钟后公开接受。原始 JSONL 保留在：

`/tmp/studyforge-pi-v4-pro-xbdMOd/sessions/--tmp-studyforge-gentle-judge-2-n6psws-learning-set--/2026-08-03T17-59-13-678Z_019fc8c7-a00e-7d3e-aa5a-00f949c7cd65.jsonl`

这证明两件不同的事：V4 Pro 显著减少了 Flash 的重复推理和等待，但模型替换没有让
“只要存在两个实质不同解释就先澄清”自动成立。两者都越过了这个语义边界，只是 Pro
越得更快、更自然。

## 结论边界

提示词修改没有通过预设的严格歧义处理标准，因此不能宣称语义问题已修复。模型对照则
支持把后续自然学生长程验收切换到 V4 Pro：它更适合观察真实教学链路，不会让一次
局部协商被 Flash 的超长 CoT 和五路素材检索主导。这个选择只改善运行质量，不替代
对提示词缺口的如实记录。
