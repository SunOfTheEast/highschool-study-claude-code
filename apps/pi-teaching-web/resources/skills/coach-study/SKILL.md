---
name: coach-study
description: Use when a Plan Session diagnoses the next teaching need, reviews closed Lessons, or prepares and revises a not-yet-started Lesson.
---

# Coach Study

Own one learning stage. The Plan Session decides what to learn next; the Lesson
Session does the teaching.

## Reconstruct the stage before deciding

Read the current Plan first. Before arranging another Lesson, read every earlier
closed Lesson in this Plan from top to bottom. Pay attention to:

- what the student actually tried and said in each Block log;
- where help entered and what changed afterwards;
- unfinished questions, corrections, and student objections;
- which activity or explanation made a useful difference;
- whether the Plan's observable standard was really exercised.

Do not replace these records with a flattering summary. A single performance can
shape the next class without becoming a broad claim about the student.

## Ask questions with teaching consequences

Before preparing a Lesson, ask enough questions to locate the real need, one per turn.
Turn “恒成立很难” into details such as:

- which structural form causes hesitation;
- what the student notices first;
- which routes they considered;
- the exact step where progress stopped;
- whether the problem is recognition, comparison, execution, checking, or time;
- what kind of practice or help the student wants now.

A useful question changes material, sequence, pace, or support. Avoid generic surveys.
When the picture is clear, describe the intended change and activity shape without
revealing an unseen problem, then ask whether it fits.

## Locate the next function in the Plan arc

Before choosing a Lesson shape, compare all closed Lessons with the Plan's Goal,
observable standard, and direct test. Decide which teaching function is now needed.
Normally continue from the concrete `Next Lesson Arrangement`; the Plan and original
Lesson logs are more authoritative than a generic cycle file.

Read the `plan-next-cycle` index or one cycle reference again only when new classroom
evidence makes the remaining arc need reinterpretation or reordering. Future
functions may be skipped, repeated, merged, or reordered while the same stage problem
and standard still hold. Discuss a consequential change with the student, then update
`Current Position` and the future arrangement before preparing the next mature
Lesson. If the stage problem itself has changed, return the decision to Roadmap. Do
not edit closed Lessons or invent a phase-state field.

## Choose one teaching shape on demand

Choose the Lesson's main teaching purpose before searching for material:

```text
clear Lesson purpose → read the matching file in references/lesson-templates/
unclear Lesson purpose → read references/lesson-templates/INDEX.md, choose, then read one file
→ adapt its teaching functions to this student
→ agree the public activity shape
→ derive material slots only for Blocks that need external assets
```

Select by the change the Lesson should produce, not by its chapter or surface topic.
Use one main template even when a few Blocks serve secondary needs; mixed needs do
not create a new Lesson type. Keep stage consolidation on the current Plan's progress
chain and spaced retrieval on the forgetting-time chain.

The template is preparation guidance, not persistent state. Do not write its name as
a field or ask Tutor to read the template library. Translate every decision Tutor
needs into the existing Lesson Goal, Student View, Teacher Control, dependencies, and
required or optional Blocks. If an agreed required material role remains unfilled,
prepare no Lesson and return to the student rather than silently shrinking the class.

## Select material privately

Keep disposable asset search out of this long-lived Plan Session:

1. If the exact asset path is already agreed and no comparison is needed, read it
   directly.
2. If finding material would require exploratory `ls`, `grep`, `find`, or opening
   several candidates, derive a temporary material slot for each agreed Block that
   still needs an external asset. One problem Block normally yields one problem-card
   slot; video and reading Blocks may yield their own slots; a discussion or
   reflection Block without an external asset yields none. Slots exist only for the
   current preparation call and are not written as new Lesson objects.
3. Give every slot one compact brief: a slot name, one `search_start` hint
   (`graph-first` or `card-text-first`), current Plan path, relevant closed Lesson
   paths, public purpose, asset kind, workload, structures or recent assets to avoid,
   and student preferences that change fit. The Coach already owns the student
   conversation, Plan, and closed-Lesson context, so package those fit conditions
   into each brief; there is no `teaching-fit-first` Scout.
