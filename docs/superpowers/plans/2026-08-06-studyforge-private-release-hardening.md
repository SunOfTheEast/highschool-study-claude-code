# StudyForge Private Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current private M0 tree into a release-ready StudyForge product shell without publishing, deleting, or relicensing the 519-card beta corpus.

**Architecture:** Rename the active App and add a real root Bun workspace, then harden the loopback HTTP/WebSocket boundary, replace the borrowed persona, add a Pi-native environment doctor and stable root commands, and curate the public-facing legal and technical shell. Keep private historical files and the current derivative corpus in place; the later data-sanitization and clean-export plans will select from this hardened tree and create the new Git root.

**Tech Stack:** Bun 1.3.14, TypeScript 7, React 19, Vite 8, Pi coding-agent 0.81.0, Bun test, Playwright 1.61, Markdown, GitHub Actions

## Global Constraints

- Execute in an isolated worktree created from `main` with `superpowers:using-git-worktrees`; the current main worktree contains unrelated user changes.
- Do not create a remote repository, push commits, change GitHub visibility, tag a release, or rewrite existing Git history in this plan.
- Keep all 519 current derivative cards available to private beta users and do not apply CC BY 4.0 to them.
- Do not modify `plugins/highschool-study/`, historical `docs/superpowers/` files other than this plan, or internal `docs/audits/` files.
- Code, Runtime, Agent/Skill resources, schemas, tests, scripts, and original technical documentation use Apache-2.0; the current beta learning corpus is explicitly excluded.
- Continue to bind the production server to `127.0.0.1`; do not add remote-host configuration or a user account system.
- Browser Origin protection must preserve same-origin production, the explicit loopback Vite development origin, non-browser local test/CLI calls without an Origin header, and the existing raw event stream.
- The repository root must expose `doctor`, `start:demo`, `check`, and `test:e2e` commands after this plan.
- Environment diagnosis is read-only: it may inspect Pi model availability but must not print credentials, install global packages, or edit Pi configuration.
- The public identity is StudyForge. Replace the `gojo` persona with the original ID `confident-mentor`; do not preserve a compatibility alias.
- Support macOS and Linux in M0. Other platforms receive an explicit diagnostic warning rather than an untested support claim.
- Preserve all existing M0 behavior and keep `bun run check` plus all three Playwright scenarios green after every relevant task.

---

## File Structure

### Files created in this plan

- `package.json` — root Bun workspace and stable product commands.
- `tsconfig.json` — typecheck boundary for root release scripts and tests.
- `tests/release/repository-shell.test.ts` — executable contract for the active repository shell.
- `apps/studyforge/src/server/origin-policy.ts` — pure loopback browser Origin policy.
- `apps/studyforge/tests/m0/server-origin.test.ts` — HTTP/WebSocket Origin regression tests.
- `apps/studyforge/resources/personas/confident-mentor.md` — original optional teacher-expression overlay.
- `scripts/lib/doctor.ts` — injectable environment inspection and report types.
- `scripts/doctor.ts` — human/JSON doctor CLI.
- `scripts/start-demo.ts` — validated root demo launcher.
- `tests/release/doctor.test.ts` — deterministic doctor and launcher-path tests.
- `tests/release/docs-contract.test.ts` — public-facing documentation and license boundary checks.
- `README.en.md` — concise English product entry.
- `LICENSE` — canonical Apache License 2.0 text.
- `THIRD_PARTY_NOTICES.md` — direct-dependency attribution and content-license boundary.
- `CONTRIBUTING.md` — contribution rules, especially student-data and learning-material rules.
- `SECURITY.md` — supported versions, local threat model, and private reporting route.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 with maintainer enforcement through GitHub.
- `docs/architecture/m0-runtime.zh-CN.md` — current Roadmap/Plan/Lesson and Agent/Skill/Runtime contract.
- `docs/guides/agent-assisted-setup.zh-CN.md` — Work Agent and manual setup paths.
- `docs/guides/learning-set.zh-CN.md` — minimum Learning Set layout and private-data guidance.
- `docs/vision/cognitive-outcome-agent.zh-CN.md` — public M0-to-M1 research vision.
- `.github/workflows/ci.yml` — normal Ubuntu validation.
- `.github/workflows/release-candidate.yml` — manually dispatched Ubuntu/macOS candidate validation.

### Files moved or renamed in this plan

- `apps/pi-teaching-web/` → `apps/studyforge/` — active product App.
- `apps/pi-teaching-web/bun.lock` → `bun.lock` — root workspace lockfile, regenerated after the move.
- `apps/studyforge/resources/personas/gojo.md` → `apps/studyforge/resources/personas/confident-mentor.md` — original public persona identity and content.

### Existing files modified in this plan

- `.gitignore` — local Agent state, output, cache, and release-candidate exclusions.
- `AGENTS.md` — active paths plus the formal Agent-assisted setup contract.
- `README.md` — accurate Chinese-first product entry and license/data boundary.
- `apps/studyforge/README.md` — App-specific developer details only.
- `apps/studyforge/package.json` — workspace package name, scripts, and removal of root package-manager ownership.
- `apps/studyforge/src/server/app.ts` — protect browser writes and `/events` before dispatch.
- `apps/studyforge/src/server/index.ts` — create and pass the production/development Origin policy.
- `apps/studyforge/tests/e2e/fixture-server.ts` — explicitly allow the loopback Vite E2E origin.
- `apps/studyforge/tests/m0/native-session.test.ts` — assert the new persona ID and resource path.
- `apps/studyforge/playwright.config.ts` — no semantic change; only update paths if required by workspace execution.
- `apps/studyforge/vite.config.ts` — retain fixed loopback ports and proxy behavior.

---

