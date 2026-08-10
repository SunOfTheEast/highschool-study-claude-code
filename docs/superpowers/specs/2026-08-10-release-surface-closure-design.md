# StudyForge 发版交互边界收口设计

## 目标

修复真实 DMG 验收中仍能被学生直接感知的八项问题：Roadmap 自然确认被拒、可恢复的
工具失败被误报、长响应缺少真实阶段感、离线帮助图片破损、页面继承滚动位置、内部协议
泄露、题卡标题 Markdown 裸露，以及模型设置被 Provider 清单淹没。

同时审计并移除 Runtime 中所有同类的自然语言确认正则，避免同一问题在 Note、题卡或
备课资产保存时再次出现。

本轮不改变 Roadmap—Plan—Lesson 教学周期，不引入新的进度协议、确认凭证、后台任务或
持久化结构。

## 已确认根因

真实 Meta Session 中，学生说“我认可，就按这个长期方案建立吧”后，模型正确调用了
`create_roadmap`，但 Runtime 中的自然语言正则不认识“我认可”，返回
`ROADMAP_CREATE_NOT_CONFIRMED`。这不是词表遗漏，而是语义权限放错层：模型与教学 Skill
已经判断了学生意图，Runtime 又用脆弱正则重复判断一次。

真实 Roadmap Session 创建首个 Plan 时，模型在写入前读取尚不存在的
`plans/plan-001/PLAN.md`，得到 ENOENT，随后成功写入并挂到 Roadmap。对话投影把每个工具
错误都显示成“这一步没有完成”，把可恢复的内部尝试误报成了学生操作失败。

其余问题也都有明确代码边界：帮助 API 已把图片转为 data URI，但 React Markdown 的默认
URL 过滤器会清空 data URI；SPA 导航没有复位 document scroll；会话标题、API 错误映射和
WebSocket Session 错误会直接输出内部值；题卡标题直接作为纯文本渲染；设置页一次展开
38 个 Provider 和 69 个模型。

## 设计

### 1. 确认与 Runtime 权限

学生必须先看到完整 Roadmap 方案并明确确认，这条教学边界继续由
`meta-dialogue/SKILL.md` 和 Meta Agent 承担。模型调用 `create_roadmap` 本身就是结构化地
声明语义条件已经满足。

完整审计发现同类语义门共有四个调用点：`create_roadmap`、`save_note`、
`save_problem_card` 和 `save_prepared_problem_card`。后三者共同依赖
`latestStudentApprovedAssetSave()`，同样会解析“可以、同意、保存吧”等对话词语。四处全部
删除 transcript 正则解析以及 `*_NOT_CONFIRMED` 错误。资产保存前公开内容、等待确认的教学
规则继续由 Free Learning、Tutor Lesson 和 Prepare Lesson/Plan Skill 承担。

Runtime 只守机械不变量：工具只注册在获准 Session、目标路径与写入范围合法、版本和来源
引用有效、持久化事务原子完成。`pending-tool-results.ts`、`session-owner.ts` 中读取 Session
branch 的逻辑只用于工具调用恢复、身份和时间戳绑定，不解释学生语言，因此保留。若未来
要求 Runtime 机械验证学生确认，必须设计学生直接触发的 UI 确认凭证；不得再次猜测自然
语言。

### 2. 对话活动与失败

工具调用是教师工作的内部步骤，不是每一步都对应一个学生操作结果：

- 可恢复的工具错误不在学生时间线显示。模型继续运行并成功回答时，不留下“这一步没有
  完成”；整轮真正失败仍由 Session 级错误承担。
- 连续的 `read`、`grep`、`find`、`ls` 合并为一个真实检索阶段，不重复刷相同回执。
- 等待首段教师文字时，根据 Session 所属层级显示稳定、真实但不虚构完成度的状态：Meta
  梳理长期方向、Roadmap 整理阶段安排、Plan 准备课堂、Lesson/自由学习思考当前问题。
- 已有 Material Scout、Lesson Reviewer 和讲义导出的专用投影保持不变；记忆提交、文件
  写入和资产保存使用实际工具名映射为对应阶段。

不显示计时百分比，不按固定秒数伪造阶段，不让 Runtime 推测模型的思维链。

### 3. 学生可见错误边界

增加一个共享的学生可见错误翻译函数。HTTP 状态、Runtime 代码、Provider 异常类型、文件
路径和 Session key 只用于本地日志和内部调试；普通页面只显示可行动的中文提示。移除聊天
标题中的 `meta:<uuid>`、`plan:plan-001` 等 key。WebSocket `session-error` 在进入学生事件流
前转换为安全文案，客户端也保留兜底转换，避免历史或测试后端直接注入原始错误。

诊断页可以保留稳定的产品级问题类别，例如“模型暂时不可用”，但不直接展示底层异常、
绝对路径或 SDK 类型名。

### 4. Markdown、帮助与导航

- 普通课堂 Markdown 继续使用当前安全 URL 规则；只有离线帮助页显式允许 Runtime 生成的
  `data:image/png;base64`，不全局放宽图片协议。
- 增加共享的行内 Markdown 渲染组件，供题卡列表与详情标题使用。标题只渲染行内强调、
  公式等内容，不生成段落容器。
- 每次应用内路由切换开始时将 document 滚动位置复位到顶部；同一页面内部的展开、输入、
  WebSocket 更新不触发复位。

### 5. 模型设置的渐进披露

设置页顶部先显示当前主教师与 Scout。Provider 区先显示当前使用和已连接项，其余未连接
Provider 收入默认折叠的“连接其他 Provider”。模型选择仍保留 Pi 目录中的全部可用模型，
但当前 Provider/当前模型优先呈现，不删除开放配置能力。

## 验收

自动回归必须覆盖：

1. `create_roadmap`、`save_note`、`save_problem_card` 和 `save_prepared_problem_card` 不再读取
   transcript 猜确认，同时仍拒绝重复目标、越权路径、陈旧 revision 和非法结构；
2. 可恢复的 read ENOENT 不产生学生可见失败，整轮 Session 错误仍有友好提示；
3. 连续读取被合并，Meta/Roadmap/Plan/Lesson/自由学习等待状态与真实层级一致；
4. 离线帮助 Markdown 最终渲染出带 data URI 的 `<img>`；
5. 应用内导航调用滚动复位；
6. 学生页面不出现 `API_ERROR`、`ResolveMessage`、绝对路径或 Session key；
7. `**题卡标题**` 在列表与详情中以强调文本渲染；
8. 当前模型配置先于折叠的其他 Provider 出现。

最后运行完整 `bun run check`、核心 Playwright E2E、桌面端测试、DMG 打包与真实安装包冒烟。
工作树中既有的无关修改不纳入本轮提交。