4. Normally make one fresh `study-material-scout` task per slot. Add a second
   perspective for one slot only when you can name a concrete unresolved uncertainty
   that could change the choice; give it the other search start and state that
   uncertainty in its task. Do not preload Scout evidence or run a parent bulk search
   first.
5. Run all slot tasks in one foreground call with `concurrency: 3` as the maximum,
   `context: "fresh"`, `async: false`, `includeProgress: false`, `artifacts: false`,
   and `agentScope: "user"`. Do not set `timeoutMs` or `maxRuntimeMs`.
6. Use exactly seven top-level fields: `tasks`, `concurrency`, `context`, `async`,
   `includeProgress`, `artifacts`, and `agentScope`. Each task item contains exactly
   `agent`, `task`, and `acceptance`: use `agent: "study-material-scout"`, keep the
   slot brief in `task`, and set `acceptance` to
   `{"level":"none","reason":"read-only candidate recall"}`. Keep results inline by
   omitting `output` and `outputMode`.
7. Wait for every slot task to settle. Merge the candidate frontiers and deduplicate
   by `asset_path`, then choose using the current Plan and student conversation.
   Fully read and verify the current selected asset for every slot. If one fails
   source, mathematical, or teaching-fit verification, try the next existing
   frontier item for that slot without launching another fan-out.

The method graph helps the Scout locate material; card metadata describes the source,
not the student. The Scout recalls and compares assets but never decides capability,
teaching sequence, Lesson structure, hint policy, Plan completion, or persistent facts.
Post-class review is not a Scout task: read the closed Lesson directly.

If one task fails, keep suitable results for the other slots. If any required slot has
no suitable real material, create no Lesson, do not silently reduce the agreed
activity count, do not automatically repeat the fan-out, and do not fall back to
inline bulk search. Tell the student which public condition cannot be met and ask what
they want to change on a later turn.

Student-facing preparation may name the lesson purpose, source or problem number,
activity count, workload, and interaction form. Keep decisive transformations,
answers, hidden route comparisons, expected traps, and intervention timing inside
`Teacher Control` until the class needs them.

This privacy rule applies to the whole preparation turn, not only the Lesson file.
While searching cards or writing the Lesson, call tools without narrating search
progress or failures, candidate card IDs, stems, answers, correct routes,
route-to-Block mappings, expected traps, or rejection reasons in assistant text. Tool
preambles and progress notes are visible to the student too. After the files are
written and reread, report only the public purpose, source/problem number when useful,
activity count, workload, and interaction form.

Never silently turn three activities into two, several agreed problems into one, or a
diagnostic class into a different kind of class.

## Write a prepared Lesson

Create a Lesson only after its public purpose is agreed. Use the exact Lesson, Block,
and Tree structure in the injected canonical document contract. Within that structure,
write `Student View` for what the learner may see and `Teacher Control` for the teaching
purpose, observations, and adaptive help strategy.

One judged problem attempt belongs to one problem Block. Keep its presentation,
discussion, hints, corrections, and result together. Use separate Blocks for genuinely
separate judged responses, not for phases of the same attempt.

You may create or edit only a Lesson with `status: prepared`. Pending Blocks can form
a useful initial route without trying to predict every classroom turn. Starting the
Lesson belongs to the student.

When adding a Lesson, follow the contract's child-first write, reread, and link order.
A longer agreed teaching arc may stay in the Plan's arrangement prose; materialize
only the prepared Lessons that are actually ready to open.

## Review after class

When a Lesson closes, read it again in full and compare the actual class with the Plan
standard. Update `Current Position`, the next arrangement, and prepared Lesson files
as needed. Ask the student when their interpretation would change the next step.

Recommend Plan completion only when the declared test or an honest equivalent has
run and the observable standard is met. State the boundary of the conclusion. The
student chooses whether to complete the Plan; do not turn that choice into an internal
workflow ceremony.
