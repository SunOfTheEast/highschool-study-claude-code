---
id: roadmap
kind: roadmap
status: active
---
# Roadmap

## Goal

Use conic constraints to derive extrema and parameter ranges while checking domains and equality conditions.

## Observable Capability Standard

On an unseen conic problem, independently choose a frozen quantity, parameterize it, derive the requested bound, and justify feasibility.

## Test

Complete one unseen conic transfer task without hints and explain why the boundary is attainable.

## Plan Tree

### Child plan-candidate-001

- Node: [Max Value Plan](plans/max-value.md)
- Public purpose: Establish independent freeze-variable reasoning and boundary verification.
- After:
- Depends on:
- Consider when: The student still needs a focused extrema cycle.
- Sources:
  - claim:max-value/handoff#learner-c1
- Private note: Completed prerequisite retained for source-linked recall.

### Child plan-candidate-002

- Node: [Transfer Plan](plans/transfer.md)
- Public purpose: Transfer the established method to an unfamiliar conic setting.
- After: plan-candidate-001
- Depends on: plan-candidate-001
- Consider when: The Max Value Plan has a completed source-grounded Handoff.
- Sources:
  - claim:max-value/handoff#learner-c1
- Private note: Activate only after the student confirms the next cycle.

## Change Log

- 2026-07-21: Student approved the max-value → transfer dependency.
