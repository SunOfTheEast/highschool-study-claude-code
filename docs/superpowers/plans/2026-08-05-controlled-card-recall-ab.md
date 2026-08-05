# Controlled Card Recall A/B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a 16-session controlled comparison that determines whether the safe TSV sidecar reduces current Material Scout load without reducing usable problem-card recall quality.

**Architecture:** Freeze four structured briefs and hidden gold cards, then run the same current Scout prompt against two read-only learning-set snapshots: A excludes the sidecar and exercises direct-field fallback; B includes the sidecar. Run fresh paired real-model Sessions at the model's supported high thinking level, preserve raw evidence under `/tmp`, score quality before speed, and commit only a sanitized report.

**Tech Stack:** Pi CLI 0.81.0, DeepSeek `deepseek-v4-flash`, native `read/grep/find/ls`, Bash, Bun, Pi Session JSONL, existing `export-pi-cot.ts`.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/gentle-judgment-isomorphic-acceptance` on `codex/gentle-judgment-isomorphic-acceptance`.
- Follow `docs/superpowers/specs/2026-08-05-controlled-card-recall-ab-design.md` exactly; do not edit questions, query terms, gold cards, scoring, Scout prompt, sidecar, or source cards during the run.
- Use provider/model `deepseek/deepseek-v4-flash` and `--thinking high`; stop rather than substitute. The first smoke pair requested medium but Pi deterministically clamped both arms to high, so it remains valid under the documented protocol amendment.
- Use fresh Sessions, paired A/B execution, maximum experiment concurrency 2, and exactly two repetitions per task.
- A and B use the same current Scout prompt. A is `direct-fallback`, not the historical deep Scout.
- Never expose target paths, IDs, answers, intersection counts, or expected outputs to a Scout.
- Keep raw evidence and credentials under a dedicated `/tmp` root. Commit only the sanitized report and experiment documents.
- Preserve all unrelated dirty-worktree changes and stage only files created by this experiment.
- Do not repair product code, prompts, cards, or index during acceptance.

---

### Task 1: Freeze and mechanically audit the experiment manifest

**Files:**
- Inspect: `docs/superpowers/specs/2026-08-05-controlled-card-recall-ab-design.md`
- Inspect: `examples/derivative-m0/learning-set/graph/card-recall-index.tsv`
- Inspect: the four hidden target card files named in the design

**Interfaces:**
- Consumes: four public briefs, four hidden target paths, and committed TSV rows.
- Produces: a frozen mapping whose public prompt contains no hidden oracle data.

- [ ] **Step 1: Verify the worktree identity and preserve dirty state**

Run:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected: branch `codex/gentle-judgment-isomorphic-acceptance`, source commit
`6a3a81899b61fc60d08ca50ccda66b38c51ab737`, and unrelated user-owned changes remain untouched.

- [ ] **Step 2: Verify every hidden target exists and each frozen query has one exact row**

Run a read-only Bun script that parses the TSV, applies same-field OR/different-field AND, and asserts:

```text
T1 -> mst_p0131_x2f_log_compare_ex19.card.yaml -> 1 exact hit
T2 -> mst_p0125_exponential_construct_ex06.card.yaml -> 1 exact hit
T3 -> mst_p0179_product_gap_m_range_ex35.card.yaml -> 1 exact hit
T4 -> mst_p0244_ln1px_minus_x_plus_halfx2_minus_kx3_extreme_zero_offset_ex21.card.yaml -> 1 exact hit
```

Expected: all four paths exist, all four cards have `quality.needs_review: false`, and no assertion fails.

- [ ] **Step 3: Scan the public brief blocks for oracle leakage**

Extract only the four `给 Scout 的完整 brief` code blocks and verify none contains:

```text
mst_p0131
mst_p0125
mst_p0179
mst_p0244
cards/derivative/
三项联合
隐藏目标
库中一定存在
```

Expected: zero matches.

### Task 2: Create isolated A/B runtime roots

**Files:**
- Create automatically under `/tmp`: one experiment root, two learning-set copies, one Pi config, Session directories, stdout logs, and a run manifest.
- Never modify: `examples/derivative-m0/learning-set`.

**Interfaces:**
- Consumes: public learning set and `/Users/yangrundong/.pi/agent/auth.json`.
- Produces: read-only `learning-set-a` without sidecar and `learning-set-b` with sidecar, plus an isolated Pi config.

- [ ] **Step 1: Create and validate the dedicated root**

Run in one foreground shell:

```bash
EXPERIMENT_ROOT="$(mktemp -d /tmp/studyforge-card-recall-ab-XXXXXX)"
test -n "${EXPERIMENT_ROOT:?}"
case "$EXPERIMENT_ROOT" in /tmp/studyforge-card-recall-ab-*) ;; *) exit 1 ;; esac
mkdir -p "$EXPERIMENT_ROOT/learning-set-a" "$EXPERIMENT_ROOT/learning-set-b" \
  "$EXPERIMENT_ROOT/pi-agent" "$EXPERIMENT_ROOT/logs" "$EXPERIMENT_ROOT/sessions"
