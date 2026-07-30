---
name: recall-study-memory
description: Use when planning, preparation, or teaching needs source-linked node history, global Trace, cards, or confirmed preferences.
user-invocable: false
allowed-tools: Read, Glob, Grep, mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Recall Study Memory

Return compact paths and canonical sources, not a persisted context object.

1. Start from the current Roadmap/Plan/Lesson node and its parent tree.
2. Read prior child Handoffs in the same branch; use Claim sources to descend
   only when the current decision needs the detail.
3. Read earlier Plan Handoffs only for a real dependency, recurring issue, or
   direction-changing question.
4. Read only current, student-confirmed profile entries relevant to the node.
5. During preparation only, use Planner Attention as a rebuildable signal,
   never as mastery or long-term memory.
6. Use `card_search` for authentic cards with attached active history,
   `trace_search` for scoped questions in the global pool, and
   `source_resolve` for one cited original.

Do not scan sibling files to reconstruct a tree, copy full old Sessions into
the current context, infer a Claim from a source-only Handoff, or fabricate a
path, handle, card, identity, or Session.
