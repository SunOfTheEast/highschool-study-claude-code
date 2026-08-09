import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  captureM1cSnapshot,
  loadM1cValidationRun,
  M1C_VALIDATION_SCENARIOS,
  prepareM1cValidationRun,
  summarizeM1cEvidence,
  type M1cValidationScenario,
} from './layout';
import { sendRecordedTurn } from './turn-client';

type Flags = ReadonlyMap<string, string>;

function parseFlags(args: string[]): Flags {
  const flags = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`expected --name value near ${name ?? '<end>'}`);
    }
    const key = name.slice(2);
    if (flags.has(key)) throw new Error(`duplicate flag: --${key}`);
    flags.set(key, value);
  }
  return flags;
}

function required(flags: Flags, name: string): string {
  const value = flags.get(name);
  if (!value) throw new Error(`missing required flag: --${name}`);
  return value;
}

function assertOnly(flags: Flags, names: readonly string[]): void {
  const allowed = new Set(names);
  for (const name of flags.keys()) if (!allowed.has(name)) throw new Error(`unsupported flag: --${name}`);
}

function scenario(value: string): M1cValidationScenario {
  if ((M1C_VALIDATION_SCENARIOS as readonly string[]).includes(value)) {
    return value as M1cValidationScenario;
  }
  throw new Error(`unknown M1c scenario: ${value}`);
}

function git(root: string): { commit: string; dirty: boolean } {
  const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root });
  const status = Bun.spawnSync(['git', 'status', '--short'], { cwd: root });
  if (head.exitCode !== 0 || status.exitCode !== 0) throw new Error('cannot read frozen git identity');
  return {
    commit: head.stdout.toString().trim(),
    dirty: status.stdout.toString().trim().length > 0,
  };
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function runM1cValidationCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command) throw new Error('expected command: prepare, turn, snapshot, or summarize');
  const flags = parseFlags(rest);

  if (command === 'prepare') {
    assertOnly(flags, [
      'output', 'blank-seed', 'course-seed', 'agent-config-source', 'scout-source',
      'git-root', 'provider', 'main-model', 'main-thinking', 'scout-model',
      'scout-thinking', 'scenario',
    ]);
    if (required(flags, 'main-thinking') !== 'high' || required(flags, 'scout-thinking') !== 'high') {
      throw new Error('M1c validation requires high thinking');
    }
    if (required(flags, 'scenario') !== 'all') throw new Error('--scenario must be all');
    const identity = git(resolve(required(flags, 'git-root')));
    const layout = prepareM1cValidationRun({
      output: required(flags, 'output'),
      blankSeed: required(flags, 'blank-seed'),
      courseSeed: required(flags, 'course-seed'),
      agentConfigSource: required(flags, 'agent-config-source'),
      scoutSource: required(flags, 'scout-source'),
      gitCommit: identity.commit,
      gitDirty: identity.dirty,
      provider: required(flags, 'provider'),
      mainModel: required(flags, 'main-model'),
      mainThinking: 'high',
      scoutModel: required(flags, 'scout-model'),
      scoutThinking: 'high',
      scenario: 'all',
    });
    output(JSON.parse(await Bun.file(layout.manifestPath).text()));
    return;
  }

  if (command === 'turn') {
    assertOnly(flags, ['output', 'scenario', 'base-url', 'session-key', 'message', 'label']);
    const layout = loadM1cValidationRun(required(flags, 'output'));
    const selected = scenario(required(flags, 'scenario'));
    const label = required(flags, 'label');
    const turn = await sendRecordedTurn({
      baseUrl: required(flags, 'base-url'),
      sessionKey: required(flags, 'session-key'),
      message: required(flags, 'message'),
      eventLogPath: join(layout.scenarios[selected].events, `${label}.jsonl`),
      turnPath: join(layout.scenarios[selected].turns, `${label}.json`),
    });
    output({
      sessionKey: turn.sessionKey,
      firstVisibleDelayMs: turn.firstVisibleAt === null ? null : turn.firstVisibleAt - turn.startedAt,
      settledDelayMs: turn.settledAt - turn.startedAt,
      history: turn.history,
    });
    return;
  }

  if (command === 'snapshot') {
    assertOnly(flags, ['output', 'scenario', 'label']);
    output(captureM1cSnapshot(
      loadM1cValidationRun(required(flags, 'output')),
      scenario(required(flags, 'scenario')),
      required(flags, 'label'),
    ));
    return;
  }

  if (command === 'summarize') {
    assertOnly(flags, ['output']);
    const layout = loadM1cValidationRun(required(flags, 'output'));
    const summaries = Object.fromEntries(M1C_VALIDATION_SCENARIOS.map((name) => [
      name,
      summarizeM1cEvidence(layout.scenarios[name].agentDir, layout.scenarios[name].learningSet),
    ]));
    const path = join(layout.root, 'evidence-summary.json');
    writeFileSync(path, `${JSON.stringify(summaries, null, 2)}\n`, { mode: 0o600 });
    output({ path, summaries });
    return;
  }

  throw new Error(`unknown M1c validation command: ${command}`);
}

if (import.meta.main) {
  try {
    await runM1cValidationCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