printf '%s\n' "$EXPERIMENT_ROOT"
```

Expected: one path under `/tmp/studyforge-card-recall-ab-*`; record it in the acceptance report.

- [ ] **Step 2: Copy B normally and construct A without deleting anything**

Run:

```bash
rsync -a examples/derivative-m0/learning-set/ "$EXPERIMENT_ROOT/learning-set-b/"
rsync -a --exclude 'graph/card-recall-index.tsv' \
  examples/derivative-m0/learning-set/ "$EXPERIMENT_ROOT/learning-set-a/"
test -f "$EXPERIMENT_ROOT/learning-set-b/graph/card-recall-index.tsv"
test ! -e "$EXPERIMENT_ROOT/learning-set-a/graph/card-recall-index.tsv"
test -f "$EXPERIMENT_ROOT/learning-set-a/graph/vocabulary.yaml"
test -f "$EXPERIMENT_ROOT/learning-set-b/graph/vocabulary.yaml"
```

Expected: only B contains the sidecar; both contain identical cards and vocabulary.

- [ ] **Step 3: Isolate authentication without printing it**

Run:

```bash
test -f /Users/yangrundong/.pi/agent/auth.json
cp /Users/yangrundong/.pi/agent/auth.json "$EXPERIMENT_ROOT/pi-agent/auth.json"
chmod 600 "$EXPERIMENT_ROOT/pi-agent/auth.json"
```

Expected: authentication is readable by Pi and never appears in terminal output or Git.

### Task 3: Run one paired smoke and validate the harness

**Files:**
- Inspect: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Create automatically: two smoke Session JSONL files and two stdout logs under the experiment root.

**Interfaces:**
- Consumes: T1 public brief, current Scout body with YAML frontmatter removed, and both learning-set roots.
- Produces: one A/B pair proving provider/model/thinking/tools/session capture before the remaining 14 calls.

- [ ] **Step 1: Launch the paired T1 smoke**

Define the exact prompt and brief, then run `pi` from each learning-set directory:

```bash
WORKTREE=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/gentle-judgment-isomorphic-acceptance
SCOUT_FILE="$WORKTREE/apps/pi-teaching-web/resources/subagents/study-material-scout.md"
SCOUT_PROMPT_TEXT="$(sed '1,10d' "$SCOUT_FILE")"
test -n "${SCOUT_PROMPT_TEXT:?}"
T1_BRIEF=$'槽位：T1-非齐次构造短题\n公开教学目的：训练学生从“导数与函数项同时出现”的关系中识别构造入口，利用题设特殊点锁定单调性，最后比较若干函数值。\n材料种类与工作量：problem-card；一问、四选一，约 10–15 分钟。\n应避免：多问综合题；只需直接代值计算的题。\n学生事实：基本求导没有问题，但不容易识别相似代数结构。\n建议检索词（只用于召回）：\n- goal: 数值比较\n- method: 局部逼近与找点\n- structure: 非齐次结构\n放宽顺序：无；只报告当前查询切片。'

