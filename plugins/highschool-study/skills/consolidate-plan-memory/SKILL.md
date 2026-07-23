---
name: consolidate-plan-memory
description: Use when evidence meets a Plan standard and the student explicitly chooses Plan completion.
user-invocable: false
allowed-tools: Read, Glob, Grep, Edit, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

Run only after direct evidence meets the Plan's observable capability standard and the student chooses completion.

1. Read the Plan standard, completion choice, indexed Lesson summaries and both confirmed profiles. Use summary source links and scoped active Trace to open a full Lesson or original only when a candidate memory depends on it.
2. Separate observation from inference. For every durable preference candidate, retain direct sources, conflicts and narrow scope.
3. Show a natural-language `add / revise / delete` table. Each row has one `student` or `teaching` owner and may be kept, rewritten or rejected. An empty confirmed delta is valid.

Do not edit a profile before item-by-item confirmation. Profiles contain only confirmed, durable, currently valid preferences with direct sources and narrow scope.

If the student rejects an inference, remove or rewrite that proposal. A rejected memory proposal is not classroom Trace.

After merging confirmed rows, persist Plan completion, evidence, caveats and profile delta as separate facts. Reread the Plan and both profiles before reporting completion; if persistence fails, do not claim the state changed.
