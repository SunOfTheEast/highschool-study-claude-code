# 可打印 Lesson 讲义验收

日期：2026-08-06

结论：**PASS**。讲义只在 Lesson 已经可开始且学生明确同意后生成；拒绝不会调用工具，
同意只产生一次卡片。导出不修改 Lesson，API 只返回选中 Block 的公开 Student View，打印
URL 可重读，Plan Session 重启后仍能从原生工具历史恢复同一卡片。

## 运行身份

- 分支：`codex/gentle-judgment-isomorphic-acceptance`
- 起始提交：`b48ab6b`，工作树保留既有未提交改动
- 主 Coach：`openai-codex/gpt-5.6-sol:high`
- 隔离根：`/tmp/studyforge-review-handout-cRlwtl`
- 拒绝案例：`control-learning-set`，Plan Session
  `019fd52a-f135-7787-85fe-66936b9fdf53`
- 同意案例：`control2-learning-set`，Plan Session
  `019fd532-aa7c-7671-9714-359981a8bb2d`

## 真实模型同意边界

两次准备都先向学生明确报告 Lesson 已可开始，随后才询问讲义。询问只说明准备包含哪些公开
活动，没有把讲义变成开课门槛，也没有让学生填写配置表。

### 拒绝

学生回复“暂时不要讲义，直接上课就行。”后：

- 3.7 秒内得到“暂不生成讲义，课程已准备就绪”的自然回复；
- `artifact_export` 调用为 0，讲义卡片为 0；
- Lesson SHA-256 前后均为
  `4572434117349586004cdbea5df1dd458c8487e4e33fc88c4bbf453fbf5d5730`；
- Lesson 继续保持 `prepared`，可直接开始。

### 同意

学生回复“嗯，要讲义。”后：

- 约 3.5 秒出现唯一一张成功讲义卡片，约 6.0 秒完成自然语言回执；
- 只调用一次 `artifact_export`；
- URL 为当前 Plan、当前 Lesson 与按 Coach 说明顺序选择的三个 Blocks；
- Lesson SHA-256 前后均为
  `331aff3e078e59bb8d91b0f91a2bf6e20439c665378386924d62ac206c350257`；
- 没有 Worker 模型、后台队列、导出 Markdown、manifest 或 PDF 副本。

## 公开内容边界

真实 API 只返回六个顶层字段：

```text
kind, planId, lessonId, title, lessonGoal, blocks
```

三个 Block 只包含 `id/title/kind/studentView`，顺序与导出请求一致。保存的真实响应经过哨兵
扫描，不含 `Teacher Control`、`Classroom Log`、`teacherControl`、`classroomLog`、
`session_id`、原始 Session 内容或未选 Block。

服务端每次打开 URL 都沿 `ROADMAP.md -> plans/plan-001/PLAN.md -> 已链接 Lesson` 重读并
验证父子关系；工具结果和 Session 卡片只保存标题、ID 顺序和 URL，不复制正文。跨 Plan、
未链接 Lesson、重复或未知 Block、损坏 owner 均由自动化测试拒绝，且失败不修改课程文档。

## 页面、打印与恢复

- 真实打印 route 的 GET 返回 `200 text/html`，使用当前构建产物；对应 API 返回真实公开讲义。
- 独立页面位于 AppShell 外，包含标题、目标、姓名/日期、按序 Blocks、作答留白和
  “打印 / 另存为 PDF”；不加载课程树、聊天或 Session history。
- Playwright 确定性 E2E 实际打开讲义页、核对公开/私有内容、拦截 `window.print()`、返回
  Lesson 并确认仍可开课。
- 停止并重启真实服务后，Plan history 从原生工具调用/结果恢复同一张卡片，标题与 URL
  完全一致；不依赖第二份 manifest。

本轮按用户之前的验收偏好，通过 HTTP 驱动真实模型以节省浏览器上下文；真实静态 route 与
API 做了连通检查，完整浏览器打印交互由同一构建产物上的 Playwright E2E 覆盖。

## 失败与非阻塞性

- Lesson 在询问讲义前已经写入、链接、回读并公开报告可开始；
- 拒绝、无回应和导出失败都不改变 Lesson 生命周期；
- 投影层把 malformed success 降为不泄密的失败卡，不退回可展开的 generic tool detail；
- 页面来源失效时明确报错并提供返回 Lesson 的链接，不枚举目录猜替代内容。

## 证据索引

- 拒绝 Session：`/tmp/studyforge-review-handout-cRlwtl/pi-agent-control/sessions/--tmp-studyforge-review-handout-cRlwtl-control-learning-set--/2026-08-06T03-43-09-109Z_019fd52a-f135-7787-85fe-66936b9fdf53.jsonl`
- 同意 Session：`/tmp/studyforge-review-handout-cRlwtl/pi-agent-control2/sessions/--tmp-studyforge-review-handout-cRlwtl-control2-learning-set--/2026-08-06T03-51-35-292Z_019fd532-aa7c-7671-9714-359981a8bb2d.jsonl`
- 真实公开 API 快照：`/tmp/studyforge-review-handout-cRlwtl/evidence/control2-handout.json`
- 同意案例 Lesson：`/tmp/studyforge-review-handout-cRlwtl/control2-learning-set/plans/plan-001/lessons/lesson-001.md`

隔离根保留供审阅，其中 Provider 配置与原生转录不得提交或公开打包。