(
  STARTED_AT="$(date +%s)"
  cd "$EXPERIMENT_ROOT/learning-set-a"
  PI_CODING_AGENT_DIR="$EXPERIMENT_ROOT/pi-agent" pi \
      --provider deepseek --model deepseek-v4-flash --thinking high \
    --mode json --print --tools read,grep,find,ls \
    --no-extensions --no-skills --no-prompt-templates --no-context-files \
    --system-prompt "$SCOUT_PROMPT_TEXT" \
    --session-dir "$EXPERIMENT_ROOT/sessions/T1-A-r1" \
    "$T1_BRIEF" >"$EXPERIMENT_ROOT/logs/T1-A-r1.stdout.jsonl" \
    2>"$EXPERIMENT_ROOT/logs/T1-A-r1.stderr.log"
  STATUS="$?"
  FINISHED_AT="$(date +%s)"
  printf '{"exit":%s,"wallSeconds":%s}\n' "$STATUS" "$((FINISHED_AT-STARTED_AT))" \
    >"$EXPERIMENT_ROOT/logs/T1-A-r1.meta.json"
  exit "$STATUS"
) &
A_PID="$!"

(
  STARTED_AT="$(date +%s)"
  cd "$EXPERIMENT_ROOT/learning-set-b"
  PI_CODING_AGENT_DIR="$EXPERIMENT_ROOT/pi-agent" pi \
      --provider deepseek --model deepseek-v4-flash --thinking high \
    --mode json --print --tools read,grep,find,ls \
    --no-extensions --no-skills --no-prompt-templates --no-context-files \
    --system-prompt "$SCOUT_PROMPT_TEXT" \
    --session-dir "$EXPERIMENT_ROOT/sessions/T1-B-r1" \
    "$T1_BRIEF" >"$EXPERIMENT_ROOT/logs/T1-B-r1.stdout.jsonl" \
    2>"$EXPERIMENT_ROOT/logs/T1-B-r1.stderr.log"
  STATUS="$?"
  FINISHED_AT="$(date +%s)"
  printf '{"exit":%s,"wallSeconds":%s}\n' "$STATUS" "$((FINISHED_AT-STARTED_AT))" \
    >"$EXPERIMENT_ROOT/logs/T1-B-r1.meta.json"
  exit "$STATUS"
) &
B_PID="$!"

