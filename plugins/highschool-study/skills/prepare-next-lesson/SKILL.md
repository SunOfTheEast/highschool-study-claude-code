---
name: prepare-next-lesson
description: Use when preparing or revising a source-grounded Lesson for one eligible Plan.
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent(highschool-study:lesson-designer), mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Prepare Next Lesson

## Teaching frame

Read the full `learning-set/LEARNING_GUIDE.md` when it exists. Build one coherent preparation
argument:

1. Reconstruct how this student currently thinks from active evidence and their own words.
2. Choose one primary cognitive change, not merely a topic or method label.
3. Give each task a distinct function in producing that change; remove or repurpose repetition.
4. Anticipate plausible reactions and end with independent evidence of the intended change.

Carry only the principles relevant to this Lesson into its existing Student View or Teacher
Control. Teacher Control should describe likely student thinking, when to wait or intervene, and
how to adapt; it is not a store of worked solutions.

## Preparation workflow

1. Select one eligible Plan in the student's chosen order and recall preparation memory. Read `references/classroom-templates.md` and `references/reveal-policy.md`; choose the template that fits the intended cognitive change and active evidence.
2. Retrieve narrowly for one known card or local question. For Plan-scale or cross-card work, delegate one focused retrieval to `Agent(highschool-study:lesson-designer)` instead of preloading the parent. When a candidate could advance or close a Plan item, require `requirement → exact card source → elicited behavior → gap` together with real card paths, active Trace references, findings, and missing roles.
3. Derive activity and problem functions before searching. Search authentic candidates for every needed function, deduplicate paths, and use their complete active Trace. Treat a same-card retry as practice, not unseen transfer. If no real card fits, change or shrink the Lesson rather than inventing a card, alias, source, or question.
4. Apply the Plan's observable test literally. Decompose it into required observable behaviors and conditions; use the card stem or steps to verify that the task elicits each one, then use active Trace to verify what the student did. Card metadata describes reference structure; surface resemblance, Lesson prose, Task state, method labels, and preparation intent do not prove alignment or attainment.
5. A decisive mathematical claim used as an answer, judging standard, or Teacher Control conclusion must cite a stable card step or locatable material. A generated generalization, conjecture, or variant remains an exploration until verified and cannot become capability evidence.
6. Prefer local material. Use an external video only after the designer verifies its canonical URL, relevant segment, teaching purpose, follow-up activity, and local fallback. A video that solves the target follows its first attempt or uses a different example.
7. Draft adjustable dialogue, problem, material, and reflection Blocks. Each Block has Node State, Student View, Teacher Control, dependencies, and safe route options. One separately judged response occupies one problem Block whose `Uses` contains exactly one real alias; separately judged parts reuse the alias in separate Blocks. If two Blocks serve the same teaching function, remove one or give it a different job.
8. Write the next indexed Lesson as `prepared` with top-level `## Aliases`, `## Lesson Summary`, and `## Traces`. Add zero, one, or multiple reflection Blocks according to the chosen template and recorded adjustments; never add a fixed top-level `## Reflection`. Every used alias resolves to a real problem card. Reread the file before reporting it prepared.
9. Apply the reveal policy as an output shape. For assessment, report preparation with readiness and the number of problem Blocks; do not preview the questions. Other templates may naturally summarize their activity roles and learning direction.

Preparation does not append classroom evidence, claim attainment, edit confirmed profiles, or close the Lesson or Plan.
