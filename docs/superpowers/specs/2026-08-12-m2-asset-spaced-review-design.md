# M2 资产级间隔复习设计

**状态：** 已讨论定稿，等待用户复核

**日期：** 2026-08-12

**适用范围：** `apps/pi-teaching-web` 的 Note、Problem Card、Free Learning、Lesson、统一学习日历与 macOS 桌面端

**相关设计：**

- `2026-08-10-studyforge-m2-m4-milestone-outline.md`
- `2026-08-11-m2-focus-cycle-design.md`
- `2026-08-12-m2-unified-learning-calendar-design.md`

## 一、问题与目标

StudyForge 已经能够保存 Note、回忆块和题卡，也能记录题卡作答、标准答案打开、Free Learning、
正式课堂与对象记忆。但是当前没有一层事实回答：学生主动保留下来的某项资产，下一次什么时候
值得再次出现。

这一层不能直接复用对象记忆或课程节点：对象记忆保存教师对知识对象的当前判断，课程树组织
长期学习，资产复习则只安排某个 Note 或题卡再次进入学生视野。到期不等于遗忘，按时复习也
不等于掌握。

本设计实现一个透明的资产级间隔复习闭环：

```text
资产进入复习轨道
→ 到期后成为候选
→ 学生自助复习，或带入 Free Learning / Lesson
→ 产生一次三档结果
→ 固定阶梯计算下一日期
→ 日历与备课 Agent 读取新的候选投影
```

本阶段明确不做：

- Topic 掌握度、BKT、IRT、全局能力分数或记忆强度百分比；
- FSRS、隐藏难度参数、遗忘概率拟合或基于模拟学生的数据校准；
- 每日强制配额、欠债、连续打卡、积分、排行榜或自动清空；
- 把资产到期、打开、阅读、保存或教师讲解解释成一次有效复习；
- 自动修改对象记忆、Roadmap、Plan、Lesson 状态或正式课程安排；
- 为每个 Note block 建立独立排程、ID 和遗忘曲线；
- 把全部复习队列常驻注入每个模型 Session。

## 二、复习原子与两种使用形态

排程原子始终是完整资产：

- 一张 Problem Card 是一个复习项；
- 一份 Note 是一个复习项；
- Material 不是本阶段的复习项；
- Note 内的多个 `recall` block 不分别进入队列。

Note 可以用两种方式复习：

1. 含一个或多个 `recall` block 时，可以不调用模型，依次回忆、显示答案，最后为整份 Note
   形成一次结果；学生按本次最弱的一块选择结果。
2. 只有 Markdown 正文时，仍然可以进入复习轨道，但不能用“重新读过一遍”完成复习。学生
   把它与其他候选一起带入 Free Learning，由老师依据正文现场生成检索问题。

Problem Card 可以直接重新作答，也可以与其他资产一起进入老师主持的复习。自助题卡复习
必须重新隐藏答案，先记录一次真实 attempt，再允许显示标准答案并形成复习结果。

## 三、事实所有权与存储位置

### 3.1 历史归学习集，日历只聚合投影

个人复习历史与资产、题卡作答日志和其他学习活动放在同一学习集：

```text
activity/
  asset-reviews/
    notes/<note-id>.md
    problem-cards/<card-id>.md
    index.tsv
```

学习集移动时历史随资产一起移动。以后分享或发布学习集时，私人 `activity/` 与记忆、Session
一样由发布流程剥离，不能随公开资产泄露。

统一学习日历不拥有复习历史。桌面端只从已知学习集读取到期投影，聚合成跨学习集候选。一个
暂时没有被桌面端定位到的学习集不会被枚举文件系统；重新打开或重新定位后恢复聚合。

### 3.2 一个事实，一个主人

| 事实 | 唯一主人 |
|---|---|
| 学生在题卡上具体写了什么、何时打开答案 | `activity/problem-attempts/` |
| 资产何时加入、采用哪档结果、何时再次出现 | `activity/asset-reviews/` |
| 老师怎样提问、学生怎样回应、给过什么帮助 | 原 Free Learning Session 或 Lesson |
| 这次表现是否改变了知识对象判断 | 现有对象记忆 |
| 学生明确约定某时复习 | 统一学习日历 |