A_STATUS=0
B_STATUS=0
wait "$A_PID" || A_STATUS="$?"
wait "$B_PID" || B_STATUS="$?"
test "$A_STATUS" -eq 0
test "$B_STATUS" -eq 0
```

This records each arm's shell wall time independently while keeping raw stdout and stderr separate.

Expected: both processes exit 0 and persist one fresh Session each.

- [ ] **Step 2: Validate smoke identity and safety before continuing**

Parse both Session JSONL files and require:

```text
provider = deepseek
model = deepseek-v4-flash
thinkingLevel = high
enabled tool calls are only read/grep/find/ls
final assistant text exists
no target path appeared in the user message
```

Also require B never opens a formal card and A reads at most the first six lines of intersection cards. If model or effective high thinking differs, stop and report BLOCKED rather than running 14 invalid calls. Preserve the first smoke pair as T1 repetition 1 because both arms were already clamped to the same effective high level before any request was sent.

### Task 4: Run the remaining paired real-model Sessions

**Files:**
- Create automatically: 14 Session JSONL files and stdout logs under the experiment root.
- Inspect only: generated evidence.

**Interfaces:**
- Consumes: T1 repetition 2 plus T2–T4 repetitions 1–2.
- Produces: 16 total valid paired observations.

- [ ] **Step 1: Execute seven more A/B waves**

Use the exact invocation validated in Task 3. Run one A and one B concurrently per wave, wait for both before starting the next wave, and alternate process start order between repetitions. Do not rerun a model failure automatically.

Expected run IDs:

```text
T1-A-r1  T1-B-r1
T1-A-r2  T1-B-r2
T2-A-r1  T2-B-r1
T2-A-r2  T2-B-r2
T3-A-r1  T3-B-r1
T3-A-r2  T3-B-r2
T4-A-r1  T4-B-r1
T4-A-r2  T4-B-r2
```

- [ ] **Step 2: Preserve failures without changing the test**

For a non-zero exit, malformed JSON, provider error, or missing Session, retain stdout and Session evidence, mark only that observation invalid/failed, and continue with the next scheduled pair if provider access remains healthy. Never alter the brief or rerun just the losing arm.

### Task 5: Score quality first and export load metrics

**Files:**
- Inspect: all 16 Session JSONL files.
- Use: `apps/pi-teaching-web/scripts/export-pi-cot.ts` for local evidence only.
- Create: `docs/audits/2026-08-05-controlled-card-recall-ab-acceptance.md`.

**Interfaces:**
- Consumes: final JSON, tool calls, usage, duration, four hidden targets, and any alternate formal cards.
- Produces: per-run and aggregate quality/load tables with no raw CoT.

- [ ] **Step 1: Apply mechanical structural scoring**

For each run record: valid JSON, candidate paths, exact hit, empty result, `matched`, `inspected`, forbidden tool/path reads, tool distribution, and whether `inspected <= matched`.

Expected: scoring uses only persisted evidence and the frozen design; no criterion is changed after seeing an arm label.

- [ ] **Step 2: Deep-check only returned candidates that are not the hidden target**

Read the formal alternate card and check mathematics, full route, workload, exposure risk, and teaching purpose. Classify it as `usable-alternative` or `wrong-recall` with a one-paragraph rationale. Do not penalize an alternate solely for having a different path.

- [ ] **Step 3: Export load metrics locally**

For every valid Session run:

```bash
cd apps/pi-teaching-web
bun scripts/export-pi-cot.ts "$SESSION_FILE" --turn 1 \
  --output "$EXPERIMENT_ROOT/logs/$RUN_ID-cot.md"
```

Extract wall time, input/output/reasoning usage, total tools, tool distribution, and formal-card reads into the report. Keep `*-cot.md` under `/tmp`.

- [ ] **Step 4: Write the sanitized acceptance report**

The report must lead with usable-candidate outcomes, then structural compliance and stability, then load. It must distinguish `direct-fallback` from the historical old Scout and state that Coach translation remains a separate experiment.

### Task 6: Verify and commit only experiment documents

**Files:**
- Verify: experiment design, implementation plan, and acceptance report.
- Preserve: all unrelated worktree changes and `/tmp` evidence.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: a reviewable commit containing no credentials, raw Sessions, CoT, or copied learning set.

- [ ] **Step 1: Run document and leak checks**

Run:

```bash
git diff --check -- \
  docs/superpowers/specs/2026-08-05-controlled-card-recall-ab-design.md \
  docs/superpowers/plans/2026-08-05-controlled-card-recall-ab.md \
  docs/audits/2026-08-05-controlled-card-recall-ab-acceptance.md
rg -n 'api[_-]?key|auth.json|session.jsonl|BEGIN.*KEY' \
  docs/superpowers/specs/2026-08-05-controlled-card-recall-ab-design.md \
  docs/superpowers/plans/2026-08-05-controlled-card-recall-ab.md \
  docs/audits/2026-08-05-controlled-card-recall-ab-acceptance.md
```

Expected: diff check passes; matches, if any, are only explicit statements that those artifacts were not committed, never secret values.

- [ ] **Step 2: Stage exactly three documents and inspect the index**

Run:

```bash
git add \
  docs/superpowers/specs/2026-08-05-controlled-card-recall-ab-design.md \
  docs/superpowers/plans/2026-08-05-controlled-card-recall-ab.md \
  docs/audits/2026-08-05-controlled-card-recall-ab-acceptance.md
git diff --cached --stat
git diff --cached --check
```

Expected: only the three experiment documents are staged.

- [ ] **Step 3: Commit the acceptance evidence**

Run:

```bash
git commit -m "docs: validate controlled card recall"
```

Expected: one commit; unrelated user-owned modifications remain unstaged.
