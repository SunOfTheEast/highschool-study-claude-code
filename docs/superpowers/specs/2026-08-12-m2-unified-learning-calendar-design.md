# M2 统一学习日历设计

**状态：** 已讨论定稿，等待用户复核

**日期：** 2026-08-12

**适用范围：** `apps/pi-teaching-web` 的 macOS 桌面端

## 一、问题与目标

StudyForge 已有 Roadmap、Plan、Lesson、Free Learning、学习资产和专注计时，但“学生准备在
什么时候回来学习”仍只存在于聊天文字或学生脑中。课程节点中的时间戳记录事情何时发生，
不表达未来约定；把排课字段直接塞进 Plan 或 Lesson 又会让日历反过来控制动态课程树。

本阶段实现一份属于学生本人的统一学习日历。它同时容纳：

- 某个时间回到当前 Plan，继续讨论、备课并上课；
- 某个时间围绕选定资料开启 Free Learning；
- 某一天由复习轨道提供的待复习候选，并允许立即开始或安排到具体时间。

日历只表达学习意向与提醒，不证明学习已经发生。本阶段明确不做：

- 通用生活日历、考试管理、作业截止系统；
- 周期重复、RRULE、自动周课表和多人共享；
- 自动替学生安排复习时间；
- `completed`、`missed`、缺席、拖延、掌握度或学习效果判断；
- 到点自动唤醒模型、自动创建 Session 或自动开始专注计时；
- 把日历字段写回 Roadmap、Plan、Lesson、资产或对象记忆；
- 在资产复习系统落地前发明临时候选 schema 或假数据。

## 二、核心产品边界

### 2.1 一份跨学习集的学生日历

日历属于桌面端的学生本人，不属于当前学习集。数学、化学等多个 StudyForge 学习集的约定
出现在同一月历中。每条约定记录目标学习集，点击时再由桌面壳切换 Runtime。

日历存放在应用数据目录，而不是任何可复制的学习集：

`<StudyForge app-home>/calendar/appointments.json`

复制或分享一个学习集不会连同个人日程一起复制。首版沿用桌面配置现有的绝对路径作为学习集
身份；不为了日历单独引入尚未被其他系统使用的 Learning Set ID。

### 2.2 时间约定与复习候选是两层事实

- **时间约定**回答学生已经决定在什么时候学什么，会占据日历格子；
- **复习候选**回答哪些资产现在值得再次出现，只在日期下显示数量，不占据时间。

候选进入日历不等于遗忘，也不等于安排。学生点开某一天后可以勾选候选：

- “现在开始复习”用选定资产创建一段 Free Learning；
- “安排到时间”把选定资产变成一条普通时间约定。

复习系统是候选的唯一事实主人。日历只消费候选投影，不复制候选状态，也不决定一次复习后
候选是否继续存在。

### 2.3 正式课程只回到 Plan

正式课程约定链接当前 Plan。到点后提醒学生打开 Plan 对话，由 Plan Session 按真实状态讨论、
备课，再进入 Lesson。

日历不读取 Lesson Tree 来挑选课堂，不提前物化 Lesson，也不判断下一课是否已经备好。学生
若在 Lesson 中约下一次课，Runtime 绑定该 Lesson 的父 Plan；若在 Plan 中约课，则绑定当前
Plan。

## 三、规范数据

### 3.1 日历文件

```ts
type CalendarStore = {
  version: 1;
  appointments: CalendarAppointment[];
};

type CalendarAppointment = {
  id: string;                       // Runtime 生成
  revision: number;                 // Runtime 递增
  createdAt: string;                // Runtime RFC 3339 时间
  updatedAt: string;                // Runtime RFC 3339 时间
  title: string;                    // 学生确认的学习意向
  startsAt: string;                 // 明确的绝对开始时间
  plannedMinutes: number | null;    // 未约定时保持 null
  learningSetPath: string;          // Runtime 规范化的绝对路径
  destination: CalendarDestination;
  opened: CalendarOpenedReceipt | null;
};

type CalendarDestination =
  | {
      kind: 'plan';
      planId: string;
    }
  | {
      kind: 'free-learning';
      intent: 'open' | 'review';
      contexts: LearningContextReference[];
    };

type CalendarOpenedReceipt = {
  at: string;
  sessionKey: SessionKey;
};
```

`startsAt` 是一次性约定的绝对时刻，因此首版不另存重复规则或时区策略；创建界面与老师公开
提案始终按当前设备时区展示完整日期、星期和时间。`plannedMinutes=null` 表示学生只约了开始
时间，Runtime 不擅自补成 25 或 60 分钟。

