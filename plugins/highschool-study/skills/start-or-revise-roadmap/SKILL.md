---
name: start-or-revise-roadmap
description: Use when creating or revising a student-approved Roadmap and Plan graph in Markdown.
allowed-tools: Read, Glob, Grep, Write, Edit
---

# Start or Revise Roadmap

1. Read the current Roadmap and Plan files, if present. Treat them as history, not a substitute for the student's current account.
2. Conduct a short multi-turn consultation before drafting. Ask one question per turn and normally ask several useful questions. Generate each next question from the student's latest answer: find the broadest ambiguous phrase whose possible meanings would change the learning action, then clarify its type, situation, stuck step, recent concrete example, or attempted approach before asking about causes. Do not put an unverified Coach hypothesis inside the question, repeat settled facts, or batch questions into a form.
3. Continue until the goal, starting pattern, desired change, constraints, and direct success test are clear enough to act on. “You decide” releases the current choice; ask from another decision-changing angle when one remains. If the student explicitly stops, proceed with stated uncertainty. Summarize the student's account and your working judgment, then invite correction before showing a proposal.
4. Make the working judgment useful: distinguish explanations that require different Plans, cite the student words or sources supporting it, change a real Plan choice, and name later evidence that would support or overturn it. Do not use a stable personality label or a generic “practice more” restatement.
5. Before creating the first Plan, confirm the Roadmap's long-term Goal, Observable Capability Standard, and whole-goal Test one question at a time. Show all three together for correction, then replace all three template placeholders before writing the Plan. A local Plan goal is a bounded next cycle and must not overwrite this long-term contract. After the first Plan exists, revise these fields only when the student says the long-term direction itself changed.
6. For each Plan milestone, record its own observable capability standard, test conditions, support allowed, transfer or retention check, and limitation.
7. Show the Plan graph explicitly: real prerequisite dependencies, groups that can proceed in parallel, and choices that can be reordered. Presentation order alone is not a dependency.
8. Show the proposed Markdown diff in student language. Create or edit Roadmap/Plan files only after the student approves it. A new Plan starts with `coach_session: null`; after writing it, add its canonical `plans/<plan-id>.md` link under `ROADMAP.md / Plan Graph`, then reread both files and the confirmed Roadmap Goal, capability standard, and Test before saying the Plan exists. Do not announce creation from an unregistered file. Any later reordering is student-approved reordering: preserve the previous Change Log entry, reason, and affected dependencies.

Planning writes no learner facts into Agents or Skills. A standard describes what evidence would demonstrate capability; merely writing or checking off the Plan does not demonstrate it or close anything.

This Skill owns the first long-term goal and explicit Roadmap restructuring;
evidence-driven next-cycle selection belongs to `plan-next-cycle`.
