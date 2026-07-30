---
id: lesson-003
kind: lesson
parent_id: max-value
parent_path: plans/max-value.md
status: closed
---
# Lesson 003

## Activation Snapshot

- Parent: plan:max-value
- Activated at: 2026-07-21T02:10:00.000Z

### Selected Context

- claim:lesson-002/handoff#learner-c1
- claim:lesson-002/handoff#teaching-t1
- card:cards/conics/freeze-variable-transfer-02.yaml

### Content Boundary

- Present the unseen transfer card without hints or a worked route.

### Adaptation Brief

- Working judgment: The student was ready to test independent transfer with the domain checkpoint internalized.
- Sources:
  - claim:lesson-002/handoff#learner-c1
  - claim:lesson-002/handoff#teaching-t1
- Design consequence: Use an unfamiliar conic family with no video and no directional hint.
- Revise if: The first attempt needs support or omits boundary feasibility.

## Block step-01

### Node State

- Kind: problem
- Required: true
- Status: completed
- Depends on:
- Uses: Q-FREEZE-TRANSFER-02

### Student View

The student independently selected the frozen quantity on the transfer card.

### Teacher Control

Record the first attempt before offering any help.

## Block step-02

### Node State

- Kind: problem
- Required: true
- Status: completed
- Depends on: step-01
- Uses: Q-FREEZE-TRANSFER-02

### Student View

The student stated the domain before evaluating the boundary and completed the no-hint feasibility check without video.

### Teacher Control

Treat this as one independent transfer observation, not universal mastery.

## Block step-03

### Node State

- Kind: reflection
- Required: true
- Status: completed
- Depends on: step-02
- Uses:

### Student View

In final Plan reflection, the student confirmed the short-checkpoint preference and the domain-first tutor requirement, deleted the long-lecture candidate, and rejected the video rule.

### Teacher Control

Keep capability, Plan completion and preference confirmation as separate decisions.

## Aliases

- Q-FREEZE-TRANSFER-02: ../cards/conics/freeze-variable-transfer-02.yaml

## Lesson Summary

The observable capability standard was met independently. Closure and Plan completion were recorded only after the student's explicit choices.

## Handoff

- ID: lesson-003/handoff
- From: lesson:lesson-003
- To: plan:max-value
- Sealed at: 2026-07-21T02:45:00.000Z

### Learner C1

- Statement: "The student independently transferred freeze-variable reasoning and justified boundary feasibility."
- Scope: "One unseen hyperbola transfer card."
- Sources:
  - block:lesson-003/step-01
  - block:lesson-003/step-02
  - card:cards/conics/freeze-variable-transfer-02.yaml
- Boundary: "A different conic family remains untested."
- Next use: "Use this claim as the compact source for the next transfer Plan."

### Teaching T1

- Statement: "Short checkpoints and a domain-first checkpoint were sufficient without video."
- Scope: "This three-Lesson cycle."
- Sources:
  - block:lesson-003/step-02
  - claim:lesson-002/handoff#teaching-t1
- Boundary: "Do not turn the sequence into a fixed template."
- Next use: "Keep only the checkpoint that remains relevant to the next Lesson."

### Source Index

- block:lesson-003/step-01
- block:lesson-003/step-02
- card:cards/conics/freeze-variable-transfer-02.yaml
- claim:lesson-002/handoff#teaching-t1
