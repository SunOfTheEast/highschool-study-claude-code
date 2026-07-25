---
name: correct-learning-record
description: Use when the student corrects an existing learning record or assessment.
allowed-tools: Read, Glob, Grep, Edit, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

1. Locate the exact active Trace and original source. Show the target, its conclusions, and affected summaries or projections; if identity is ambiguous, ask rather than guess.
2. Confirm the student's correction and scope. Preserve the original event: call `trace_append` with a new source-linked correction and `supersedes` set to the exact mistaken Trace ID.
3. Re-query active evidence after the superseding Trace. Planner Attention and other derived evidence projections may rebuild. Report which Lesson Summary, Plan decision, alternative sidecar, or confirmed profile may now be stale, but do not rewrite any of them in this correction flow.
4. Do not silently change either confirmed profile. If the correction conflicts with a profile item, show the conflict and defer any profile delta to the explicit, Plan-gated `highschool-study:consolidate-plan-memory` confirmation flow.

Never overwrite the original Trace or fabricate a source or Session ID.