复习事件可以引用题卡 attempt 或 Session，但不复制作答、答案、对话和对象记忆内容。

## 四、规范事件

### 4.1 文件与公共字段

每个在轨或曾经在轨的资产拥有一个 Markdown 文件。文件头绑定稳定资产 handle，正文只追加
按顺序编号的 YAML 事件块。Runtime 生成并校验：

```ts
type ReviewEventBase = {
  eventId: string;
  requestId: string;
  at: string;          // RFC 3339 权威时间
  localDate: string;   // Runtime 按当时设备日期生成的 YYYY-MM-DD
};

type ReviewResult = 'forgot' | 'effortful' | 'fluent';
```

代码枚举对应学生界面：

- `forgot`：没想起来；
- `effortful`：想起来了，但比较吃力；
- `fluent`：顺利想起来。

三档只驱动排程，不表示错误率、掌握度或能力等级。

### 4.2 事件变体

```ts
type ReviewEvent =
  | ReviewEventBase & {
      kind: 'enrolled';
      assetRevision: number;
      trigger:
        | { kind: 'asset-saved' }
        | { kind: 'first-attempt'; problemAttemptId: string }
        | { kind: 'historical-attempt'; problemAttemptId: string }
        | { kind: 'manual' };
      policy: 'fixed-ladder-v1';
    }
  | ReviewEventBase & {
      kind: 'reviewed';
      assetRevision: number;
      result: ReviewResult;
      evidence:
        | {
            kind: 'self-report';
            problemAttemptId: string | null;
          }
        | {
            kind: 'session';
            sessionKey: FreeLearningSessionKey | `lesson:${string}`;
          };
    }
  | ReviewEventBase & {
      kind: 'corrected';
      targetEventId: string;
      replacementResult: ReviewResult | null;
    }
  | ReviewEventBase & {
      kind: 'removed';
    }
  | ReviewEventBase & {
      kind: 'restarted';
      assetRevision: number;
      policy: 'fixed-ladder-v1';
    };
```

`replacementResult=null` 表示误点或被引用的复习实际上没有发生。旧事件仍留在日志中，但不再
参与当前投影。更正可以使后续状态重新计算，不能修改、覆盖或删除原事件。

资产 handle 由受管文件和调用入口绑定；模型不提交路径、ID、revision、时间、日期、Session
Key、attempt ID 或策略版本。Free Learning 与 Tutor 只提交当前 Session 已绑定的资产别名和
三档结果；Runtime 决定证据变体并补齐其他字段。

## 五、透明固定阶梯

首版策略为：

```text
stage       0   1   2    3    4    5     6
interval    1   3   7   14   30   60   120 天
```

确定性重放规则：

1. `enrolled` 或 `restarted`：进入 `stage=0`，在事件本地日期次日到期；
2. `fluent`：前进一档，最高停在 120 天；
3. `effortful`：退回一档，最低停在 1 天；
4. `forgot`：回到 `stage=0`；
5. 新间隔从实际复习的本地日期开始，不从原到期日开始；
6. 逾期不改变档位，只继续形成到期候选；
7. `removed`：停止形成候选；
8. 被移出的资产再次 `enrolled` 时从第一档开始，但历史保留；
9. `corrected`：按替代结果重新重放；替代为 `null` 时忽略目标结果；
10. 同一资产同一本地日期最多有一个有效 `reviewed` 事件。

如果当天事件先被更正为 `null`，学生随后可以完成一次真实复习；否则同日重复练习不会继续
推进阶梯。老师讲解后学生当场会了，也不能在同一天用第二条成功结果覆盖首次冷检索。

策略版本绑定一次在轨周期。未来若有真实数据支持 FSRS，应新增明确的策略切换事件或重新加入
周期，而不是用新算法悄悄改写学生已经看到的日期和旧日志。

## 六、进入、退出与 revision

### 6.1 自动与手动进入

- 学生明确确认保存的新 Note 或 Problem Card，默认在同一原子事务中写入 `enrolled`，次日
  首次到期；
