# 学生安全六课复验

日期：2026-07-29  
结论：`BLOCKED AT LESSON 5 READINESS`

本轮从全新 Roadmap 开始，目标是完成一个六课 Plan、结构化 Learning Review、
长期画像确认和返回原 Roadmap Coach 的跨周期回访。Roadmap、Plan 问诊以及前四节
真实课堂均已完成；第五节已经备好但尚未开始时，学生可见的 Plan 面板提前显示了
题卡、目标题、预设困难点和替代路线。继续上课会污染第五、六节的首次尝试证据，
因此按预先声明的学生安全停止条件冻结运行。

本报告只记录可复核的运行事实。凭据、隐藏提示、完整 thinking、完整题卡 payload
和完整聊天转录均未写入。

## Branch Audit

- `codex/student-safe-teaching-reliability` 已 fast-forward 合并到 `main`。
- `codex/studyforge-lane-b` 与 `codex/studyforge-lane-c` 的提交均被 `git cherry`
  判定为已通过等价 patch 进入 `main`，不应再次合并。
- `codex/app-function-panels` 是较早、与现有主线大面积重叠的旧实现，未合并。
- 本轮修复后验收基线：`main@dc591cdcc8d39f6995de1abb6bab38a2928dd903`。
- 工作区只保留了验收前已有的两个未跟踪用户文件，本轮未触碰。

## Preflight Schema Failure And Fix

第一次进入 Plan Coach 时，DeepSeek 在生成前拒绝了全部工具 schema：

```text
Invalid schema for function 'plan_update':
schema must be a JSON Schema of 'type: "object"', got 'type: null'
```

根因是 `4aed5bc` 把 `plan_update` 的顶层从 `Type.Object` 改成
`Type.Union`，序列化后根节点只有 `anyOf`，没有 provider 要求的
`type: object`。此前真课没有出现，是因为相关验收停在 Roadmap Coach，
而 Roadmap Coach 不加载 `plan_update`；本地测试也只用 TypeBox 校验值，
没有把 schema 提交给真实 provider。

修复 `dc591cd` 保留顶层 object，并用根级 `oneOf` 表达
active/replan/complete 的互斥约束。验证结果：

- `bun run check`：278 pass，0 fail；
- typecheck 通过；
- production build 通过；
- 独立 DeepSeek 真机 smoke 中，Plan Coach 成功完成一次一问并正常调用工具；
- 本轮完整运行中，真实 Plan 更新成功。

## Run Identity

- Runtime root：`/tmp/studyforge-six-lesson-final-zMsYzg`
- Learning set：全新模板 Roadmap + 导数题卡、图谱与公开材料副本
- Cards/graph hash：
  `bde0d45b6f9548af8c355c3ead23bade09fd04081ab3272b67b7f32793b03323`
- Provider / model / thinking：`deepseek / deepseek-v4-pro / high`
- Message projection：`safe`
- Server：`127.0.0.1:63872`
- 学生可见泄露截图：
  `/tmp/studyforge-six-lesson-final-zMsYzg/student-visible-plan-leak.png`
- Roadmap Coach：`019facec-5575-704f-b0ee-7033ae8842fa`
- Plan Coach：`019facf3-908c-7854-9615-cac2ee9f2bc2`
- Lesson 1 Tutor：`019facfb-570f-7200-b0aa-bc95c8c5b616`
- Lesson 2 Tutor：`019fad08-1d64-717c-b528-bef353394cbc`
- Lesson 3 Tutor：`019fad19-65b2-75aa-98d7-65dadeb9ec5d`
- Lesson 4 Tutor：`019fad27-4318-7522-89b8-7689360887fa`

每个 Session 都有唯一的 `studyforge.session-owner.v1`，分别绑定
`ROADMAP.md`、当前 Plan 或对应 Lesson 文件。

## Natural Trajectory

学生以普通高二学生身份说明：导数基础操作稳定，但做含参不等式时容易沿用第一问
的分类框架；即使已经看到导数零点含参、分支交叉等换路信号，也常再硬分一层。
Roadmap Coach 通过逐次询问，和学生共同确定三周六课 Plan：

> 面对陌生题，在 3–5 分钟内写出分类讨论与构造路线的入口、下一步难点和选择理由；
> 初始选择不要求押中，但换路必须说明具体信号。

已完成课堂：

1. **Lesson 1：诊断。** 学生技术执行稳定，能看到局部反证信号，但对“局部证据
   足以排除一段参数”有一拍不信任。
2. **Lesson 2：定向练习。** 学生把必要性与充分性拆开，局部信号只负责排除参数，
   不再要求它包办整题；目标行为达成。
3. **Lesson 3：无提示迁移。** 学生自发用二阶导把全局问题压回边界，节奏更自然。
   学生主动指出它仍属于端点导数同族，因此只接受“同族进阶”的证据，不把它夸成
   跨类型迁移；Tutor 接受了这个证据边界。
4. **Lesson 4：前摄双路比较。** 学生在执行前比较两条路线的入口与第一瓶颈，
   选择更直接服务恒成立目标的路线并独立完成。反思进一步收窄为：
   比较只写入口、首个瓶颈和换路信号，不把“两路比较”做成两边各解半题。