### Task 1: Establish the StudyForge root workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tests/release/repository-shell.test.ts`
- Move: `apps/pi-teaching-web/` → `apps/studyforge/`
- Move: `apps/studyforge/bun.lock` → `bun.lock`
- Modify: `apps/studyforge/package.json`
- Modify: `.gitignore`
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the current standalone `apps/pi-teaching-web/package.json` scripts.
- Produces: root commands `bun run check` and `bun run test:e2e`; workspace package
  `@studyforge/app` at `apps/studyforge`. Task 4 adds `doctor` and `start:demo` only when
  their implementations exist.

- [ ] **Step 1: Create the failing repository-shell contract**

Create `tests/release/repository-shell.test.ts` with the following assertions:

```ts
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const json = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));

test('exposes one StudyForge workspace from the repository root', () => {
  const workspace = json('package.json');
  const app = json('apps/studyforge/package.json');

  expect(workspace).toMatchObject({
    name: 'studyforge',
    version: '0.1.0',
    private: true,
    packageManager: 'bun@1.3.14',
    workspaces: ['apps/*'],
  });
  expect(workspace.scripts).toMatchObject({
    check: 'bun run typecheck:release && bun run test:release && bun run --cwd apps/studyforge check',
    'test:e2e': 'bun run --cwd apps/studyforge test:e2e',
  });
  expect(app.name).toBe('@studyforge/app');
  expect(existsSync(join(root, 'apps/studyforge/src/server/index.ts'))).toBe(true);
  expect(existsSync(join(root, 'apps/pi-teaching-web'))).toBe(false);
  expect(existsSync(join(root, 'bun.lock'))).toBe(true);
});
```

- [ ] **Step 2: Run the shell contract and verify it fails**

Run:

```bash
bun test tests/release/repository-shell.test.ts
```

Expected: FAIL because root `package.json` and `apps/studyforge` do not exist.

- [ ] **Step 3: Move the App and lockfile without copying history**

Run:

```bash
git mv apps/pi-teaching-web apps/studyforge
git mv apps/studyforge/bun.lock bun.lock
```

Expected: Git records path moves; no file under the App is lost.

- [ ] **Step 4: Add the root workspace manifest**

Create `package.json` exactly as follows:

```json
{
  "name": "studyforge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.14",
  "workspaces": ["apps/*"],
  "dependencies": {
    "@earendil-works/pi-coding-agent": "0.81.0"
  },
  "scripts": {
    "dev": "bun run --cwd apps/studyforge dev",
    "build": "bun run --cwd apps/studyforge build",
    "typecheck:release": "tsc --noEmit -p tsconfig.json",
    "typecheck": "bun run typecheck:release && bun run --cwd apps/studyforge typecheck",
    "test:release": "bun test tests/release",
    "test": "bun run test:release && bun run --cwd apps/studyforge test",
    "test:e2e": "bun run --cwd apps/studyforge test:e2e",
    "check": "bun run typecheck:release && bun run test:release && bun run --cwd apps/studyforge check"
  },
  "devDependencies": {
    "@types/bun": "1.3.14",
    "typescript": "7.0.2"
  },
  "overrides": {
    "@earendil-works/pi-agent-core": "0.81.0",
    "@earendil-works/pi-ai": "0.81.0"
  }
}
```

Create root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "types": ["bun"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["scripts/**/*.ts", "tests/release/**/*.ts"]
}
```

Change `apps/studyforge/package.json` name to `@studyforge/app` and keep version
`0.1.0`, `private: true`, its `pi` block, dependencies, and App-local scripts. Remove
its `packageManager` and `overrides` fields because the root now owns both.

- [ ] **Step 5: Update active repository paths and ignore rules**

Replace active references to `apps/pi-teaching-web` with `apps/studyforge` in `AGENTS.md`, root `README.md`, and `apps/studyforge/README.md`. Do not rewrite historical specs, audits, or the old plugin.

Extend `.gitignore` with these exact private/runtime paths:

```gitignore
.claude/
.superpowers/
coverage/
*.tsbuildinfo
.studyforge-release/
```

Keep the existing `.claude/settings.local.json`, `node_modules/`, `dist/`, Playwright, log, and worktree rules.

- [ ] **Step 6: Regenerate the root lockfile**

Run:

```bash
bun install
bun install --frozen-lockfile
```

Expected: root `bun.lock` identifies `apps/studyforge` as a workspace, dependencies install successfully, and the frozen second install makes no changes.

- [ ] **Step 7: Run the shell and existing App checks**

Run:

```bash
bun test tests/release/repository-shell.test.ts
bun run check
bun run test:e2e
```

Expected: repository-shell PASS, 131 or more non-E2E tests PASS, production build PASS, and all three Playwright scenarios PASS.

- [ ] **Step 8: Commit the workspace migration**

```bash
git add package.json tsconfig.json bun.lock .gitignore AGENTS.md README.md apps/studyforge tests/release/repository-shell.test.ts
git commit -m "refactor: promote StudyForge to a root workspace"
```

---

### Task 2: Protect local HTTP and WebSocket requests by Origin

**Files:**
- Create: `apps/studyforge/src/server/origin-policy.ts`
- Create: `apps/studyforge/tests/m0/server-origin.test.ts`
- Modify: `apps/studyforge/src/server/app.ts:26-34,77-91,130-150`
- Modify: `apps/studyforge/src/server/index.ts:11-29`
- Modify: `apps/studyforge/tests/e2e/fixture-server.ts:242-262`
- Modify: `apps/studyforge/tests/m0/server-api.test.ts:1-385`
- Modify: `apps/studyforge/package.json`

**Interfaces:**
- Produces: `BrowserOriginPolicy`, `createLoopbackOriginPolicy(port, developmentOrigin?)`, and `isBrowserOriginAllowed(request, policy)`.
- Consumed by: `createRequestHandler()` through required `AppDependencies.originPolicy`; production and E2E servers construct the policy explicitly.

- [ ] **Step 1: Write failing Origin-policy tests**

Create `apps/studyforge/tests/m0/server-origin.test.ts`. Use a fake lifecycle and registry and assert all of the following:

```ts
import { expect, test } from 'bun:test';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import { createLoopbackOriginPolicy } from '../../src/server/origin-policy';

