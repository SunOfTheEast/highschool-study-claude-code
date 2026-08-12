import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import {
  desktopThinkingLevels,
  type DesktopModelSelection,
  type DesktopVisionSelection,
  type StudyForgeAppConfig,
  type StudyForgePaths,
} from './contracts';

const invalid = (): never => {
  throw new Error('STUDYFORGE_APP_CONFIG_INVALID');
};

export function defaultAppConfig(): StudyForgeAppConfig {
  return {
    version: 1,
    onboardingComplete: false,
    currentLearningSet: null,
    recentLearningSets: [],
    teacher: null,
    scout: null,
    vision: { mode: 'auto' },
  };
}

export function resolveStudyForgePaths(input: {
  appHome: string;
  documentsHome: string;
}): StudyForgePaths {
  if (!isAbsolute(input.appHome) || !isAbsolute(input.documentsHome)) invalid();
  const agentDir = join(input.appHome, 'agent');
  return {
    appHome: input.appHome,
    appConfigPath: join(input.appHome, 'app.json'),
    agentDir,
    authPath: join(agentDir, 'auth.json'),
    modelsPath: join(agentDir, 'models.json'),
    settingsPath: join(agentDir, 'settings.json'),
    sessionsDir: join(agentDir, 'sessions'),
    logsDir: join(input.appHome, 'logs'),
    actorsDir: join(input.appHome, 'actors'),
    voiceDir: join(input.appHome, 'voice'),
    documentsHome: input.documentsHome,
  };
}

function modelSelection(value: unknown): DesktopModelSelection | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const candidate = value as Record<string, unknown>;
  const provider = candidate.provider;
  const model = candidate.model;
  const thinking = candidate.thinking;
  if (
    typeof provider !== 'string'
    || provider.trim() !== provider
    || provider.length === 0
    || /[\r\n]/.test(provider)
    || typeof model !== 'string'
    || model.trim() !== model
    || model.length === 0
    || /[\r\n]/.test(model)
    || typeof thinking !== 'string'
    || !(desktopThinkingLevels as readonly string[]).includes(thinking)
  ) invalid();
  return {
    provider: provider as string,
    model: model as string,
    thinking: thinking as DesktopModelSelection['thinking'],
  };
}

function absolutePath(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !isAbsolute(value) || /[\r\n]/.test(value)) invalid();
  return value as string;
}

function visionSelection(value: unknown): DesktopVisionSelection {
  if (value === undefined) return { mode: 'auto' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const candidate = value as Record<string, unknown>;
  if (candidate.mode === 'auto' && Object.keys(candidate).length === 1) return { mode: 'auto' };
  if (candidate.mode === 'model' && Object.keys(candidate).length === 2) {
    const selection = modelSelection(candidate.selection);
    if (selection === null) return invalid();
    return { mode: 'model', selection };
  }
  return invalid();
}

export function parseAppConfig(value: unknown): StudyForgeAppConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || typeof candidate.onboardingComplete !== 'boolean') invalid();
  if (!Array.isArray(candidate.recentLearningSets)) invalid();
  const recentLearningSets = (candidate.recentLearningSets as unknown[])
    .map((path) => absolutePath(path)!);
  if (new Set(recentLearningSets).size !== recentLearningSets.length) invalid();
  return {
    version: 1,
    onboardingComplete: candidate.onboardingComplete as boolean,
    currentLearningSet: absolutePath(candidate.currentLearningSet, true),
    recentLearningSets,
    teacher: modelSelection(candidate.teacher),
    scout: modelSelection(candidate.scout),
    vision: visionSelection(candidate.vision),
  };
}

export function loadAppConfig(path: string): StudyForgeAppConfig {
  if (!existsSync(path)) return defaultAppConfig();
  try {
    return parseAppConfig(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    if (error instanceof Error && error.message === 'STUDYFORGE_APP_CONFIG_INVALID') throw error;
    return invalid();
  }
}

export function saveAppConfig(path: string, input: StudyForgeAppConfig): void {
  const config = parseAppConfig(input);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
}
