# Plan Material Scout Context Isolation Design

## 1. Purpose

StudyForge M0 keeps one native Pi Session for each Plan. That continuity is useful:
the Coach can retain the student's diagnosis, decisions, objections, and the reasons
the teaching sequence changed. The current material-selection path, however, performs
directory traversal, graph inspection, repeated grep, and candidate-card reading
inline in that same Session. Rejected cards and transient search results then remain in
the Plan context for every later Lesson.

This change isolates only that disposable search work. Three temporary read-only
Material Scouts search the same learning set from different angles in fresh Pi
contexts, then return short candidate indexes. The Plan Coach waits for all three,
merges their results, keeps all teaching authority, reads the selected asset itself,
writes the Lesson, and updates the Plan.

## 2. Scope

The first implementation applies only to Plan-node material recall and comparison.

It must:

- keep one long-lived Plan Session for the full Plan;
- keep direct parent reading of every earlier closed Lesson;
- give only Plan Sessions access to one foreground `subagent` tool;
- run three copies of one packaged `study-material-scout` concurrently, each with
  fresh context, read-only file tools, and a distinct search lane;
- search static `cards/`, `graph/`, and `materials/` assets plus the exact Plan/Lesson
  paths named by the parent task;
- return at most two concise, source-grounded candidates per lane and at most six
  candidates before parent-side deduplication;
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

### A. Plan-only native Pi parallel fan-out — selected

Load the pinned `pi-subagents` extension explicitly for Plan resources, package one
read-only `study-material-scout`, and expose `subagent` only in the Plan tool list. Run
three fresh-context copies in one foreground parallel call: graph-first, card-text
first, and teaching-fit/history-first. Wait for every lane to settle and impose no
StudyForge wall-clock deadline.

This reuses a runtime path that StudyForge previously exercised while avoiding the old
workflow layer. It gives semantic asset comparison without keeping raw search results
in the parent Session.

### B. One foreground Scout with a fixed deadline — rejected

The first real-model run gave one Scout the full corpus and a 180-second limit. It
spent the entire interval widening its search, reached promising cards, then lost the
whole result at the deadline. A corrected retry increased both latency and cost. The
failure came from coupling retrieval quality to a clock, not from a missing retry.

### C. Restore the historical Evidence Scout workflow — rejected

The old implementation included workflow proposals, lifecycle stores, custom events,
task-rail projection, background execution, and specialized study tools. Those pieces
solved a broader product problem and would reintroduce the complexity deliberately
removed by M0.

### D. Add a deterministic `material_search` domain tool — deferred

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
one foreground parallel call with `async: false`, `context: "fresh"`,
`includeProgress: false`, `artifacts: false`, and `concurrency: 3`. It omits
`timeoutMs` and `maxRuntimeMs`; provider transport and request failures remain normal
infrastructure errors, but StudyForge does not turn elapsed time into a material-
quality decision. No workflow artifact is promoted into the learning set.

On the first delegated search in a Plan Session, the Coach may first call
`subagent(action: "list")` as required by the extension to confirm that the packaged
agent is executable. This discovery result is small and need not repeat before every
Lesson in the same Session.

## 5. Material Scout

`study-material-scout` is a packaged Pi agent with:

- tools: `read`, `grep`, `find`, `ls`;
- thinking: `medium`;
- fresh context;
- no inherited project context or Skills;
- no `write`, `edit`, shell, nested subagent, lifecycle, or teaching mutation tool.

Each lane receives the same compact teaching brief:

1. current Plan path;
2. relevant closed Lesson paths;
3. public Lesson purpose;
4. desired activity or asset kind;
5. material count and workload constraints;
6. structures, sources, families, or recently used assets to avoid;
7. any student preference that changes material fit.

The lane instruction then narrows how that copy searches:

1. `graph-first`: start from the method tree, vocabulary, aliases, and card method
   metadata; open only a few structurally plausible cards;
2. `card-text-first`: search card stems and solution metadata directly for the task
   shape, formulas, and activity type;
