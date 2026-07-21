---
name: run-lesson
description: Teach or resume one prepared Lesson while preserving evidence and student control.
allowed-tools: Read, Glob, Grep, Edit, Skill, TaskCreate, TaskUpdate, TaskList, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

1. Call `highschool-study:recall-study-memory` with purpose `teaching`, then read the prepared Lesson and its direct sources. Do not read planner attention during teaching.
2. At entry and after every student turn, check for a transition request. Whenever the student asks to pause or close, call `highschool-study:close-lesson-reflection` immediately, regardless of capability attainment, and stop the normal sequence pending that reflection outcome. Do this before another activity or Task change. This request-triggered reflection is separate from the attainment-first reflection below.
3. If the Lesson is paused, first show its recorded pause point, remaining blocks, and active evidence. Require a fresh explicit `continue`, `adjust`, or `close` choice; the earlier pause instruction is not consent to resume. Before that choice, make no Task calls and do not teach. On continue, proceed from the saved point. On adjust, revise only the remaining blocks as requested and then proceed. On close, call `highschool-study:close-lesson-reflection` and stop without recreating Tasks.
4. Only after that choice for a paused Lesson—or immediately for an already active Lesson—project the Lesson's remaining ActivityBlocks to a coarse Task List. Tell the student which blocks are optional and let them skip, reorder, repeat, or adjust blocks when dependencies still hold. Tasks are a user-interface projection, never evidence or authority.
5. Teach one block at a time. After every evidence-bearing activity, call `trace_append` with the real Plan, Lesson, block, source/card identity, observation, support level, and student evidence. Resolve source references when necessary; never invent cards, sources, session IDs, or learner statements.
6. Update Lesson working notes from appended Trace without replacing the original evidence. Keep observation, evaluation, hypothesis, and unresolved question distinct.
7. Separately, when evidence first meets a Lesson or Plan criterion, show the supporting and conflicting evidence and call `highschool-study:close-lesson-reflection`, even if the student has not requested a transition. Task completion is not capability attainment. Capability attainment does not close a Lesson or Plan automatically.

Never edit confirmed profiles during teaching. Never let Task state, time elapsed, or a correct answer without its support conditions stand in for the recorded capability test.
