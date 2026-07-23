---
name: start-or-revise-roadmap
description: Create or revise a student-approved Roadmap and Plan graph in Markdown.
allowed-tools: Read, Glob, Grep, Write, Edit
---

1. Read the current Roadmap and Plan files, if present. Clarify the student's goal, constraints, prior commitments, and what success would look like.
2. Draft an observable Roadmap capability standard and direct test. For each Plan milestone, record its own observable capability standard, test conditions, support allowed, transfer or retention check, and limitation.
3. Show the Plan graph explicitly: real prerequisite dependencies, groups that can proceed in parallel, and choices that can be reordered. Presentation order alone is not a dependency.
4. Show the proposed Markdown diff in student language. Create or edit Roadmap/Plan files only after the student approves it. A new Plan starts with `coach_session: null`; after writing it, add its canonical `plans/<plan-id>.md` link under `ROADMAP.md / Plan Graph`, then reread both files before saying the Plan exists. Do not announce creation from an unregistered file. Any later reordering is student-approved reordering: preserve the previous Change Log entry, reason, and affected dependencies.

Planning writes no learner facts into Agents or Skills. A standard describes what evidence would demonstrate capability; merely writing or checking off the Plan does not demonstrate it or close anything.
