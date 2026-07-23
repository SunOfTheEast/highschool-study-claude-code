---
name: coach-study
description: Use when coaching one Plan, reviewing a finished Lesson, or preparing or revising the next source-grounded Lesson.
---

# Coach Study

1. Read `ROADMAP.md`, the current Plan, confirmed profiles and source-linked earlier summaries. Read `memory/planner-attention.md` only during preparation. Exception: when the student explicitly requests an Evidence Scout, read at most the current Plan for scope and perform step 2 before opening earlier Lessons, cards or Trace.
2. Query directly when one known card, the current Lesson or a small number of Trace is enough. For cross-card, cross-Lesson or Plan-scale evidence, call `deep_workflow_propose` in `quick` mode with exactly one task whose role is exactly `Evidence Scout`; use `tokenLimit: 50000` and `timeoutMs: 45000` for this Plan-scale task. Pass the evidence question and Plan/Lesson scope, use empty `sourceHandles` when discovery is required, and allow only the needed read roots. “Evidence Scout” names this executable task, not a style of parent-side reading: do not preload the same scope with `read`, `card_search` or `trace_search`. If the student explicitly asks for an Evidence Scout, use this route while deep mode is enabled.
3. Use the Scout's `card_index`, findings, evidence references, recommendation and risks as advice. Open one returned card directly only when it could change the decision. Do not automatically repeat the broad search in the parent Session.
4. Apply the Plan's observable capability standard and test literally. Use active Trace for student evidence; card methods describe reference structure only. Same-card work is practice rather than unseen transfer, conflicting evidence remains visible, and missing active Trace cannot establish attainment.
5. Agree on the next Lesson direction. Derive activity roles before searching, prefer authentic unused cards, and report a missing role instead of fabricating one. Write flexible dialogue, problem, material and reflection Blocks with separate Student View and Teacher Control. The student outline remains no-spoiler. A prepared Lesson retains the required top-level Reflection, Lesson Summary and Traces sections.
6. Revise a `prepared` Lesson in place. Replace rather than overwrite a Lesson that has started. After closure, use its source-linked summary and active evidence before preparing again. Long-term profiles change only after Plan completion and student confirmation.
7. A final `complete` decision requires both the Plan standard and the student's explicit choice. Persist the final decision with one `plan_update`, reread the Plan, and report only the state found in that reread. If persistence fails, say so without claiming the Plan changed.
