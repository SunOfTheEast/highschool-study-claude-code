---
name: prepare-next-lesson
description: Use when materializing or revising the next source-grounded Lesson under one eligible Plan.
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent(highschool-study:lesson-designer), mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Prepare Next Lesson

## Diagnose before retrieval

Read the Plan, relevant prior Lesson Handoffs, active Trace, selected confirmed
memory, and `LEARNING_GUIDE.md`. Ask one decision-changing question per turn
before private retrieval. Clarify the student's current experience, intent,
time, energy, desired difficulty, or support only when the answer changes this
Lesson.

Form one working judgment: distinguish plausible causes, cite the student's
words or active sources, choose one primary cognitive change, and name a later
response that would overturn the judgment. Show only the broad purpose,
activity shape, and support level; let the student correct it before private
card comparison or Teacher Control writing.

## Build one coherent Lesson

Read the classroom-template and reveal-policy references. Derive the function
of every activity before searching. Search authentic cards or materials for
those functions and include their complete active Trace history. A same-card
retry is practice, not unseen transfer. If no real source fits, shrink or
change the Lesson rather than inventing a card, source, alias, or problem.

Each separately judged response occupies one `problem` Block and uses exactly
one real alias. Dialogue, material, problem, and reflection Blocks remain
reorderable only while pending. Give each Block:

- Node State, dependency, and source alias;
- Student View;
- private Teacher Control describing likely thinking, wait/intervene
  conditions, and safe adaptations.

A decisive answer or judging claim cites a stable card step or locatable
material. Generated variants remain exploration until verified.

## Materialize the selected Candidate

Write one `prepared` Lesson with:

- `parent_id` and `parent_path` matching the current Plan;
- a frozen Activation Snapshot and Adaptation Brief;
- top-level Blocks, `## Aliases`, `## Lesson Summary`, and `## Handoff`;
- zero, one, or multiple reflection Blocks chosen by the template.

There is no Lesson-local Trace section. Real classroom observations later go
through `trace_append` into the learning-set-wide `traces/` pool.

Replace the approved `### Candidate <handle>` in the Plan's `Lesson Tree` with
one `### Child <handle>` pointing to the new Lesson while preserving its
public purpose, order, dependencies, sources, and private note. Do not modify
an activated Lesson, whether it is active, paused, or terminal; revise only a
prepared Lesson after the student requests re-preparation.

Reread the Lesson and parent tree. Tell the student only readiness, broad
purpose, number and general form of activities, and available next choices.
Do not reveal the question, method, card identity, decisive condition,
transformation, route comparison, checkpoint, or answer.