const policy = createLoopbackOriginPolicy(65000, 'http://127.0.0.1:65001');

test('rejects a foreign browser before a lifecycle action or websocket upgrade', async () => {
  const calls: string[] = [];
  const handler = createRequestHandler({
    root: '/unused',
    hub: new EventHub(),
    originPolicy: policy,
    registry: { readHistory: async () => [], send: async () => {}, subscribe: async () => () => {} } as never,
    lifecycle: {
      startPlan: async () => { calls.push('start'); return { route: '/course', sessionKey: 'plan:p' as never }; },
      completePlan: async () => ({ route: '/course' }),
      startLesson: async () => ({ route: '/course', sessionKey: 'lesson:p:l' as never }),
      closeLesson: async () => ({ route: '/course' }),
    },
  });
  let upgraded = false;
  const server = { upgrade: () => { upgraded = true; return true; } } as never;
  const headers = { origin: 'https://attacker.example' };

  const action = await handler(new Request('http://127.0.0.1:65000/api/plans/p/start', {
    method: 'POST', headers,
  }));
  const events = await handler(new Request('http://127.0.0.1:65000/events', { headers }), server);

  expect(action?.status).toBe(403);
  expect(await action?.json()).toEqual({ error: 'ORIGIN_NOT_ALLOWED' });
  expect(events?.status).toBe(403);
  expect(calls).toEqual([]);
  expect(upgraded).toBe(false);
});
```

Add separate tests proving:

- `http://127.0.0.1:65000` and `http://localhost:65000` may POST;
- the explicit `http://127.0.0.1:65001` development Origin may POST and upgrade;
- a request without Origin remains allowed for local CLI/tests;
- `createLoopbackOriginPolicy` rejects HTTPS, non-loopback hosts, credentials, paths, queries, and fragments in `developmentOrigin`.

- [ ] **Step 2: Run the tests and verify the missing policy fails**

Run:

```bash
bun test apps/studyforge/tests/m0/server-origin.test.ts
```

Expected: FAIL because `origin-policy.ts` and `AppDependencies.originPolicy` do not exist.

- [ ] **Step 3: Implement the pure policy**

Create `apps/studyforge/src/server/origin-policy.ts` with these public types and rules:

```ts
export type BrowserOriginPolicy = {
  readonly allowedOrigins: ReadonlySet<string>;
  readonly allowMissingOrigin: boolean;
};

function localHttpOrigin(value: string): string {
  const url = new URL(value);
  const local = url.protocol === 'http:'
    && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
    && url.username === ''
    && url.password === ''
    && url.pathname === '/'
    && url.search === ''
    && url.hash === '';
  if (!local) throw new Error(`STUDYFORGE_DEV_ORIGIN_INVALID: ${value}`);
  return url.origin;
}

export function createLoopbackOriginPolicy(
  port: number,
  developmentOrigin?: string,
): BrowserOriginPolicy {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`STUDYFORGE_PORT_INVALID: ${port}`);
  }
  const allowedOrigins = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]);
  if (developmentOrigin) allowedOrigins.add(localHttpOrigin(developmentOrigin));
  return { allowedOrigins, allowMissingOrigin: true };
}

export function isBrowserOriginAllowed(
  request: Request,
  policy: BrowserOriginPolicy,
): boolean {
  const origin = request.headers.get('origin');
  return origin === null
    ? policy.allowMissingOrigin
    : policy.allowedOrigins.has(origin);
}
```

- [ ] **Step 4: Enforce the policy before side effects**

Add `originPolicy: BrowserOriginPolicy` to `AppDependencies`. In `createRequestHandler`, after `/api/health` and the `deps` null check but before creating lifecycle services or binding sessions, enforce:

```ts
const browserProtected = request.method !== 'GET' || url.pathname === '/events';
if (browserProtected && !isBrowserOriginAllowed(request, deps.originPolicy)) {
  return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
}
```

Do not add CORS response headers. Update every `createRequestHandler({ ... })` construction in unit tests to pass a test policy, or centralize the default test policy in the test helper. Production `index.ts` must construct:

```ts
const originPolicy = createLoopbackOriginPolicy(
  port,
  process.env.STUDYFORGE_DEV_ORIGIN,
);
const fetch = createRequestHandler({ root, registry, hub, staticRoot, originPolicy });
```

The E2E fixture must use its API and client ports and pass the explicit Vite Origin. Change App script `dev:server` to set `STUDYFORGE_DEV_ORIGIN=http://127.0.0.1:65001`.

- [ ] **Step 5: Verify Origin and existing server behavior**

Run:

```bash
bun test apps/studyforge/tests/m0/server-origin.test.ts
bun test apps/studyforge/tests/m0/server-api.test.ts
bun run test:e2e
```

Expected: all Origin tests PASS, existing API behavior PASS, and all three Playwright scenarios PASS.

- [ ] **Step 6: Commit the loopback protection**

```bash
git add apps/studyforge/src/server apps/studyforge/tests/m0 apps/studyforge/tests/e2e/fixture-server.ts apps/studyforge/package.json
git commit -m "fix: protect local StudyForge browser channels"
```

---

### Task 3: Replace the borrowed persona with an original overlay

