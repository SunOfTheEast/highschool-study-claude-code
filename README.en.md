# StudyForge

StudyForge is a local, Markdown-first tutoring agent that manages a learning process instead of merely answering prompts. M0 implements a complete Roadmap → Plan → Plan-local Lesson loop, one native Pi Session per node, student-owned lifecycle controls, inspectable classroom evidence, bounded material search, and a focused web workspace. The first teaching pack and the current UI are Chinese-first.

> **Screenshot / demo slot:** a privacy-safe image may be added if a clean public export is prepared. The private beta repository does not ship screenshots containing real course state or proprietary cards.

## Course model

```text
LEARNING_GUIDE.md
ROADMAP.md
└── plans/<plan-id>/PLAN.md
    └── lessons/<lesson-id>.md
        └── Block: Student View + Teacher Control + Classroom Log
```

Roadmap, Plan, and Lesson are different conversation scales. A student explicitly confirms a proposal before a child node is written. Parents read evidence only through the linked tree; an unlinked file is never treated as learner history.

`graph/`, `cards/`, and `materials/` are three independent optional static-asset slices. Static assets accelerate Knowledge browsing and lesson preparation; they are not the course model. Course, Session, and Lesson continue from the required Markdown and classroom process, while Knowledge has a stable empty state when every optional slice is absent or empty.

## Run locally

The validated platforms are macOS and Linux. Install Bun 1.3+ and configure at least one Pi model through OAuth or an API key, then run from the repository root:

```bash
bun install --frozen-lockfile
bun run doctor
bun run start:demo
```

Open <http://127.0.0.1:65000>. By default, `start:demo` selects the public, cardless `examples/math-starter-m0`. Its minimum Learning Set is a writable root containing only `LEARNING_GUIDE.md` and `ROADMAP.md`; Plan directories can be created after student agreement. The read-only doctor checks `platform`, `bun`, `app`, `learning-set`, `write`, `model`, and `port` without printing credential values or authentication paths.

The private beta corpus requires explicit opt-in and remains subject to the license warning below:

```bash
STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run start:demo
```

Set `STUDY_LEARNING_SET=/absolute/path/to/learning-set` to use another authorized pack.

An agent may install repository dependencies, run the doctor, explain failures, and start the foreground server. It must not read credentials, change global Pi configuration without approval, or expose the server beyond loopback. The Chinese [agent-assisted setup guide](docs/guides/agent-assisted-setup.zh-CN.md) contains a copy-paste prompt.

## Implemented M0 behavior

- Routes: `/course`, `/course/plan/:planId`, `/course/plan/:planId/lesson/:lessonId`, and `/knowledge`.
- Plan lifecycle is `prepared → active → completed`; Lesson lifecycle is `prepared → active → closed`. UI actions, not prompts, own transitions.
- **Material Scout** performs shallow, small-batch recall in an isolated context. The parent Coach owns deep reading, mathematics, teaching fit, and persistence.
- **Lesson Reviewer** performs a bounded risk review only when prepared material may leak an answer, conflict with the lesson, or otherwise create material teaching risk.
- Lesson writes are deterministic and node-bound through `classroom_log_append` and `classroom_update`.
- TeX is rendered with KaTeX, and a prepared Lesson can export a printable handout containing public `Student View` content only.

See the [M0 runtime architecture](docs/architecture/m0-runtime.zh-CN.md) and [Learning Set contract](docs/guides/learning-set.zh-CN.md).

## Privacy, limits, and licensing

M0 is a loopback-only single-user application. Learning Set Markdown stores course state; Pi owns model credentials and Session JSONL. StudyForge makes no cloud, remote-access, or multi-user security claim. Never publish real minor records, private classroom transcripts, credentials, or derived learner profiles.

M0 has no derived long-term learner model, cross-Plan memory layer, vector store, or claim of measured learning gains. Those are M1 research questions, described in the [cognitive-outcome agent vision](docs/vision/cognitive-outcome-agent.zh-CN.md).

The current `examples/derivative-m0` directory is a private beta evaluation corpus. It is not licensed under Apache-2.0 and is not approved for public redistribution. It must be removed or replaced before the clean public export.

Project-authored code and documentation are available under [Apache-2.0](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md), [contributing](CONTRIBUTING.md), [security](SECURITY.md), and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Verify

```bash
bun run check
bun run test:e2e
```
