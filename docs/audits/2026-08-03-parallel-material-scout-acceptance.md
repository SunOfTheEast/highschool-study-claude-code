# Parallel Material Scout Acceptance

## Setup

- Branch: `codex/parallel-material-scout`.
- Behavioral runs exercised commits through `6800886`; the clarified convergence and
  multi-material contract was then committed as `c262de9`.
- Model/provider: `deepseek-v4-flash` through the locally configured DeepSeek provider.
  No credential was copied into this report.
- Copied learning-set roots:
  `studyforge-parallel-scout-acceptance-KnDlSt` and
  `studyforge-parallel-scout-acceptance-r2-PMkwKK` under `/tmp`.
- The successful run used a genuinely new Plan Session,
  `019fc37d-b8d3-78b8-925e-67844c54c4e0`, created after the copied Plan's
  `session_id` had been cleared.
- Natural student request: “上一节结束了，接下来你安排吧。我还是想先自己做，卡住了我再说。”

## Run A: call-shape failure found and corrected

The first run launched from a fresh Plan Session and reached the three-lane design,
but its first execution call added per-task `outputMode: "file-only"` without an
output path. The extension rejected that call before creating children. The Coach
corrected the arguments in the same turn and then completed all three lanes, selected
a real card, wrote and reread the Lesson, updated and reread the Plan, and sent a
normal public summary.

This was treated as a failed strict acceptance rather than hidden as a recovered
success. The assembled Agent and Skill contract was tightened so that the execution
object has exactly seven top-level fields and every task has only `agent` and `task`;
`output` and `outputMode` are omitted.

## Run B: successful foreground fan-out

The second fresh run followed this observed sequence:

```text
read Plan, Roadmap, lesson list, closed lesson-007, and Coach Skill
→ optional subagent(action: list)
→ one subagent call with three tasks
→ graph-first, card-text-first, and teaching-fit-first start concurrently
→ all three settle successfully
→ parent reads one selected card in full
→ parent writes and rereads lesson-008
→ parent updates and rereads plan-002
→ parent sends one ordinary preparation summary
```

The execution object used `concurrency: 3`, `context: "fresh"`, `async: false`,
`includeProgress: false`, `artifacts: false`, and `agentScope: "user"`. It contained
no timeout, maximum-runtime, output, or output-mode field. No corrected retry or
parent-side fallback search occurred.

Lane timing from the child Session files:

| Lane run | Started (UTC) | Settled (UTC) | Result |
|---|---|---|---|
| run-0 | 17:21:58.935 | 17:26:01.572 | succeeded |
| run-1 | 17:21:58.936 | 17:27:20.405 | succeeded |
| run-2 | 17:21:58.938 | 17:27:12.175 | succeeded |

The three start times differ by 3 ms, so this was real concurrent fan-out rather than
three serial searches. The foreground Scout call took about 5 minutes 22 seconds; the
whole Plan turn, including review, selection, Lesson writing, Plan writing, and final
reply, took about 10 minutes 19 seconds. StudyForge imposed no material-search
deadline.

## Selection and Lesson scope

The agreed Lesson contained one judged problem Block, so the Coach selected and fully
read one card:

`cards/derivative/mst_p0222_a_x_minus_lnx_rational_tail_monotonic_and_bound_ch6_fenzhi_ex06.card.yaml`

No rejected card was opened in the parent Session. The parent did not perform an
exploratory card `ls`, `grep`, or `find`; its only card-library operation was the full
read of the chosen card. Every child used only the allowed read-only tools:
`read`, `grep`, `find`, and `ls`. No Scout wrote a learning-set file.

This one-problem run proves selected-only parent expansion for a selected set of size
one. It does not prove a multi-problem Lesson by example. After the run, the contract
was corrected to make the general rule explicit: each lane searches until semantic
convergence and returns a variable-length compressed shortlist; the Coach derives the
number of selected full assets from the agreed Lesson Blocks. A multi-problem Lesson
may therefore open several selected cards, while rejected cards remain outside the
long-lived Plan context.

## Context isolation and public behavior

The post-Scout parent turn recorded 5,724 uncached input tokens. The raw child search
sessions remained separate under the temporary Pi Session directory; they were not
copied into the parent as assistant messages. The native tool result did include more
wrapper metadata than the requested three-field compact JSON, so output compactness
remains an observation target rather than a perfect result.

The student-visible reply named the public purpose, source/problem number, workload,
and interaction form. It did not expose the full stem, answer, decisive transformation,
candidate comparison, lane progress, failure mechanics, or rejected-card contents.

## Verification

- Focused M0 resource and subagent tests: 12 passed, 0 failed.
- Full `bun run check`: typecheck passed, 34 tests passed, production build passed.
- Browser cycle: 1 passed, 0 failed.
- `git diff --check`: passed.

## Verdict

The core redesign passes: a new Plan Session can review its closed Lesson, launch one
foreground three-lane fresh-context search without a StudyForge deadline, receive all
lane results, keep final teaching judgment in the Coach, expand only selected material,
and finish the normal Lesson/Plan write path without narrating private search.

The fixed candidate cap observed during Run B was a design mistake, not a runtime
requirement, and was removed in `c262de9`. The remaining unproven case is behavioral
observation of a naturally requested multi-problem Lesson selecting several cards;
the contract now permits it, but this one-problem acceptance is not mislabeled as that
test.