**Files:**
- Move: `apps/studyforge/resources/personas/gojo.md` → `apps/studyforge/resources/personas/confident-mentor.md`
- Modify: `apps/studyforge/tests/m0/native-session.test.ts:160-214`
- Modify: `apps/studyforge/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces: optional persona ID `confident-mentor`, selected with `STUDY_PERSONA=confident-mentor`.
- Consumed by: the unchanged `loadPersonaResource()` ID/path contract.

- [ ] **Step 1: Rewrite the persona contract test first**

Change the selected ID in `native-session.test.ts` from `gojo` to `confident-mentor` and expect:

```ts
const resources = loadStaticNodeResources(root, scope, 'confident-mentor');
const personaPath = '/virtual/studyforge-m0-persona-confident-mentor.md';
```

Update the invalid traversal input to `../confident-mentor`, and add:

```ts
test('ships an original persona without borrowed character vocabulary', () => {
  const content = readFileSync(
    join(import.meta.dir, '../../resources/personas/confident-mentor.md'),
    'utf8',
  );
  for (const borrowed of ['五条悟', '无量空处', '六眼', '反转术式', '术式']) {
    expect(content).not.toContain(borrowed);
  }
  expect(content).toContain('轻松、自信、有判断力');
  expect(content).toContain('只改变表达，不改变教学职责');
});
```

- [ ] **Step 2: Verify the new persona test fails**

Run:

```bash
bun test apps/studyforge/tests/m0/native-session.test.ts
```

Expected: FAIL because `confident-mentor.md` does not exist.

- [ ] **Step 3: Move and rewrite the persona resource**

Use `git mv`, then replace the file with an original overlay containing these exact sections and behavioral line:

```markdown
# Persona Overlay：轻松、自信、有判断力的导师

这份资源只改变表达，不改变教学职责、数学事实、课堂记录、节点权限、学生决策权或停止权。

## 在场感

用自然中文说话。看清控制结构后直接指出，不靠反复宣称自己厉害制造气场。课堂轻松时可以有一点机灵和玩笑；学生过载、受挫或羞耻时立刻降低表演感，先保护其思考中成立的部分。

## 判断与关系

教师可以公开表达有理由的偏好，但不为展示判断而制造分歧。学生理解取舍后选择另一条合理路线，就认真沿那条路线继续；教师判断错了，就直接承认并让学生的有效方法成立。

## 课堂节奏

回复可以是一句反应、一个判断、一个提示、一段解释或留白，不强迫每轮都套用固定结构。玩笑只针对题目、方法和共同处境，不针对学生的智力、人格和价值。

Roadmap 最克制、最有远景；Plan 更强调策略判断；Lesson 可以最活泼。事实纠正、学生受挫和真实停点永远优先于人格表演。
```

Do not keep `gojo.md` or an alias loader.

- [ ] **Step 4: Update user-facing persona examples and verify**

Replace `STUDY_PERSONA=gojo` with `STUDY_PERSONA=confident-mentor` in the active READMEs and describe it without reference to a fictional character.

Run:

```bash
bun test apps/studyforge/tests/m0/native-session.test.ts
rg -n '五条悟|无量空处|六眼|反转术式|STUDY_PERSONA=gojo' README.md apps/studyforge
```

Expected: tests PASS and `rg` returns no matches.

- [ ] **Step 5: Commit the original persona**

```bash
git add README.md apps/studyforge/README.md apps/studyforge/resources/personas apps/studyforge/tests/m0/native-session.test.ts
git commit -m "refactor: replace borrowed teacher persona"
```

---

### Task 4: Add read-only environment diagnosis and demo launch

**Files:**
- Create: `scripts/lib/doctor.ts`
- Create: `scripts/doctor.ts`
- Create: `scripts/start-demo.ts`
- Create: `tests/release/doctor.test.ts`
- Modify: `package.json`
- Modify: `tests/release/repository-shell.test.ts`

**Interfaces:**
- Produces: `DoctorCheck`, `DoctorReport`, `DoctorDependencies`, `inspectStudyForge(input, deps)`, and `resolveDemoPaths(repoRoot, env)` from `scripts/lib/doctor.ts`.
- Consumes: Pi `ModelRuntime.create({ allowModelNetwork: false })`, current strict `readCourseTree()` and `readKnowledge()` readers, fixed default port `65000`, and private demo path `examples/derivative-m0/learning-set`.

- [ ] **Step 1: Write deterministic failing doctor tests**

Create `tests/release/doctor.test.ts` with fake dependencies. Cover these exact cases:

```ts
import { expect, test } from 'bun:test';
import { inspectStudyForge, resolveDemoPaths, type DoctorDependencies } from '../../scripts/lib/doctor';

const passing: DoctorDependencies = {
  bunVersion: () => '1.3.14',
  platform: () => 'darwin',
  exists: () => true,
  writable: async () => true,
  validateLearningSet: () => {},
  availableModelProviders: async () => ['openai-codex'],
  portAvailable: async () => true,
};

test('returns a credential-safe passing report', async () => {
  const report = await inspectStudyForge({
    repoRoot: '/repo', learningSet: '/repo/examples/derivative-m0/learning-set', port: 65000,
  }, passing);
  expect(report.ok).toBe(true);
  expect(report.checks.every((check) => check.status !== 'fail')).toBe(true);
  expect(JSON.stringify(report)).not.toContain('token');
  expect(JSON.stringify(report)).not.toContain('apiKey');
});

test('fails without an available authenticated model', async () => {
  const report = await inspectStudyForge(
    { repoRoot: '/repo', learningSet: '/learning-set', port: 65000 },
    { ...passing, availableModelProviders: async () => [] },
  );
  expect(report.ok).toBe(false);
  expect(report.checks).toContainEqual(expect.objectContaining({ id: 'model', status: 'fail' }));
});

