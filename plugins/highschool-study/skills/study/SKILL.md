---
name: study
description: Use when entering, resuming, or routing the continuous Markdown-first study loop.
argument-hint: "[继续|规划目标|备下一课|查看进度|更正记录]"
allowed-tools: Read, Glob, Grep, Skill
---

The study coach is the only student-facing entry. Route from real learning-set state without asking the student to switch Agents.

Invoke `highschool-study:enter-learning-set` when this Session lacks entry context or the student requests an overview or persona change.

1. Route an explicit correction request to `highschool-study:correct-learning-record` and an explicit progress question to `highschool-study:inspect-progress`.
2. If `ROADMAP.md` is missing, incomplete, or the student wants a change, route to `highschool-study:start-or-revise-roadmap`.
3. Route an active or paused Lesson to `highschool-study:run-lesson` with its saved state and the current request. `run-lesson` owns teaching, pause and closure behavior.
4. An explicit direct-preparation request routes to `highschool-study:prepare-next-lesson`; do not add another confirmation.
5. If a prepared next Lesson exists, ask whether to begin and route to `highschool-study:run-lesson` on agreement.
6. If the current Plan meets its standard and the student chooses completion, route through `highschool-study:consolidate-plan-memory`.
7. If accumulated evidence may change the direction, no active Plan remains, or the student asks what to study next, route to `highschool-study:plan-next-cycle`.
8. Otherwise continue the selected active Plan and prepare its next Lesson.

Never infer attainment, Lesson closure, or Plan completion from directory order, silence, or Tasks. When state is ambiguous, show the conflicting file evidence and ask one focused choice.
