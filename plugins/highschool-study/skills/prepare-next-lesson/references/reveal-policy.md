# Reveal Policy

The preparation role may inspect complete cards and solutions. Student-visible teaching must follow the current block's reveal mode and must not dump the Lesson, Teacher Control, card answer, solution, or rubric. A first-attempt problem heading is exactly the Lesson alias, followed by the authentic stem and choices. Never add a subtitle, direction, or description from the card title, graph.goal, graph.method, graph.structure, hint, solution, or Teacher Control.

## Lesson block format

Every problem-bearing block contains both headings:

### Student View

Store only the task, authentic problem or reference, and information allowed before the student's next attempt.

### Teacher Control

Store the problem role, evidence target, reveal mode, card-step references, and ordered hints. Prefer references to stable card steps over copied solutions.

## zero

Use for diagnosis and assessment. Before the first attempt, reveal no method name, decisive transformation, intermediate conclusion, answer, option elimination, or rubric result. Assess only work the student has already produced. If the student wants to keep thinking, acknowledge and wait. A request to think longer is not consent for a hint. Do not ask a leading question, name the object to compare, or narrow the method. If the student explicitly asks for help after an attempt, first record the real unsupported or incomplete attempt, then teach. A failed Trace write cannot support attainment. Retry once with the exact tool contract; if it still fails, say that evidence is unavailable and make no attainment claim. Record `support: tutor` after any Tutor hint. When complete `traceHistory` shows prior Tutor support, a same-card unsupported completion is recall, not unseen transfer. Any later unsupported validation uses a different unseen card.

## ladder

Require an initial attempt. When the student is stuck, ask whether they want a hint and reveal one level per student-approved turn. Apply these levels literally:

1. Level 1 points to one location or condition already present in the student's work; it introduces no new operation, comparison object, function, substitution, divisor, or intermediate expression. A Level 1 reply is exactly one observation sentence and then stops. Use the form `一级提示：只看你刚才写出的 <原样位置或条件>。` It must not explain why, suggest a next step, or contain a mathematical-action verb such as `合并、构造、求导、换元、比较、代入、移项、放缩、拆分、通分`.
2. Level 2 may name one operation or method class, but gives no transformed expression or result.
3. Level 3 may give one key intermediate expression.
4. Give the full solution only after an explicit student request.

Record actual support honestly. The existing Trace `support` remains `none`, `tutor`, or `external`; when useful, put the highest revealed ladder level in `note`.

## worked-example

A complete worked example is allowed in a concept lesson. The later student target must be a different authentic card, and the example must not announce the target's decisive transformation, intermediate result, or answer.

## First-attempt forbidden content

Unless the selected mode explicitly allows it, do not reveal:

- the correct answer or option;
- a decisive substitution, divisor, factorization, or construction;
- a complete monotonic interval, parameter bound, or key intermediate expression;
- a reason that directly eliminates an option;
- the method name when method recognition is itself the evidence target.

A video that solves the target cannot appear before the target's first attempt. Use a different example or move the video after that attempt.
