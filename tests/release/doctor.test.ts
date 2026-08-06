import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readKnowledge } from '../../apps/studyforge/src/study/knowledge';
import { readCourseTree } from '../../apps/studyforge/src/study/markdown';
import {
  inspectStudyForge,
  resolveDemoPaths,
  type DoctorDependencies,
} from '../../scripts/lib/doctor';

const passing: DoctorDependencies = {
  bunVersion: () => '1.3.14',
  platform: () => 'darwin',
  exists: () => true,
  writable: async () => true,
  validateLearningSet: () => {},
  availableModelProviders: async () => ['openai-codex'],
  portAvailable: async () => true,
};

const input = {
  repoRoot: '/repo',
  learningSet: '/repo/examples/derivative-m0/learning-set',
  port: 65000,
};

test('returns a credential-safe passing report', async () => {
  const report = await inspectStudyForge(input, passing);

  expect(report.ok).toBe(true);
  expect(report.checks.every((check) => check.status !== 'fail')).toBe(true);
  expect(JSON.stringify(report)).not.toContain('token');
  expect(JSON.stringify(report)).not.toContain('apiKey');
});

test('fails without an available authenticated model', async () => {
  const report = await inspectStudyForge(
    { repoRoot: '/repo', learningSet: '/learning-set', port: 65000 },
    { ...passing, availableModelProviders: async () => [] },
  );

  expect(report.ok).toBe(false);
  expect(report.checks).toContainEqual(expect.objectContaining({
    id: 'model',
    status: 'fail',
  }));
});

test('uses an explicit learning set before the public starter default', () => {
  expect(resolveDemoPaths('/repo', { STUDY_LEARNING_SET: '/custom/set' }).learningSet)
    .toBe('/custom/set');
  expect(resolveDemoPaths('/repo', {}).learningSet)
    .toBe('/repo/examples/math-starter-m0/learning-set');
});

test('validates the cardless public starter', () => {
  const learningSet = join(import.meta.dir, '../../examples/math-starter-m0/learning-set');
  const course = readCourseTree(learningSet);
  const knowledge = readKnowledge(learningSet);

  expect(course.tree.children).toEqual([]);
  expect(knowledge.methods).toEqual([]);
  expect(knowledge.cards).toEqual([]);
  expect(knowledge.materials).toEqual([]);
});

test('fails when Bun is older than 1.3.0', async () => {
  const report = await inspectStudyForge(input, {
    ...passing,
    bunVersion: () => '1.2.99',
  });

  expect(report.ok).toBe(false);
  expect(report.checks).toContainEqual(expect.objectContaining({ id: 'bun', status: 'fail' }));
});

test('warns instead of failing solely for an unvalidated platform', async () => {
  const report = await inspectStudyForge(input, {
    ...passing,
    platform: () => 'win32',
  });

  expect(report.ok).toBe(true);
  expect(report.checks).toContainEqual(expect.objectContaining({
    id: 'platform',
    status: 'warn',
  }));
});

test('reports an invalid Learning Set', async () => {
  const report = await inspectStudyForge(input, {
    ...passing,
    validateLearningSet: () => { throw new Error('fixture is malformed'); },
  });

  expect(report.ok).toBe(false);
  expect(report.checks).toContainEqual(expect.objectContaining({
    id: 'learning-set',
    status: 'fail',
  }));
});

test('fails when the Learning Set cannot persist course state', async () => {
  const report = await inspectStudyForge(input, {
    ...passing,
    writable: async () => false,
  });

  expect(report.ok).toBe(false);
  expect(report.checks).toContainEqual(expect.objectContaining({ id: 'write', status: 'fail' }));
});

test('fails when the App root is incomplete', async () => {
  const report = await inspectStudyForge(input, {
    ...passing,
    exists: () => false,
  });

  expect(report.ok).toBe(false);
  expect(report.checks).toContainEqual(expect.objectContaining({ id: 'app', status: 'fail' }));
});

test('fails when the requested port is occupied', async () => {
  const report = await inspectStudyForge(input, {
    ...passing,
    portAvailable: async () => false,
  });

  expect(report.ok).toBe(false);
  expect(report.checks).toContainEqual(expect.objectContaining({ id: 'port', status: 'fail' }));
});
