---
name: consolidate-plan-memory
description: Propose and confirm long-term profile changes only when a capable student explicitly completes a Plan.
user-invocable: false
allowed-tools: Read, Glob, Grep, Edit, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

Run this Skill only after both gates are independently true: direct evidence meets the Plan's observable capability standard, and the student explicitly chooses to complete the Plan. Task completion is not capability attainment; capability attainment does not complete the Plan automatically.

1. Read the Plan standard, test, completion choice, every indexed Lesson in the Plan, and every Lesson Summary. Call `trace_search(planId=...)` once for the Plan's complete active Trace set. Read both current confirmed profiles in full.
2. Resolve direct original sources for each durable preference under consideration. Separate observation from inference, show conflicts and counterexamples, and keep narrow scope conditions.
3. Show a natural-language table of proposed `add / revise / delete` rows. Every row has proposed text, `student` or `teaching` owner, direct original sources, conflicts, and scope conditions. Each confirmed item has one owner only; never duplicate it across profiles.
4. Invite the student to keep, rewrite, delete, or reject all rows in natural language. An empty confirmed delta is valid and never blocks Plan completion.

Never edit either profile before explicit student confirmation. After confirmation, merge only the confirmed rows into `memory/student-profile.md` or `memory/teaching-profile.md`, preserving direct source links and current scope. Profiles contain durable current preferences only: no proposal status, confidence, confidence score, rejected-item list, retired version, or workflow payload.

If the student corrects a mistaken inference during review, append that objection with `trace_append` as a cardless Trace in the final Plan-reflection block, linked to the student utterance and relevant original evidence. Do not invent a card reference. Then rebuild the affected Plan Summary from active evidence and complete the Plan with its closure, attainment, and confirmed profile delta recorded as separate facts.
