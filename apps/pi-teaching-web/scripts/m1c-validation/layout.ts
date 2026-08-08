import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const M1C_VALIDATION_SCENARIOS = ['material', 'blank', 'course'] as const;
export type M1cValidationScenario = typeof M1C_VALIDATION_SCENARIOS[number];

export type M1cScenarioLayout = {
  learningSet: string;
  agentDir: string;
  logs: string;
  events: string;
  turns: string;
  snapshots: string;
};

export type M1cValidationLayout = {
  root: string;
  manifestPath: string;
  scenarios: Record<M1cValidationScenario, M1cScenarioLayout>;
};

export type M1cSnapshot = {
  scenario: M1cValidationScenario;
  label: string;
  path: string;
  capturedAt: string;
  treeHash: string;
};

export type M1cEvidenceSummary = {
  sessionFiles: string[];
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
    totalTokens: number;
  };
  toolCalls: Array<{ name: string; count: number }>;
  canonicalFiles: string[];
  unreadableSessionLines: number;
};

export type PrepareM1cValidationInput = {
  output: string;
  blankSeed: string;
  courseSeed: string;
  agentConfigSource: string;
  scoutSource: string;
  gitCommit: string;
  gitDirty: boolean;
  provider: string;
  mainModel: string;
  mainThinking: 'high';
  scoutModel: string;
  scoutThinking: 'high';
  scenario: 'all';
};

const RUN_PREFIX = 'studyforge-m1c-validation-';
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

function plainDirectory(path: string, label: string): string {
  if (!existsSync(path)) throw new Error(`${label} does not exist: ${path}`);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`${label} must be a plain directory: ${path}`);
  }
  return realpathSync(path);
}

