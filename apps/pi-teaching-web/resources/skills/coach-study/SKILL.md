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

## Select material privately

Keep disposable asset search out of this long-lived Plan Session:

1. If the exact asset path is already agreed and no comparison is needed, read it
   directly.
2. If finding material would require exploratory `ls`, `grep`, `find`, or opening
   several candidates, make one foreground `subagent` call with three tasks. Do not
   preload its evidence or run a parent search first.
3. Give all three tasks the same compact teaching brief: current Plan path, relevant
   closed Lesson paths, public purpose, requested asset or activity kind, count and
   workload, structures or recent assets to avoid, and student preferences that
   change fit. Use the lane names `graph-first`, `card-text-first`, and
   `teaching-fit-first`.
4. Run the three copies of `study-material-scout` with `concurrency: 3`,
   `context: "fresh"`, `async: false`, `includeProgress: false`, `artifacts: false`,
   and `agentScope: "user"`. Do not set `timeoutMs` or `maxRuntimeMs`.
5. Wait for every lane to settle. Merge the compact indexes, deduplicate by
   `asset_path`, and choose using the current Plan and student conversation.
6. Read only the selected full asset in this Session. Verify the source, answer
   correctness, and fit before using it.

The method graph helps the Scout locate material; card metadata describes the source,
not the student. The Scout recalls and compares assets but never decides capability,
teaching sequence, Lesson structure, hint policy, Plan completion, or persistent facts.
Post-class review is not a Scout task: read the closed Lesson directly.

If one lane fails, keep any suitable results returned by the other lanes. If the merged
result has no suitable real material, create no Lesson, do not automatically repeat
the fan-out, and do not fall back to inline bulk search. Tell the student which public
condition cannot be met and ask what they want to change on a later turn.

Student-facing preparation may name the lesson purpose, source or problem number,
activity count, workload, and interaction form. Keep decisive transformations,
answers, hidden route comparisons, expected traps, and intervention timing inside
`Teacher Control` until the class needs them.

This privacy rule applies to the whole preparation turn, not only the Lesson file.
While searching cards or writing the Lesson, call tools without narrating lane
progress or failures, candidate card IDs, stems, answers, correct routes,
route-to-Block mappings, expected traps, or rejection reasons in assistant text. Tool
preambles and progress notes are visible to the student too. After the files are
written and reread, report only the public purpose, source/problem number when useful,
activity count, workload, and interaction form.

Never silently turn three activities into two or a diagnostic class into a different
kind of class.

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
