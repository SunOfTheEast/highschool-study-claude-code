import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { DesktopModelSelection } from './contracts';

type SettingsObject = Record<string, unknown>;

function object(value: unknown): SettingsObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as SettingsObject
    : {};
}

function readSettings(path: string): SettingsObject {
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as SettingsObject;
  } catch {
    throw new Error('STUDYFORGE_PI_SETTINGS_INVALID');
  }
}

function qualified(selection: DesktopModelSelection): string {
  return `${selection.provider}/${selection.model}`;
}

export function writeDesktopPiSettings(path: string, input: {
  sessionsDir: string;
  teacher: DesktopModelSelection;
  scout: DesktopModelSelection;
}): void {
  const current = readSettings(path);
  const subagents = object(current.subagents);
  const agentOverrides = object(subagents.agentOverrides);
  const next = {
    ...current,
    defaultProvider: input.teacher.provider,
    defaultModel: input.teacher.model,
    defaultThinkingLevel: input.teacher.thinking,
    sessionDir: input.sessionsDir,
    subagents: {
      ...subagents,
      agentOverrides: {
        ...agentOverrides,
        'study-material-scout': {
          ...object(agentOverrides['study-material-scout']),
          model: qualified(input.scout),
          thinking: input.scout.thinking,
        },
        'lesson-risk-reviewer': {
          ...object(agentOverrides['lesson-risk-reviewer']),
          model: qualified(input.teacher),
          thinking: input.teacher.thinking,
        },
      },
    },
  };
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
}
