import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const resources = join(import.meta.dir, '../../resources');
const methodsRoot = join(resources, 'skills/references/learning-methods');

function read(path: string): string {
  return readFileSync(join(resources, path), 'utf8');
}

const methods = [
  'brainstorming',
  'knowledge-reconstruction',
  'structural-comparison',
  'claim-challenge',
  'retrieval-practice',
] as const;

test('packages one audit index and five shared learning methods', () => {
  const index = readFileSync(join(methodsRoot, 'INDEX.md'), 'utf8');

  for (const method of methods) {
    expect(index).toContain(`${method}.md`);
    expect(readFileSync(join(methodsRoot, `${method}.md`), 'utf8')).not.toBeEmpty();
  }
});

test('routes Free Learning and Tutor directly without loading the audit index', () => {
  const free = read('skills/free-learning/SKILL.md');
  const tutor = read('skills/tutor-lesson/SKILL.md');

  for (const method of methods) {
    const route = `../references/learning-methods/${method}.md`;
    expect(free).toContain(route);
    expect(tutor).toContain(route);
  }
  expect(free).not.toContain('../references/learning-methods/INDEX.md');
  expect(tutor).not.toContain('../references/learning-methods/INDEX.md');
});

test('keeps learning methods free of persistence and lifecycle authority', () => {
  for (const method of methods) {
    const source = readFileSync(join(methodsRoot, `${method}.md`), 'utf8');
    for (const forbidden of [
      'save_note',
      'save_problem_card',
      'lesson_memory_commit',
      'free_learning_memory_commit',
      'finish_lesson',
      'classroom_update',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  }
});

test('keeps question formation compact in the common teaching core', () => {
  const core = read('teaching/math-teaching-core.md');

  expect(core).toContain('## Helping a student form a question');
  expect(core).toContain('对象、矛盾、前提或边界');
  expect(core).toContain('异常、联系、条件或反例');
  expect(core).toContain('问题已经清楚时直接进入讨论');
  expect(core).toContain('不可自行推出的事实');
});
