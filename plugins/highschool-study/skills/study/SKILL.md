---
name: study
description: Enter or resume the continuous Markdown-first study loop from learning-set directory state.
argument-hint: "[继续|规划目标|备下一课|查看进度|更正记录]"
allowed-tools: Read, Glob, Grep, Skill
---

The study coach is the only student-facing entry. Inspect the learning-set directory before choosing a route; do not ask the student to switch Agents.

1. Route an explicit correction request to `highschool-study:correct-learning-record` and an explicit progress question to `highschool-study:inspect-progress`.
2. If `ROADMAP.md` is missing, incomplete, or the student wants a change, route to `highschool-study:start-or-revise-roadmap`.
3. If a Lesson is active, route to `highschool-study:run-lesson` with the current student request. If the request asks to pause or close, run-lesson must route through `highschool-study:close-lesson-reflection` even when capability has not been attained.
4. If a Lesson is paused, route it to the paused-Lesson consent checkpoint in `highschool-study:run-lesson`, carrying its saved pause point. Do not describe this route as a resume and do not recreate Tasks or teach until the student makes the fresh choice required there.
5. If a prepared next Lesson exists, ask whether to begin and route to `highschool-study:run-lesson` only on agreement.
6. If the current Plan has capability evidence and the student explicitly chooses Plan completion, route the final reflection through `highschool-study:consolidate-plan-memory`.
7. Otherwise choose the next eligible Plan from recorded dependencies and student-approved order, then route to `highschool-study:prepare-next-lesson`.

Never infer attainment, Lesson closure, or Plan completion from directory order, silence, or Tasks. When state is ambiguous, show the conflicting file evidence and ask one focused choice.
