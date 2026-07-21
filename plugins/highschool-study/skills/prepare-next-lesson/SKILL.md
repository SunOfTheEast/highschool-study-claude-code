---
name: prepare-next-lesson
description: Prepare a source-grounded, flexible next Lesson for one eligible Plan.
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent(highschool-study:lesson-designer), mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

1. Select one eligible Plan from explicit dependencies and the student's approved order. Call `highschool-study:recall-study-memory` with purpose `preparation` before searching for new material.
2. Call `card_search` for candidates that match the Plan standard and next Lesson need. Every card_search candidate already includes its complete active traceHistory. Do not call `trace_search` to refetch a candidate's history; use it only for a cross-card evidence question or evidence not scoped to one card.
3. Resolve original sources for any material choice or adaptation. Never invent a card, source, or session ID. If direct evidence is insufficient, delegate to `Agent(highschool-study:lesson-designer)`; optional Agent/Dynamic Workflow remains subject to the recall Skill's parallel-search gate, and raw JSON remains in the current session.
4. Draft a small sequence of flexible ActivityBlocks chosen from video, explanation, practice, interaction, and quiz. Mark prerequisites, evidence target, source/card references, optional blocks, and safe reorder or skip choices. Keep teaching usable when an optional medium is unavailable.
5. Write the next indexed Lesson as prepared, with its Plan link, capability target, direct sources, blocks, and empty reflection/Summary areas. Preparation does not append classroom evidence, assert attainment, edit either profile, or close the Lesson or Plan.
