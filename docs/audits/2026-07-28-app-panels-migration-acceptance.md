# StudyForge App 功能面板迁移验收

日期：2026-07-28

## 验收范围

本轮把四块已批准的产品面板接入现有 Pi 前端：

1. 固定当前课堂与文档式课堂情境；
2. 学生安全的研习资料；
3. 续学优先的学习集首页；
4. Session 级陪伴风格与浏览器本地展示偏好。

它们与同批完成的 Plan 长期记忆确认卡共享原有 Roadmap、Plan、Lesson、Trace 和
Pi Session 事实边界，没有引入数据库、后台索引服务、新公共 MCP 工具或第二套路由。

## 状态归属

| 内容 | 唯一 owner | 前端行为 |
| --- | --- | --- |
| Roadmap、Plan、Lesson、题卡、材料 | learning set 中的 Markdown/YAML | 只读或通过既有窄写入更新 |
| 作答与方法记录 | Lesson 中的 active Trace | 投影到近期记录、方法进展和研习资料 |
| 对话、工作流、陪伴风格 | 对应 Pi Session | 不复制到其他 Session |
| 首页续学目标 | 从未完成 Plan/Lesson 事实确定性计算 | 只保存仍然 eligible 的最近路由 |
| 柔和动效、完成反馈 | 浏览器 `studyforge.presentation.v1` | 不进入模型上下文或 learning set |
| overlay 打开状态、搜索词 | 当前 React 页面 | 关闭或离开页面后不形成学习事实 |

## 集成场景

Playwright fixture 同时提供 prepared、active、paused、closed 和 abandoned Lesson，
一个 active Block、一个 pending Block、一个被 supersede 的旧 Trace、一条 active
Trace、一份材料和一个学习集自定义陪伴风格。完整场景验证：

- 首页只有一个主续学入口，并优先进入 active Lesson；
- 固定课堂只显示 active Block 的 `Q-DOMAIN-EX22`，不显示 pending
  `Q-DOMAIN-EX16` 或 Teacher Control；
- 课堂情境默认只展开第一节，可读取当前 active Trace；
- 以 Trace 文本搜索可反查真实题卡，并只返回完整 active 历史；
- 来源透镜关闭后保留原搜索结果；
- 自定义陪伴风格不泄漏内部提示，选择后刷新仍留在所属 Session；
- 从 Tutor 去学习顾问时先暂停，续课后仍在原 Block；
- closed Replay 可以刷新恢复，但不会覆盖首页保存的 active 续学位置。

## 自动检查

在提交前实际运行：

```text
apps/pi-teaching-web
  bun run check
  → TypeScript PASS
  → 229 tests PASS
  → production build PASS

  bun run test:e2e -- --reporter=line
  → 16 Playwright tests PASS

plugins/highschool-study
  bun run release:check
  → 55 tests PASS
  → claude plugin validate --strict PASS
  → public MCP tools: exactly 4
```

生产构建仍有一个非阻断提示：主 JavaScript chunk 约 636 kB，超过 Vite 默认的
500 kB 提示阈值。本轮没有为此引入代码分割，因为它不影响本地单人版功能或正确性。

## 视觉检查

使用 1440×1000 桌面视口和 390×844 窄视口，在隔离的 E2E learning set 上检查：

- 首页首屏只有一个深色主入口，其余概述、信号和回放保持次级；
- 当前课堂在视觉上强于聊天历史，右侧情境是一列连续文档而非卡片仪表盘；
- 研习资料与陪伴风格以 overlay 打开，底层 Session 和路由不变；
- 390 px 宽度下 `scrollWidth === clientWidth === 390`，无横向溢出；
- 关闭柔和动效后根节点切为 `data-motion="reduced"`，过渡与动画时长降为
  `0.00001s`；
- 浏览器只报告 fixture 环境缺少 `favicon.ico`，没有运行时页面错误。

截图只包含公开演示题卡与合成 fixture；完成肉眼检查后不作为产品资产提交。

## 结论

两份设计稿所需的 UI、事实投影、Session 归属与集成链路均已实现。四块面板现在是
同一学习闭环的不同视图，不会绕过学习顾问、提前揭示 pending 内容，或把展示偏好
误写成学习事实。
