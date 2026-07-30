---
name: consolidate-plan-memory
description: Use when a completed Plan Handoff may justify student-confirmed long-term preference changes.
user-invocable: false
allowed-tools: Read, Glob, Grep, Edit, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Consolidate Plan Memory

Run only after the Plan meets its observable standard, has a sealed Plan
Handoff, and the student explicitly chooses completion.

Read the completed Plan Handoff, its lower Claim/Trace sources, and both
confirmed profiles. Separate observed learning behavior from inferred durable
preference. A candidate must:

- remain useful beyond one Lesson;
- have a narrow scope and counter-evidence;
- cite one or more exact active Claim handles owned by the completed Plan
  Handoff (`claim:<plan-id>/handoff#learner-cN` for student memory or
  `claim:<plan-id>/handoff#teaching-tN` for teaching memory);
- never substitute a child Lesson Claim, Trace, Session, Handoff handle, path,
  or reconstructed ID for that Plan Claim;
- match an existing profile ID and content exactly when revising or deleting.

Show each proposed `add`, `revise`, or `delete` in natural language with its
student or teaching owner. The student may keep, rewrite, or reject each item;
an empty confirmed delta is valid. Do not edit either profile before all
decisions are explicit. After rereading the newly sealed Plan Handoff, create
the runtime review proposal in that same terminal completion turn. Do not ask
for another completed-Plan chat turn: the review panel owns the later
item-by-item keep, rewrite, and reject decisions.

Apply only accepted rows and student rewrites. Keep stable IDs for revisions.
Each active profile entry records Content, Scope, Sources, Rationale, and
Counter-evidence. Do not store capability, one-attempt state, subject-specific
weakness, or Planner Attention as a global preference.

Persist Plan completion, Plan Handoff, and confirmed profile delta as separate
facts. Reread the completed Plan and both full profile files before reporting
what changed. If any write fails, preserve the confirmed proposal and report
that application remains incomplete.
