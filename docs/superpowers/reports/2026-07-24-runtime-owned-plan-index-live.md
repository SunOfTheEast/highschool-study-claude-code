# 运行时所有 Plan 索引真模验收

日期：2026-07-24

## Run Identity

- Source: `c638bfd` 加本次最小实现工作区
- App: `apps/pi-teaching-web`
- Runtime root: `/tmp/studyforge-plan-index-lDgVTH/learning-set`
- URL: `http://127.0.0.1:65435`
- Message projection: `raw-stream`
- Provider/model: `deepseek/deepseek-v4-pro`
- Roadmap: `roadmap`
- New Plan: `isomorphic-param-separation`
- Coach Session: `019f8fec-e2fc-7d63-8353-1e6fd96d90bb`

仓库示例未被写入；所有课堂事实只存在于上述 `/tmp` 副本。报告不保存凭据、
完整 Session 或 Teacher Control。

## Lesson Evidence

| Lesson | Tutor Session | Cards | Result |
| --- | --- | --- | --- |
| `lesson-004` | `019f8fef-e151-725e-94c3-03b300bec612` | `ex_mst_425`、`mst_p0016_ex01` | 两次 `correct / support:none`，正式 closed |
| `lesson-005` | `019f900e-f7c0-72cc-a5b0-71eb1807d6a7` | `mst_p0019_ex08`、`mst_p0020_ex14` | 两次 `correct / support:none`，正式 closed |

两节课均由前端开始，分别创建独立 Tutor Session；学生明确确认结束后，前端返回
同一个 Coach Session。第二节由 Coach 读取第一节 Summary 与 active Trace 后准备。

## Structural Acceptance

| Boundary | Result | Evidence |
| --- | --- | --- |
| Model contract | PASS | 三次真实 `plan_update` 参数均只有 `decision`、`currentPosition`、`nextLessonCandidate`、`planSummary`，无 `lessonIndex`。 |
| First audit | PASS | `lesson-004` 准备并审计后仍在 Plan、workspace API 与侧边栏中。 |
| Multi-Lesson audit | PASS | `lesson-005` 准备并再次审计后，索引同时保留 `lesson-004` 与 `lesson-005`。 |
| Real status refresh | PASS | 最终索引由真实 Lesson frontmatter 重建为两条 `closed`。 |
| Ordering | PASS | 既有 `lesson-004` 保持第一，后发现的 `lesson-005` 追加为第二。 |
| Roadmap status | PASS | Plan frontmatter 与 Roadmap Plan Graph 均为 `active`。 |
| Route/UI | PASS | 页面清理后重新打开同一 Plan URL，两个 Lesson 与各自状态均从持久化文件恢复。 |
| Final decision | PASS | Coach 对四条 Trace 做审计后判定 `active`，没有把四题正确误判为完成可观测标准。 |

## Observations Outside This Fix

- 第二次备课中，真实模型因截断 Student View、错放 Teacher Control、遗漏 reflection
  产生两次 Blueprint 修正，最终成功生成 Lesson；这没有破坏 Plan 索引，但可作为
  之后观察结构化参数稳定性的样本。
- 四条 Trace 都没有已确认的规范方法映射，因此 `/api/abilities` 返回空节点。这与
  本次索引修复无关，也不应把题卡参考方法冒充为学生实际方法。
- `raw-stream` 显示内部英文工具旁白符合诊断模式预期；学生默认的 `safe` 模式未改。

## Result

本次最小修复通过真实两课连续验收。原故障链
“Coach 提交伪 Lesson Index → 链接被覆盖 → workspace/侧边栏丢课”已被切断：
模型不再拥有结构字段，运行时从真实 Lesson 文件恢复索引并同步 Roadmap 状态。
