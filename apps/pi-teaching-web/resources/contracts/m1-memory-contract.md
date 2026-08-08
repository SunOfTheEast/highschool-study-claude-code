# StudyForge M1 教师记忆契约

记忆是学习集内可追溯的教师笔记，不是聊天摘要、自动评分或静态学生画像。

## 五个语义边界

1. 直接发生、可以复述的表现是学习痕迹。
2. 只回答某个知识对象学到哪里的是对象记忆。
3. 同一模式跨不同知识对象反复出现后，才可形成能力假设。
4. 学生明确表达或多次确认的互动需求才是偏好；教学效果观察不是偏好。
5. 教师以后打算怎样处理是教学待办，留在 Plan 或 Roadmap，不进入 memory。

提示后完成不能写成独立完成；一次错误不能写成稳定能力；“尚未证明”是一等状态。

## 文件与所有权

- Lesson 的 Block `Classroom Log` 保存原始课堂事实。
- `memory/objects/` 保存对象的 Current Judgment、Evolution Overview、Learning History、
  未证明边界，以及 Learning History 到来源 Lesson 和 Block ID 的直接链接。
- `memory/capabilities/` 保存跨对象能力假设；Tutor 不写能力文件，Coach 在跨对象证据成立后
  写工作假设，Roadmap 跨 Plan 校准同一文件。
- `memory/preferences/` 保存明确偏好的原话、时间、范围、当前判断和变化历史。
- `memory/indexes/` 与 `memory/INDEX.md` 是可重建路由，不是另一份事实。

原始 Classroom Log、对象 Learning History、能力校准历史和学生原话只追加、不回写。
对象、能力、偏好的当前判断可以随新证据修订，但必须保留流变和来源链接。纠正是新事实，
不是擦除旧事实或旧历史条目。

## 原子固化与路由所有权

Tutor 在唯一课末反思后用一次 `lesson_memory_commit` 提交可选的补充课堂事实、受影响对象
的学习历史与当前判断、明确偏好和对象路由。对象的 `learningHistoryEntry` 只压缩这次变化，
`evidenceBlockIds` 指向当前 Lesson 中真实存在的来源 Block。

已有对象通常声明 `keep`；新对象由 Tutor 明确选择 `assign`，或在归属确实不清楚时选择
`defer`。Runtime 不判断学习对象是什么，也不根据标题、关键词、题卡字段或目录结构选择
bucket；它只绑定当前 Lesson、时间、稳定 ID、路径、链接并原子写入模型已经声明的关系。

`defer` 的对象必须出现在根索引的 `Deferred Object Routing`，因此后续 Session 无需枚举
目录。Plan Coach 形成明确分类判断后，使用 `memory_route_resolve` 把该对象连接到点名的
既有或新 bucket；仍不清楚时保持原样。这个工具不承担对象合并、普通重分桶或能力判断。

成功回执后不回读刚写入的文件。学生纠正通过新的 `lesson_memory_commit` 向 Classroom Log
和受影响对象的 Learning History 追加纠正事实，并修订当前判断；旧记录永不重写。

## 渐进式披露

需要记忆时按亮线读取：

```text
memory/INDEX.md → 相关对象、能力或偏好文件 → 必要时精确定位来源 Block 的 Classroom Log
```

索引足够时不搜索，L1 判断足够时不读课堂原文。确需核验时，先用对象历史给出的 Lesson
路径和 Block ID 定位，再读取相邻范围，不默认读取整份 Lesson。使用原生 `Read` / `Grep`；
没有通用记忆工具。当前课堂表现优先于旧记忆。

教学角色只在自己的自然收口点局部维护受影响文件。当前 Session 不自动回读本次刚写入
的记忆，也不为了“完整”创建没有证据支持的类别或条目。
