# StudyForge 删除 Consolidated Learning Traces 设计

**状态：** 已确认，待实施  
**日期：** 2026-08-08

## 1. 决策

删除 M1a 引入的独立 `Consolidated Learning Traces` 层。

它没有在真实验收中证明自己带来了不可替代的教学收益，反而让同一次课堂变化被重复写成：

```text
Block Classroom Log
→ Lesson Trace
→ 对象记忆 Current Judgment / Evolution Overview / Trace Timeline
```

后续角色沿 Trace 下钻时，原生 `read` 又常常把整份 Lesson 读入上下文。因此这层既没有稳定实现
压缩，也增加了课末生成负担、持久字段和后续阅读路径。

删除的是这层中间摘要，不是学习历史本身。

## 2. 删除后的事实模型

```text
Block Classroom Log（原始课堂事实，原位追加）
        │
        └── 对象记忆 Learning History（对象相关的压缩变化，直接引用 Block）
                    ├── Current Judgment
                    ├── Evolution Overview
                    └── Boundaries / Not Yet Demonstrated
```

各层边界如下：

- `Classroom Log` 是课堂事实的唯一原始持有者；旧事实不修改，只能追加后续事实或纠正。
- `Learning History` 是对象记忆内部的时间序列。一次提交为每个受影响对象形成一条压缩变化，
  记录“这次对该对象的认识发生了什么变化”，并引用本课一个或多个证据 Block；后续纠正可以
  再追加新条目。
- `Current Judgment` 回答现在学到哪里。
- `Evolution Overview` 压缩跨多次历史形成的流变主线。
- `Boundaries / Not Yet Demonstrated` 明示尚未证明的边界。
- `INDEX.md` 和分桶文件只负责路由，不保存第二份事实。

同一个 Block 可以被多个对象引用，因为每个对象保存的是该事实对本对象的不同意义；原始事件仍只
存在于 Classroom Log。

## 3. 原子提交契约

保留 `lesson_memory_commit`，因为一次课末反思仍需原子地提交关闭事实、对象记忆、偏好和路由。
删除所有 Trace 专属输入与输出：

- 删除 `traces`；
- 删除 `TraceDraft`；
- 删除 `traceKey`、`traceEntries` 与 `traceIds`；
- 删除 Lesson 内 Trace ID 的生成和渲染；
- 删除 capability signal 的 Tutor 专属字段。

每个对象 mutation 改为只增加一组直接证据：

```ts
{
  target,
  currentJudgment,
  evolutionOverview,
  boundaries,
  learningHistoryEntry: {
    change: string,
    evidenceBlockIds: string[]
  },
  routing,
  frontierSummary?
}
```

Runtime 校验 Block 确实属于当前 Lesson、生成时间戳，并渲染为：

```markdown
## Learning History

- 2026-08-08 21:30 — 提示比较目标形式后完成；尚未证明能自主识别。
  - 来源：[lesson-001](../../plans/plan-001/lessons/lesson-001.md) — Block `block-003`
```

已有对象的旧历史逐字保留，只追加新条目。学生纠正时，向 Classroom Log 和对象历史各追加新的
纠正事实，并更新当前判断；不得改写旧条目。

## 4. 阅读路径

课末写入面向未来 Session；当前 Tutor 写完后不回读本次记忆。

Plan、Roadmap 和课堂按需召回都使用同一条渐进路径：

```text
memory/INDEX.md
→ 相关对象或偏好文件
→ 只有在信息缺失、相互冲突或决策影响较高时，才定位到引用的 Lesson Block
```

不再存在“先读刚关闭 Lesson 的 Trace”这一步，也不默认读取完整 Lesson。若必须核对原始证据，
先用精确 Block ID 定位，再读取相邻范围。

能力判断不再接收 Tutor 写出的 `capabilitySignal`。Plan 或 Roadmap 只有在不同对象的历史中看到
重复模式时，才形成或调整能力假设，并直接引用相关对象历史；需要核验时再下钻 Block。

## 5. 旧数据与历史文档

当前受支持的示例学习集没有真实 Trace 数据，因而不提供迁移器、兼容解析或双写路径。

- 运行时严格拒绝带 `Consolidated Learning Traces` 的 Lesson，避免废弃概念继续进入上下文。
- 当前契约、角色、Skill 与仓库指南全部删除 Trace 语义。
- 已有日期化 spec、audit 和 Git 历史保留为实验记录；必要时标注已废弃，但不篡改其当时结论。

## 6. 验收

实施完成必须证明：

1. 活跃 Runtime、契约与 Skill 中不存在 `Consolidated Learning Traces`、`TraceDraft`、
   `traceEntries`、`traceIds` 或 `Trace Timeline`。
2. Lesson parser 只接受 `Lesson Goal` 与 `Block`，旧 Trace Section 明确失败。
3. 一次原子提交能把一个 Block 的不同对象意义分别写入多个对象，并只在 Lesson Log 中保留一份
   原始事实。
4. 对象历史有 Runtime 时间戳、准确 Lesson 路径和存在的 Block ID；纠正只能追加。
5. 对象、偏好、分桶和根索引仍保持全事务原子性与幂等回放。
6. Plan 的课后流程先读 L0/L1，默认不读取完整 Lesson。
7. 全量类型检查、单元测试、构建和课程 E2E 通过。

## 7. 未采用方案

- **把 Trace 原样搬进对象文件：** 仍要求模型填写同一组中间字段，只是换了位置。
- **保留只读兼容 Trace：** 继续扩大 parser、提示词和测试表面，也会诱导模型沿旧路径读取。
- **删掉全部对象历史：** 会丢失认知流变，只留下易漂移的当前结论，不符合教师备课需求。
