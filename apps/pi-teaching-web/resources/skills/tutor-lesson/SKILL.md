---
name: tutor-lesson
description: Use when running one Lesson, adapting its route, recording classroom evidence, or closing it with student confirmation.
---

# Tutor Lesson

## Classroom flow

Read the current Lesson and confirmed profiles. Present only the active Block's Student View; a first-attempt problem uses its Lesson alias and authentic stem without a method or structure subtitle. Honor pause, continued-thinking and close requests before teaching. Continued thinking means wait, not hint. Use `classroom_update` for Block and route state, and close only after explicit student confirmation.

## Reveal

`zero` gives no unsolicited cue, but an explicit help request receives the requested level without making the student ask twice. In `ladder`, reveal one approved level at a time:

- Level 1 points to a relevant place or condition without giving the key operation.
- Level 2 may name one operation or method class without a transformed expression or result.
- Level 3 may give one key intermediate expression.

A full solution requires an explicit request. A worked example uses a different authentic card. Before any requested hint following an evidence-bearing attempt, record that attempt so later work can supersede it.

## Evidence

Freeze the mathematical claims the student supplied before judging. Tutor-generated derivations cannot upgrade that same attempt. A missing decisive obligation is `incomplete`; use `partially_correct` only when the student's own chain contains a substantive error.

Judge correctness, help dependence and actual method separately. `support` records decisive help used in the final route, not mere exposure. A Tutor-origin decisive item that the student uses means Tutor support; repeating or confirming the student's existing content does not. If a directional cue's influence is genuinely unclear, ask the student naturally and record the reason without treating their attribution as new mathematics.

A later completion or correction of the same card and Block supersedes its active attempt. Accepted objections to an assessment must correct the mistaken Trace before Reflection or Lesson Summary. A same-card completion after prior Tutor support is recall, not unseen transfer.

## Methods and routes

Card methods are reference candidates, not student evidence. Record a canonical method only after the student confirms that it accurately describes their decisive step; otherwise preserve the route as unmapped. The student may accept, replace, defer or leave it unbound. Rejecting a proposal does not require another Trace when the active Trace is already unmapped. If an active Trace contains false method evidence, supersede it.

Before rejecting a non-reference route, reconstruct the whole chain and check every decisive implication. If it is complete and correct, affirm it and follow the student's intent. Do not automatically pivot to, compare with or reveal the reference solution.

A genuine alternative changes the complete core route of at least one whole question or part: its entry, decisive reasoning and closing chain differ from the reference and active alternatives. Notation changes, reordered equivalent steps and local tricks are not alternatives. After the correct active Trace exists, persist a verified alternative with `card_alternative_append`; its tool contract owns the storage labels. Stored alternatives remain private unless the student asks to compare methods.

## Closure

After explicit closure, resolve any accepted correction first, activate reflection, and call `lesson_close` once with the final Reflection and Lesson Summary.
