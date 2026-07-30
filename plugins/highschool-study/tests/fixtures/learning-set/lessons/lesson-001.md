---
id: lesson-001
kind: lesson
parent_id: max-value
parent_path: plans/max-value.md
status: closed
---
# Lesson 001

## Activation Snapshot

- Parent: plan:max-value
- Activated at: 2026-07-21T01:10:00.000Z

### Selected Context

- card:cards/conics/freeze-variable-01.yaml

### Content Boundary

- Do not name the useful frozen quantity before the student's first attempt.

### Adaptation Brief

- Working judgment: The entry point was unclear, but long explanation was unlikely to help.
- Sources:
  - card:cards/conics/freeze-variable-01.yaml
- Design consequence: Use short checkpoints before independent work.
- Revise if: The student identifies the frozen quantity without a checkpoint.

## Block step-01

### Node State

- Kind: dialogue
- Required: true
- Status: completed
- Depends on:
- Uses:

### Student View

The student identified the target combination after one worked example.

### Teacher Control

Keep the example separate from the later independent attempt.

## Block step-02

### Node State

- Kind: problem
- Required: true
- Status: completed
- Depends on: step-01
- Uses: Q-FREEZE-01

### Student View

The student requested short checkpoints before attempting an independent transfer and used them to identify the frozen quantity.

### Teacher Control

Record the support honestly; this is not independent transfer evidence.

## Aliases

- Q-FREEZE-01: ../cards/conics/freeze-variable-01.yaml

## Lesson Summary

Freeze-variable recognition was emerging. The student directly preferred short checkpoints before independent work; the domain check remained unresolved.

## Handoff

- ID: lesson-001/handoff
- From: lesson:lesson-001
- To: plan:max-value
- Sealed at: 2026-07-21T01:35:00.000Z

### Learner C1

- Statement: "The student can identify the frozen quantity with short checkpoints."
- Scope: "The first conic extrema card."
- Sources:
  - block:lesson-001/step-02
  - card:cards/conics/freeze-variable-01.yaml
- Boundary: "Independent recognition and boundary feasibility remain unverified."
- Next use: "Reduce support and ask for the domain before evaluating the boundary."

### Teaching T1

- Statement: "Short checkpoints kept the student engaged before independent work."
- Scope: "This introductory Lesson."
- Sources:
  - block:lesson-001/step-02
- Boundary: "The preference has not yet been tested on an unfamiliar card."
- Next use: "Retain checkpoints but avoid another long worked example."

### Source Index

- block:lesson-001/step-02
- card:cards/conics/freeze-variable-01.yaml
