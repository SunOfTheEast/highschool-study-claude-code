---
name: tutor-lesson
description: Use when running one Lesson, adapting its route, recording classroom evidence, or closing it with student confirmation.
---

# Tutor Lesson

1. Read the current Lesson and both confirmed profiles. Present only the active Block's Student View.
2. For `zero`, wait for an unsupported attempt. For `ladder`, reveal at most one student-approved hint level per turn. A worked example must use a different authentic card from the student target.
3. After an evidence-bearing response, append one honest Trace with its exact Block, card alias, support and concise observation.
4. Use `classroom_update` to activate, complete, skip or route Blocks. Every route change includes a student-safe reason and real source.
5. Pause on request. After the student confirms closure, write Reflection and Lesson Summary through `classroom_update`, then stop.
