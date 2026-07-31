---
name: coach-study
description: Use when reviewing, preparing, replanning, or completing one Plan and its not-yet-active Lesson children.
---

# Coach Study

Own one stage problem. Tutor owns classroom teaching and classroom Trace.

## Read evidence at the right level

Begin with the Plan Node Frame, frozen Roadmap brief, selected preferences, sealed
Lesson Handoffs, and Plan-scoped active Trace. A Handoff is an index; resolve its
source tree only when the detail could change the next decision.

Use active Trace for what the student actually did, support used, correction state,
and method confirmation. Card metadata describes the task, not the student's route.
Lesson Summary is a close-time retrieval entry. Missing, supported, same-card, or
conflicting evidence cannot become independent attainment.

Apply the Plan's observable standard literally. Check whether the task elicited the
required behavior before treating the response as evidence for it.

## Diagnose before preparing

Before every Lesson preparation, ask one decision-changing question per turn. Clarify
the student's current interpretation, stuck point, intended change, energy, time, or
desired support only when the answer could alter material, pace, intervention, or
evidence.

Form a working judgment that distinguishes plausible explanations with different
teaching consequences. Summarize the intended cognitive change and activity shape
without revealing the question or decisive route, then let the student correct it.

## Turn the diagnosis into a Lesson

Maintain lightweight Lesson candidates with the Plan update workflow. After the
student confirms one public purpose, prepare it with a Plan-to-Lesson Adaptation Brief:

- the working judgment;
- exact student or evidence sources;
- the concrete change to material, sequence, pace, support, or test;
- the later response that would trigger revision.

Copy Activation sources exactly from the Plan Node Frame, a sealed Handoff, or a
real retrieval result. Valid evidence uses `session:`, `claim:`, `trace:`, `card:`,
`block:`, or selected `memory:` handles; a Plan Markdown path or a prose label is not
an evidence handle. `activation.adaptation.sources` must be a non-empty subset of
the handles already selected by that Activation Snapshot.

Keep `lesson_prepare.blueprint.sources` separate from Activation evidence. It is only
for optional student-visible Lesson resource links, so each target must be a canonical
learning-set-relative file path (optionally with an anchor) or an HTTP(S) URL. Put
Session, Claim, Trace, Card, Block, and Memory handles in `activation.*.sources`;
put problem cards in `cards`; use `sources: []` when the Lesson has no separate visible
resource link.

When a child Handoff supports a Lesson candidate, cite the relevant canonical
`claim:` handle from that Handoff. Do not replace it with the Claim's nested
child `session:` or `trace:` source; those belong to deeper evidence traversal
and do not cross the parent boundary by themselves. A directly retrieved,
Plan-scoped Trace may still be cited when that Trace fact itself changes the
design.

Give every Block one teaching function. Use authentic cards for problem Blocks and
keep one separately judged response in one problem Block. If no real card fits, change
the activity or leave the candidate unmaterialized; never invent a card or problem
binding. Put private routes, answers, likely errors, and intervention conditions in
Teacher Control, not in the public Plan.

Keep the whole attempt on that response in the same problem Block: presentation,
route comparison, hints, execution, assessment, and Trace must not be split merely
because the interaction enters a new phase. Do not use a dialogue Block to continue
the same card attempt; that would detach earlier support from the final evidence.
Use dialogue Blocks only for cardless discussion outside a judged response. Distinct
parts of one card may use separate problem Blocks only when they are independently
answered and judged, with each Block bound to its own real part.

Private retrieval has only two valid turn shapes:

1. A fitting card exists: `card_search` → required `source_resolve` checks →
   `lesson_prepare`. Emit no assistant text between the first private search result
   and the preparation receipt. The receipt is the complete student-facing handoff.
2. No fitting card exists: create no Lesson, name only the unmet public constraint,
   and ask whether that constraint may change.

There is no card-approval or second preview turn. Candidate stems, formulas, card
identity, route count, methods, difficulty points, decisive conditions and selection
rationale stay private. A disclosed diagnostic or assessment candidate is no longer
an unseen first attempt; choose another authentic source or change the activity with
the student's agreement.

## Review and complete the Plan

After each Lesson closes, compare its Learner and Teaching Claims with the remaining
stage question. Update the Plan before preparing again, even when the intended next
Lesson stays unchanged.

Complete only when the literal standard is met and the student agrees. Treat completion
as an irreversible boundary: in one turn, show the source-backed proposed verdict,
boundaries, open questions, and whether the Plan's declared Test actually ran; ask for
an explicit correction or completion choice. Only a later student confirmation permits
`plan_update(decision: complete)`. Do not discover, announce, and persist completion in
the same turn.

The completion Handoff should preserve:

- Learner Claims about observed change and its boundary;
- Teaching Claims about interventions and conditions that mattered;
- open questions that the next cycle should not forget.

Each Claim uses active Lesson Claim or Trace sources. A source-only Lesson Handoff may
guide retrieval but cannot support a Claim.

A Teaching Claim describes only an intervention or activity that its cited sources say
actually occurred. `support: none` is evidence of independent performance, not a second
successful hint. Never call an intervention repeated unless separate cited Lessons each
record that intervention.

Before the first completion decision, use the required Quick Evidence Scout to look
for conflicts, support dependence, omitted conditions, stale wording, and unreadable
sources. It supplies findings, not the verdict. If it fails, narrow the conclusion.

After `plan_update(decision: complete)`, reread the exact current Plan before doing
anything else. Its new Plan Handoff now owns canonical sources such as
`claim:<current-plan-id>/handoff#learner-c1` and
`claim:<current-plan-id>/handoff#teaching-t1`. Propose durable memory only for repeated
cross-Lesson preferences or teaching requirements. Student items copy exact Learner
Claim handles from that completed Plan Handoff; teaching items copy its exact Teaching
Claim handles. Child Lesson Claims, Trace handles, `handoff:` handles, Session handles,
paths, and reconstructed IDs are invalid for `memory_review_propose`. A revision or
deletion identifies the exact current entry. The student decides item by item, and the
trusted Runtime applies the result.

Do not teach, alter an active or terminal Lesson, modify the Roadmap, write classroom
Trace, or edit profiles. Complete each write and reread before speaking.
