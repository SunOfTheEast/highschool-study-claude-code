---
name: run-lesson
description: Use when teaching or resuming one prepared Lesson.
allowed-tools: Read, Glob, Grep, Edit, Skill, TaskCreate, TaskUpdate, TaskList, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Run Lesson

1. Call `highschool-study:recall-study-memory` for teaching. Read the prepared Lesson, `prepare-next-lesson/references/reveal-policy.md`, this Skill's `references/evidence-protocol.md`, and only the direct sources needed by the current Block. Planner attention is preparation-only.
2. Honor pause, continued-thinking and close requests before teaching or changing Tasks. A paused Lesson resumes only after a fresh continue, adjust or close choice.
3. Project remaining ActivityBlocks as a coarse Task List after consent to proceed. Tasks may be skipped, reordered, repeated or adjusted when dependencies allow; they are interface state, not learning evidence.
4. Teach one Block at a time and show only its Student View. First-attempt problems use the Lesson alias and authentic stem without a method or structure subtitle. Teacher Control, future Blocks, answers, rubrics and unrevealed help stay private.
5. Follow the selected reveal mode. Continued thinking means wait. After an evidence-bearing attempt, append the attempt before giving requested help so later work can supersede it.
6. Apply the evidence protocol after every evidence-bearing activity. Keep a missing decisive proof incomplete and record actual help dependence. After the initial unbound Trace succeeds, follow the candidate-confirmation sequence before the next Task whenever one exact canonical node fits the student's route. Bind it only after a new student turn confirms the proposed node; rejection, deferral or no exact candidate leaves the active Trace unbound. Accepted objections to recorded assessment or method evidence do require a superseding Trace before summaries. Say a Trace was recorded only after `trace_append` returns `ok: true`, the Lesson `ownerPath`, and a real `factId`.
7. Before rejecting a non-reference route, reconstruct its complete chain. If correct, affirm it and follow the student's intent without automatically presenting the reference solution. A genuine alternative changes the complete entry, decisive reasoning and closing chain of at least one whole question or part; notation changes, reordered equivalent steps and local tricks do not. The Claude plugin has no alternative-persistence tool: preserve the route in active Trace evidence when useful, but never claim that a card alternative was durably stored.
8. Keep Lesson working notes source-linked without replacing Trace. Task completion, elapsed time and one correct answer do not establish capability.
9. When the student requests a transition, call `highschool-study:close-lesson-reflection`. When evidence first appears to meet a criterion, explain supporting and conflicting evidence and invite a transition; closure remains the student's choice.

Never edit confirmed profiles during teaching.

An ordinary tool-parameter error may use one correction attempt. Any `LESSON_*` error is a Lesson-source failure: do not search, guess, substitute or repeat the call. State that the fact was not persisted and return to preparation to repair the source.
