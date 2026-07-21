---
name: inspect-progress
description: Explain current progress from source-linked Markdown and active Trace without writing state.
allowed-tools: Read, Glob, Grep, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

This Skill is read-only. Read the relevant Roadmap, Plan, Lesson, summaries, and both confirmed profiles directly, then answer the student's actual scope. Never read or rely on `memory/planner-attention.md`; it is preparation-only.

For method evidence, call `trace_search` with the relevant Plan or Lesson scope and use only active Trace. Use the returned `cardsByPath` to bind traced cards to their real primary and secondary method roles. Cardless Trace can support the surrounding learning history but cannot establish a card method role. Use `source_resolve` only when a cited original needs drill-down. Derive this request-local view without writing a projection, and label it uncalibrated descriptive evidence rather than mastery or an effect estimate.

Report these dimensions separately, each with direct sources and uncertainty:

- Roadmap capability attainment and its test evidence;
- each Plan's capability attainment, explicit completion/closure, dependencies, and eligible next work;
- each Lesson's target attainment and separate open/paused/closed state;
- method evidence from active Trace plus real card primary and secondary method roles, clearly labeled uncalibrated rather than mastery;
- student and teaching preferences from the two confirmed profiles, clearly labeled durable and student-confirmed.

Do not treat Task state, a method projection, profile text, Lesson closure, Plan closure, or capability evidence as interchangeable. Resolve originals when the student asks why. State what evidence would settle any open question, and never mutate files or Trace from this progress view.