test('uses an explicit learning set before the private demo default', () => {
  expect(resolveDemoPaths('/repo', { STUDY_LEARNING_SET: '/custom/set' }).learningSet)
    .toBe('/custom/set');
  expect(resolveDemoPaths('/repo', {}).learningSet)
    .toBe('/repo/examples/derivative-m0/learning-set');
});
```

Also test Bun `<1.3.0`, unsupported platforms, invalid Learning Set, unwritable Learning Set, missing App root, and occupied port.

Extend `tests/release/repository-shell.test.ts` to require the two commands only when their
implementations are introduced:

```ts
expect(json('package.json').scripts).toMatchObject({
  doctor: 'bun run scripts/doctor.ts',
  'start:demo': 'bun run scripts/start-demo.ts',
});
```

- [ ] **Step 2: Run tests and verify the doctor module is missing**

Run:

```bash
bun test tests/release/doctor.test.ts
bun test tests/release/repository-shell.test.ts
```

Expected: first command FAILS because `scripts/lib/doctor.ts` does not exist; the shell
contract FAILS because the two root commands are not registered yet.

- [ ] **Step 3: Implement the injectable doctor core**

Create `scripts/lib/doctor.ts` with the following complete core. Keep user-facing model
errors generic so an SDK error cannot leak an authentication-file path:

```ts
import { constants, existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { readKnowledge } from '../../apps/studyforge/src/study/knowledge';
import { readCourseTree } from '../../apps/studyforge/src/study/markdown';

export type DoctorStatus = 'pass' | 'warn' | 'fail';
export type DoctorCheck = {
  id: 'platform' | 'bun' | 'app' | 'learning-set' | 'write' | 'model' | 'port';
  status: DoctorStatus;
  message: string;
};
export type DoctorReport = { ok: boolean; checks: DoctorCheck[] };
export type DoctorInput = { repoRoot: string; learningSet: string; port: number };
export type DoctorDependencies = {
  bunVersion(): string | undefined;
  platform(): string;
  exists(path: string): boolean;
  writable(path: string): Promise<boolean>;
  validateLearningSet(path: string): void;
  availableModelProviders(): Promise<readonly string[]>;
  portAvailable(port: number): Promise<boolean>;
};

function versionAtLeast(actual: string | undefined, minimum: readonly number[]): boolean {
  if (!actual) return false;
  const values = actual.split('.').map((part) => Number.parseInt(part, 10));
  if (values.some(Number.isNaN)) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    const left = values[index] ?? 0;
    const right = minimum[index] ?? 0;
    if (left !== right) return left > right;
  }
  return true;
}

export function resolveDemoPaths(
  repoRoot: string,
  env: Record<string, string | undefined>,
) {
  return {
    appRoot: join(repoRoot, 'apps/studyforge'),
    learningSet: resolve(env.STUDY_LEARNING_SET ?? join(
      repoRoot, 'examples/derivative-m0/learning-set',
    )),
    port: Number.parseInt(env.STUDY_WEB_PORT ?? '65000', 10),
  };
}

