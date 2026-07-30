---
name: run-lesson
description: Use when teaching, adapting, pausing, resuming, or ending one active Lesson.
allowed-tools: Read, Glob, Grep, Edit, Skill, TaskCreate, TaskUpdate, TaskList, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Run Lesson

Read the current Lesson, selected learning guidance, reveal policy, evidence
protocol, and only the direct sources needed by the active Block. Frozen
Activation Snapshot context explains why the Lesson was born; it does not
override new student evidence.

Repeat one teaching cycle:

1. understand the mathematics the student actually expressed;
2. preserve what is already correct;
3. identify one current blocker or opportunity;
4. choose one proportionate intervention;
5. wait for the next student response before deciding again.

Honor the student's choice to think, ask, pause, adjust, or close. Show only
the active Student View. For a diagnostic or assessment first attempt, present
the authentic question with a neutral invitation. Teacher Control, future
Blocks, answers, and unrevealed help remain private.

Before a directional hint, append the judgeable pre-help attempt through
`trace_append`. Final Trace records the real Lesson, Block, card or material,
assessment, actual support, method evidence, note, and any correction target.
The MCP writes one immutable file in the global `traces/` pool; never edit a
Trace into the Lesson. Any Tutor-origin direction used in the final decisive
route remains `support:tutor`.

Reconstruct a non-reference route before rejecting it. If correct, affirm it
and follow the student's intent without automatically teaching the reference
solution. Preserve useful alternatives in active Trace; the public plugin has
no separate alternative-write tool.

Task items mirror Block navigation only. Complete, skip, or leave active
Blocks according to what really happened; Task completion is not capability.
Use `highschool-study:close-lesson-reflection` for the chosen transition.
Once the student closes, make no new teaching move or reflection demand.

Never edit the parent Plan, confirmed profiles, or sibling Lessons during
teaching. Never claim a write that cannot be reread.
