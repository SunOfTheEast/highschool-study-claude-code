# StudyForge 分层学习节点 Runtime 真实验收

日期：2026-07-31  
结论：通过；一个前端只读态问题转交“三坐标工作台”计划处理。

## 1. 验收范围与基线

- 初始验收基线：`4e6ca20`（完成分层契约迁移）
- 最终复验代码：`5f58c04`
- 模型：`deepseek-v4-pro`
- Provider：`deepseek`
- 凭据：使用独立 Pi 凭据目录；本报告不记录密钥、Base URL 或完整系统提示词
- Student A 学习集副本：
  `/tmp/studyforge-hierarchical-acceptance-clean-20260731-Qx1imV/learning-set`
- Student B 学习集副本：
  `/tmp/studyforge-personalization-b-20260731-cxJQTH/learning-set`

验收使用真实模型、真实 Session、真实 Markdown 写入和真实页面操作。公开示范学习集未写入验收事实。

## 2. Node Session

### Student A：会方法，但在可行路线之间犹豫

| Node | Session |
|---|---|
| Roadmap Coach | `019fb4b4-c47e-7177-bcef-47f1b9dbae18` |
| Plan Coach · plan-001 | `019fb4c7-ff6f-7b8d-bff9-4e5af4e55764` |
| Tutor · lesson-001 | `019fb4da-bd5d-79d8-abcf-6c705713485c` |
| Tutor · lesson-002 | `019fb4f7-03b4-729c-94fe-4b7546034d4c` |
| Tutor · lesson-003 | `019fb506-61c5-7fcd-b2d8-0d62e24dc668` |

### Student B：选路快，但在变形后遗漏条件

| Node | Session |
|---|---|
| Roadmap Coach | `019fb517-1466-7a7b-a0f8-60e15f00bf5b` |
| Plan Coach · plan-001 | `019fb51b-a68f-7d2e-afa3-7b55d8acebea` |
| Tutor · lesson-001 | `019fb51f-410a-70e7-9284-0c93c81fda33` |
| Tutor · lesson-002 | `019fb52b-2a51-7742-9cc9-28ab76d2118c` |
| Tutor · lesson-003 | `019fb537-7a78-726f-98e4-aa580f855ef4` |
| Plan Coach · 边界补测 plan-002 | `019fb554-edc2-7d11-b975-9c807024e2f3` |
| Tutor · 边界补测 lesson-004 | `019fb556-5b3e-799a-8e2c-d62af1fa61f3` |

每个 Session 的 owner 均来自对应 Node frontmatter；没有复制父 Session 或兄弟 Session 的聊天历史。

## 3. 生命周期 Smoke

生命周期主链通过：

1. Roadmap 问诊后建立两个 Plan Candidate。
2. 只把学生选中的近期 Candidate 物化为 `plan-001`；另一 Candidate 保留在 Roadmap。
3. 学生显式进入后才激活 Plan Session。
4. Plan 问诊、检索和备课后建立 Lesson Candidate，并只物化下一课。
5. 学生显式点击后才激活 Tutor Session。
6. Lesson 关闭后成为只读 Replay，学生点击后回到原 Plan Session。
7. Plan 根据已关闭 Lesson Handoff 调整后续未激活 Lesson。
8. Plan 完成后生成自身 Handoff；Roadmap 只引用 Plan Claim 写 checkpoint。
9. Roadmap 保留未物化的另一 Plan Candidate，没有自动推进。

Candidate 在物化前没有文件或 Session；prepared 与 active 状态在刷新和深链后均能从 Markdown 与 owner Session 恢复。

## 4. Activation Snapshot 与个性化差异

两名学生使用同一导数资产、同一长期目标和可重叠题卡，但冻结上下文与课堂设计不同。

### Student A

历史判断是“方法会做，但两条路线都能走时犹豫”。Plan 把课堂重心放在：

- 动笔前比较路线代价；
- 移除显眼支点后再选路；
- 发现原路线代价过高时切换；
- 使用一题多解验证真实采用的方法，而不是照抄题卡声明。

### Student B

历史判断是“选路迅速，但分离参数或除式后容易遗失限制、端点和取等条件”。Plan 把课堂重心放在：

