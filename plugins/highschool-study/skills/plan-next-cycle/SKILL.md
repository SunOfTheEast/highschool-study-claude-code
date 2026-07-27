---
name: plan-next-cycle
description: Use when accumulated learning evidence may change whether the student continues, revises, diagnoses, or starts the next Plan.
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent(highschool-study:lesson-designer), mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
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

When materially different explanations would lead to different Plans, compare only
the plausible alternatives. If direct evidence already determines the next useful
step, do not invent competing hypotheses. If key alternatives remain unresolved,
recommend a short diagnostic Plan.

Choose one leverage point that matters to the Roadmap and can plausibly change within
one Plan. Do not mechanically choose the lowest signal.

## Optional evidence workflow

Use direct evidence when it is sufficient. For broad, conflicting, or direction-changing
history, delegate one to three genuinely independent evidence questions to
Agent(highschool-study:lesson-designer). Select questions from capability trajectory,
recurring reasoning, and response to prior teaching; do not create a task merely to
fill a category. The delegate returns compact paths, findings, conflicts and uncertainty.
It cannot write learning facts or select the Plan.
If delegation returns only partial results, use them only when the remaining evidence
is sufficient; otherwise keep the decision diagnostic or unresolved.

## Discuss and persist

Present one recommended next Plan or diagnostic Plan in student language. Explain the
current judgment, the sources that changed the decision, uncertainty, and what later
result would support or overturn it. The student may reject, revise, reorder, pause,
or choose another eligible direction.

If the confirmed decision keeps the current Plan and only changes its next teaching
move, edit the existing Current Position, Next Lesson Candidate and Plan Summary while
preserving the original Planning Basis. Create a new Plan only when the decision
starts a new learning cycle.

Only after explicit confirmation, write the canonical plans/<plan-id>.md inside the
real learning-set root. Every Plan must contain exactly one non-empty Goal, Observable
Capability Standard, Test, Planning Basis, Lesson Index, Current Position, Next Lesson
Candidate and Plan Summary section. The shared reader rejects the whole Plan when any
required section is missing, empty or duplicated.

After writing, call `source_resolve` from `ROADMAP.md` to `plans/<plan-id>.md` and
require `valid: true`. Repair the same file and retry when validation fails; do not
link the Plan or report success before it validates.

Planning Basis must contain:

- the current judgment and why this direction matters now;
- direct source links that actually changed the choice;
- a validation or replanning signal.

Use natural prose or a short list; do not force unused fields. After validation, add
the canonical Plan link under ROADMAP.md / Plan Graph, reread both files, and report
only the persisted state.

At Plan completion, compare its Planning Basis with active evidence in Plan Summary.
State an intervention effect only when classroom evidence supports it. Preserve
unverified transfer, retention, and causal claims as open.
