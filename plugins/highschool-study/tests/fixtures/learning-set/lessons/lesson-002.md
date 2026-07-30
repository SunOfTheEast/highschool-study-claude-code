---
id: lesson-002
kind: lesson
parent_id: max-value
parent_path: plans/max-value.md
status: closed
---
# Lesson 002

## Activation Snapshot

- Parent: plan:max-value
- Activated at: 2026-07-21T01:40:00.000Z

### Selected Context

- claim:lesson-001/handoff#learner-c1
- claim:lesson-001/handoff#teaching-t1

### Content Boundary

- Do not treat presentation medium as the cause before observing the next blocker.

### Adaptation Brief

- Working judgment: Boundary feasibility, rather than method recognition, was the next blocker.
- Sources:
  - claim:lesson-001/handoff#learner-c1
- Design consequence: Ask for the legal domain before boundary evaluation.
- Revise if: The student checks domain and attainability without prompting.

## Block step-01

### Node State

- Kind: dialogue
- Required: true
- Status: completed
- Depends on:
- Uses:

### Student View

A long uninterrupted explanation led to disengagement; the student asked to return to shorter checkpoints.

### Teacher Control

Honor the student's request and stop the long explanation.

## Block step-02

### Node State

- Kind: problem
- Required: true
- Status: completed
- Depends on: step-01
- Uses:

### Student View

A short animation was available, but the domain prompt—not the medium—unblocked the boundary check.

### Teacher Control

Do not promote an always-video rule from this Lesson.

## Aliases

（无）

## Lesson Summary

The method execution improved with a domain prompt. Evidence conflicted with both a long-lecture preference and an always-video teaching rule.

## Handoff

- ID: lesson-002/handoff
- From: lesson:lesson-002
- To: plan:max-value
- Sealed at: 2026-07-21T02:05:00.000Z

### Learner C1

- Statement: "The student used the domain prompt to complete the boundary check."
- Scope: "This supported boundary-feasibility attempt."
- Sources:
  - block:lesson-002/step-02
- Boundary: "Independent domain checking remains unverified."
- Next use: "Remove the prompt on an unseen transfer card."

### Teaching T1

- Statement: "The domain checkpoint mattered more than the availability of a video."
- Scope: "This Lesson's observed blocker."
- Sources:
  - block:lesson-002/step-01
  - block:lesson-002/step-02
- Boundary: "One Lesson cannot establish a universal medium preference."
- Next use: "Keep the checkpoint and omit an unnecessary video."

### Source Index

- block:lesson-002/step-02
- block:lesson-002/step-01