第五节计划训练“路线仍能硬做、但成本已明显上涨时主动换路”。Lesson 文件已经
写出，Tutor Session 尚未创建。

## What Passed

### Roadmap 与 Plan 问诊

- 一次只问一个会改变决策的问题；
- 学生能修正诊断口径和课次取舍；
- Coach 能区分“补跨类型信号”与“保留原 Plan 核心终点”的机会成本；
- 学生安全的课程就绪卡只显示环节数量和一般形式，没有泄露题目。

### 教学连续性

- 四个 Tutor Session 相互独立，并通过 Lesson 文件和 Trace 交接；
- 前课行为会真实改变后课设计；
- Tutor 能接受学生自创路线和更谨慎的证据口径；
- 四节课均正常关闭，Lesson Summary 与 Trace 可重读；
- Trace 能保留 incomplete/partially_correct → correct 的 supersede 链。

### 教学质量

- Coach 没有机械执行原六课清单，而是根据前课结果动态调整；
- 第三节选卡没有完全命中预定“跨族信号”，Tutor 和学生都没有把它包装成完全通过；
- 第四节把“会做题”上移为“能说明为什么选这条路”，已经触及本 Plan 的核心能力。

## Blocking Failure

第五节备课完成后，学生可见的 `ContextStack` 直接渲染了 Plan 的
`Next Lesson Candidate` 与 `Plan Summary`。其中包含：

- 题卡短号和目标函数；
- 目标小问；
- 默认路线会出现的具体导数与隐零点困难；
- 更优替代路线的决定性变形；
- 预设的换路信号和课堂剧情。

安全的课程就绪卡本身没有泄露，但同一页面右侧的 Plan 面板已经把这节课为何要换路、
从哪里换、换到哪里全部说完。第五节的首次选择与中途换路证据因此失效。

### Root Cause

这不是单一措辞问题，而是两个输出通道的边界不一致：

1. `lesson_prepare` 的学生交接有确定性的安全就绪投影；
2. `plan_update` 的三个自由文本字段会原样写入 Markdown；
3. `coach-context.ts` 再把这些字段原样交给 `ContextStack.tsx` 展示；
4. Skill 虽然要求题面、方法、决定性结构和选卡理由保持私有，但运行时没有对持久化
   Plan 字段做同等边界；
5. 本次 Coach 在私有选卡后再次调用 `plan_update`，把备课信息写进了学生可见 Plan。

因此当前机制是“课程就绪消息安全，但旁边的 Plan 可能泄露”。只靠继续强化提示词
仍然是 fail-open：模型只要有一次把备课摘要写进 Plan，安全投影就会被绕过。

## Non-blocking Findings

### Plan review 一次漏写

Lesson 3 结束后，Coach 没有先调用 `plan_update`，就直接准备了 Lesson 4。
当时右侧 Plan 仍停在 Lesson 2 / Lesson 3 候选。Lesson 4 结束后 Coach 才补写并
恢复到正确状态。最终文件没有损坏，但违反了“每课关闭后先复盘写回、再备课”的契约，
刷新恢复期间可能得到陈旧方向。

### 真实 provider 短暂故障已恢复

- Plan Coach 发生一次 `Connection error`；
- Lesson 2 在一道短热身题后发生一次五分钟 provider timeout；
- 两次都在同一 Session、同一事实链上自动续写恢复，没有重复学生输入或丢失 Trace。

这说明恢复链有效，但五分钟无响应仍是明显体验问题。

### 另解落盘工具仍反复填错参数

Lesson 1、2、4 共出现 10 次 `card_alternative_append` 失败，主要是把无分问卡片的
`question` 填成非 `整题` 值，或遗漏 method 结构。课堂和 Trace 最终正确，但本轮
cards 与源资产无差异，说明识别出的替代路线没有真正附回题卡。

Lesson 5 首次 `lesson_prepare` 也发生一次 cards/sources 参数缺失，第二次调用恢复。

## Coverage

### 已覆盖

- 分支回收与等价 patch 审计；
- 全新 Roadmap、首个 Plan 和真实 provider；
- Roadmap/Plan/四个 Tutor Session 的 owner 绑定；
- 逐课问诊、无剧透课程就绪卡、课堂 Trace、关课和返回 Coach；
- 不完整作答、学生证据异议、独立替代路线和动态重排；
- `plan_update` 新 schema 的真实 provider 验证。

### 因安全停止未覆盖

- Lesson 5 中途换路；
- Lesson 6 综合迁移收束；
- Plan 首次 complete 前的 Quick Evidence Scout；
- 结构化 Learning Review 和学生来源异议；
- proposed → submitted → applied 长期画像确认；
- 返回原 Roadmap Coach 的跨周期建议。

## Next Action

先单独解决“私有备课内容进入学生可见 Plan”的通道问题，再从 Lesson 5 之前的新鲜
Session 重做两节课；不能复用已经看过题卡和路线的当前学生 Session。

修复目标应是确定性的边界，而不是再追加一段泛化提示：Plan Coach 仍需保留足够信息
用于后续备课，但学生界面只能看到不会破坏首次尝试的 Plan 级摘要。修复通过后，再继续
Lesson 5、Lesson 6、Scout、Learning Review、长期记忆和 Roadmap 回访。
