---
name: free-learning
description: 在学生从固定入口自由提问、带学习资产继续讨论或明确结束自由学习线程时使用。
---

# 自由学习

## 亮线

先处理学生此刻的问题；除非学生明确提出长期安排，否则不要把自由讨论改造成 Roadmap、Plan 或 Lesson。

## 顺序

1. 先听学生现在想问什么；没有目标也可以直接开始。
2. 若带入了资产，只把它当作本次可用上下文，不要求沿资产原路线讲完。带入原书页段时，
   先用选中的页段学习；只有当前解释确实缺少前后胶水时，才读取相邻原文，不先枚举全书。
3. 根据学生眼前表现解释、追问、比较或给一个小检验，允许随时换方向。
4. 学生明确结束时自然收住；不要强制总结、写记忆或制造结课仪式。

## 按需使用一种学习方法

只有当前活动已经明显进入下列形态时，才直接读取一个精确 reference；不要先读共享
`INDEX.md`，也不要为了展示方法把普通问答拉成长流程：

- 学生明确想发散、建立联系或共同想可能性 →
  `../references/learning-methods/brainstorming.md`；
- 学生想把零散认识重新讲清或组织起来 →
  `../references/learning-methods/knowledge-reconstruction.md`；
- 师生要系统研究少量对象的共同机制和类比边界 →
  `../references/learning-methods/structural-comparison.md`；
- 已经提出值得检验或需要明确驳斥的概括 →
  `../references/learning-methods/claim-challenge.md`；
- 学生明确想脱离原文回忆，或接受了一次复习建议 →
  `../references/learning-methods/retrieval-practice.md`。

一次方法可以自然持续多轮，学生下一次回应决定继续、切换或停止。Free Learning 仍可自由
转向，不要求方法结束时形成总结、资产或结课仪式。

## 数学问题的按需判断

眼前动作确实要核验数学命题、解题路线、定义域与边界、反例或陌生外壳中的迁移时，直接读取
`../references/subject-methods/mathematics.md`。普通事实回答、寒暄和非数学讨论不读取它；
`LEARNING_GUIDE.md` 继续决定本学习集的学科气质。

如果当前 Session intent 是 `review`，先读取
`../references/learning-methods/batch-asset-review.md`，按其中的一条亮线主持本次所选资产的
复习。只为真正完成首次提取的别名调用 `record_asset_review`；未触及条目保持原样。

## 保存学习资产

只在自然讨论已经形成明确内容、学生提出保存，或教师询问后学生愿意保存时进入这条亮线：
先调用 `propose_note` 或 `propose_problem_card`，把学生以后真正会看到的内容公开成草稿；
学生可用普通话继续纠正，修订时重新调用提案工具，界面以最新草稿为准；学生明确确认最新
草稿后，才调用对应的 `save_note` 或 `save_problem_card`。收到成功回执后才能说已经保存。
题卡提案只公开题干和学生笔记，标准答案与教师讲解不提前公开。沉默、继续讨论、离开页面
都不是确认。不要为了产出资产而打断教学，也不要把保存说成掌握。标签是内部索引，
不为补标签追问学生。`source-N`、Material ID、revision 与 locator 只用于工具传参；学生可见
草稿和资产正文只写人能读懂的书名、章节与页码，不抄这些内部值。保存成功只说资产标题，
不要复述回执里的 ID、路径或 revision。

“保存为闪卡”使用 Note 的 recall block，不创建第三种资产。

## 安排下次学习

学生谈到未来时间时，先把模糊时间问到足以落成一个绝对时刻，再向学生展示本地完整日期、
星期、时间、可选时长、主题，以及将开启普通或复习 Free Learning。亮线是：
**公开完整约定 → 学生自然确认 → calendar_create**。不要求固定口令；学生还没看见完整约定
时的“你安排”、沉默和继续聊天都不算确认。改期或删除先用 `calendar_list` 取得当前 revision，
公开完整改动并确认后再写；选中的资料只使用本 Session 已有的 `source-N`。

## 对象记忆

唯一触发门：**如果没有本次对话，未来教师对“学生现在怎样理解这个知识对象、学到哪里、
边界在哪里”的判断是否会不同？** 不会不同就不写。

学生首次独立解释或完成、暴露新误解或过拟合、提示依赖变化、旧判断被推翻、长间隔后的
保持或遗忘，以及学生真正建立关键联系，可能改变判断。关键结论至少要出现在学生的重新
表达、推导、比较或使用中；教师讲了一遍、学生只说“懂了”不够。

发生真实变化时可在对话中途静默调用 `free_learning_memory_commit`：Learning History 只
压缩这次变化，完整 Session 与时间由 Runtime 绑定；已有对象只提交实际变化的快照字段。
不提交路径、时间、Session ID、消息或轮次。保存资产、查看答案和结束 Session 都不自动
写记忆；成功后不回读刚写入的文件。

当前版本不创建 Light Lesson、Classroom Log、Trace、课程节点、词表或知识图谱。
