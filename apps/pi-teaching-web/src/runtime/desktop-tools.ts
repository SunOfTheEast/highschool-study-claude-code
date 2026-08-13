import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { isAbsolute, join } from 'node:path';

type ToolEnvironment = Record<string, string | undefined>;

type SettingsWithOverrides = {
  applyOverrides(overrides: { shellPath?: string }): void;
};

export type PreparedDesktopTools = {
  bash: string;
  rg: string;
  fd: string;
};

export function packagedShellPath(environment: ToolEnvironment = process.env): string | undefined {
  const value = environment.STUDYFORGE_PACKAGED_BASH?.trim();
  return value || undefined;
}

function declaredSource(
  environment: ToolEnvironment,
  name: 'BASH' | 'RG' | 'FD',
): string | undefined {
  const value = environment[`STUDYFORGE_PACKAGED_${name}`]?.trim();
  return value || undefined;
}

function requireRegularFile(path: string | undefined, name: string): string {
  if (!path || !isAbsolute(path) || !existsSync(path)) {
    throw new Error(`STUDYFORGE_PACKAGED_TOOL_MISSING: ${name}`);
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`STUDYFORGE_PACKAGED_TOOL_MISSING: ${name}`);
  }
  return path;
}

function digest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function seedManagedTool(source: string, destination: string): void {
  if (existsSync(destination) && digest(source) === digest(destination)) return;
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  try {
    copyFileSync(source, temporary);
    renameSync(temporary, destination);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

export function prepareDesktopManagedTools(
  agentDir: string,
  environment: ToolEnvironment = process.env,
): PreparedDesktopTools | null {
  const declared = {
    bash: declaredSource(environment, 'BASH'),
    rg: declaredSource(environment, 'RG'),
    fd: declaredSource(environment, 'FD'),
  };
  if (!declared.bash && !declared.rg && !declared.fd) return null;

  const bash = requireRegularFile(declared.bash, 'bash');
  const rgSource = requireRegularFile(declared.rg, 'rg');
  const fdSource = requireRegularFile(declared.fd, 'fd');
  const binDir = join(agentDir, 'bin');
  mkdirSync(binDir, { recursive: true });
  const rg = join(binDir, 'rg.exe');
  const fd = join(binDir, 'fd.exe');
  seedManagedTool(rgSource, rg);
  seedManagedTool(fdSource, fd);
  return { bash, rg, fd };
}

export function applyPackagedShellPath(
  settingsManager: SettingsWithOverrides,
  environment: ToolEnvironment = process.env,
): void {
  const shellPath = packagedShellPath(environment);
  if (shellPath) settingsManager.applyOverrides({ shellPath });
}