`destination.kind` 决定唯一进入路径。`intent` 只区分普通发散学习与复习，两者都创建既有
Free Learning，不产生新的“复习 Session”类型。空 `contexts` 可以表达没有预选资料的自由
学习；Note 与 Problem Card 使用现有稳定 handle，在打开时读取最新 revision；Material 继续
沿用现有带 revision 的 `LearningContextReference`。

`opened` 只说明学生曾从该约定进入某个 Session，使重复点击能够回到原处。它不是开始学习、
完成日程或达到目标的证据。已经进入的约定若要再次安排，应新建或复制下一条约定；删除旧
约定不会删除已经产生的 Session。

### 3.2 不持久化的投影

以下内容都可以从规范事实重建，不进入日历 JSON：

- “即将开始”“时间已过”“已进入”；
- 结束时间与日历块高度；
- 学习集标题、颜色与图标；
- 日期格中的约定数量和待复习数量；
- 提前十分钟与到点的通知请求；
- 通知是否仍在 macOS 待投递队列中。

日历没有取消 tombstone。未进入的约定被删除时从规范文件移除；其系统通知作为投影一并
撤销。若需要保留真实学习历史，事实已经属于 Session 与学习足迹，不能靠取消记录替代。

## 四、两条创建路径

### 4.1 界面直接创建

学生点击月历日期或“新建约定”，直接填写：

- 明确开始日期和时间；
- 可选计划时长；
- 标题；
- 目标学习集；
- 当前 Plan，或 Free Learning 的普通 / 复习意图及可选资料。

保存、改期和删除是普通界面操作，不调用模型。首版不提供全天事件、任意提醒偏移或周期重复。

### 4.2 对话中协商创建

Plan、Lesson 和 Free Learning 可以在真实对话中安排下一次学习：

```text
学生提出时间意向
→ 老师依据 Runtime 提供的当前时间与设备时区解释自然语言
→ 公开完整日期、星期、时间、可选时长、主题和进入位置
→ 学生明确确认
→ 写入日历
→ 返回可点击日历回执
```

老师可以把“明晚八点”解释成绝对时间，但“这周找时间”“之后复习一下”不够形成约定，只能
继续商量。学生尚未看见完整提案时说“你安排”只授权老师提出方案，不构成持久化批准；看见
提案后的“嗯”“可以”“就这样”等自然确认可以由老师按上下文判断。Runtime 不使用固定口令
或正则再次判断语义批准。

不新增 proposal tool。老师用普通对话展示一行清楚的约定，确认后才调用创建、改期或删除
工具。修改既有约定时先按日期查询一个有界候选集合，使用当前 `revision`；旧 revision 被拒绝
并返回最新约定，不能覆盖学生刚在界面做出的改动。

模型只提交学生不可推导的标题、解释后的开始时间、可选时长、意图与必要的短引用。Runtime
从当前 Session 绑定学习集、父 Plan、资产合法性、ID、revision 与权威写入时间；模型不填写
绝对路径、Session Key、创建时间或通知 ID。

Roadmap 与 Meta 不装载日历写入工具。Roadmap 若已经产生下一 Plan，学生可以进入该 Plan
再约课；Meta 尚未形成课程入口时不能用日历强行创造一个。

## 五、月历界面

采用已确认的统一月视图：

- 顶部主导航增加“学习日历”；
- 月格中只展示真正占用时间的学习约定；
- 日期底部以安静圆点显示“待复习 N”，不把每张卡铺进月格；
- 点击日期后在右侧展开当天约定与待复习候选；
- 候选按学习集标识，可多选后“现在开始复习”或“安排到时间”；
- 约定显示学习集、开始时间、可选时长和标题；
- 不显示完成勾、缺席标记、连续学习天数、积分或掌握度颜色。

跨学习集颜色只是稳定的视觉投影；颜色不进入约定 schema，也不代表学科优先级或学习状态。

## 六、macOS 定时通知

日历必须在 StudyForge 完全退出时仍能提醒。macOS `UNUserNotificationCenter` 可以使用
`UNCalendarNotificationTrigger` 交给系统按指定时间投递本地通知，即使应用不在运行；Tauri
通用通知插件只覆盖即时发送，因此本阶段增加一个窄化的 macOS UserNotifications 桥，不增加
后台 daemon。

每条未来约定登记两个非重复请求：提前 10 分钟和到点。请求 ID 可确定重建：

```text
studyforge.calendar.<appointmentId>.<revision>.advance
studyforge.calendar.<appointmentId>.<revision>.due
```

