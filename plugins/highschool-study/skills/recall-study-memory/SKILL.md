---
name: recall-study-memory
description: Use when preparation or teaching needs prior Markdown memory, cards, Trace, or source drill-down.
user-invocable: false
allowed-tools: Read, Glob, Grep, mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

Return paths and direct source references, not a persisted context object.

1. Locate the real Roadmap, selected Plan and current or next Lesson. Read their indices and state.
2. Read prior closed-Lesson summaries in the same Plan in order. Use their source links to open an original only when the current decision depends on that detail.
3. Read earlier Plan summaries only when a dependency, recurring method or current decision makes them relevant.
4. Read both confirmed profiles. Treat only current, student-confirmed, source-linked entries as preferences.
5. During preparation only, read `memory/planner-attention.md` as a rebuildable attention projection, not mastery or long-term memory.
6. Use `card_search` for authentic candidates and their attached active history. Use direct `trace_search` for a small scoped evidence question; preparation may delegate a Plan-scale or cross-card search so the parent receives compact paths, reasons and source references rather than full payloads.
7. Use `source_resolve` only to drill from a cited learning-set source to the original needed now.

Never fabricate a path, card, source, identity or Session.
