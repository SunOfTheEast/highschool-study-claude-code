# Plan Material Scout Context Isolation Design

## 1. Purpose

StudyForge M0 keeps one native Pi Session for each Plan. That continuity is useful:
the Coach can retain the student's diagnosis, decisions, objections, and the reasons
the teaching sequence changed. The current material-selection path, however, performs
directory traversal, graph inspection, repeated grep, and candidate-card reading
inline in that same Session. Rejected cards and transient search results then remain in
the Plan context for every later Lesson.

This change isolates only that disposable search work. A temporary read-only Material
Scout searches and compares assets in its own fresh Pi context, then returns a short
candidate index. The Plan Coach keeps all teaching authority, reads the selected asset
itself, writes the Lesson, and updates the Plan.

## 2. Scope

The first implementation applies only to Plan-node material recall and comparison.

It must:

- keep one long-lived Plan Session for the full Plan;
- keep direct parent reading of every earlier closed Lesson;
- give only Plan Sessions access to one foreground `subagent` tool;
- run one packaged `study-material-scout` with fresh context and read-only file tools;
- search static `cards/`, `graph/`, and `materials/` assets plus the exact Plan/Lesson
  paths named by the parent task;
- return at most three concise, source-grounded candidates;
- let the Plan Coach make the final selection and read only the selected asset in the
  parent Session;
- preserve the current child-first Lesson write, reread, Plan-link, reread sequence;
- reuse the current collapsed native-tool rendering without adding a new page or task
  rail.

It must not:

- restore the old Deep Workflow runtime, workflow store, evidence projections, task
  graph, confirmation gate, or background monitor;
- create a new persistent teaching fact, Handoff, memory pool, index, vector store, or
  database;
- let the Scout write Roadmap, Plan, Lesson, Block logs, cards, graph, or materials;
- let the Scout decide student capability, Plan completion, Lesson structure, hint
  policy, or long-term teaching direction;
- copy a child transcript into the parent Session;
- replace direct post-Lesson review with a subagent;
- expose the `subagent` tool to Roadmap or Lesson Sessions.

## 3. Considered approaches

### A. Plan-only native Pi Subagent — selected

Load the pinned `pi-subagents` extension explicitly for Plan resources, package one
read-only `study-material-scout`, and expose `subagent` only in the Plan tool list. Run
the child in the foreground with fresh context and a 180-second limit.

This reuses a runtime path that StudyForge previously exercised while avoiding the old
workflow layer. It gives semantic asset comparison without keeping raw search results
in the parent Session.

### B. Restore the historical Evidence Scout workflow — rejected

The old implementation included workflow proposals, lifecycle stores, custom events,
task-rail projection, background execution, and specialized study tools. Those pieces
solved a broader product problem and would reintroduce the complexity deliberately
removed by M0.

### C. Add a deterministic `material_search` domain tool — deferred

A custom tool could return compact candidates without a child model, but useful
teaching relevance is not currently reducible to filename or metadata rules. It would
either miss semantic matches or grow into another retrieval engine. It remains an
option only if repeated Scout runs later show stable deterministic predicates.

## 4. Runtime boundary

The app pins `pi-subagents@0.35.1`. At server startup it appends the packaged
`resources/subagents/` directory to `PI_SUBAGENT_EXTRA_AGENT_DIRS` without replacing
an existing value.

Resource assembly remains node-specific:

| Node | Active model tools | Added extension |
|---|---|---|
| Roadmap | `read`, `grep`, `find`, `ls`, `edit`, `write` | none |
| Plan | the six native file tools plus `subagent` | explicit `pi-subagents` path |
| Lesson | `read`, `grep`, `find`, `ls`, `edit`, `write` | none |

The resource loader continues suppressing automatically discovered extensions. The
Plan loader receives only the explicit `pi-subagents` extension path. The parent uses
foreground execution (`async: false`), fresh child context, no full progress payload,
and a 180-second maximum runtime. No workflow artifact is promoted into the learning
set.

## 5. Material Scout

`study-material-scout` is a packaged Pi agent with:

