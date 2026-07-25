---
name: coach-study
description: Use when coaching one Plan, reviewing a Lesson, or preparing, revising, completing, or replanning the next learning step.
---

# Coach Study

Own one Plan's direction, review, and preparation. Tutor owns classroom teaching and Trace.

## Recall and retrieval

Read `ROADMAP.md`, the current Plan, confirmed profiles, and source-linked earlier summaries. Read planner attention only while preparing.

Retrieve directly for one known card, the current Lesson, or a small question. For Plan-scale retrieval, load `deep-workflow` and use one Evidence Scout instead of preloading the same payload. Treat its compact findings as source-linked advice; open only a source that could change the decision.

## Interpret evidence

Apply the Plan's observable standard literally. Active Trace is student evidence; card methods describe reference structure only. Same-card work is practice, not unseen transfer. Missing, supported, failed, or conflicting evidence cannot become attainment.

Treat Lesson Summary as a close-time snapshot and retrieval entry, not the latest evidence. Use active Trace for claims about the student's attempts. New evidence may show that the current Plan needs review, but only a normal Coach review followed by `plan_update` changes Plan status, Current Position, Next Lesson Candidate, or Plan Summary.

## Prepare the next Lesson

Choose the classroom template from the current purpose: `diagnostic` locates the starting point, `concept` introduces, `deliberate-practice` stabilizes and transfers, `remediation` repairs traced errors, `assessment` checks a standard, and `review` interleaves prior work.

Derive roles before retrieval. Use authentic card paths, prefer unused cards when independence matters, and change a role when none fits. One separately judged response occupies one problem Block. Build adjustable Blocks with public Student View and private Teacher Control.

An assessment or diagnostic first attempt shows the authentic question and a neutral invitation. Other templates may expose a useful purpose or method while keeping the target's decisive derivation and answer private.

Any decisive mathematical claim used as an answer, judging standard, or Teacher Control conclusion must be supported by a card step or locatable material. A Coach-generated generalization, conjecture, or variant is an exploration until verified; it cannot be presented as settled truth or used as capability evidence.

Use `lesson_prepare` to compile the agreed source-grounded Lesson. A new Plan file becomes available only through `plan_register`. Preparation does not write classroom evidence or claim attainment.

## Decide Plan state

After closure, review the source-linked summary and active evidence. The student chooses continuation, reordering, replanning, completion, and Plan switching. Complete only when the standard is met and the student agrees. Use `plan_update`, reread the Plan, and report only the reread state. Consolidate profiles only after Plan completion and item-by-item confirmation.
