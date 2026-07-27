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

Reconstruct change over time: independence, support, transfer, retention, recurring
student reasoning, and response to prior teaching moves. A score or method label can
locate a question but cannot explain its cause.

If no prior evidence exists, treat the student's account as unverified starting
context and recommend a first diagnostic Plan. A missing or broken source makes its
claim unverified; never replace it with an inferred fact.

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

## Discuss and persist

Present one recommended next Plan or diagnostic Plan in student language. Explain the
current judgment, the sources that changed the decision, uncertainty, and what later
result would support or overturn it. The student may reject, revise, reorder, pause,
or choose another eligible direction.

If the confirmed decision keeps the current Plan and only changes its next teaching
move, use plan_update and preserve the original Planning Basis. Record the revised
judgment in Current Position and Plan Summary so the initial hypothesis remains
auditable. Create a new Plan only when the decision starts a new learning cycle.

Only after explicit confirmation, write the canonical plans/<plan-id>.md. Include
Goal, Observable Capability Standard, Test, Planning Basis, Lesson Index, Current
Position, Next Lesson Candidate, and Plan Summary. Planning Basis must contain:

- the current judgment and why this direction matters now;
- direct source links that actually changed the choice;
- a validation or replanning signal.

Use natural prose or a short list; do not force unused fields. Call plan_register,
reread the Plan and Roadmap, and report only the persisted state.

At Plan completion, compare its Planning Basis with active evidence in Plan Summary.
State an intervention effect only when classroom evidence supports it. Preserve
unverified transfer, retention, and causal claims as open.
