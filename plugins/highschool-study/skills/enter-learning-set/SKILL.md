---
name: enter-learning-set
description: Load the learning-set overview and exactly one presentation persona before routing study work.
user-invocable: false
allowed-tools: Read, Glob, Grep, Write, Edit
---

Run this Skill before any Roadmap, Plan, Lesson, correction, or progress route. Return context to the caller; do not create another Agent or a persisted context object.

## Learning-set overview

1. If `learning-set/ROADMAP.md` is absent, keep the overview context empty and continue through persona resolution; let `study` route to Roadmap creation. Do not block.
2. Read `learning-set/ROADMAP.md` and extract `## Learning Set Overview` on every entry.
3. Use `Grep` over `learning-set/lessons/*.md` for headings matching `^## Trace event-`.
4. Present the overview to the student when no such Trace exists or when the student explicitly asks for the overview, including “show the overview.” Otherwise keep it as background and do not repeat it unprompted.
5. If the overview section is absent, form one short fallback sentence from the Roadmap title, Goal, Plan Graph, and Observable Capability Standard. Do not block study.

## Persona resolution

Resolve in this exact order:

1. an explicit temporary choice already made in the current Lesson Session;
2. `Preferred persona` under `## Highschool Study Presentation` in `learning-set/CLAUDE.local.md`;
3. `Default presentation persona` in `learning-set/CLAUDE.md`;
4. the bundled `neutral-tutor`.

Use `Glob` to enumerate `learning-set/.claude/personas/*.md` and this Skill's `references/personas/*.md`. Match an existing filename stem exactly. A learning-set file with the same stem overrides the bundled file. Do not construct a path from student text and do not invent a persona. If the requested ID is missing, tell the student and fall back to the learning-set default, then to `neutral-tutor` if necessary.

Read exactly one final persona file. Treat "disable personas" as `neutral-tutor`. Apply the selected file only to student-visible wording. Never pass it to `lesson-designer`, and never write it into Trace, summaries, profiles, planner attention, capability judgments, card selection, assessments, or tests.

## Switching

- A request such as "for this lesson" or "temporarily" changes only the current Lesson Session. Do not write a temporary choice.
- A request such as "for this learning set from now on" creates the `Preferred persona` bullet under `## Highschool Study Presentation` in `learning-set/CLAUDE.local.md` when absent; otherwise, update only the `Preferred persona` bullet and preserve every other line in that section and every other section:

  ```markdown
  ## Highschool Study Presentation

  - Preferred persona: `<existing-persona-id>`
  ```

- "Restore the learning-set default" removes only the `Preferred persona` bullet and preserves every other line in that section and every other section. "Disable personas for this learning set" stores `neutral-tutor`.

Return the overview text, whether it should be presented, the selected persona ID/path/content, and any fallback notice to `study`.