3. `teaching-fit-first`: start from the Plan and closed Lessons, build the used/avoid
   boundary, then look for a novel source and workload that fits the diagnosed student.

These are search perspectives, not new agent roles or persistent workflow nodes. The
same packaged agent runs all three. Each lane stops after finding one or two credible
candidates; it does not try to exhaust the corpus.

The Scout may inspect the named Plan/Lessons to check novelty, but those reads remain
inside the child context. It searches only the learning-set root and returns one JSON
object:

```json
{
  "lane": "graph-first",
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

Each result contains at most two candidates. It does not reproduce full stems,
solutions, decisive transformations, answers, rejected-card contents, or a transcript
of its search. If no real asset qualifies, `candidates` is empty and
`search_boundary` briefly states what was checked. The parent receives all three lane
results in one native tool result, deduplicates by `asset_path`, and does not persist
the indexes.

## 6. Coach behavior

After diagnosis and direct Lesson review, the Coach follows this decision rule:

1. If an exact asset path is already agreed and no comparison is needed, read that
   asset directly; do not launch a Scout.
2. If finding or comparing assets would require exploratory `ls`, `grep`, `find`, or
   opening multiple candidates, make one parallel `subagent` call containing the three
   lane tasks. Do not put a runtime deadline on the call.
3. Wait for all lanes to settle, merge and deduplicate their compact indexes, and
   choose based on the current Plan and student conversation. Agreement between lanes
   is useful evidence but is not an automatic score or selection rule.
4. Read the full selected asset in the parent Session and verify its content before
   use.
5. Write and reread the prepared Lesson, link it from the Plan, reread the Plan, and
   then send the existing public preparation summary.

The Scout results are advice, not authority. The Coach may reject every candidate. A
lane that fails returns a failed lane result after the provider or tool settles; it
does not cancel successful siblings. If at least one remaining lane supplies a real
fit, the Coach may continue. If all three fail or return no suitable material, the
Coach must not fall back to inline bulk search or automatically launch another full
fan-out. It creates no Lesson and tells the student in ordinary language that the
current material does not meet the agreed public condition. A later turn may retry
only after the public requirement or search boundary changes.

Post-class review remains unchanged: the parent Coach directly reads the closed Lesson
and updates the Plan. Asset isolation must not become evidence isolation.

## 7. Student-visible behavior

The parallel `subagent` call appears as one collapsed native tool-activity item; the
first use in a Plan Session may also show one small collapsed discovery item. Child
file reads and internal candidate comparison do not become assistant messages. The
Coach emits no prose before or between search, write, and reread tool calls, including
when a lane fails. Once the Lesson and Plan are written and reread, the Coach sends one
ordinary summary containing only the public purpose, source or problem number when
useful, activity count, workload, and interaction form.

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

Skill prose and agent judgment are not tested by exact wording. Inspection of the
assembled Plan resources confirms that the revised guidance is present; real-model
acceptance proves whether the Coach actually follows it. Acceptance must run from a
copied learning set and show this parent-session sequence:

```text
read Plan and closed Lessons
→ optional first-use subagent(action: list)
→ subagent(tasks: graph-first + card-text-first + teaching-fit-first, fresh)
→ wait for all three compact indexes
→ read one selected asset
→ write Lesson
→ read Lesson
→ edit Plan
→ read Plan
→ public summary
```

Acceptance uses a new Plan Session created after the extension is enabled and a natural
student request such as “上一节结束了，接下来你安排吧，我还是想先自己做”. It must
not tell the Coach what diagnostic hypothesis, card family, or Scout mechanics to use.
An upgrade-era Session whose history predates the Scout is not evidence for or against
the new path.

Acceptance fails if the parent performs exploratory bulk card search before or after
the Scouts, if rejected cards are opened in the parent Session, if any lane is cut off
by a StudyForge wall-clock deadline, if the student-visible message leaks a stem or
teaching route, or if a Scout writes a learning-set file. The report records each
lane's completion, total wall time, and parent Session context growth so the change is
judged against both the failed 180-second single-Scout run and the observed seven-
minute inline preparation.