- 升级前的普通 Note 不自动进入，学生可以在资产详情页手动加入；
- 旧题卡第一次产生真实 attempt 时自动加入；若同一流程随后形成三档结果，再正常追加
  `reviewed`；
- 首次启用时只检查已有 `activity/problem-attempts/` 文件，对确有历史 attempt 且尚无轨道的
  少量题卡写 `historical-attempt` 迁移事件；不扫描 519 张题卡并集体加入；
- 单纯打开、搜索到、被老师引用、展示答案或进入备课都不触发加入。

### 6.2 学生控制

首版只提供三个控制动作：

- **移出复习**：追加 `removed`，停止产生候选，历史保留；
- **重新加入复习**：追加 `enrolled(trigger.kind='manual')`，从次日第一档开始；
- **重新开始**：在仍在轨时追加 `restarted`，从次日第一档开始。

不增加暂停若干天、忽略本次、自动延期或自定义重复规则。学生暂时不处理时，候选保持到期；
需要具体时间时使用统一日历。

### 6.3 内容 revision

复习轨道绑定稳定资产 handle，不绑定某一个 revision。内容编辑不会自动重置间隔；每个内容
相关事件记录当时读取的 revision，下次复习始终读取最新 revision。

Runtime 无法判断一次编辑是修正错字、补充个人笔记还是彻底替换知识对象，因此不做语义
重置。内容已经实质变成另一对象时应新建资产；学生希望重新巩固最新版时可主动“重新开始”。

## 七、自助复习

### 7.1 Note

只有含 `recall` block 的 Note 提供“直接复习”。界面按当前 revision 依次只显示提示，学生在
脑中作答后显示答案。所有当前回忆块完成后，学生为整份 Note 选择一次三档结果；多块时按
最弱一块选择。

中途离开、只看部分回忆块、revision 在过程中发生变化或没有选择三档，都不写 `reviewed`，
原到期状态保持不变。纯 Markdown Note 只提供“和老师复习”。

### 7.2 Problem Card

进入复习视图后，即使历史上已经打开过答案，也要重新隐藏标准答案。学生必须：

```text
提交新作答，或选择“不会”
→ 打开标准答案
→ 比较后选择三档结果
```

现有 `ProblemAttemptEvent` 与 `ProblemAnswerRevealEvent` 继续保存原始行为。复习事件使用
`self-report` 并由 Runtime 绑定本次 attempt ID。没有本次 attempt、没有打开答案或 attempt
属于另一 revision 时，不接受结果。

学生的三档选择是自我报告。系统不靠字符串、参考答案或 Runtime 正则判断自由文本作答是否
正确。

## 八、Free Learning 批量复习

学生可以从日历候选栏或资产界面选择一个或多个 Note / Problem Card，创建现有 Free Learning，
但携带 `review` 意图。它不是新的 Review Session 类型，也不创建 Roadmap、Plan 或 Lesson。

Runtime 在 Session 建立时提供一份紧凑、持久可恢复的私有复习简报：

```text
资产别名｜类型｜到期日｜当前档位｜最近结果
```

资产正文仍沿现有 selected-context 路径读取。简报不包含完整历史、不把到期解释为遗忘，也不
自动触发老师回复。

老师的亮线是：

```text
先做未受提示污染的检索
→ 再根据表现讲解或比较
→ 为真正触及的资产记录首次结果
→ 未触及资产保持到期
```

- 纯正文 Note：老师从正文生成一个或少量能够检验核心内容的问题，不先把正文复述给学生；
- 有回忆块的 Note：优先利用已有提示，必要时按讨论语境调整问法；
- 题卡：保持先作答、后答案的边界；
- 学生先看到答案、老师先讲解或只进行了开放讨论时，不得记录 `fluent`；
- 同堂修复可以影响教学记录或对象记忆，但排程仍采用当天首次冷检索结果。

老师记录结果不需要学生逐项再点按钮，但排程变化必须公开，例如“这项会在约 7 天后再出现”。
学生指出误点、看过答案或判断记录错误时，追加 `corrected`。

## 九、正式 Lesson 吸收

备课 Agent 获得只读、有界的到期查询。默认只返回候选摘要：

