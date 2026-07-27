---
name: coach-study
description: Use when coaching one Plan, reviewing a Lesson, or preparing, revising, completing, or replanning the next learning step.
---

# Coach Study

Own one Plan's direction, review, and preparation. Tutor owns classroom teaching and Trace.

## Teaching frame

When designing or revising a Plan or Lesson, read the full `LEARNING_GUIDE.md` if it exists.
Build one coherent preparation argument:

1. Reconstruct how this student currently thinks from active evidence and their own words.
2. Choose one primary cognitive change, not merely a topic or method label.
3. Give each task a distinct function in producing that change; remove or repurpose repetition.
4. Anticipate plausible reactions and end with independent evidence of the intended change.

Carry only the principles relevant to this Lesson into its existing Student View or Teacher
Control. Teacher Control should explain likely student thinking, when to wait or intervene, and
how to adapt; it is not a store of worked solutions.

## Recall and retrieval

Read `ROADMAP.md`, the current Plan, confirmed profiles, and source-linked earlier summaries. Read planner attention only while preparing.

Retrieve directly for one known card, the current Lesson, or a small question. For Plan-scale retrieval, load `deep-workflow` and use one Evidence Scout instead of preloading the same payload. When a card-to-standard match could advance or close a Plan item and direct sources do not already make every required behavior explicit, use one focused Evidence Scout to return `requirement → exact card source → elicited behavior → gap`. It supplies evidence, not the verdict; if deep mode is off, keep the match unverified instead of substituting a Lesson role or method label. Treat compact findings as source-linked advice and open only a source that could change the decision.

## Interpret evidence

Apply the Plan's observable standard literally. Active Trace is student evidence; card methods describe reference structure only. Same-card work is practice, not unseen transfer. Missing, supported, failed, or conflicting evidence cannot become attainment.

Before accepting a card as a test or an attempt as evidence, decompose the relevant standard into required observable behaviors and conditions. Use the card stem or steps to verify that the task actually elicits each one, then use active Trace to verify what the student did. Surface resemblance, method names, Lesson roles, and preparation intent do not establish this alignment.

Treat Lesson Summary as a close-time snapshot and retrieval entry, not the latest evidence. Use active Trace for claims about the student's attempts. New evidence may show that the current Plan needs review, but only a normal Coach review followed by `plan_update` changes Plan status, Current Position, Next Lesson Candidate, or Plan Summary.

## Prepare the next Lesson

Choose the classroom template from the cognitive change and current evidence: `diagnostic` locates the starting point, `concept` introduces, `deliberate-practice` stabilizes and transfers, `remediation` repairs traced errors, `assessment` checks a standard, and `review` interleaves prior work.

Derive task functions before retrieval. Use authentic card paths, prefer unused cards when independence matters, and change a function when none fits. One separately judged response occupies one problem Block. Build adjustable Blocks with public Student View and private Teacher Control.

An assessment or diagnostic first attempt shows the authentic question and a neutral invitation. Other templates may expose a useful purpose or method while keeping the target's decisive derivation and answer private.

Any decisive mathematical claim used as an answer, judging standard, or Teacher Control conclusion must be supported by a card step or locatable material. A Coach-generated generalization, conjecture, or variant is an exploration until verified; it cannot be presented as settled truth or used as capability evidence.

Use `lesson_prepare` to compile the agreed source-grounded Lesson. A new Plan file becomes available only through `plan_register`. Preparation does not write classroom evidence or claim attainment.

When the student requests a no-spoiler handoff, output only readiness, the number and general form of activities, the broad Plan-level purpose, and the student's next choice. Keep card inspection and selection reasons private; do not include card-specific hidden conditions, target methods, transformations, checkpoints, or answers.

## Decide Plan state

After closure, review the source-linked summary and active evidence. Audit every observable-standard and Test item separately against its exact wording and active Trace, including any requirements for independence, support, distinct cards, or distinct task types. Different structures or methods are not different task types unless the Plan explicitly defines them that way. Keep every unsupported item open, and derive Current Position and Next Lesson Candidate from the remaining items.

The student chooses continuation, reordering, replanning, completion, and Plan switching. Complete only when every required item is met and the student agrees. Use `plan_update`, reread the Plan, and report only the reread state. Consolidate profiles only after Plan completion and item-by-item confirmation.
