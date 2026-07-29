---
name: consolidate-plan-memory
description: Use when evidence meets a Plan standard and the student explicitly chooses Plan completion.
user-invocable: false
allowed-tools: Read, Glob, Grep, Edit, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

Run only after direct evidence meets the Plan's observable capability standard and the student chooses completion.

1. Read the Plan standard, completion choice, indexed Lesson summaries and both confirmed profiles. Use summary source links and scoped active Trace to open a full Lesson or original only when a candidate memory depends on it.
2. Separate observation from inference. For every durable preference candidate, retain direct sources, conflicts and narrow scope.
3. Show a natural-language `add / revise / delete` table. Each row has one `student` or `teaching` owner and may be kept, rewritten or rejected. An empty confirmed delta is valid.

Do not edit a profile before item-by-item confirmation. Profiles contain only confirmed, durable, currently valid preferences with direct sources and narrow scope.

If the student rejects an inference, remove or rewrite that proposal. A rejected memory proposal is not classroom Trace.

When Planning Basis exists, compare its initial judgment with active evidence in the
persisted Plan Summary. Distinguish supported, refuted and still-unverified claims,
and describe an intervention effect only when Lesson or Trace sources support it.

After confirmation, apply only accepted rows and student rewrites to the canonical
`learning-set/memory/student-profile.md` and
`learning-set/memory/teaching-profile.md`. Keep stable `S…` and `T…` identifiers for
revisions. Every active entry records Content, Scope, direct Sources, Rationale and
Counter-evidence; rejecting a row leaves the profile unchanged, while rewriting a
proposed delete retains that entry with the student's replacement text. Do not write
capability conclusions, single-attempt states or Planner Attention into either
profile.

Persist Plan completion, evidence, caveats and the confirmed profile delta as
separate facts. Reread the Plan and both complete profile files before reporting
their actual state. If either write fails, report the failure and do not claim that
the confirmed delta was applied.
