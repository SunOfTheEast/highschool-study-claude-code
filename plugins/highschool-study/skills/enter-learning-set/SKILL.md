---
name: enter-learning-set
description: Use when a Session first enters a learning set, lacks entry context, or changes overview or persona.
user-invocable: false
allowed-tools: Read, Glob, Grep, Write, Edit
---

Return entry context to `study`; do not create another Agent or persisted context object.

## Learning-set overview

Read `learning-set/ROADMAP.md` when present and extract `## Learning Set Overview`. Present it on first Session entry or explicit request; otherwise keep it as background. If absent, use one short fallback from the Roadmap title, goal, Plan graph and observable capability standard. A missing Roadmap leaves overview empty so `study` can route its creation.

## Persona resolution

Resolve one existing persona in this order: current Lesson's temporary choice, `CLAUDE.local.md` preference, `CLAUDE.md` default, then bundled `neutral-tutor`. A learning-set persona file overrides a bundled file with the same ID. A missing ID falls back visibly; never construct a path from free-form student text.

Persona affects student-visible presentation only. It never changes or enters cards, evidence, assessment, summaries, profiles, capability, memory or the persona-neutral lesson designer.

## Switching

- A temporary choice changes only the current Lesson Session and is not written.
- A persistent choice creates or updates only the `Preferred persona` bullet under `## Highschool Study Presentation` in `learning-set/CLAUDE.local.md`:

  ```markdown
  ## Highschool Study Presentation

  - Preferred persona: `<existing-persona-id>`
  ```

- Restoring the learning-set default removes only that bullet. Disabling personas stores `neutral-tutor`.

Return the overview presentation decision, selected persona and any fallback notice.
