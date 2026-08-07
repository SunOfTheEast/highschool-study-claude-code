import { readFileSync } from 'node:fs';
import {
  captureLearningSetSnapshot,
  loadValidationRunLayout,
  prepareValidationRun,
  type ValidationArm,
} from './layout';
import { sendObservedTurn } from './turn-client';

type Flags = ReadonlyMap<string, string>;

function parseFlags(args: string[]): Flags {
  const result = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || name.length === 2 || value === undefined || value.startsWith('--')) {
      throw new Error(`expected named flag and value near ${name ?? '<end>'}`);
    }
    const key = name.slice(2);
    if (result.has(key)) throw new Error(`duplicate flag: --${key}`);
    result.set(key, value);
  }
  return result;
}

function required(flags: Flags, name: string): string {
  const value = flags.get(name);
  if (!value) throw new Error(`missing required flag: --${name}`);
  return value;
}

function assertOnly(flags: Flags, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const name of flags.keys()) {
    if (!allowedSet.has(name)) throw new Error(`unsupported flag: --${name}`);
  }
}

function armFlag(value: string): ValidationArm {
  if (value === 'm0' || value === 'm1a') return value;
  throw new Error('--arm must be m0 or m1a');
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function runValidationCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command) throw new Error('expected command: prepare, snapshot, or turn');
  const flags = parseFlags(rest);

  if (command === 'prepare') {
    assertOnly(flags, [
      'run-root',
      'seed',
      'agent-config-source',
      'm0-scout',
      'm1a-scout',
    ]);
    const layout = prepareValidationRun({
      runRoot: required(flags, 'run-root'),
      seedLearningSet: required(flags, 'seed'),
      agentConfigSource: required(flags, 'agent-config-source'),
      m0ScoutSource: required(flags, 'm0-scout'),
      m1aScoutSource: required(flags, 'm1a-scout'),
    });
    output(JSON.parse(readFileSync(layout.manifestPath, 'utf8')));
    return;
  }

  if (command === 'snapshot') {
    assertOnly(flags, ['run-root', 'arm', 'label']);
    const layout = loadValidationRunLayout(required(flags, 'run-root'));
    output(captureLearningSetSnapshot(
      layout,
      armFlag(required(flags, 'arm')),
      required(flags, 'label'),
    ));
    return;
  }

  if (command === 'turn') {
    assertOnly(flags, ['base-url', 'session-key', 'message', 'event-log']);
    const turn = await sendObservedTurn({
      baseUrl: required(flags, 'base-url'),
      sessionKey: required(flags, 'session-key'),
      message: required(flags, 'message'),
      eventLogPath: required(flags, 'event-log'),
    });
    output({
      sessionKey: turn.sessionKey,
      startedAt: turn.startedAt,
      firstVisibleAt: turn.firstVisibleAt,
      settledAt: turn.settledAt,
      history: turn.history,
    });
    return;
  }

  throw new Error(`unknown validation command: ${command}`);
}

if (import.meta.main) {
  try {
    await runValidationCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