macOS 自身能够查询和按 ID 撤销待投递请求。应用启动、约定写入、改期或删除后，用规范日历
与系统待投递请求做 reconciliation：补齐缺失请求、替换当前 revision、移除旧 revision 和已
删除约定。日历 JSON 不复制 `advanceDeliveredAt`、`dueDeliveredAt` 或通知队列。

通知正文可以显示学生确认的标题和学习集名称；用于点击路由的 payload 只包含
`appointmentId + revision`，不包含绝对路径、Plan 内容或资产正文。点击旧 revision 时先读取
规范日历；事件已经改期或删除就只打开最新日历详情，不执行旧入口。

学生点击提前提醒并真正进入学习后，撤销尚未到点的第二条通知。通知权限被拒绝时，设置与
日历页明确显示“系统提醒未开启”；日历仍可使用，不能声称提醒已登记。

参考官方能力：

- [Scheduling a notification locally from your app](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app)
- [getPendingNotificationRequests](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/getpendingnotificationrequests%28completionhandler%3A%29)
- [removePendingNotificationRequests](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/removependingnotificationrequests%28withidentifiers%3A%29)
- [Tauri notification JavaScript API](https://v2.tauri.app/reference/javascript/notification/)

## 七、从约定进入 Session

到点只发系统提醒，不自动调用模型。学生点击通知或日历中的“现在开始”后，桌面端依次：

1. 按 `appointmentId + revision` 读取当前约定；
2. 检查目标学习集是否可用，以及是否存在跨学习集专注计时冲突；
3. 必要时切换当前学习集并等待目标 Runtime ready；
4. Plan 约定打开对应 Plan 对话；Free Learning 约定创建或复用一次带选定 context 的 Session；
5. 向目标 Pi Session 持久化一次时间事实；
6. 写入 `opened` 回执，并撤销尚未投递的本次通知。

同一 appointment revision 的 launch endpoint 是幂等入口。`opened` 已存在时直接路由到原
Session，不重复创建 Free Learning，也不再次注入时间事件。

时间事件使用原生 Pi Custom Message：

`studyforge.m2.appointment-opened.v1`

最小数据包含：

```ts
type AppointmentOpened = {
  appointmentId: string;
  appointmentRevision: number;
  scheduledAt: string;
  openedAt: string;
  plannedMinutes: number | null;
  title: string;
  intent: 'course' | 'open' | 'review';
};
```

Runtime 生成类似以下事实：

> 学生从原定 20:00 的学习约定进入；实际打开时间为 19:53，原计划约 60 分钟，主题是继续
> 当前阶段。这只表示学生打开了入口，不证明学习已经开始。本事件不要求回复。

该消息 `triggerTurn=false`。老师等学生真正发言后再回应；若学生接着说“开始吧”，Plan 老师
知道当前时间预算和来意，Free Learning 老师也知道这是普通探索还是复习。日历不会自动开始
专注计时，学生仍需按界面按钮决定。

## 八、失效引用与纠正闭环

- **学习集被移动或不可用：** 保留约定并显示“找不到原学习集”，让学生重新定位；不枚举
  文件系统猜测。
- **Plan 已删除、完成或不可进入：** 打开约定详情并要求学生重新选择当前 Plan；不沿 Lesson
  Tree 自动寻找替代项。
- **Note / Problem Card 更新：** 稳定 handle 在打开时读取最新 revision，因为学生约的是
  再看该资产，不是冻结旧文本。
- **Material 更新：** 继续尊重现有 pinned revision 与 locator，不静默漂移。
- **资产已删除：** 明确标出失效引用，让学生移除或只使用仍存在的内容；不静默丢项。
- **约定改期或删除：** revision 改变后，旧通知和旧写入请求立即失效；删除约定不回写目标
  Session。
- **跨学习集专注冲突：** 若当前专注计时仍在运行，阻止 Runtime 切换并提示先结束当前专注，
  不静默终止计时。

过去但尚未进入的约定仍可由学生晚些时候开始或改期。界面只显示“时间已过”，不能将它
命名为缺席、未完成或失败。

## 九、待复习候选的阶段边界

日历页面为候选区域保留消费位置，但当前日历实现不定义候选记录、不扫描资产猜测到期，也不
写临时 `due` 字段。没有真实复习提供者时，候选区域为空或隐藏。

后续资产复习系统必须提供有证据的只读投影，至少包含日期、学习集与可启动的资产 handle。
日历的两个消费动作保持稳定：

- 立即创建 `intent='review'` 的 Free Learning；
- 创建同一 context 的未来 Calendar Appointment。

候选被学习、延期或再次出现后的状态仍由复习系统处理，不由日历从 Session 长度或打开动作
推断。

## 十、实现改动面

后续实施计划应拆成一个垂直闭环中的独立任务：

1. 新增 app-global Calendar Repository、原子 JSON 写入、revision 与跨学习集读投影；
2. 增加日历查询、界面 CRUD、幂等 launch 与 `calendar-invalidated` 事件；
3. 在 Plan、Lesson、Free Learning 增加有界查询和确认后写入契约，并投影可点击回执；
4. 新增统一月历页、日期侧栏、约定编辑器和空的候选消费位置；
5. 增加 macOS UserNotifications 定时桥、权限状态、冷启动点击恢复与通知 reconciliation；
6. 复用专注计时设计中的 Tauri 单实例能力，处理跨学习集 Runtime 切换；
7. 通过原生 Pi Custom Message 注入一次 `appointment-opened`；
8. 运行自动化、真实 macOS 通知和真实模型验收。

Calendar Repository 只在桌面模式启用。普通 Web / Pi extension 未配置 app-home 时不装载日历
工具，不为了兼容它们把个人日历塞回学习集。

不修改 Roadmap、Plan、Lesson、资产、对象记忆、学习足迹或专注周期 schema，不增加数据库、
系统 Calendar/EventKit 同步、后台进程、重复日程和临时候选表。

## 十一、验收

### 11.1 自动化

1. 统一日历能创建、读取、改期和删除属于不同学习集的约定；写入原子且 revision 冲突不会
   覆盖较新值。
2. `plannedMinutes=null`、Plan 与两种 Free Learning 入口都能正确往返；不存在完成、缺席或
   掌握字段。
3. 对话写入只能在完整提案确认后发生；Runtime 绑定路径、Plan、ID、revision 与时间，不接受
   模型伪造权威字段。
4. 通知请求 ID 由 appointment revision 确定生成；创建、改期、删除和应用启动 reconciliation
   能补齐或撤销准确请求，不需要通知回执字段。
5. 点击当前通知能切换学习集并打开目标；旧 revision、失效 Plan、丢失学习集和删除资产不会
   被静默执行。
6. 同一约定重复点击只进入一个 Free Learning 或同一个 Plan，并只产生一条
   `appointment-opened`。
7. `appointment-opened` 不触发模型 turn，内部 ID、绝对路径和原始 payload 不暴露给学生。
8. 活动专注计时阻止跨学习集切换；通知权限拒绝只降低提醒能力，不损坏日历。
9. 月历格只显示约定，复习候选在无真实 provider 时为空，不从演示数据或资产数量伪造。

### 11.2 macOS 真实通知

使用真实签名或自签名 DMG 做至少一条冷启动验收：创建几分钟后的约定，完全退出 StudyForge，
确认系统仍投递通知；点击后单实例启动应用、恢复目标学习集并进入正确 Plan 或 Free Learning。
另验收改期、删除、权限拒绝和提前提醒点击后取消到点通知。

### 11.3 真实模型

使用发布配置中的真实老师模型验收：

1. 学生在 Plan 或 Lesson 中说“后天晚上八点继续，一小时”，老师首击公开绝对日期、星期、
   时间、时长与 Plan，学生自然确认后才创建。
2. 学生说“这周找时间复习一下”，老师不写入模糊约定，只追问真正会改变时间的一个问题。
3. 学生在 Free Learning 中选择几份资产并约定复习，老师保存为未来 Free Learning，不创建
   新 Session 类型，不把到期解释为遗忘。
4. 学生自然改期或删除已存在约定，老师先公开改动，再使用当前 revision；旧上下文不能覆盖
   界面中的新修改。
5. 学生从约定进入后说“开始吧”，老师能利用计划主题与可选时间预算，但不声称学生已学习、
   不自动开始计时、写记忆或改变课程状态。

首击合格门是：没有批准就不写，时间表述明确，到点不自动唤醒模型，点击后只注入事实，老师
仍把实际学习行为交还给学生与当前 Session。

## 十二、与 M2 后续阶段的关系

专注周期与日历共享 Runtime 权威时间、Tauri 单实例和 Pi Custom Message 通道，但拥有独立
规范数据：专注周期记录正在运行的一只表，日历记录未来学习约定。日历不会用计划时长自动
启动或填写专注周期。

资产复习系统随后成为待复习候选的唯一来源，并复用日历已经验证的“现在开始 / 安排到时间”
入口。这样现实时间、课程生命周期与复习轨道相互连接，但任何一层都不冒充另一层的事实。
