import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { sendObservedTurn } from '../m1a-validation/turn-client';
import {
  M2_VALIDATION_SCENARIOS,
  m2ValidationScenario,
  type M2ValidationScenarioId,
} from './scenarios';

export type LearningSetState = {
  root: string;
  digest: string;
  fileCount: number;
  files: Record<string, string>;
};

export type LearningSetDiff = {
  created: string[];
  modified: string[];
  deleted: string[];
};

export type M2ValidationArguments = {
  root: string;
  apiBase: string;
  scenario: M2ValidationScenarioId | null;
  sessionKey: string | null;
  message: string | null;
  output: string | null;
  label: string | null;
  tokenEnv: string | null;
  dryRun: boolean;
};

function plainRoot(path: string): string {
  if (!isAbsolute(path)) throw new Error('M2_VALIDATION_ROOT_INVALID');
  const root = resolve(path);
  if (!existsSync(root)) throw new Error('M2_VALIDATION_ROOT_NOT_FOUND');
  const metadata = lstatSync(root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error('M2_VALIDATION_ROOT_INVALID');
  }
  return root;
}

function apiBase(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('M2_VALIDATION_API_BASE_INVALID');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || !url.port
    || url.username
    || url.password
    || url.search
    || url.hash
  ) throw new Error('M2_VALIDATION_API_BASE_INVALID');
  url.pathname = '/';
  return url.toString();
}

function flags(argv: string[]): Map<string, string> {
  if (argv.length % 2 !== 0) throw new Error('M2_VALIDATION_ARGUMENTS_INVALID');
  const parsed = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]!;
    const value = argv[index + 1]!;
    if (!name.startsWith('--') || value.startsWith('--')) {
      throw new Error('M2_VALIDATION_ARGUMENTS_INVALID');
    }
    const key = name.slice(2);
    if (parsed.has(key)) throw new Error(`M2_VALIDATION_ARGUMENT_DUPLICATE: ${key}`);
    parsed.set(key, value);
  }
  return parsed;
}

export function parseM2ValidationArguments(argv: string[]): M2ValidationArguments {
  const parsed = flags(argv);
  const allowed = new Set([
    'root', 'api-base', 'scenario', 'session-key', 'message', 'output', 'label',
    'token-env', 'dry-run',
  ]);
  for (const key of parsed.keys()) {
    if (!allowed.has(key)) throw new Error(`M2_VALIDATION_ARGUMENT_UNSUPPORTED: ${key}`);
  }
  const root = parsed.get('root');
  const endpoint = parsed.get('api-base');
  if (!root || !endpoint) throw new Error('M2_VALIDATION_ARGUMENTS_REQUIRED');
  const scenarioValue = parsed.get('scenario') ?? null;
  const scenario = scenarioValue
    ? m2ValidationScenario(scenarioValue).id
    : null;
  const dryValue = parsed.get('dry-run') ?? 'false';
  if (dryValue !== 'true' && dryValue !== 'false') throw new Error('M2_VALIDATION_DRY_RUN_INVALID');
  const sessionKey = parsed.get('session-key') ?? null;
  const message = parsed.get('message') ?? null;
  if ((sessionKey === null) !== (message === null)) {
    throw new Error('M2_VALIDATION_TURN_INCOMPLETE');
  }
  if (sessionKey && !scenario) throw new Error('M2_VALIDATION_SCENARIO_REQUIRED');
  const output = parsed.get('output') ?? null;
  if (output !== null && !isAbsolute(output)) throw new Error('M2_VALIDATION_OUTPUT_INVALID');
  const label = parsed.get('label') ?? null;
  if (label !== null && !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(label)) {
    throw new Error('M2_VALIDATION_LABEL_INVALID');
  }
  const tokenEnv = parsed.get('token-env') ?? null;
  if (tokenEnv !== null && !/^[A-Z][A-Z0-9_]*$/.test(tokenEnv)) {
    throw new Error('M2_VALIDATION_TOKEN_ENV_INVALID');
  }
  return {
    root: plainRoot(root),
    apiBase: apiBase(endpoint),
    scenario,
    sessionKey,
    message,
    output: output ? resolve(output) : null,
    label,
    tokenEnv,
    dryRun: dryValue === 'true',
  };
}

