---
name: plan-next-cycle
description: Use when accumulated learning evidence may change whether the student continues, revises, diagnoses, or starts the next Plan.
---

# Plan Next Cycle

Coach owns the judgment and final write. Tutor evidence, cards, summaries, profiles,
planner attention, and child findings are inputs, not verdicts.

## Establish the decision

Read the Roadmap, relevant Plan Summaries, confirmed profiles, and LEARNING_GUIDE.md.
Use Lesson Summary as a retrieval entry and active Trace for claims about student
performance. Read planner attention only as a preparation signal. Do not bulk-load
old Lessons; open a source only when it could change the decision.

When sources disagree, active Trace owns attempt outcome, support, actual method and
recorded time. A source-linked Lesson or Plan Summary is the compact retrieval index,
not permission to override conflicting original facts. Planner Attention is a
rebuildable preparation signal. Do not use a hand-authored or explicitly prototype
HEATMAP as current learner evidence. Open the decisive original source before choosing
between Plans when a conflict could change the direction.

Reconstruct change over time: independence, support, transfer, retention, recurring
student reasoning, and response to prior teaching moves. A score or method label can
locate a question but cannot explain its cause.

If no prior evidence exists, treat the student's account as unverified starting
context and recommend a first diagnostic Plan. A missing or broken source makes its
claim unverified; never replace it with an inferred fact.

## Ask the current student

History decides what not to ask again; it does not replace a current consultation.
Before recommending a direction, ask one question per turn and normally ask several
useful questions about how the student interprets the last cycle, what matters now,
and any changed constraint or desired outcome.

Generate each next question from the student's latest answer. Find the broadest
ambiguous phrase whose possible meanings would lead to different Plans, then clarify
its type, situation, stuck step, recent example, or attempted approach before asking
about causes. Do not lead with a Coach hypothesis, repeat a settled fact, or batch the
consultation into a questionnaire. If the student delegates one choice, leave that
line and ask from another decision-changing angle when one remains. If they
explicitly stop the inquiry, continue with stated uncertainty.

Before proposing, summarize the combined historical evidence and current account,
and invite correction. The resulting working judgment must distinguish explanations
with different teaching consequences, cite the student words or exact sources that
support it, change the next Plan action, and name later evidence that would support
or overturn it. Avoid stable personality labels and generic restatements of weakness.

When materially different explanations would lead to different Plans, compare only
the plausible alternatives. If direct evidence already determines the next useful
step, do not invent competing hypotheses. If key alternatives remain unresolved,
recommend a short diagnostic Plan.

Choose one leverage point that matters to the Roadmap and can plausibly change within
one Plan. Do not mechanically choose the lowest signal.

## Optional evidence workflow

Use direct evidence when it is sufficient. When relevant history is broad, conflicting,
or direction-changing and deep mode is enabled, load deep-workflow. Ask one to three
independent Evidence Scout questions selected from capability trajectory, recurring
reasoning, and response to prior teaching. Do not create a task merely to fill a
category. Scouts return findings and exact sources; they never select the Plan.
If a workflow returns only partial results, use them only when the remaining evidence
is sufficient; otherwise keep the decision diagnostic or unresolved.

## Countercheck completion once

When the proposed decision is this Plan's first completion attempt, load
`deep-workflow` and run its mandatory Quick Evidence Scout even when deep mode is off.
Give it the proposed conclusion, exact boundary, key sources and supporting sources;
ask for conflicts, omitted conditions, support dependence, stale wording and
unreadable sources or writes, not a verdict. Recheck at most once if its findings
change the key-source set. On failure or timeout, narrow the boundary and keep an open
question.

## Discuss and persist

Present one recommended next Plan or diagnostic Plan in student language. Explain the
current judgment, the sources that changed the decision, uncertainty, and what later
result would support or overturn it. The student may reject, revise, reorder, pause,
or choose another eligible direction.

If the confirmed decision keeps the current Plan and only changes its next teaching
move, use plan_update and preserve the original Planning Basis. Record the revised
judgment in Current Position and Plan Summary so the initial hypothesis remains
auditable. Create a new Plan only when the decision starts a new learning cycle.

Only after explicit confirmation, write the canonical plans/<plan-id>.md. Every Plan
must contain exactly one non-empty Goal, Observable Capability Standard, Test,
Planning Basis, Lesson Index, Current Position, Next Lesson Candidate and Plan Summary
section. `plan_register` rejects the whole Plan when any required section is missing,
empty or duplicated. Repair the same file and retry; do not report success until the
returned Plan has a non-empty `planningBasis`.

Before any real Lesson exists, Lesson Index contains only `（暂无）`. Put prospective
Lesson functions in Next Lesson Candidate or Plan Summary; never describe an uncreated
Lesson as `prepared` or give it a numbered Lesson Index entry. `lesson_prepare` adds
the real indexed link after the Lesson exists.

Planning Basis must contain:

- the current judgment and why this direction matters now;
- direct source links that actually changed the choice;
- a validation or replanning signal.

Use natural prose or a short list; do not force unused fields. Call `plan_register`,
reread the Plan and Roadmap, and report only the persisted state.

At Plan completion, compare its Planning Basis with active evidence in Plan Summary.
State an intervention effect only when classroom evidence supports it. Preserve
unverified transfer, retention, and causal claims as open. Persist the conclusion,
boundary, key evidence, supporting evidence, open questions and next step as the
structured Learning Review, then reread it before speaking to the student.
