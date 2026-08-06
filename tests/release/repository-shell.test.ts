import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const json = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));

test('exposes one StudyForge workspace from the repository root', () => {
  const workspace = json('package.json');
  const app = json('apps/studyforge/package.json');

  expect(workspace).toMatchObject({
    name: 'studyforge',
    version: '0.1.0',
    private: true,
    packageManager: 'bun@1.3.14',
    workspaces: ['apps/*'],
  });
  expect(workspace.scripts).toMatchObject({
    check: 'bun run typecheck:release && bun run test:release && bun run --cwd apps/studyforge check',
    doctor: 'bun run scripts/doctor.ts',
    'start:demo': 'bun run scripts/start-demo.ts',
    'test:e2e': 'bun run --cwd apps/studyforge test:e2e',
  });
  expect(app.name).toBe('@studyforge/app');
  expect(existsSync(join(root, 'apps/studyforge/src/server/index.ts'))).toBe(true);
  expect(existsSync(join(root, 'apps/pi-teaching-web'))).toBe(false);
  expect(existsSync(join(root, 'bun.lock'))).toBe(true);
});

test('runs public verification without model credentials', () => {
  for (const path of [
    '.github/workflows/ci.yml',
    '.github/workflows/release-candidate.yml',
  ]) {
    const workflow = readFileSync(join(root, path), 'utf8');
    expect(workflow).toContain('oven-sh/setup-bun@v2');
    expect(workflow).toContain('bun install --frozen-lockfile');
    expect(workflow).toContain('bun run check');
    expect(workflow).toContain('bun run test:e2e');
  }
});
