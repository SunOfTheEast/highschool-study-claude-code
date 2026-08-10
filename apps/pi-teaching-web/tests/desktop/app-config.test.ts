import { afterEach, expect, test } from 'bun:test';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  defaultAppConfig,
  loadAppConfig,
  resolveStudyForgePaths,
  saveAppConfig,
} from '../../src/desktop/app-config';

const roots: string[] = [];

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('resolves every private Pi path below the explicit StudyForge app home', () => {
  const home = temporaryRoot('studyforge-home-');
  const appHome = join(home, 'Library', 'Application Support', 'StudyForge');
  const documentsHome = join(home, 'Documents', 'StudyForge');
  const paths = resolveStudyForgePaths({ appHome, documentsHome });

  expect(paths).toEqual({
    appHome,
    appConfigPath: join(appHome, 'app.json'),
    agentDir: join(appHome, 'agent'),
    authPath: join(appHome, 'agent', 'auth.json'),
    modelsPath: join(appHome, 'agent', 'models.json'),
    settingsPath: join(appHome, 'agent', 'settings.json'),
    sessionsDir: join(appHome, 'agent', 'sessions'),
    logsDir: join(appHome, 'logs'),
    actorsDir: join(appHome, 'actors'),
    voiceDir: join(appHome, 'voice'),
    documentsHome,
  });
  for (const value of Object.values(paths)) {
    expect(value.startsWith(appHome) || value === documentsHome).toBe(true);
    expect(value).not.toContain(join(home, '.pi'));
  }
});

test('round-trips only the versioned desktop settings', () => {
  const appHome = temporaryRoot('studyforge-config-');
  const path = join(appHome, 'app.json');
  const config = {
    ...defaultAppConfig(),
    onboardingComplete: true,
    currentLearningSet: '/Users/student/Documents/StudyForge/化学/learning-set',
    recentLearningSets: ['/Users/student/Documents/StudyForge/化学/learning-set'],
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' as const },
    scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' as const },
  };

  saveAppConfig(path, config);

  expect(loadAppConfig(path)).toEqual(config);
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(config);
});

test('returns defaults for a missing config and rejects malformed persisted choices', () => {
  const appHome = temporaryRoot('studyforge-invalid-config-');
  const path = join(appHome, 'app.json');
  expect(loadAppConfig(path)).toEqual(defaultAppConfig());

  writeFileSync(path, JSON.stringify({
    version: 1,
    onboardingComplete: true,
    currentLearningSet: 'relative/learning-set',
    recentLearningSets: [],
    teacher: { provider: 'openai-codex', model: '', thinking: 'high' },
    scout: null,
  }));

  expect(() => loadAppConfig(path)).toThrow('STUDYFORGE_APP_CONFIG_INVALID');
});