function walkFiles(root: string): Array<{ path: string; hash: string }> {
  const result: Array<{ key: string; path: string }> = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`M2_VALIDATION_SYMLINK_UNSUPPORTED: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        const key = relative(root, path).split(sep).join('/');
        result.push({ key, path });
      }
    }
  };
  visit(root);
  return result.map((file) => ({
    path: file.key,
    hash: createHash('sha256').update(readFileSync(file.path)).digest('hex'),
  }));
}

export function captureLearningSetState(path: string): LearningSetState {
  const root = plainRoot(path);
  const entries = walkFiles(root);
  const digest = createHash('sha256');
  for (const entry of entries) digest.update(`${entry.path}\0${entry.hash}\0`);
  return {
    root,
    digest: digest.digest('hex'),
    fileCount: entries.length,
    files: Object.fromEntries(entries.map((entry) => [entry.path, entry.hash])),
  };
}

export function diffLearningSetState(
  before: LearningSetState,
  after: LearningSetState,
): LearningSetDiff {
  if (before.root !== after.root) throw new Error('M2_VALIDATION_DIFF_ROOT_MISMATCH');
  const beforePaths = new Set(Object.keys(before.files));
  const afterPaths = new Set(Object.keys(after.files));
  return {
    created: [...afterPaths].filter((path) => !beforePaths.has(path)).sort(),
    modified: [...afterPaths].filter((path) => (
      beforePaths.has(path) && before.files[path] !== after.files[path]
    )).sort(),
    deleted: [...beforePaths].filter((path) => !afterPaths.has(path)).sort(),
  };
}

function outputDirectory(path: string | null): string {
  if (path === null) return mkdtempSync(join(tmpdir(), 'studyforge-m2-validation-'));
  if (!existsSync(path)) mkdirSync(path, { recursive: true, mode: 0o700 });
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error('M2_VALIDATION_OUTPUT_INVALID');
  }
  return path;
}

async function health(endpoint: string, token: string | null): Promise<unknown> {
  const response = await fetch(
    new URL('api/health', endpoint),
    token ? { headers: { authorization: `Bearer ${token}` } } : undefined,
  );
  if (!response.ok) throw new Error(`M2_VALIDATION_HEALTH_FAILED: ${response.status}`);
  return response.json();
}

function publicActions(history: unknown[]): Array<{ name: string; status: string }> {
  return history.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    if (value.kind === 'tool' && typeof value.name === 'string') {
      return [{ name: value.name, status: String(value.status ?? 'unknown') }];
    }
    if (value.kind === 'learning-asset-proposal') {
      return [{
        name: value.assetKind === 'note' ? 'propose_note' : 'propose_problem_card',
        status: String(value.status ?? 'shown'),
      }];
    }
    if (value.kind === 'learning-asset-saved') {
      return [{ name: `save_${String(value.assetKind)}`, status: String(value.status ?? 'unknown') }];
    }
    const named = new Map([
      ['paper-research', 'paper_research'],
      ['peer', 'ask_peer'],
      ['material-search', 'material_scout'],
      ['lesson-review', 'lesson_reviewer'],
      ['lesson-handout', 'artifact_export'],
      ['focus-marker', 'focus_cycle'],
    ]);
    const name = named.get(String(value.kind));
    return name ? [{ name, status: String(value.status ?? value.phase ?? 'observed') }] : [];
  });
}

function publicState(state: LearningSetState) {
  return { digest: state.digest, fileCount: state.fileCount };
}

export async function runM2Validation(arguments_: M2ValidationArguments): Promise<{
  output: string;
  reportPath: string;
  report: Record<string, unknown>;
}> {
  const output = outputDirectory(arguments_.output);
  const label = arguments_.label ?? `${arguments_.scenario ?? 'preflight'}-${Date.now()}`;
  const reportPath = join(output, `${label}.json`);
  if (existsSync(reportPath)) throw new Error('M2_VALIDATION_REPORT_EXISTS');
  const token = arguments_.tokenEnv ? process.env[arguments_.tokenEnv] ?? null : null;
  if (arguments_.tokenEnv && !token) throw new Error('M2_VALIDATION_TOKEN_MISSING');
  const before = captureLearningSetState(arguments_.root);
  const common = {
    version: 1,
    mode: arguments_.dryRun ? 'dry-run' : arguments_.sessionKey ? 'turn' : 'preflight',
    createdAt: new Date().toISOString(),
    root: arguments_.root,
    apiBase: arguments_.apiBase,
    scenario: arguments_.scenario ? m2ValidationScenario(arguments_.scenario) : null,
    scenarioCatalog: arguments_.scenario ? undefined : M2_VALIDATION_SCENARIOS,
    before: publicState(before),
  };
  let report: Record<string, unknown>;
  if (arguments_.dryRun) {
    report = { ...common, connected: false, changed: { created: [], modified: [], deleted: [] } };
  } else {
    const healthResult = await health(arguments_.apiBase, token);
    if (arguments_.sessionKey && arguments_.message) {
      const turn = await sendObservedTurn({
        baseUrl: arguments_.apiBase,
        sessionKey: arguments_.sessionKey,
        message: arguments_.message,
        eventLogPath: join(output, `${label}.events.jsonl`),
        ...(token ? { token } : {}),
      });
      const after = captureLearningSetState(arguments_.root);
      report = {
        ...common,
        connected: true,
        health: healthResult,
        sessionKey: turn.sessionKey,
        studentMessage: arguments_.message,
        firstVisibleDelayMs: turn.firstVisibleAt === null ? null : turn.firstVisibleAt - turn.startedAt,
        settledDelayMs: turn.settledAt - turn.startedAt,
        publicActions: publicActions(turn.history),
        projectedHistory: turn.history,
        after: publicState(after),
        changed: diffLearningSetState(before, after),
      };
    } else {
      report = {
        ...common,
        connected: true,
        health: healthResult,
        changed: { created: [], modified: [], deleted: [] },
      };
    }
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return { output, reportPath, report };
}

export async function runM2ValidationCli(argv: string[]): Promise<void> {
  const result = await runM2Validation(parseM2ValidationArguments(argv));
  process.stdout.write(`${JSON.stringify({
    output: result.output,
    reportPath: result.reportPath,
    mode: result.report.mode,
    firstVisibleDelayMs: result.report.firstVisibleDelayMs ?? null,
    settledDelayMs: result.report.settledDelayMs ?? null,
    publicActions: result.report.publicActions ?? [],
    changed: result.report.changed,
  }, null, 2)}\n`);
}

if (import.meta.main) {
  try {
    await runM2ValidationCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
