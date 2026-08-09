import { afterEach, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { writeDesktopPiSettings } from '../../src/desktop/pi-settings';

const roots: string[] = [];

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('writes teacher defaults and the two StudyForge subagent overrides only', () => {
  const root = temporaryRoot('studyforge-pi-settings-');
  const path = join(root, 'agent', 'settings.json');
  mkdirSync(join(root, 'agent'), { recursive: true });
  writeFileSync(path, JSON.stringify({
    quietStartup: true,
    subagents: { agentOverrides: { unrelated: { model: 'other/model' } } },
  }));

  writeDesktopPiSettings(path, {
    sessionsDir: join(root, 'agent', 'sessions'),
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' },
  });

  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
    quietStartup: true,
    defaultProvider: 'openai-codex',
    defaultModel: 'gpt-5.6-sol',
    defaultThinkingLevel: 'high',
    sessionDir: join(root, 'agent', 'sessions'),
    subagents: {
      agentOverrides: {
        unrelated: { model: 'other/model' },
        'study-material-scout': {
          model: 'openai-codex/gpt-5.6-terra',
          thinking: 'high',
        },
        'lesson-risk-reviewer': {
          model: 'openai-codex/gpt-5.6-sol',
          thinking: 'high',
        },
      },
    },
  });
});

test('does not touch an ordinary Pi settings sentinel', () => {
  const root = temporaryRoot('studyforge-pi-sentinel-');
  const sentinel = join(root, '.pi', 'agent', 'settings.json');
  const studyforge = join(root, 'Library', 'Application Support', 'StudyForge', 'agent');
  mkdirSync(join(root, '.pi', 'agent'), { recursive: true });
  writeFileSync(sentinel, 'ordinary-pi-settings\n');

  writeDesktopPiSettings(join(studyforge, 'settings.json'), {
    sessionsDir: join(studyforge, 'sessions'),
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' },
  });

  expect(readFileSync(sentinel, 'utf8')).toBe('ordinary-pi-settings\n');
});

test('leaves packaged subagent models configurable by isolated settings', () => {
  for (const name of ['study-material-scout.md', 'lesson-risk-reviewer.md']) {
    const content = readFileSync(resolve(import.meta.dir, `../../resources/subagents/${name}`), 'utf8');
    const frontmatter = content.split('---')[1] ?? '';
    expect(frontmatter).not.toMatch(/^model:/m);
    expect(frontmatter).not.toMatch(/^thinking:/m);
  }
});
