# Plan 长期记忆确认卡验收记录

日期：2026-07-28

## 验收范围

- completed Plan Coach 生成带来源的长期记忆候选；
- 候选作为独立时间线条目恢复，不伪装成学生消息；
- 学生逐条采用、改写后采用或不采用；
- 提交后唤醒原 Plan Coach，并在原卡片位置显示 submitted；
- Roadmap Coach、Tutor 和未完成 Plan 不具备候选提议权限；
- 两份 Markdown 画像仍是唯一已确认长期记忆。

## 确定性验收

- memory-review store、来源校验和提议工具测试；
- Plan Coach Session owner、隐藏 continuation 和恢复测试；
- conversation projector 顺序与原位更新测试；
- API 范围、完整决定和 agent-end reconciliation 测试；
- reducer、卡片和确认面板测试；
- Playwright 覆盖稍后处理、刷新恢复、三类决定、一次提交和不重复卡片。

## 语义检查

- 所有候选默认未选择；
- rewrite 空文本不能提交；
- 提交不等于画像写入完成；
- 前端不直接写画像；
- 隐藏决定消息不进入可见时间线；
- 卡片与决定只留在所属 Plan Coach Session；
- 不新增公共 MCP 工具、数据库或待确认 Markdown。

## 发布检查

最终提交前运行应用 `bun run check`、Playwright E2E、插件 `bun run release:check`，
并记录实际通过数量。验收记录不包含凭据、隐藏提示或课堂全文。
