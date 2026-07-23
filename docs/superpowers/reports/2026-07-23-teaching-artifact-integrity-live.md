# 教学产物完整性真课验收

## Run Identity

- App commit: `02029a4af5675c9e4a386d61fd2fc5ddbb6a50d7`
- Copied learning set: `/tmp/studyforge-artifact-integrity-jAxaMI/learning-set`
- Runtime: Pi teaching web，`http://127.0.0.1:65321/`
- Provider / model: `xiaomi` / `mimo-v2.5-pro-ultraspeed`
- Created Plan: `artifact-integrity-pilot`
- Created Lesson: `lesson-pilot-001`
- Creator Coach Session: `019f8efb-d66a-75b3-91de-fc36f608af82`
- Plan Coach Session: `019f8efd-03a4-77c6-9099-2061327b1018`
- Tutor Session: `019f8f01-1cb1-7fbc-b44e-2c57b6c86379`
- Foreign-owner replacement Coach Session: `019f8f04-f10b-7ec0-bee7-9c73d79708f3`

No provider credential was printed or copied.

## Boundary Results

| Boundary | Result | Evidence |
|---|---|---|
| Plan registration | PASS | Creator Coach called `plan_register({ planId: "artifact-integrity-pilot" })`; receipt returned `ok: true`, `ownerPath: plans/artifact-integrity-pilot.md`, and the Plan appeared after returning home. |
| Exact Session ownership | PASS | The copied Plan was deliberately pointed at Tutor Session `019f8f01-...`; after restart it received fresh Coach Session `019f8f04-...`. Its JSONL contains exactly one `studyforge.session-owner.v1` entry with `role: coach`, `ownerId: artifact-integrity-pilot`, and `ownerPath: plans/artifact-integrity-pilot.md`. |
| Prepared Lesson admission | PASS | The real Coach's first draft lacked canonical Aliases and a parseable reflection Block. Start returned actionable errors, kept `status: prepared`, and left `tutor_session` empty. A second visually plausible but noncanonical repair was also rejected. |
| Trace receipt and source binding | PASS | Tutor receipts created `event-001` through `event-004` under `lessons/lesson-pilot-001.md`. Active `event-004` supersedes `event-003`, binds the real card path, preserves `support: tutor`, and records the student-confirmed primary method `保值性与分治`. |
| Student-controlled closure | PASS | After the student explicitly confirmed closure, `lesson_close` returned `{"ok":true,"ownerPath":"lessons/lesson-pilot-001.md","status":"closed"}`. The Lesson frontmatter, Reflection, Summary, and reflection Block were updated before the UI returned to Coach. |
| Coach Plan writeback | MECHANISM PASS / SEMANTICS FAIL | `plan_update` returned `{"ok":true,"decision":"complete"}` and all four Plan sections changed, but the decision overclaimed independent attainment and the rewritten Lesson Index removed its Markdown link. |

The repository copy at `examples/derivative-demo/learning-set` remained unchanged.

## Classroom Evidence

The student independently:

- recognized that the exponential and logarithmic shells both compare a quantity with `1`;
- completed the `a = 1` monotonicity analysis;
- verified both standard inequalities and the final decomposition.

The decisive construction was not independent. Tutor explicitly supplied “add and subtract
`x`” and both target expressions before the student's proof. Tutor correctly recorded this as
`support: tutor`, then preserved that support in the superseding method-confirmed Trace.

There was one Tutor parameter retry:

- first call: `classroom_update({ action: "activate", blockId: "Block warmup" })`;
- result: `BLOCK_NOT_FOUND: Block warmup`;
- recovery: Tutor retried with the raw Block ID and completed the class without corrupting facts.

There were no empty assistant turns. Plan registration, Trace recording, method binding, and
formal closure were announced only after successful receipts.

## Remaining Observations

| Observation | Evidence | Classification | Recommended action |
|---|---|---|---|
| Coach does not know the executable Lesson grammar from the current prose rule. | Initial draft used headings such as `## Block 1 — ...`, bold `Student View` labels, an arrow alias, and no canonical Node State. Its first repair used `**Kind:** reflection`; both drafts were declared ready but rejected by Start. | real defect | Fix now in Skill text: include one short canonical Block and alias skeleton, including raw Block IDs, allowed Kind values, raw dependency IDs, and `### Student View` / `### Teacher Control`. Do not add a generalized schema layer or prose tests. |
| Coach marked supported construction as independent attainment. | Active `event-004` says `support: tutor`; the standard requires independently identifying the decomposition direction; the student only confirmed ending the Lesson, not completing the Plan. Coach still chose `complete`. | real defect | Fix now in Coach Skill: when an independence criterion's decisive move has support other than `none`, that row cannot qualify; ending a Lesson is not consent to complete a Plan. The resulting decision here must remain `active`. |
| `plan_update` destroyed Lesson navigation. | Coach supplied a plain-text `lessonIndex` without `[title](../lessons/lesson-pilot-001.md)`. After refresh, the Lesson child Session disappeared from the sidebar although the Lesson file still existed. | real defect | Fix now at the write boundary: preserve existing Lesson Markdown links, or reject a replacement that drops an indexed Lesson link. This guards a normal navigation invariant, not an edge case. |
| Tutor used `Block warmup` instead of raw ID `warmup` once. | One `BLOCK_NOT_FOUND` tool result, followed by successful correction and no fact corruption. The malformed Coach dependencies also used the `Block ` prefix. | model occasional | First apply the canonical Skill skeleton and rerun. Add no new retry framework unless this remains frequent. |
| Pi Coach routed the student to a Claude plugin command. | After Plan creation it said to enter `highschool-study:study`, although the actual start surface is the Lesson item in the Pi sidebar. | real defect | Fix now with one Pi-only sentence: direct the student to the sidebar Lesson; never mention Claude Code commands. |
| New Plan omitted literal `coach_session: null`. | The first Plan frontmatter omitted the field; registration and first open still produced a correctly owned Coach Session. | model occasional | Observe after adding the canonical authoring skeleton; no compatibility or defensive code is needed. |

## Conclusion

The runtime boundaries added by this plan are working: unregistered Plans do not masquerade as
available, foreign Sessions are not reused, invalid prepared Lessons cannot start, and Trace /
close writes have auditable receipts.

The next fixes should stay small and concentrated:

1. give Coach one exact executable Lesson skeleton and Pi-specific routing sentence;
2. make supported evidence unambiguously fail an independence criterion;
3. preserve Lesson links during `plan_update`.

After those three changes, rerun one short copied class. No schema expansion, new judging Agent,
or generalized defensive framework is justified by this run.
