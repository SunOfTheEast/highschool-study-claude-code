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
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

export type ValidationArm = 'm0' | 'm1a';

export type ArmLayout = {
  learningSet: string;
  agentDir: string;
  logs: string;
  events: string;
  turns: string;
  snapshots: string;
};

export type ValidationRunLayout = {
  root: string;
  manifestPath: string;
  m0: ArmLayout;
  m1a: ArmLayout;
};

export type SnapshotRecord = {
  arm: ValidationArm;
  label: string;
  path: string;
  capturedAt: string;
  treeHash: string;
};

type PrepareValidationRunOptions = {
  runRoot: string;
  seedLearningSet: string;
  agentConfigSource: string;
  m0ScoutSource: string;
  m1aScoutSource: string;
};

type ValidationManifest = {
  version: 1;
  createdAt: string;
  layout: ValidationRunLayout;
  sources: {
    seedLearningSet: string;
    agentConfigSource: string;
    m0ScoutSource: string;
    m1aScoutSource: string;
  };
  models: {
    parent: string;
    parentThinking: 'high';
    scout: string;
    scoutThinking: 'high';
  };
  hashes: {
    seedLearningSet: string;
    m0Scout: string;
    m1aScout: string;
  };
};

const RUN_PREFIX = 'studyforge-m1a-validation-';
const SNAPSHOT_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

function canonicalTmp(): string {
  return realpathSync(tmpdir());
}

function assertPlainDirectory(path: string, description: string): string {
  if (!existsSync(path)) throw new Error(`${description} does not exist: ${path}`);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`${description} must be a plain directory: ${path}`);
  }
  return realpathSync(path);
}

