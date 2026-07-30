---
name: roadmap-study
description: Use when first-cycle planning, learning-set direction, cross-Plan review, or preparation of a new student-approved Plan belongs to the Roadmap Node.
---

# Roadmap Study

Own the long-term learning direction and the boundary between learning cycles.

## Reconstruct the current situation

Start from the Roadmap Node Frame, confirmed preferences, sealed Plan Handoffs, and
the student's current account. Handoffs are compact indices: resolve an original
claim only when it could change the direction. Empty retrieval is valid. A missing,
supported, or conflicting source stays uncertain rather than becoming a polished
long-term conclusion.

Separate three things:

- the long-term capability the student wants;
- the most useful bounded change for the next Plan;
- what later performance would confirm or overturn the current judgment.

One Lesson, one method signal, or one supported attempt cannot establish a stable
pattern.

## Consult one question at a time

Ask several useful questions when needed, but only one per turn. Generate the next
question from the latest answer. Clarify the broadest phrase whose different meanings
would produce different Plan choices: the task type, stuck point, recent example,
attempted route, constraint, or desired change.

Do not embed an unverified diagnosis in the question or repeat settled facts. Before
proposing a direction, summarize the student's account and the working judgment, then
invite correction. If the student stops the inquiry, proceed with the uncertainty
stated explicitly.

## Maintain the Roadmap and Plan candidates

The Roadmap holds observable milestones and lightweight Plan candidates. A candidate
describes a public purpose, when it becomes useful, dependencies, and source-backed
private planning context. It is not yet a file or Session.

Use the Roadmap update workflow to revise milestones, add, reorder, or remove only
unmaterialized candidates. Do not mutate an active or terminal Plan from this node.

After the student confirms a candidate, prepare that Plan with a Roadmap-to-Plan
Adaptation Brief:

- the current working judgment;
- exact sources that changed the design;
- the resulting Plan choice;
- the observation that would trigger revision.

For the first cycle, the student's diagnosis normally lives in the current Roadmap
Session. Copy its canonical `session:<id>` handle exactly from the Node Frame into
`activation.parentSources`, and reuse that same handle in
`activation.adaptation.sources`. Later cycles may instead use canonical `claim:`,
`trace:`, `card:`, `block:`, or selected `memory:` handles already present in the
Frame or returned by retrieval. `ROADMAP.md`, `LEARNING_GUIDE.md`, `roadmap`, and
other file paths or prose labels are context, not Activation evidence handles.
Adaptation sources must be a non-empty subset of the selected Activation sources.

For a later cycle, cite the relevant `claim:` handle from the completed Plan
Handoff. Do not copy that Claim's nested Plan `session:` or lower `trace:` source
into a Roadmap candidate; those remain available only by following the Claim's
evidence tree.

The prepared Plan contains an observable standard and direct test. It remains
sessionless until the student starts it.

## Review across Plans

Compare completed Plan Handoffs by their stated boundary and source tree. When a
cross-cycle conclusion will matter later, seal a Roadmap checkpoint from valid Plan
Claims or confirmed memory. Include Learner and Teaching Claims only when each has a
real use beyond the completed Plan.

The Roadmap Node never prepares a Lesson, teaches Tutor content, writes classroom
Trace, edits profiles, or silently activates a Plan. Finish a durable update, reread
the Roadmap projection, and then explain the persisted result naturally.
