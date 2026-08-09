# 方法节点确认真课复验

日期：2026-07-24

## Run Identity

- Source: `d2fa074` 加本次三份 Skill 最小修改
- App: `apps/pi-teaching-web`
- Runtime root: `/tmp/studyforge-method-confirm-Z4d7mA/learning-set`
- URL: `http://127.0.0.1:65436`
- Message projection: `raw-stream`
- Provider/model: `deepseek/deepseek-v4-pro`
- Plan: `isomorphic-param-separation`
- Lesson: `lesson-006`
- Tutor Session: `019f9064-6f6b-7e6e-99a0-6e079fb7aff0`

仓库示例未被写入；课堂事实只存在于上述 `/tmp` 副本。报告不保存凭据、
完整 Session、隐藏提示或 Teacher Control。

## Evidence

| Check | Result | Durable evidence |
| --- | --- | --- |
| Initial attempt | PASS | `event-001` 为 `correct / support:none / methods:null` |
| Candidate question | PASS | Tutor 在进入下一 Block 前指出学生的决定性步骤并询问方法绑定是否准确 |
| New student turn | PASS | 学生明确确认主方法与辅助方法 |
| Superseding write | PASS | `event-002` 使用 `methodStatus: student_confirmed` 并 `supersedes: event-001` |
| Canonical methods | PASS | 主方法 `参变量分离`，辅助方法 `同构变形与换元法`，无未解析节点 |
| Ability refresh | PASS | `/api/abilities` 立即出现两个 `unstable / score:1 / evidenceCount:1` 节点，来源均为 `event-002` |
| Closure | PASS | `lesson_close` 返回 `ok:true / status:closed`，页面回到原 Coach Session |

## Observations Outside This Fix

- Tutor 一次提出了一个包含主方法和辅助方法的绑定方案。Trace schema 支持该表示，
  两个节点也都由学生逐项确认；但若把 Skill 中“at most one canonical node”严格解释为
  只能出现一个节点，这次行为仍有轻微措辞偏差。
- Coach 的课前回复提前给出了完整题目、目标结构和方法名称，不符合“无剧透摘要”。
  这是备课交接的独立问题，不影响本次方法确认闭环结论，本轮没有边验收边修改。

## Result

本次最小修复通过核心真课验收。先记未映射事实、再询问学生、确认后 supersede、
最后刷新能力投影的完整链路已经真实运行，不再把规范方法只留在 Tutor 的聊天文本里。
