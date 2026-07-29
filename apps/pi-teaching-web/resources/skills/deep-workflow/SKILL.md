---
name: deep-workflow
description: Use when deep mode is enabled and a teaching decision needs isolated Plan-scale retrieval, independent analysis, or dependent review.
---

# Deep Workflow

Use this Skill while the current Session's deep-mode toggle is enabled. One exception
is mandatory: a Plan Coach may use one Quick Evidence Scout before its first attempt
to complete the Plan even when the toggle is off. Deep-off mode permits no other
workflow.

Use an ordinary direct response when current context is sufficient.

For `plan-next-cycle`, select one to three independent evidence questions from the
student's capability trajectory, recurring reasoning, and response to prior teaching.
Use only questions whose answers could change the Plan; do not create a task merely to
fill a category.

Use one Quick Workflow Evidence Scout when a cross-card, cross-Lesson or Plan-scale search would otherwise leave large card and Trace payloads in the parent Session. Invoke `deep_workflow_propose` with `mode: quick`, `tokenLimit: 50000`, `timeoutMs: 180000` and exactly one task whose `role` is `Evidence Scout`; pass the evidence question, scope and allowed roots, and leave `sourceHandles` empty when discovery is required. The child discovers authentic sources and returns a compact card index, findings and references. The parent does not prefetch the same broad result with `read`, `card_search` or `trace_search`. An explicit student request for an Evidence Scout takes this route.

For card-to-standard alignment, ask the Scout to map every required observable behavior to an exact card stem or step and report missing or ambiguous requirements. Lesson roles, method names, structural resemblance, and Coach intent are not alignment evidence. The Scout does not decide Plan attainment.

For the mandatory completion check, include the proposed conclusion, boundary, key
sources and supporting sources. Ask only for conflicts, omitted conditions, actual
support dependence, stale wording and sources or claimed writes that cannot be
reread. The Scout returns findings and exact references, never `complete`,
`replan`, mastery or another verdict. If the findings change the key-source set, the
Coach may run this check once more. If the Scout fails or times out, narrow the
boundary and retain an open question rather than replacing the missing review with a
guess.

Use multiple tasks only for genuinely independent questions whose answers could change the next teaching action. Use a deep proposal for dependent waves or adversarial review, and wait for explicit student confirmation before it runs.

Give every child only the context needed for its role. Treat results as source-linked advice. The parent Coach or Tutor makes the teaching decision and remains the only writer of Lesson, Trace, Plan, profiles and planner attention. Child artifacts and unreviewed conclusions remain private.