function plainFile(path: string, label: string): string {
  if (!existsSync(path)) throw new Error(`${label} does not exist: ${path}`);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} must be a plain file: ${path}`);
  }
  return realpathSync(path);
}

function validationRoot(path: string, empty: boolean): string {
  if (!isAbsolute(path)) throw new Error('M1c validation output must be absolute');
  const resolved = resolve(path);
  if (!basename(resolved).startsWith(RUN_PREFIX)) {
    throw new Error(`M1c validation output basename must begin ${RUN_PREFIX}`);
  }
  if (dirname(resolved) !== realpathSync('/tmp')) {
    throw new Error('M1c validation output must be a direct child of /tmp');
  }
  if (existsSync(resolved)) {
    const canonical = plainDirectory(resolved, 'M1c validation output');
    if (empty && readdirSync(canonical).length > 0) {
      throw new Error('M1c validation output must be empty');
    }
    return canonical;
  }
  if (!empty) throw new Error(`M1c validation output does not exist: ${resolved}`);
  mkdirSync(resolved);
  return realpathSync(resolved);
}

function inside(root: string, target: string): void {
  const rel = relative(root, target);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`target escapes validation output: ${target}`);
  }
}

function copyPlainTree(source: string, destination: string): void {
  const sourceRoot = plainDirectory(source, 'copy source');
  if (existsSync(destination)) throw new Error(`copy destination exists: ${destination}`);
  mkdirSync(destination);
  const visit = (from: string, to: string): void => {
    for (const entry of readdirSync(from, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const sourcePath = join(from, entry.name);
      const destinationPath = join(to, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`copy source contains symlink: ${sourcePath}`);
      if (entry.isDirectory()) {
        mkdirSync(destinationPath);
        visit(sourcePath, destinationPath);
      } else if (entry.isFile()) {
        copyFileSync(sourcePath, destinationPath);
      } else {
        throw new Error(`copy source contains unsupported entry: ${sourcePath}`);
      }
    }
  };
  visit(sourceRoot, destination);
}

function hashTree(root: string): string {
  const base = plainDirectory(root, 'hash root');
  const hash = createHash('sha256');
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      const rel = relative(base, path).split(sep).join('/');
      if (entry.isSymbolicLink()) throw new Error(`hash root contains symlink: ${path}`);
      if (entry.isDirectory()) {
        hash.update(`directory\0${rel}\0`);
        visit(path);
      } else if (entry.isFile()) {
        hash.update(`file\0${rel}\0`);
        hash.update(readFileSync(path));
        hash.update('\0');
      }
    }
  };
  visit(base);
  return hash.digest('hex');
}

function pinScout(sourcePath: string, provider: string, model: string, thinking: 'high'): string {
  const lines = readFileSync(plainFile(sourcePath, 'Scout source'), 'utf8').split('\n');
  if (lines[0] !== '---') throw new Error('Scout source must begin with frontmatter');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error('Scout frontmatter is not closed');
  const frontmatter = lines.slice(1, end)
    .filter((line) => !/^\s*(?:model|thinking)\s*:/.test(line));
  const description = frontmatter.findIndex((line) => /^\s*description\s*:/.test(line));
  frontmatter.splice(description < 0 ? frontmatter.length : description + 1, 0,
    `model: ${provider}/${model}`, `thinking: ${thinking}`);
  return ['---', ...frontmatter, '---', ...lines.slice(end + 1)].join('\n');
}

function configureAgent(
  destination: string,
  source: string,
  scoutSource: string,
  model: { provider: string; main: string; mainThinking: 'high'; scout: string; scoutThinking: 'high' },
): void {
  const config = plainDirectory(source, 'Pi agent configuration source');
  mkdirSync(destination);
  copyFileSync(plainFile(join(config, 'auth.json'), 'Pi auth source'), join(destination, 'auth.json'));
  chmodSync(join(destination, 'auth.json'), 0o600);
  const modelStore = join(config, 'models-store.json');
  if (existsSync(modelStore)) copyFileSync(plainFile(modelStore, 'Pi model store'), join(destination, 'models-store.json'));
  writeFileSync(join(destination, 'settings.json'), `${JSON.stringify({
    defaultProvider: model.provider,
    defaultModel: model.main,
    defaultThinkingLevel: model.mainThinking,
  }, null, 2)}\n`, { mode: 0o600 });
  mkdirSync(join(destination, 'agents'));
  writeFileSync(
    join(destination, 'agents/study-material-scout.md'),
    pinScout(scoutSource, model.provider, model.scout, model.scoutThinking),
    { mode: 0o600 },
  );
}

function scenarioLayout(root: string, scenario: M1cValidationScenario): M1cScenarioLayout {
  const base = join(root, 'scenarios', scenario);
  const layout = {
    learningSet: join(base, 'learning-set'),
    agentDir: join(base, 'pi-agent'),
    logs: join(base, 'logs'),
    events: join(base, 'events'),
    turns: join(base, 'turns'),
    snapshots: join(base, 'snapshots'),
  };
  for (const path of Object.values(layout)) inside(root, path);
  return layout;
}

export function prepareM1cValidationRun(input: PrepareM1cValidationInput): M1cValidationLayout {
  if (input.scenario !== 'all') throw new Error('M1c validation currently requires scenario=all');
  if (input.mainThinking !== 'high' || input.scoutThinking !== 'high') {
    throw new Error('M1c validation requires high thinking for both models');
  }
  const root = validationRoot(input.output, true);
  mkdirSync(join(root, 'scenarios'));
  const scenarios = Object.fromEntries(M1C_VALIDATION_SCENARIOS.map((scenario) => [
    scenario,
    scenarioLayout(root, scenario),
  ])) as Record<M1cValidationScenario, M1cScenarioLayout>;
  const model = {
    provider: input.provider,
    main: input.mainModel,
    mainThinking: input.mainThinking,
    scout: input.scoutModel,
    scoutThinking: input.scoutThinking,
  };
  for (const scenario of M1C_VALIDATION_SCENARIOS) {
    const layout = scenarios[scenario];
    mkdirSync(dirname(layout.learningSet));
    copyPlainTree(scenario === 'course' ? input.courseSeed : input.blankSeed, layout.learningSet);
    configureAgent(layout.agentDir, input.agentConfigSource, input.scoutSource, model);
    mkdirSync(layout.logs);
    mkdirSync(layout.events);
    mkdirSync(layout.turns);
    mkdirSync(layout.snapshots);
  }
  const layout: M1cValidationLayout = {
    root,
    manifestPath: join(root, 'manifest.json'),
    scenarios,
  };
  writeFileSync(layout.manifestPath, `${JSON.stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    git: { commit: input.gitCommit, dirty: input.gitDirty },
    models: model,
    scenario: input.scenario,
    sources: {
      blankSeed: realpathSync(input.blankSeed),
      courseSeed: realpathSync(input.courseSeed),
      scout: realpathSync(input.scoutSource),
    },
    layout,
  }, null, 2)}\n`, { mode: 0o600 });
  return layout;
}

export function loadM1cValidationRun(output: string): M1cValidationLayout {
  const root = validationRoot(output, false);
  const manifestPath = plainFile(join(root, 'manifest.json'), 'M1c validation manifest');
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    version?: unknown;
    layout?: M1cValidationLayout;
  };
  if (parsed.version !== 1 || !parsed.layout || parsed.layout.root !== root) {
    throw new Error('M1c validation manifest is invalid');
  }
  for (const scenario of M1C_VALIDATION_SCENARIOS) {
    for (const path of Object.values(parsed.layout.scenarios[scenario])) inside(root, path);
  }
  return parsed.layout;
}

export function captureM1cSnapshot(
  layout: M1cValidationLayout,
  scenario: M1cValidationScenario,
  label: string,
): M1cSnapshot {
  if (!LABEL.test(label)) throw new Error(`invalid M1c snapshot label: ${label}`);
  const target = join(layout.scenarios[scenario].snapshots, label);
  inside(layout.root, target);
  mkdirSync(target);
  const snapshotPath = join(target, 'learning-set');
  copyPlainTree(layout.scenarios[scenario].learningSet, snapshotPath);
  const record = {
    scenario,
    label,
    path: snapshotPath,
    capturedAt: new Date().toISOString(),
    treeHash: hashTree(snapshotPath),
  } satisfies M1cSnapshot;
  writeFileSync(join(target, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  const base = plainDirectory(root, 'inventory root');
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`inventory contains symlink: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) result.push(relative(base, path).split(sep).join('/'));
    }
  };
  visit(base);
  return result.sort();
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function summarizeM1cEvidence(agentDir: string, learningSet: string): M1cEvidenceSummary {
  const sessionFiles = files(agentDir).filter((path) => path.endsWith('.jsonl'));
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0 };
  const tools = new Map<string, number>();
  let unreadableSessionLines = 0;
  for (const relativePath of sessionFiles) {
    for (const line of readFileSync(join(agentDir, relativePath), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(line) as Record<string, unknown>;
      } catch {
        unreadableSessionLines += 1;
        continue;
      }
      const message = value.message && typeof value.message === 'object'
        ? value.message as Record<string, unknown>
        : null;
      const nativeUsage = message?.usage && typeof message.usage === 'object'
        ? message.usage as Record<string, unknown>
        : null;
      if (nativeUsage) {
        usage.input += number(nativeUsage.input);
        usage.output += number(nativeUsage.output);
        usage.cacheRead += number(nativeUsage.cacheRead);
        usage.cacheWrite += number(nativeUsage.cacheWrite);
        usage.reasoning += number(nativeUsage.reasoning);
        usage.totalTokens += number(nativeUsage.totalTokens);
      }
      if (!Array.isArray(message?.content)) continue;
      for (const item of message.content) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const content = item as Record<string, unknown>;
        if (content.type !== 'toolCall' || typeof content.name !== 'string') continue;
        tools.set(content.name, (tools.get(content.name) ?? 0) + 1);
      }
    }
  }
  const canonicalFiles = files(learningSet).filter((path) => (
    !path.startsWith('semantics/indexes/')
    && !/^materials\/[^/]+\/projections\//.test(path)
    && !path.startsWith('.studyforge-transactions/')
  ));
  return {
    sessionFiles,
    usage,
    toolCalls: [...tools].sort(([left], [right]) => left.localeCompare(right))
      .map(([name, count]) => ({ name, count })),
    canonicalFiles,
    unreadableSessionLines,
  };
}
