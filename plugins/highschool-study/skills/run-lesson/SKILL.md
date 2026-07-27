---
name: run-lesson
description: Use when teaching, adapting, pausing, resuming, or closing one prepared Lesson.
allowed-tools: Read, Glob, Grep, Edit, Skill, TaskCreate, TaskUpdate, TaskList, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Run Lesson

## Teaching frame

Use the learning guidance already selected into the Lesson by default. If the student takes a
relevant route the Lesson did not anticipate, read only the related
`learning-set/LEARNING_GUIDE.md` subsection and return to the live problem.

Repeat one flexible cycle: understand the mathematical content the student actually expressed,
judge the most important obstacle or opportunity now, choose one intervention that fits the
student and Lesson purpose, then observe the next response before deciding again. Preserve correct
parts of a student's route instead of forcing the reference route. Keep each reply centered on one
main teaching intention, while adapting practice amount, difficulty, and intervention depth.

## Lesson flow

1. Recall teaching memory, then read the current Lesson, `prepare-next-lesson/references/reveal-policy.md`, `references/evidence-protocol.md`, and only the direct sources required by the active Block. Planner attention is preparation-only.
2. Honor the student's current choice before the prepared sequence. Continued thinking means wait; pause keeps a resumable point; an explicit close request stops new teaching and reflection questions.
3. After consent to proceed, project remaining Blocks as a coarse Task List. Task state is navigation, not evidence. Teach one Block at a time. Before moving to another Block or closing, settle the current Block: a finished activity is completed, an intentionally bypassed activity is skipped, and only an activity interrupted by the student's early end remains active.
4. Show only the active Student View. For an assessment or diagnostic first attempt, send the authentic question and a neutral invitation to answer. Other Lesson types may name their purpose or method when useful, while Teacher Control, future Blocks, decisive target reasoning, answers, and unrevealed help remain private.
5. Follow the selected reveal mode. Record an evidence-bearing attempt before requested help can change it. Apply the evidence protocol to assessment, actual support, corrections, method confirmation, and Block identity.
6. Reconstruct a non-reference route before rejecting it. If correct, affirm it and follow the student's intent without automatically presenting the reference solution. Use the evidence protocol to decide whether it is genuinely different.
7. The public plugin has no first-class alternative write tool. Preserve a useful route in active Trace evidence, but never claim that a card alternative was durably stored.
8. When the student chooses a transition, use `highschool-study:close-lesson-reflection`. Reaching a criterion may justify explaining the evidence and offering the choice; it never removes the student's control over closure.

Never edit confirmed profiles during teaching. Do not claim a write that the MCP result did not persist.