- 无提示基线观察；
- 一句不展开数学步骤的泛化提醒；
- 无提示陌生题验收；
- 三个执行锚点：变形前标记限制、变形后核对丢点、结论处回原式检查取等。

Student B lesson-003 的 `Activation Snapshot` 由当前 Plan 的冻结判断和已确认偏好组成；Tutor 没有获得前两课完整聊天。个性化差异落实到了目标、课堂顺序、介入方式和观察口径，不是只换开场话术。

## 5. Handoff 证据树

通过的证据路径为：

```text
Roadmap checkpoint claim
  → Plan Handoff claim
    → Lesson Handoff claim / source-only index
      → active Trace
        → Lesson + Block + Card + Tutor Session
```

边界如下：

- Lesson Handoff 只允许当前 Lesson 的 Trace、Session、Card 和 Claim。
- Plan Handoff 可引用子 Lesson Handoff 的 Claim；若子 Handoff 为 source-only，则按索引解析当前子事实。
- Roadmap checkpoint 只引用 Plan 自身 Claim，不直接抄 Lesson Claim、Trace 或 Session。
- `rejectedIssues` 在有效 Handoff 中为空；确定失效的来源不能继续进入父级结论。
- Handoff 的 `Boundary` 保留“一题、一路线、单一结构”等限制，没有升级成跨方法稳定能力。

真实验收曾捕获并修复两类越界：

1. Lesson Handoff 引用了前一 Lesson 的 Claim；
2. Plan/Roadmap 总结直接使用了低层 Trace 或 Session。

修复后，同一情境的 Runtime 会拒绝越界来源，模型可改用合法的当前层来源完成交接。

## 6. Trace、纠错与投影

### 写入

Trace 均由 Runtime 绑定：

- `plan_id` / `plan_path`
- `lesson_id` / `lesson_path`
- `block_id`
- 当前揭示的 `card_path`
- `occurred_at`
- Tutor Session owner

同一题卡一次 attempt 不因多个课堂步骤重复增加证据计数。方法投影只读取 active Trace，并继续作为备课注意信号，不作为自动 mastery 判决。

### 纠错

本轮没有发生“学生异议被 Tutor 接受后，旧 Trace 事实必须撤销”的情境，因此没有制造虚假的 supersede。supersede 的确定失效与非级联历史保留由自动测试覆盖；真实验收验证了学生纠正 Tutor 的口头映射后，Tutor 另写准确的 reflection Trace，并在 Handoff 中采用修正后的口径。

### 边界补测

`lesson-004` 产生两条事实：

- `trace-f1698d47-eb04-42a3-a598-d96111eb3f0d`：错误路线，`assessment: incorrect`，`support: none`
- `trace-41dc1dc3-35d6-4f46-b275-65888f7e49a7`：半句后疲劳早退，`assessment: incomplete`，`support: none`

两条 Trace 都绑定真实 Block；早退没有被改写成能力失败，也没有生成稳定能力结论。

## 7. Tutor 真实情境

| 情境 | 真实覆盖 | 结果 |
|---|---|---|
| 完全答错 | Student B lesson-004 | Tutor 先复述理解，再追问触发结构；未抢答或倾倒标准解 |
| 部分正确 | Student B lesson-001 | 正确结果但漏限制与边界回查，记录为 partial |
| 只写半句 | Student B lesson-004 | Tutor 承接已表达部分，只问“后面怎么想”，未替学生补全 |
| 卡住并请求提示 | Student A lesson-001 | 按学生请求给出有限提示，并记录 support |
| 提示后完成 | Student A lesson-001 | 后续 attempt 与提示依赖一并保留 |
| 提出另解 | Student A lesson-003 | 按实际路线绑定，不把题卡默认方法当作学生方法 |
| 反驳 Tutor | Student B lesson-001、lesson-003 | Tutor 接受对遗漏数目和锚点映射的纠正，最终 Handoff 使用修正口径 |
| 疲劳主动早退 | Student B lesson-004 | 立即结束，不劝继续、不评价能力、不布置任务 |

`lesson-004` 页面关闭后是只读 Replay，Lesson Summary 如实写明停止位置、未完成状态与退出方式。

## 8. 长期记忆确认

Student B 完成 `plan-001` 后：