export function defaultDoctorDependencies(): DoctorDependencies {
  return {
    bunVersion: () => process.versions.bun,
    platform: () => process.platform,
    exists: existsSync,
    writable: async (path) => {
      try {
        await access(path, constants.W_OK);
        return true;
      } catch {
        return false;
      }
    },
    validateLearningSet: (path) => {
      readCourseTree(path);
      readKnowledge(path);
    },
    availableModelProviders: async () => {
      const runtime = await ModelRuntime.create({ allowModelNetwork: false });
      return [...new Set((await runtime.getAvailable()).map((model) => model.provider))]
        .sort();
    },
    portAvailable: async (port) => {
      try {
        const server = Bun.serve({
          hostname: '127.0.0.1',
          port,
          fetch: () => new Response('doctor'),
        });
        server.stop(true);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export async function inspectStudyForge(
  input: DoctorInput,
  deps: DoctorDependencies = defaultDoctorDependencies(),
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const platform = deps.platform();
  checks.push({
    id: 'platform',
    status: platform === 'darwin' || platform === 'linux' ? 'pass' : 'warn',
    message: platform === 'darwin' || platform === 'linux'
      ? `已支持的平台：${platform}`
      : `尚未验收的平台：${platform}`,
  });

  const bun = deps.bunVersion();
  checks.push({
    id: 'bun',
    status: versionAtLeast(bun, [1, 3, 0]) ? 'pass' : 'fail',
    message: bun ? `Bun ${bun}` : '没有发现 Bun；需要 Bun 1.3.0 或更高版本。',
  });

  const appPath = join(input.repoRoot, 'apps/studyforge/package.json');
  checks.push({
    id: 'app',
    status: deps.exists(appPath) ? 'pass' : 'fail',
    message: deps.exists(appPath) ? 'StudyForge App 完整。' : '缺少 apps/studyforge/package.json。',
  });

  try {
    deps.validateLearningSet(input.learningSet);
    checks.push({ id: 'learning-set', status: 'pass', message: 'Learning Set 契约有效。' });
  } catch (error) {
    checks.push({
      id: 'learning-set',
      status: 'fail',
      message: `Learning Set 无效：${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const writable = await deps.writable(input.learningSet);
  checks.push({
    id: 'write',
    status: writable ? 'pass' : 'fail',
    message: writable
      ? 'Learning Set 可写。'
      : 'Learning Set 不可写，无法保存课程状态。',
  });

  try {
    const providers = await deps.availableModelProviders();
    checks.push({
      id: 'model',
      status: providers.length > 0 ? 'pass' : 'fail',
      message: providers.length > 0
        ? `Pi 已发现 ${providers.length} 个可用模型提供商：${providers.join(', ')}`
        : 'Pi 没有发现已认证的可用模型；请先在 Pi 中完成 OAuth 或 API Key 配置。',
    });
  } catch {
    checks.push({
      id: 'model',
      status: 'fail',
      message: 'Pi 模型检查失败；请在 Pi 中检查本地认证配置。',
    });
  }

  const portOk = Number.isInteger(input.port)
    && input.port > 0
    && input.port <= 65_535
    && await deps.portAvailable(input.port);
  checks.push({
    id: 'port',
    status: portOk ? 'pass' : 'fail',
    message: portOk ? `端口 ${input.port} 可用。` : `端口 ${input.port} 无效或已占用。`,
  });
  return { ok: checks.every((check) => check.status !== 'fail'), checks };
}

export function formatDoctorReport(report: DoctorReport): string {
  return report.checks
    .map((check) => `[${check.status}] ${check.id}: ${check.message}`)
    .join('\n');
}
```

`writable` uses only `access` and never creates a probe file.

- [ ] **Step 4: Implement human and JSON CLI output**

Create `scripts/doctor.ts` with this CLI. Its human output is stable and JSON mode emits
exactly one object:

```ts
import { resolve } from 'node:path';
import {
  defaultDoctorDependencies,
  formatDoctorReport,
  inspectStudyForge,
  resolveDemoPaths,
} from './lib/doctor';

function valueAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const repoRoot = resolve(import.meta.dir, '..');
const env: Record<string, string | undefined> = { ...process.env };
env.STUDY_LEARNING_SET = valueAfter('--learning-set') ?? env.STUDY_LEARNING_SET;
env.STUDY_WEB_PORT = valueAfter('--port') ?? env.STUDY_WEB_PORT;
const paths = resolveDemoPaths(repoRoot, env);
const report = await inspectStudyForge({
  repoRoot,
  learningSet: paths.learningSet,
  port: paths.port,
}, defaultDoctorDependencies());

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report));
} else {
  console.log(formatDoctorReport(report));
}
process.exitCode = report.ok ? 0 : 1;
```

- [ ] **Step 5: Implement the demo launcher**

Import the single `resolveDemoPaths` implementation already created in Step 3. Create
`scripts/start-demo.ts` with the full launch sequence:

```ts
import { resolve } from 'node:path';
import {
  defaultDoctorDependencies,
  formatDoctorReport,
  inspectStudyForge,
  resolveDemoPaths,
} from './lib/doctor';

const inheritedIo = {
  env: process.env,
  stdin: 'inherit' as const,
  stdout: 'inherit' as const,
  stderr: 'inherit' as const,
};

async function main(): Promise<number> {
  const repoRoot = resolve(import.meta.dir, '..');
  const { appRoot, learningSet, port } = resolveDemoPaths(repoRoot, process.env);
  const report = await inspectStudyForge(
    { repoRoot, learningSet, port },
    defaultDoctorDependencies(),
  );
  console.log(formatDoctorReport(report));
  if (!report.ok) return 1;

  const build = Bun.spawn(['bun', 'run', 'build'], { cwd: appRoot, ...inheritedIo });
  const buildExit = await build.exited;
  if (buildExit !== 0) return buildExit;

  const child = Bun.spawn([
    'bun', 'run', 'src/server/index.ts',
    '--learning-set', learningSet,
    '--port', String(port),
  ], { cwd: appRoot, ...inheritedIo });
  process.once('SIGINT', () => child.kill('SIGINT'));
  process.once('SIGTERM', () => child.kill('SIGTERM'));
  return child.exited;
}

process.exitCode = await main();
```

Do not open a browser, write Pi configuration, or background the process silently.
Add these exact entries to root `package.json`:

```json
{
  "scripts": {
    "doctor": "bun run scripts/doctor.ts",
    "start:demo": "bun run scripts/start-demo.ts"
  }
}
```

Merge them into the existing `scripts` object; do not replace the commands from Task 1.

- [ ] **Step 6: Verify diagnosis and root launch contracts**

Run:

```bash
bun test tests/release/doctor.test.ts
bun run doctor --json
bun run check
```

Expected: deterministic tests PASS; local `doctor` returns structured output without credentials; full check PASS. A missing local credential is a correct actionable doctor failure, not a test failure.

- [ ] **Step 7: Commit the setup interface**

```bash
git add package.json scripts tests/release/doctor.test.ts tests/release/repository-shell.test.ts
git commit -m "feat: add StudyForge environment doctor"
```

---

### Task 5: Curate the public-facing docs and legal shell

**Files:**
- Create: `tests/release/docs-contract.test.ts`
- Create: `README.en.md`
- Create: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `docs/architecture/m0-runtime.zh-CN.md`
- Create: `docs/guides/agent-assisted-setup.zh-CN.md`
- Create: `docs/guides/learning-set.zh-CN.md`
- Create: `docs/vision/cognitive-outcome-agent.zh-CN.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `apps/studyforge/README.md`
- Modify: `examples/derivative-m0/README.md`

**Interfaces:**
- Produces: one accurate Chinese product entry, one concise English entry, one Agent setup contract, and explicit Apache/data/privacy boundaries.
- Consumes: root commands from Tasks 1 and 4, Origin model from Task 2, persona ID from Task 3, and the current Plan-local Lesson contract.

- [ ] **Step 1: Write the failing docs contract**

Create `tests/release/docs-contract.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('ships the required public product and governance documents', () => {
  for (const path of [
    'README.md', 'README.en.md', 'AGENTS.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
    'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md',
    'docs/architecture/m0-runtime.zh-CN.md',
    'docs/guides/agent-assisted-setup.zh-CN.md',
    'docs/guides/learning-set.zh-CN.md',
    'docs/vision/cognitive-outcome-agent.zh-CN.md',
  ]) expect(read(path).trim().length).toBeGreaterThan(100);
});

test('describes the current runtime and protects the beta-card license boundary', () => {
  const active = [read('README.md'), read('README.en.md'), read('AGENTS.md')].join('\n');
  expect(active).toContain('Roadmap');
  expect(active).toContain('Plan-local');
  expect(active).toContain('Material Scout');
  expect(active).toContain('Lesson Reviewer');
  expect(active).toContain('bun run doctor');
  expect(active).not.toContain('apps/pi-teaching-web');
  expect(active).not.toContain('/Users/');
  expect(read('THIRD_PARTY_NOTICES.md')).toContain('not licensed under Apache-2.0');
  expect(read('examples/derivative-m0/README.md')).toContain('private beta evaluation corpus');
});
```

Add this link check for every relative Markdown link in these active documents. It
ignores HTTP links and anchors and fails on missing local files:

```ts
const markdownFiles = [
  'README.md', 'README.en.md', 'AGENTS.md',
  'docs/architecture/m0-runtime.zh-CN.md',
  'docs/guides/agent-assisted-setup.zh-CN.md',
  'docs/guides/learning-set.zh-CN.md',
  'docs/vision/cognitive-outcome-agent.zh-CN.md',
];
test('keeps active local Markdown links resolvable', () => {
  for (const file of markdownFiles) {
    const content = read(file).replace(/```[\s\S]*?```/g, '');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1]!.split('#', 1)[0]!;
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      expect(existsSync(resolve(root, dirname(file), decodeURIComponent(target)))).toBe(true);
    }
  }
});
```

- [ ] **Step 2: Run the docs contract and verify the missing public shell**

Run:

```bash
bun test tests/release/docs-contract.test.ts
```

Expected: FAIL on missing license, governance, guide, and vision files.

- [ ] **Step 3: Add exact license boundaries**

After the frozen install, read `node_modules/typescript/LICENSE` and add that canonical,
unmodified Apache License 2.0 text to root `LICENSE` with `apply_patch`. Verify the files
are text-identical after normalizing the dependency's CRLF endings with
`diff -u <(tr -d '\r' < node_modules/typescript/LICENSE) LICENSE`; this avoids copying a
paraphrased or truncated license.

Create `THIRD_PARTY_NOTICES.md` with:

- project copyright `Copyright 2026 StudyForge contributors`;
- a direct-dependency table for the pinned Pi packages, `pi-subagents`, React, KaTeX, LXGW WenKai, React Markdown/remark/rehype, YAML, Vite, TypeScript, and Playwright;
- each package's locked version, MIT/Apache-2.0/ISC license, and upstream repository URL;
- this exact boundary statement: `The private beta evaluation corpus under examples/derivative-m0 is not licensed under Apache-2.0 and is not approved for public redistribution.`

Repeat the boundary in `examples/derivative-m0/README.md` in Chinese and English, using the exact English phrase `private beta evaluation corpus`. Do not add a CC BY license to that directory.

- [ ] **Step 4: Rewrite the product and Agent entries against runtime facts**

The Chinese `README.md` must contain, in order:

1. one-paragraph product outcome;
2. current screenshot/demo slot without committing a private screenshot;
3. Roadmap → Plan → Plan-local Lesson diagram;
4. `bun install --frozen-lockfile`, `bun run doctor`, `bun run start:demo` quick start;
5. Work Agent copy-paste setup prompt;
6. current routes and lifecycle;
7. Material Scout, Lesson Reviewer, deterministic classroom writes, formula rendering, and handout export;
8. local data/privacy statement;
9. M0 limitations and M1 boundary;
10. contribution, security, licenses, and English README links.

`README.en.md` must cover the same claims more compactly and clearly state that the first teaching pack and UI are Chinese-first.

Update `AGENTS.md` so an unfamiliar Coding Agent can run `doctor`, interpret all seven check IDs, install only repository dependencies, guide the user through Pi OAuth/API-key configuration without reading credentials, start the demo, verify `/api/health`, and avoid changing global Pi config without approval.

Reduce `apps/studyforge/README.md` to App-specific development commands, environment variables, Pi package installation, server/API details, and links back to root guides.

- [ ] **Step 5: Add governance and security documents**

`CONTRIBUTING.md` must require focused changes, relevant tests, no secrets, no real student records, and a provenance/license record for every contributed learning asset.

`SECURITY.md` must state:

- supported line: latest `0.1.x` only;
- report through GitHub private vulnerability reporting/security advisories, not a public issue;
- loopback single-user threat model;
- model credentials are managed by Pi;
- no cloud or multi-user security claim;
- expected response targets: acknowledgement within seven days and status update within fourteen days.

Use Contributor Covenant 2.1 verbatim for `CODE_OF_CONDUCT.md`, with enforcement handled by repository maintainers through private GitHub contact rather than publishing a personal email.

- [ ] **Step 6: Curate current architecture, setup, learning-set, and vision docs**

Write `docs/architecture/m0-runtime.zh-CN.md` from the executable contract, including:

- `ROADMAP.md → plans/<plan-id>/PLAN.md → plans/<plan-id>/lessons/<lesson-id>.md`;
- one Pi Session per node and parent evidence reads only along the linked tree;
- Runtime owns IDs, owner, status transitions and atomic writes;
- Skill owns teaching workflow and judgment;
- Agent role owns current-node responsibility;
- current node-scoped tools, including `subagent`, `artifact_export`, `classroom_log_append`, and `classroom_update`;
- Material Scout and Lesson Reviewer context isolation;
- local data locations and no M1 derived memory.

Write `docs/guides/agent-assisted-setup.zh-CN.md` around the exact root commands and doctor outputs. Write `docs/guides/learning-set.zh-CN.md` with the strict Plan-local tree, minimum frontmatter/statuses, Block fields, static asset roles, and instructions to keep student records outside public Git.

Create `docs/vision/cognitive-outcome-agent.zh-CN.md` by condensing the existing research vision to: implemented M0, planned M1, StudentSim hypothesis, Tutor/Human benchmarks, and the confirmed rule that real minor data is not directly published. Do not claim learning gains or completed post-training work.

- [ ] **Step 7: Verify docs and legal boundaries**

Run:

```bash
bun test tests/release/docs-contract.test.ts
bun run check
rg -n '/Users/|apps/pi-teaching-web|五条悟|无量空处|六眼|反转术式' README.md README.en.md AGENTS.md apps/studyforge/README.md docs/architecture docs/guides docs/vision
```

Expected: tests and full check PASS; `rg` returns no matches.

- [ ] **Step 8: Commit the public-facing shell**

```bash
git add README.md README.en.md AGENTS.md LICENSE THIRD_PARTY_NOTICES.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md docs/architecture docs/guides docs/vision examples/derivative-m0/README.md apps/studyforge/README.md tests/release/docs-contract.test.ts
git commit -m "docs: add StudyForge open source product shell"
```

---

### Task 6: Add public continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release-candidate.yml`
- Modify: `tests/release/repository-shell.test.ts`

**Interfaces:**
- Consumes: root frozen install, `check`, and `test:e2e` commands.
- Produces: normal Ubuntu CI and an explicit Ubuntu/macOS release-candidate matrix without model credentials.

- [ ] **Step 1: Extend the repository-shell test to require workflows**

Add assertions that both workflow files exist and contain:

```ts
for (const path of ['.github/workflows/ci.yml', '.github/workflows/release-candidate.yml']) {
  const workflow = readFileSync(join(root, path), 'utf8');
  expect(workflow).toContain('oven-sh/setup-bun@v2');
  expect(workflow).toContain('bun install --frozen-lockfile');
  expect(workflow).toContain('bun run check');
  expect(workflow).toContain('bun run test:e2e');
}
```

- [ ] **Step 2: Verify the workflow contract fails**

Run:

```bash
bun test tests/release/repository-shell.test.ts
```

Expected: FAIL because the workflows do not exist.

- [ ] **Step 3: Add normal Ubuntu CI**

Create `.github/workflows/ci.yml` exactly as follows. It grants only read access and
declares no repository secrets:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14
      - run: bun install --frozen-lockfile
      - run: bun run check
      - run: bunx playwright install --with-deps chromium
      - run: bun run test:e2e
```

- [ ] **Step 4: Add the manual cross-platform candidate workflow**

Create `.github/workflows/release-candidate.yml`:

```yaml
name: Release Candidate

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  verify:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14
      - run: bun install --frozen-lockfile
      - run: bun run check
      - if: runner.os == 'Linux'
        run: bunx playwright install --with-deps chromium
      - if: runner.os == 'macOS'
        run: bunx playwright install chromium
      - run: bun run test:e2e
```

Do not attempt a real-model smoke or publish artifacts from CI.

- [ ] **Step 5: Verify workflow and local contracts**

Run:

```bash
bun test tests/release/repository-shell.test.ts
bun run check
bun run test:e2e
```

Expected: all tests and builds PASS; three Playwright scenarios PASS.

- [ ] **Step 6: Commit CI**

```bash
git add .github/workflows tests/release/repository-shell.test.ts
git commit -m "ci: validate StudyForge public release shell"
```

---

### Task 7: Run the Phase A release-hardening acceptance

**Files:**
- Verify only; modify a file only when a failing check proves a Phase A defect.

**Interfaces:**
- Consumes: all outputs from Tasks 1–6.
- Produces: a clean, reviewable private hardening branch ready for the separate data-sanitization plan.

- [ ] **Step 1: Verify the exact changed-file boundary**

Run:

```bash
git diff --name-status main...HEAD
git status --short
```

Expected: only the files declared by this plan are changed; the isolated worktree is clean. No card YAML, old plugin, audit, or historical spec appears.

- [ ] **Step 2: Reinstall from the root lockfile in a fresh exported tree**

Create a new temporary directory, validate it, and export committed `HEAD` into it without
copying working-tree state or `.git` objects:

```bash
candidate_root=$(mktemp -d)
test -n "$candidate_root"
case "$candidate_root" in
  /tmp/*|/private/tmp/*) ;;
  *) exit 1 ;;
esac
git archive HEAD | tar -x -C "$candidate_root"
cd "$candidate_root"
bun install --frozen-lockfile
```

Expected: install completes from root and does not modify `bun.lock`. Keep the temporary
path for the remaining acceptance commands and report it at handoff; this plan does not
delete it.

- [ ] **Step 3: Run the complete deterministic suite**

Run:

```bash
bun run check
bun run test:e2e
```

Expected: typecheck, release tests, 131 or more App tests, production build, and all three Playwright scenarios PASS.

- [ ] **Step 4: Verify doctor behavior in both output modes**

Run:

```bash
bun run doctor
bun run doctor --json
```

Expected: both modes describe the same seven checks, reveal no credentials or auth paths, and either pass or give a precise local model/port remediation. If the configured environment has GPT OAuth, the model check reports an available provider without exposing token contents.

- [ ] **Step 5: Smoke the real local server**

With port `65000` free and a configured model, run `bun run start:demo` in a terminal. In another terminal verify:

```bash
curl --fail http://127.0.0.1:65000/api/health
curl -i -X POST -H 'Origin: https://attacker.example' http://127.0.0.1:65000/api/plans/plan-001/start
```

Expected: health returns `{ "ok": true, "runtime": "pi-m0" }`; the foreign-Origin POST returns `403` with `ORIGIN_NOT_ALLOWED`. Stop the foreground server normally after verification.

- [ ] **Step 6: Inspect the active product surface**

Run:

```bash
rg -n '/Users/|apps/pi-teaching-web|五条悟|无量空处|六眼|反转术式' README.md README.en.md AGENTS.md apps/studyforge docs/architecture docs/guides docs/vision
rg -n 'private beta evaluation corpus|not licensed under Apache-2.0' examples/derivative-m0/README.md THIRD_PARTY_NOTICES.md
```

Expected: first search has no matches; second search finds both explicit beta-data boundaries.

- [ ] **Step 7: Confirm the work is ready for the next independent plan**

Run:

```bash
git log --oneline main..HEAD
git status --short --branch
```

Expected: focused commits for workspace, Origin policy, persona, doctor, docs/legal shell, and CI; clean status. Do not merge, push, sanitize data, initialize the public Git root, or create a GitHub repository in this task.

---

## Work explicitly deferred to separate approved plans

This plan deliberately stops at a private, hardened product tree. Two later plans own the remaining release work:

1. **Learning-set provenance and sanitization** — decide the fate of every card, solution, rubric, material, image, graph derivative, and source reference; produce an explicitly CC BY 4.0-compatible public demo corpus without reducing private beta coverage first.
2. **Clean export and public cutover** — implement the allowlist exporter and release audit, generate a fresh tree without `.git`, create and verify the new Git root, obtain explicit approval before GitHub creation/push/visibility changes, publish `v0.1.0`, and declare the new repository canonical.

Neither deferred plan may infer that the current 519-card corpus is redistributable merely because Phase A succeeds.
