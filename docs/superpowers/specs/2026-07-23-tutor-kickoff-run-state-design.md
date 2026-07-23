# Tutor 启动轮次状态设计

## 问题

Lesson 启动接口先把 Lesson 写成 `active` 并返回快照，再在后台执行隐藏
Tutor kickoff。前端仅以 `Lesson.status === active` 判断输入框可用，因此
kickoff 尚未结束时学生已经可以发送消息。Pi Session 此时仍在运行，
第二个 prompt 会失败，而前端把所有异常统一显示成“模型调用失败”。

真实 Lesson 004 已证明这一点：界面报错后，原 kickoff 仍继续读取题卡、
推进课堂节点并生成题目。Provider 并未中断。

## 目标

- Tutor kickoff 运行期间显示“Tutor 正在启动”，不显示输入框。
- 普通 Coach/Tutor 响应运行期间也不接受第二次界面提交。
- 运行完成或失败后恢复输入。
- 保持启动接口非阻塞；不排队学生消息，不增加重试。
- 不修改 Roadmap、Plan、Lesson、Trace 或教学 Skill。

## 方案

新增仅用于前端投影的 `session-run` 事件：

```ts
{
  type: 'session-run';
  sessionKey: SessionKey;
  status: 'running' | 'idle';
  label: string;
}
```

服务端在启动 kickoff 或发送普通 prompt 前发布 `running`，在对应 Promise
的 `finally` 中发布 `idle`。错误仍通过现有 `session-error` 事件报告。

客户端为每个 Session 保存独立的 `busy` 标签。当前 Session 忙碌时：

- 状态区显示 `busy` 标签；工具状态存在时优先显示更具体的工具标签；
- composer 和人设选择保持不可用；
- Session、Lesson 路由及流式消息继续正常更新。

## 不采用的方案

- **等待 kickoff 后再返回启动请求：** 真实 kickoff 可能超过一分钟，
  会把长模型轮次变成易超时的 HTTP 请求。
- **把早到的学生消息排队：** 可能在题目呈现前消费学生回答，破坏课堂顺序。
- **仅依靠工具执行状态：** 工具结束与下一次工具开始之间仍有模型思考期，
  不能代表完整 Agent turn。

## 验收

1. 服务端测试证明 kickoff 的 `running` 先于后台 turn，`idle` 只在 turn
   完成后出现。
2. 客户端状态测试证明 busy 按 Session 隔离并可清除。
3. 完整类型检查、单元测试和构建通过。
4. 真实浏览器中启动下一节 Lesson：启动期间无可发送输入框，只显示启动
   状态；题目出现后输入恢复，并能完成一次自然课堂闭环。

