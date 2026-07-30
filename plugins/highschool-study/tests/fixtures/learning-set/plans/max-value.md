---
id: max-value
kind: plan
status: completed
parent_id: roadmap
parent_path: ROADMAP.md
---
# Max Value Plan

## Goal

Strengthen independent freeze-variable reasoning and boundary verification.

## Observable Capability Standard

Independently freeze a useful combination, eliminate the remaining variable, and verify the domain and equality condition on an unseen problem.

## Test

Complete one no-hint transfer card and explain why its boundary is attainable.

## Planning Basis

Prior classroom records showed that the domain must be stated before the final boundary check. The cycle therefore kept short checkpoints while moving toward one independent transfer.

## Activation Snapshot

- Parent: roadmap:roadmap
- Activated at: 2026-07-21T01:00:00.000Z

### Selected Context

- card:cards/conics/freeze-variable-01.yaml

### Content Boundary

- Do not reveal the decisive frozen quantity before the student's first attempt.

### Adaptation Brief

- Working judgment: The student needed shorter checkpoints and an explicit domain check before independent transfer.
- Sources:
  - card:cards/conics/freeze-variable-01.yaml
- Design consequence: Move from supported recognition to one no-hint transfer.
- Revise if: The student independently checks the domain and attainable boundary on an unseen card.

## Lesson Tree

### Child lesson-candidate-001

- Node: [Lesson 001](../lessons/lesson-001.md)
- Public purpose: Recognize the frozen quantity with short checkpoints.
- After:
- Depends on:
- Consider when: The method is new or the entry point is unclear.
- Sources:
  - block:lesson-001/step-02
- Private note: Supported recognition is not independent transfer evidence.

### Child lesson-candidate-002

- Node: [Lesson 002](../lessons/lesson-002.md)
- Public purpose: Use the domain before evaluating the boundary.
- After: lesson-candidate-001
- Depends on: lesson-candidate-001
- Consider when: The frozen quantity is visible but feasibility remains fragile.
- Sources:
  - block:lesson-002/step-02
- Private note: Separate the useful prompt from the presentation medium.

### Child lesson-candidate-003

- Node: [Lesson 003](../lessons/lesson-003.md)
- Public purpose: Complete one independent transfer and confirm the learning cycle.
- After: lesson-candidate-002
- Depends on: lesson-candidate-002
- Consider when: The student is ready for a no-hint transfer check.
- Sources:
  - claim:lesson-002/handoff#learner-c1
- Private note: Completion requires the student's explicit choice after reviewing the evidence.

## Current Position

The observable capability standard is met and the student explicitly completed this Plan.

## Capability and Completion

- Capability standard: met with direct evidence in Lesson 003.
- Student Plan choice: explicitly completed on 2026-07-21.

## Consolidation Review

| Operation | Owner | Candidate | Direct original source | Conflict / scope | Student decision |
| --- | --- | --- | --- | --- | --- |
| add | student | Short checkpoints before independent transfer | [lesson-001 block step-02](../lessons/lesson-001.md#block-step-02) | Applies when a method has several dependent checks. | keep / confirmed |
| revise | teaching | Ask for the domain before boundary evaluation | [lesson-003 block step-02](../lessons/lesson-003.md#block-step-02) | Lesson 002 needed a prompt; use before independent transfer. | rewrite / confirmed |
| delete | student | Long uninterrupted lectures | [lesson-002 block step-01](../lessons/lesson-002.md#block-step-01) | Conflicts with the student's direct Lesson 001 preference. | delete / confirmed |
| add | teaching | Always start with a video | [lesson-002 block step-02](../lessons/lesson-002.md#block-step-02) | Lesson 003 succeeded without video. | reject / unconfirmed |

## Confirmed Delta

- One student-owned addition and one teaching-owned revision were confirmed.
- The deleted and rejected candidates were not retained in either profile.

## Plan Summary

The student can apply freeze-variable reasoning independently when the domain is stated before the final boundary check. The compact confirmed profiles carry only the durable preferences needed by the next Plan.

## Handoff

- ID: max-value/handoff
- From: plan:max-value
- To: roadmap:roadmap
- Sealed at: 2026-07-21T03:00:00.000Z

### Learner C1

- Statement: "The student can independently transfer freeze-variable reasoning when domain and attainability are checked."
- Scope: "This completed conic extrema cycle."
- Sources:
  - claim:lesson-003/handoff#learner-c1
- Boundary: "Transfer to a different conic family has not yet been checked."
- Next use: "Use one unfamiliar conic family in the next Plan."

### Teaching T1

- Statement: "Short checkpoints followed by a domain-first prompt supported the move to independent transfer."
- Scope: "Lessons 001–003 in this Plan."
- Sources:
  - claim:lesson-001/handoff#teaching-t1
  - claim:lesson-002/handoff#teaching-t1
  - claim:lesson-003/handoff#teaching-t1
- Boundary: "The same sequence may not be needed after transfer stabilizes."
- Next use: "Retain the domain checkpoint but remove unnecessary worked examples."

### Source Index

- claim:lesson-003/handoff#learner-c1
- claim:lesson-001/handoff#teaching-t1
- claim:lesson-002/handoff#teaching-t1
- claim:lesson-003/handoff#teaching-t1
