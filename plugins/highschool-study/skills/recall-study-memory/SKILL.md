---
name: recall-study-memory
description: Recall the seven native Markdown and evidence classes needed for preparation or teaching.
user-invocable: false
allowed-tools: Read, Glob, Grep, mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

Perform these seven stages in order. Return paths and direct source references, not a new persisted context object.

1. Locate the active `ROADMAP.md`, selected Plan, and current or next Lesson with `Glob`/`Grep`; then read their indices and current state. Do not infer an identity that is absent from disk.
2. Read all prior Lesson Summaries in the same Plan for closed Lessons, in index order. A summary is navigation evidence; drill into its cited original source before relying on a disputed or material detail.
3. Read relevant earlier Plan Summaries when they bear on a dependency, recurring method, or current decision. Do not load unrelated Plans merely because they are older.
4. Read both confirmed profiles in full for preparation and teaching: `memory/student-profile.md` and `memory/teaching-profile.md`. Treat only current, explicitly confirmed, directly source-linked entries as preferences.
5. For preparation only, read `memory/planner-attention.md`. It is a rebuildable attention projection, not long-term memory or a mastery conclusion. Do not read or rely on it during teaching.
6. Use `card_search` to retrieve actual card candidates. Every candidate already carries its complete active `traceHistory`; use `trace_search` for cross-card or evidence queries, not to redundantly fetch one card's history.
7. Use `source_resolve` only to drill down from a cited source reference to the original content needed for the current decision. Never fabricate a path, card, source, or session ID.

Only launch Agent/Dynamic Workflow when direct evidence is insufficient and at least two independent searches can run in parallel. Raw Workflow JSON remains in the current Claude session and is never written to Agents, Skills, profiles, summaries, Trace, or another state file.