```text
asset alias｜标题｜类型｜语义标签｜到期日｜最近结果
```

备课 Agent 可以结合本课目标选择少量候选，并在选中后读取最新版资产；不得为了全面而把
整个队列注入上下文。读取队列、选入 Uses 或写进课堂草案都不是复习事件。

只有 Lesson Tutor 实际进行了无提示检索，才可以通过当前 Lesson 已绑定的资产别名记录结果。
正常讲解碰巧提到旧内容、学生已经看到答案、备课材料使用了该资产，均不够。Tutor 与 Free
Learning 共用同一结果语义和同日首次规则。

Roadmap、Meta 与普通 Plan 讨论不装载复习写入工具。正式课程是否吸收到期资产仍由备课判断，
队列不能自动改变 Lesson Tree、课次或课程目标。

## 十、到期索引与统一日历

### 10.1 可重建索引

`activity/asset-reviews/index.tsv` 至少投影：

```text
kind  id  active  stage  due_on  last_result
```

它只由规范事件重建，不接受模型写入。事件追加与索引刷新使用现有原子文档能力；若缓存丢失、
陈旧或损坏，先从受管日志重建。未知策略版本或无效事件使该资产的复习状态显式不可用，不能
套默认日期继续推进。

### 10.2 候选规则

- 未来日期可以投影当天预计到期数量；
- 今天的候选包含所有 `dueOn <= 今天` 且仍在轨的资产；
- 逾期只显示“已到复习时间”或原到期日，不显示欠债、失败或拖延；
- 默认按最早到期排序，并按学习集分组；
- 到期多少就如实显示多少，不强制每日数量，也不自动延期未选项目；
- 学生自己勾选本次复习数量，Free Learning 只读取所选资产。

日历消费两个既定动作：

- “现在开始复习”创建带所选 context 的 Free Learning；
- “安排到时间”创建 `intent='review'` 的 Calendar Appointment。

学生提前复习会立即刷新候选；已经明确创建的未来日历约定仍由日历拥有，不被复习系统静默
删除。打开约定时可以显示“部分资产已经提前复习”，由学生决定继续、替换或取消。

### 10.3 资产详情

学生资产页只显示必要状态：

```text
下次复习：8 月 15 日
当前间隔：3 天
[现在复习] [移出复习] [重新开始]
```

不展示记忆强度、掌握率、连续天数、积分或算法内部参数。未在轨资产显示“加入复习”。

## 十一、证据边界

复习事件是排程事实，不是自动教学结论：

- 自助选择 `fluent` 不自动更新对象记忆；
- 到期不表示学生已经忘记；
- 保存资产不表示学生掌握，也不会产生首次成功；
- 同堂讲会不表示长间隔保持；
- 备课 Agent 不能把到期或 `effortful` 直接写成能力结论；
- 纯正文 Note 现场生成的问题只留在 Session，除非学生另行确认，不回写 Note；
- Free Learning 或 Lesson 若观察到真正改变对象判断的长间隔保持、误解或提示依赖，可以按
  现有对象记忆门独立写入；Review Runtime 不代写、不双写。

M3 可以消费这些真实复习事件研究保持与遗忘，但不得反向修改日志，或把固定阶梯的 stage
冒充学生模型。

## 十二、纠正、幂等与失效恢复

- 同一 `requestId` 的完全相同写入返回原事件；不同内容冲突并拒绝；
- 同资产同日已有有效结果时，后续结果拒绝；最近结果被更正为 `null` 后可完成一次真实复习；
- stale asset revision 不写结果，界面重新读取最新版后再开始；
- 资产被删除时保留历史，候选显示资产不可用并允许移出，不枚举目录猜替代品；
- Note 在自助过程中失去回忆块或发生 revision 变化时终止本次写入；
- Free Learning 中途结束，只更新已经完成首次检索的资产；
- 学习集移动后，桌面端按既有重新定位流程恢复聚合；
- 索引失败不回写或润色规范日志，恢复动作只有确定性重建；
- 对旧事件的纠正只重放复习投影；若教师曾另写对象记忆，是否需要修正仍由对应教师角色按
  原证据边界判断，Runtime 不跨层联动修改。

