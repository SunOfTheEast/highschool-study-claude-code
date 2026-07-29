import { expect, test } from 'bun:test';
import {
  parseProfileDocument,
  renderProfileDocument,
  type ProfileEntry,
} from '../../src/memory-review/profile-document';

const studentSource = `---
id: student-profile
kind: confirmed-preferences
---
# Student Profile

Only confirmed preferences belong here.

## Active Preferences

## Notes

This section must survive.
`;

const entry: ProfileEntry = {
  id: 'S1',
  content: '独立尝试后再获得方向性提示',
  scope: '当前 Roadmap',
  sources: ['lessons/lesson-003.md#trace-event-002'],
  rationale: '多节课中这种节奏能保留自己的路线判断',
  counterEvidence: '暂无',
};

test('round-trips canonical S/T entries while preserving all other sections', () => {
  const student = renderProfileDocument(studentSource, 'student', [entry]);
  expect(parseProfileDocument(student, 'student')).toEqual([entry]);
  expect(student).toContain('## Notes\n\nThis section must survive.');

  const teachingEntry = { ...entry, id: 'T1', content: '先等待学生完整尝试' };
  const teaching = renderProfileDocument(
    studentSource.replaceAll('student', 'teaching').replace('Student', 'Teaching'),
    'teaching',
    [teachingEntry],
  );
  expect(parseProfileDocument(teaching, 'teaching')).toEqual([teachingEntry]);
});

test('accepts an empty canonical Active Preferences section', () => {
  const rendered = renderProfileDocument(studentSource, 'student', []);
  expect(parseProfileDocument(rendered, 'student')).toEqual([]);
  expect(rendered).toContain('## Active Preferences\n\n## Notes');
});

test('rejects wrong owner IDs, duplicates, missing fields, and annotated sources', () => {
  const canonical = renderProfileDocument(studentSource, 'student', [entry]);
  expect(() => parseProfileDocument(
    canonical.replace('### S1', '### T1'),
    'student',
  )).toThrow('MEMORY_PROFILE_FORMAT_INVALID');
  expect(() => parseProfileDocument(
    canonical.replace(
      /### S1[\s\S]*?(?=\n## Notes)/,
      (block) => `${block.trim()}\n\n${block.trim()}\n`,
    ),
    'student',
  )).toThrow('MEMORY_PROFILE_FORMAT_INVALID');
  expect(() => parseProfileDocument(
    canonical.replace(/^- Scope:.*$/m, ''),
    'student',
  )).toThrow('MEMORY_PROFILE_FORMAT_INVALID');
  expect(() => parseProfileDocument(
    canonical.replace(
      '  - lessons/lesson-003.md#trace-event-002',
      '  - lessons/lesson-003.md#trace-event-002（课堂表现）',
    ),
    'student',
  )).toThrow('MEMORY_PROFILE_FORMAT_INVALID');
});

test('rejects legacy free bullets without migrating or guessing them', () => {
  expect(() => parseProfileDocument(
    studentSource.replace(
      '## Active Preferences',
      '## Active Preferences\n\n- 喜欢每一步都确认。',
    ),
    'student',
  )).toThrow('MEMORY_PROFILE_FORMAT_INVALID');
});