function assertPlainFile(path: string, description: string): string {
  if (!existsSync(path)) throw new Error(`${description} does not exist: ${path}`);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${description} must be a plain file: ${path}`);
  }
  return realpathSync(path);
}

export function assertDedicatedRunRoot(path: string): string {
  if (!isAbsolute(path)) throw new Error('validation run root must be absolute');

  const resolved = resolve(path);
  if (!basename(resolved).startsWith(RUN_PREFIX)) {
    throw new Error(`validation run root basename must begin ${RUN_PREFIX}`);
  }

  const parent = assertPlainDirectory(dirname(resolved), 'validation run parent');
  if (parent !== canonicalTmp()) {
    throw new Error('validation run root must be a direct child of the system temporary directory');
  }

  if (existsSync(resolved)) {
    const metadata = lstatSync(resolved);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error('validation run root must be a plain directory');
    }
    if (readdirSync(resolved).length > 0) {
      throw new Error('validation run root must be empty');
    }
    return realpathSync(resolved);
  }

  return join(parent, basename(resolved));
}

function assertPreparedRunRoot(path: string): string {
  if (!isAbsolute(path)) throw new Error('prepared validation run root must be absolute');
  const resolved = resolve(path);
  if (!basename(resolved).startsWith(RUN_PREFIX)) {
    throw new Error(`prepared validation run root basename must begin ${RUN_PREFIX}`);
  }
  const metadata = lstatSync(resolved);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error('prepared validation run root must be a plain directory');
  }
  const canonical = realpathSync(resolved);
  if (dirname(canonical) !== canonicalTmp()) {
    throw new Error('prepared validation run root must be a direct child of the system temporary directory');
  }
  return canonical;
}

function ensureInside(root: string, target: string): void {
  const rel = relative(root, target);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`target escapes owned root: ${target}`);
  }
}

function copyPlainTree(
  source: string,
  destination: string,
  include: (relativePath: string) => boolean = () => true,
): void {
  const sourceRoot = assertPlainDirectory(source, 'copy source');
  if (existsSync(destination)) throw new Error(`copy destination already exists: ${destination}`);
  mkdirSync(destination, { recursive: false });

  const visit = (currentSource: string, currentDestination: string): void => {
    const entries = readdirSync(currentSource, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const sourcePath = join(currentSource, entry.name);
      const relativePath = relative(sourceRoot, sourcePath);
      if (!include(relativePath)) continue;
      if (entry.isSymbolicLink()) throw new Error(`copy source contains a symbolic link: ${sourcePath}`);
      const destinationPath = join(currentDestination, entry.name);
      if (entry.isDirectory()) {
        mkdirSync(destinationPath);
        visit(sourcePath, destinationPath);
      } else if (entry.isFile()) {
        copyFileSync(sourcePath, destinationPath);
      } else {
        throw new Error(`copy source contains an unsupported entry: ${sourcePath}`);
      }
    }
  };

  visit(sourceRoot, destination);
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function hashPlainTree(root: string): string {
  const canonicalRoot = assertPlainDirectory(root, 'hash root');
  const hash = createHash('sha256');

  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`hash root contains a symbolic link: ${path}`);
      const relativePath = relative(canonicalRoot, path).split(sep).join('/');
      if (entry.isDirectory()) {
        hash.update(`directory\0${relativePath}\0`);
        visit(path);
      } else if (entry.isFile()) {
        hash.update(`file\0${relativePath}\0`);
        hash.update(readFileSync(path));
        hash.update('\0');
      } else {
        throw new Error(`hash root contains an unsupported entry: ${path}`);
      }
    }
  };

  visit(canonicalRoot);
  return hash.digest('hex');
}

function createArmLayout(root: string, arm: ValidationArm): ArmLayout {
  const armRoot = join(root, 'arms', arm);
  const layout: ArmLayout = {
    learningSet: join(armRoot, 'learning-set'),
    agentDir: join(armRoot, 'pi-agent'),
    logs: join(armRoot, 'logs'),
    events: join(armRoot, 'events'),
    turns: join(armRoot, 'turns'),
    snapshots: join(armRoot, 'snapshots'),
  };
  for (const path of Object.values(layout)) ensureInside(root, path);
  return layout;
}

function pinScout(sourcePath: string): string {
  const source = readFileSync(assertPlainFile(sourcePath, 'Scout source'), 'utf8');
  const lines = source.split('\n');
  if (lines[0] !== '---') throw new Error('Scout source must begin with YAML frontmatter');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error('Scout source frontmatter is not closed');

  const frontmatter = lines.slice(1, end)
    .filter((line) => !/^\s*(?:model|thinking)\s*:/.test(line));
  const descriptionIndex = frontmatter.findIndex((line) => /^\s*description\s*:/.test(line));
  const insertionIndex = descriptionIndex >= 0 ? descriptionIndex + 1 : frontmatter.length;
  frontmatter.splice(
    insertionIndex,
    0,
    'model: openai-codex/gpt-5.6-terra',
    'thinking: high',
  );

  return ['---', ...frontmatter, '---', ...lines.slice(end + 1)].join('\n');
}

function writeAgentConfiguration(
  agentDir: string,
  agentConfigSource: string,
  scoutSource: string,
): void {
  const configSource = assertPlainDirectory(agentConfigSource, 'Pi agent configuration source');
  const authSource = assertPlainFile(join(configSource, 'auth.json'), 'Pi auth source');
  mkdirSync(join(agentDir, 'agents'), { recursive: true });

  const authDestination = join(agentDir, 'auth.json');
  copyFileSync(authSource, authDestination);
  chmodSync(authDestination, 0o600);

  const modelsSource = join(configSource, 'models-store.json');
  if (existsSync(modelsSource)) {
    copyFileSync(assertPlainFile(modelsSource, 'Pi model store'), join(agentDir, 'models-store.json'));
  }

  const settingsPath = join(agentDir, 'settings.json');
  writeFileSync(settingsPath, `${JSON.stringify({
    defaultProvider: 'openai-codex',
    defaultModel: 'gpt-5.6-sol',
    defaultThinkingLevel: 'high',
  }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(settingsPath, 0o600);

  const scoutDestination = join(agentDir, 'agents/study-material-scout.md');
  writeFileSync(scoutDestination, pinScout(scoutSource), { mode: 0o600 });
  chmodSync(scoutDestination, 0o600);
}

export function prepareValidationRun(options: PrepareValidationRunOptions): ValidationRunLayout {
  const root = assertDedicatedRunRoot(options.runRoot);
  const seedLearningSet = assertPlainDirectory(options.seedLearningSet, 'seed learning set');
  const agentConfigSource = assertPlainDirectory(
    options.agentConfigSource,
    'Pi agent configuration source',
  );
  const m0ScoutSource = assertPlainFile(options.m0ScoutSource, 'M0 Scout source');
  const m1aScoutSource = assertPlainFile(options.m1aScoutSource, 'M1a Scout source');

  if (!existsSync(root)) mkdirSync(root);
  mkdirSync(join(root, 'arms'));
  const layout: ValidationRunLayout = {
    root,
    manifestPath: join(root, 'manifest.json'),
    m0: createArmLayout(root, 'm0'),
    m1a: createArmLayout(root, 'm1a'),
  };

  for (const [arm, armLayout] of Object.entries({ m0: layout.m0, m1a: layout.m1a })) {
    const armRoot = dirname(armLayout.learningSet);
    mkdirSync(armRoot);
    copyPlainTree(
      seedLearningSet,
      armLayout.learningSet,
      arm === 'm0'
        ? (relativePath) => relativePath.split(sep)[0] !== 'memory'
        : undefined,
    );
    mkdirSync(armLayout.agentDir);
    mkdirSync(armLayout.logs);
    mkdirSync(armLayout.events);
    mkdirSync(armLayout.turns);
    mkdirSync(armLayout.snapshots);
  }

  writeAgentConfiguration(layout.m0.agentDir, agentConfigSource, m0ScoutSource);
  writeAgentConfiguration(layout.m1a.agentDir, agentConfigSource, m1aScoutSource);

  const manifest: ValidationManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    layout,
    sources: {
      seedLearningSet,
      agentConfigSource,
      m0ScoutSource,
      m1aScoutSource,
    },
    models: {
      parent: 'openai-codex/gpt-5.6-sol',
      parentThinking: 'high',
      scout: 'openai-codex/gpt-5.6-terra',
      scoutThinking: 'high',
    },
    hashes: {
      seedLearningSet: hashPlainTree(seedLearningSet),
      m0Scout: sha256File(m0ScoutSource),
      m1aScout: sha256File(m1aScoutSource),
    },
  };
  writeFileSync(layout.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  chmodSync(layout.manifestPath, 0o600);
  return layout;
}

export function loadValidationRunLayout(runRoot: string): ValidationRunLayout {
  const root = assertPreparedRunRoot(runRoot);
  const manifestPath = join(root, 'manifest.json');
  const parsed = JSON.parse(readFileSync(assertPlainFile(manifestPath, 'validation manifest'), 'utf8')) as {
    version?: unknown;
    layout?: unknown;
  };
  if (parsed.version !== 1 || !parsed.layout || typeof parsed.layout !== 'object') {
    throw new Error('validation manifest is invalid');
  }
  const layout = parsed.layout as ValidationRunLayout;
  if (layout.root !== root || layout.manifestPath !== manifestPath) {
    throw new Error('validation manifest does not match its run root');
  }
  for (const arm of ['m0', 'm1a'] as const) {
    for (const path of Object.values(layout[arm])) ensureInside(root, path);
  }
  return layout;
}

export function captureLearningSetSnapshot(
  layout: ValidationRunLayout,
  arm: ValidationArm,
  label: string,
): SnapshotRecord {
  const root = assertPreparedRunRoot(layout.root);
  if (!SNAPSHOT_LABEL.test(label)) throw new Error(`invalid snapshot label: ${label}`);
  const armLayout = layout[arm];
  ensureInside(root, armLayout.learningSet);
  ensureInside(root, armLayout.snapshots);

  const snapshotRoot = join(armLayout.snapshots, label);
  ensureInside(root, snapshotRoot);
  if (existsSync(snapshotRoot)) throw new Error(`snapshot label already exists: ${arm}/${label}`);
  mkdirSync(snapshotRoot);
  const snapshotPath = join(snapshotRoot, 'learning-set');
  copyPlainTree(armLayout.learningSet, snapshotPath);

  const record: SnapshotRecord = {
    arm,
    label,
    path: snapshotPath,
    capturedAt: new Date().toISOString(),
    treeHash: hashPlainTree(snapshotPath),
  };
  writeFileSync(join(snapshotRoot, 'record.json'), `${JSON.stringify(record, null, 2)}\n`, {
    mode: 0o600,
  });
  return record;
}