1. Plan Handoff 先封存带来源的教学 Claim；
2. Plan Coach 在同一终止 turn 发起长期记忆候选；
3. UI 逐条展示候选、来源和边界；
4. 学生仅采用一条有范围限制的教学偏好；
5. Runtime 原子解析并写入完整 `teaching-profile.md`；
6. `student-profile.md` 未被覆盖或误改；
7. Roadmap checkpoint 在记忆确认后仍只使用 Plan Claim。

采用的偏好限定在“培养可重复检查程序”的周期，不机械推广到所有学习目标；反证边界明确为只有一个 Plan。

## 9. 真实验收发现并修复的问题

以下问题都由真实流程复现后修复，并各自有定向测试：

- 激活证据句柄一度没有绑定当前 Node 上下文；
- 检索失败信息可能进入学生可见输出；
- 空 Node Tree 被错误填充；
- Candidate 引用了越界来源；
- 诊断题公开摘要泄露来源编号；
- 父级 Handoff 索引刷新不及时；
- 子级证据可绕过 Handoff Claim 进入父级；
- 每题 attempt 没有被明确约束在单一 Block；
- Lesson Handoff 可误用兄弟 Lesson Claim；
- Plan 完成结论可能在学生确认前封存；
- Lesson Link 与 Evidence Source 混用；
- source-only Lesson Handoff 的来源范围过宽；
- 已物化子节点仍显示冻结 Candidate 的旧公开目的；
- 完成 Plan 后的长期记忆提议被错误推迟到不可写的下一 turn；
- Runtime 已应用记忆后，Agent 被要求重读其无权读取的完整画像；
- assessment 题号未按学生安全投影隐藏。

没有因为单次模型参数错误引入通用重试框架，也没有用 Skill 文案掩盖 Runtime 身份和来源权限问题。

## 10. 剩余边界

### 已知 P1：完成 Plan 的聊天壳仍会请求 deep-mode 状态

完成后的 Plan 本应是只读历史，但旧 Plan 页面仍请求 `/api/sessions/<plan>/deep`，服务返回 `PLAN_SESSION_NOT_ACTIVE: completed`。事实文件、Handoff、长期记忆和返回 Roadmap 均不受影响。

该问题属于前端终态投影，不应通过重新开放 completed Plan 写权限修复。它转交后续“三坐标工作台”计划：完成 Plan 明确渲染只读态，并停止请求 active-only Session API。

### 未证明内容

- 一次真实验收不能证明跨学科或长期数月后的个性化稳定性。
- Student B 的无提示迁移只覆盖一题、一路线和一种函数结构。
- supersede 的运行时契约已由自动测试覆盖，但本轮没有人为制造需要撤销旧事实的真实课堂。

## 11. 自动验证

最终验证结果：

- `apps/pi-teaching-web`
  - `bun run test`：367 pass，0 fail
  - `bun run typecheck`：通过
  - `bun run build`：通过；仅有 Vite chunk-size 提示
  - `bun run test:e2e`：21 pass，0 fail（使用隔离端口，未中断已有本地实例）
- `plugins/highschool-study`
  - `bun run release:check`：67 pass，0 fail
  - build：通过
  - typecheck：通过
  - `claude plugin validate --strict`：通过
  - 公共 MCP：仍为四个

最终检查还发现资源加载集成测试会真实执行 Pi 扩展发现，稳定耗时约
5.1 秒，刚好超过 Bun 默认 5 秒预算。空 Agent 目录复验耗时相同，排除本地配置
膨胀。仅将该集成测试预算调整为 15 秒；生产资源加载逻辑未修改。

## 12. 最终判断

分层 Node Runtime 已经满足本次重构的核心目标：

- Roadmap、Plan、Lesson 是实际控制权树；
- Candidate、prepared、active 与 terminal 的权限边界真实生效；
- 子节点只读取冻结上下文和合法来源，不复制父会话；
- Trace 可回到 Lesson、Block、Card 与 Session；
- Handoff 形成可回溯证据树；
- 长期记忆只由 completed Plan、学生确认和 Runtime 原子写入产生；
- 同一资产能因不同历史产生不同的教学设计；
- Tutor 在错误、半句、提示依赖、另解、反驳和主动早退情境中保持了正确教学边界。

因此第一份 StudyForge 分层节点 Runtime 计划通过验收。剩余 P1 不阻塞事实正确性，纳入紧接着实施的三坐标工作台前端收口。