## 十三、实现改动面与依赖顺序

后续实施计划应拆成以下垂直切片：

1. Review Repository、事件解析、固定阶梯重放与可重建索引；
2. 新资产保存、历史题卡 attempt 与 enrollment 的原子接入；
3. Note / Problem Card 自助复习与资产详情控制；
4. Free Learning review brief、批量复习 Skill 与受管结果工具；
5. Prepare 的有界只读查询和 Lesson Tutor 的受管结果工具；
6. 桌面跨学习集候选聚合，以及与统一日历的 provider 接口；
7. 聚焦自动化、真实模型和 DMG 闭环验收。

统一学习日历可以先实现空 provider，再由本设计接入真实候选；也可以先完成 Review Repository
再实现日历。无论实施顺序如何，日历不能临时复制复习状态，复习系统也不能自己创建日历约定。

对话内资产草稿落地后，新资产保存仍复用同一个最终 save 事务，因此 enrollment 不依赖草稿
形态。专注周期只记录真实用时，不从复习结果自动开始、结束或评价专注。

## 十四、验收

### 14.1 聚焦自动化

1. 新 Note / Problem Card 保存会原子加入复习，升级时 519 张未作答旧题卡不会集体进入；
2. `1/3/7/14/30/60/120` 阶梯、三档结果、逾期、纠正、移出、重新加入和重置能确定性重放；
3. 同资产同日只采用第一次有效冷检索，讲解后的成功不能再次推进；
4. Note 只有完成全部当前回忆块并选择结果才写事件，整个 Note 只占一个队列项；
5. 题卡结果引用当前 revision 的真实 attempt 与 reveal，历史答案已打开时复习视图仍先隐藏；
6. Free Learning 只更新真正触及的所选资产，未完成项保持到期；
7. Prepare 查询只读且有界，Tutor 只能写当前 Lesson 已绑定资产；
8. 日历聚合只消费候选投影，不复制状态，不因提前复习删除明确约定；
9. Review 写入不会自动改对象记忆、课程状态或资产内容；
10. 日志可在索引丢失后恢复，失效资产和未知策略不会被静默猜测。

测试只覆盖这些独立硬不变量，不为每个相同枚举和展示文案堆叠重复用例。

### 14.2 真实模型

1. **纯正文 Note：** 到期后老师先生成检索问题，不先复述正文；学生失败后经讲解完成，本次
   仍记录 `forgot`。
2. **批量未完成：** 选择多项，只复习其中两项；老师只写两条结果，其余候选保持原样。
3. **正式课堂吸收：** 备课 Agent 只挑与本课目标相关的到期资产，读取本身不写事件；Tutor
   做冷检索后才记录。
4. **边界表达：** 老师不把“到期”称为遗忘，不把自助 `fluent` 称为掌握，也不把当天修复
   称为延迟保持。

### 14.3 桌面真实闭环

用真实学习集验证：跨学习集候选聚合、Note 自助翻卡、题卡重新隐藏答案、批量进入 Free
Learning、安排到日历、提前复习后的状态刷新、移出与重新加入，以及应用重启后历史与日期
不变。至少包含一个索引删除后重建和一个资产失效场景。

## 十五、定稿决策

1. Note 与 Problem Card 都是资产级复习单位；回忆块只是 Note 的无模型复习界面。
2. 纯正文 Note 通过 Free Learning 生成检索问题，不把阅读算复习。
3. 新资产默认加入；旧库只按真实 attempt 或学生明确动作加入。
4. 首版采用透明固定阶梯和三档结果，不使用 FSRS 或掌握度。
5. 复习历史归学习集，日历只聚合可重建候选。
6. 直接复习由学生自评；Free Learning / Lesson 由老师依据首次冷检索记录。
7. 同资产同日只推进一次，讲解后成功不覆盖首次结果。
8. 资产 revision 不自动重置历史；实质新对象新建资产，主动重学使用 restarted。
9. 到期数量不受配额控制，学生自己选择批次。
10. 复习事件、作答、Session 与对象记忆各自拥有自己的事实，不自动跨层双写。
