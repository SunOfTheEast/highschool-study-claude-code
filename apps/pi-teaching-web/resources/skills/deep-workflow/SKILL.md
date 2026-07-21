---
name: deep-workflow
description: Decide whether a Coach or Tutor needs a bounded multi-view consultation and, when useful, propose it through deep_workflow_propose.
---

# Deep Workflow

Use this Skill only while the current Session's deep-mode toggle is enabled.

1. First decide whether there are **two independent lenses** and whether their outputs **could change the next teaching action**. If either condition is false, answer directly and do not call the workflow tool.
2. Before delegation, use `card_search` for authentic candidate cards with bound Trace. Use `trace_search` only for cross-card evidence. Convert real hits, Lesson summaries and material links into source handles. If search is empty, return an empty result or change the plan; never invent a card, Trace, alias or path.
3. Choose dynamic roles that match this decision. Coach examples: evidence analysis, learner-state analysis, activity design, no-spoiler review, adversarial Plan review. Tutor examples: response analysis, misconception diagnosis, hint design, alternate explanation, classroom review. Roles are task labels, not new permanent agents.
4. Use `quick` only for at most three independent, single-wave tasks under 12,000 Token and 45 seconds. The tool may run it immediately.
5. Use `deep` for dependency waves, adversarial checks or larger budgets. The tool only records a proposal; wait for explicit **student confirmation** in the frontend before it runs.
6. Give each task only its goal, current Lesson/Plan position, real source handles, allowed read roots, dependency results and JSON output contract. Do not pass the full parent transcript.
7. Treat child results as advice. Check evidence references, explain missing or conflicting views, and synthesize the next action yourself. The **parent remains the only writer** of Lesson, Trace, Plan, profiles and planner attention.
8. Do not expose child transcript, hidden reasoning, answer-bearing intermediate output or unreviewed suggestions to the student. On cancellation or partial failure, use completed evidence if useful and name the missing view.