- tools: `read`, `grep`, `find`, `ls`;
- thinking: `medium`;
- fresh context;
- no inherited project context or Skills;
- no `write`, `edit`, shell, nested subagent, lifecycle, or teaching mutation tool.

The parent task supplies:

1. current Plan path;
2. relevant closed Lesson paths;
3. public Lesson purpose;
4. desired activity or asset kind;
5. material count and workload constraints;
6. structures, sources, families, or recently used assets to avoid;
7. any student preference that changes material fit.

The Scout may inspect the named Plan/Lessons to check novelty, but those reads remain
inside the child context. It searches only the learning-set root and returns one JSON
object:

```json
{
  "candidates": [
    {
      "asset_path": "cards/derivative/example.card.yaml",
      "asset_kind": "card",
      "source": "2020 · 某校月考 T21",
      "fit": "自然暴露零点换序后的判号执行",
      "novelty": "当前 Plan 尚未使用同族材料",
      "risks": ["提前展示导数会污染诊断"]
    }
  ],
  "search_boundary": "只检索了 cards/、graph/、materials/ 和任务点名的教学文档"
}
```

The result contains at most three candidates. It does not reproduce full stems,
solutions, decisive transformations, answers, rejected-card contents, or a transcript
of its search. If no real asset qualifies, `candidates` is empty and
`search_boundary` briefly states what was checked.

## 6. Coach behavior

After diagnosis and direct Lesson review, the Coach follows this decision rule:

1. If an exact asset path is already agreed and no comparison is needed, read that
   asset directly; do not launch a Scout.
2. If finding or comparing assets would require exploratory `ls`, `grep`, `find`, or
   opening multiple candidates, call `study-material-scout` once instead.
3. Inspect the returned candidate index and choose based on the current Plan and
   student conversation.
4. Read the full selected asset in the parent Session and verify its content before
   use.
5. Write and reread the prepared Lesson, link it from the Plan, reread the Plan, and
   then send the existing public preparation summary.

The Scout result is advice, not authority. The Coach may reject every candidate. If a
run fails, times out, or returns no suitable material, the Coach may make one fresh
Scout attempt with a corrected task. It must not fall back to inline bulk search in the
Plan Session. If the second attempt also fails, it creates no Lesson and tells the
student in ordinary language that the current material does not meet the agreed public
condition.

Post-class review remains unchanged: the parent Coach directly reads the closed Lesson
and updates the Plan. Asset isolation must not become evidence isolation.

## 7. Student-visible behavior

The `subagent` call appears as one collapsed native tool-activity item. Child file
reads and internal candidate comparison do not become assistant messages. Once the
Lesson and Plan are written and reread, the Coach sends one ordinary summary containing
only the public purpose, source or problem number when useful, activity count,
workload, and interaction form.

No frontend safety projection is introduced. Assistant text is still rendered
unchanged; the improvement comes from keeping private search out of the parent model's
text generation and context.

## 8. Verification

Mechanical tests must establish that:

- the package dependency and bundled Scout are installed from the repository;
- the extra Scout directory is appended without replacing an existing directory;
- Plan resources activate `subagent` while Roadmap and Lesson resources retain only
  the six native file tools;
- only the explicitly packaged extension is loaded;
- the Scout's mechanical tool allowlist is read-only;
- all existing M0 parsing, lifecycle, unit, build, and browser tests remain green.

Skill prose is not tested by exact wording. Real-model acceptance must run from a
copied learning set and show this parent-session sequence:

```text
read Plan and closed Lessons
→ subagent(study-material-scout, fresh)
→ read one selected asset
→ write Lesson
→ read Lesson
→ edit Plan
→ read Plan
→ public summary
```

Acceptance fails if the parent performs exploratory bulk card search before or after
the Scout, if rejected cards are opened in the parent Session, if the student-visible
message leaks a stem or teaching route, or if the Scout writes a learning-set file.
The report records wall time and parent Session context growth so the change is judged
against the observed seven-minute inline preparation rather than only for functional
correctness.
