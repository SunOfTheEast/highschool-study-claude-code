import { expect, test } from 'bun:test';
import { transitionClassroomSource } from '../../src/study/classroom-transition';

const source = `---
id: lesson-transition
kind: lesson
plan_id: plan-transition
status: active
---
# Classroom transition fixture

## Block orientation（必做）

### Node State

- Kind: dialogue
- Required: true
- Status: completed
- Depends on:
- Uses:

### Student View

Orient.

### Teacher Control

Observe.

## Block problem-a（必做）

### Node State

- Kind: problem
- Required: true
- Status: active
- Depends on: orientation
- Uses: Q-A

### Student View

Solve A.

### Teacher Control

Observe A.

## Block repair（可选）

### Node State

- Kind: dialogue
- Required: false
- Status: pending
- Depends on: problem-a
- Uses:

### Student View

Repair.

### Teacher Control

Observe repair.

## Block problem-b（必做）

### Node State

- Kind: problem
- Required: true
- Status: pending
- Depends on: repair
- Uses: Q-B

### Student View

Solve B.

### Teacher Control

Observe B.

## Lesson Summary

（课堂结束后填写）

## Aliases

- Q-A: ../cards/a.yaml
- Q-B: ../cards/b.yaml

## Traces

（课堂中通过 trace_append 追加）
`;

function blockStatus(body: string, blockId: string): string | null {
  const start = body.indexOf(`## Block ${blockId}`);
  if (start < 0) return null;
  const end = body.indexOf('\n## Block ', start + 1);
  const block = body.slice(start, end < 0 ? body.length : end);
  return /^- Status:\s*(.+?)\s*$/m.exec(block)?.[1] ?? null;
}

test('allows only the unique active Block to complete', () => {
  expect(() => transitionClassroomSource(source, {
    action: 'activate',
    blockId: 'repair',
  })).toThrow('CLASSROOM_ACTIVE_BLOCK_EXISTS');

  expect(() => transitionClassroomSource(source, {
    action: 'complete',
    blockId: 'repair',
  })).toThrow('CLASSROOM_BLOCK_NOT_ACTIVE');

  const completed = transitionClassroomSource(source, {
    action: 'complete',
    blockId: 'problem-a',
  });
  expect(blockStatus(completed, 'problem-a')).toBe('completed');
  expect(completed.match(/^- Status: completed$/gm)).toHaveLength(2);
});

test('requires resolved dependencies before activation', () => {
  const completed = transitionClassroomSource(source, {
    action: 'complete',
    blockId: 'problem-a',
  });

  expect(() => transitionClassroomSource(completed, {
    action: 'activate',
    blockId: 'problem-b',
  })).toThrow(/CLASSROOM_DEPENDENCY_UNRESOLVED.*repair/);

  const activated = transitionClassroomSource(completed, {
    action: 'activate',
    blockId: 'repair',
  });
  expect(blockStatus(activated, 'repair')).toBe('active');
});

test('applies route skip and insert with their Block status in one string', () => {
  const completed = transitionClassroomSource(source, {
    action: 'complete',
    blockId: 'problem-a',
  });
  const skipped = transitionClassroomSource(completed, {
    action: 'route',
    routeAction: 'skip',
    blockId: 'repair',
    reason: '学生已能独立完成。',
    source: '#trace-event-001',
  });
  expect(blockStatus(skipped, 'repair')).toBe('skipped');
  expect(skipped).toContain('### Route change route-001');
  expect(skipped).toContain('- Action: skip');

  const inserted = transitionClassroomSource(skipped, {
    action: 'route',
    routeAction: 'insert',
    blockId: 'repair',
    after: 'problem-a',
    reason: '学生要求补一次迁移。',
    source: '#trace-event-002',
  });
  expect(blockStatus(inserted, 'repair')).toBe('pending');
  expect(inserted).toContain('### Route change route-002');
  expect(inserted).toContain('- Action: insert');
  expect(inserted).toContain('- After: problem-a');
});

test('reopens one resolved Block for repeat only when no Block is active', () => {
  const completed = transitionClassroomSource(source, {
    action: 'complete',
    blockId: 'problem-a',
  });
  const repeated = transitionClassroomSource(completed, {
    action: 'route',
    routeAction: 'repeat',
    blockId: 'problem-a',
    after: 'problem-b',
    reason: '学生请求再做一次。',
    source: 'student-request',
  });
  expect(blockStatus(repeated, 'problem-a')).toBe('pending');
  expect(repeated).toContain('- Action: repeat');

  expect(() => transitionClassroomSource(source, {
    action: 'route',
    routeAction: 'repeat',
    blockId: 'orientation',
    reason: '当前仍有活动节点。',
    source: 'student-request',
  })).toThrow('ROUTE_REPEAT_WHILE_ACTIVE');
});

test('rejects invalid route targets, anchors, placement, and status', () => {
  const invalid = [
    {
      input: {
        action: 'route',
        routeAction: 'move',
        blockId: 'missing',
        reason: 'missing',
        source: 'test',
      },
      error: 'BLOCK_NOT_FOUND',
    },
    {
      input: {
        action: 'route',
        routeAction: 'move',
        blockId: 'repair',
        before: 'missing',
        reason: 'missing anchor',
        source: 'test',
      },
      error: 'ROUTE_ANCHOR_NOT_FOUND',
    },
    {
      input: {
        action: 'route',
        routeAction: 'move',
        blockId: 'repair',
        before: 'problem-a',
        after: 'problem-b',
        reason: 'ambiguous',
        source: 'test',
      },
      error: 'ROUTE_PLACEMENT_AMBIGUOUS',
    },
    {
      input: {
        action: 'route',
        routeAction: 'move',
        blockId: 'repair',
        before: 'repair',
        reason: 'self',
        source: 'test',
      },
      error: 'ROUTE_SELF_ANCHOR',
    },
    {
      input: {
        action: 'route',
        routeAction: 'move',
        blockId: 'problem-a',
        reason: 'active cannot move',
        source: 'test',
      },
      error: 'ROUTE_BLOCK_STATUS_INVALID',
    },
    {
      input: {
        action: 'route',
        routeAction: 'repeat',
        blockId: 'repair',
        reason: 'pending cannot repeat',
        source: 'test',
      },
      error: 'ROUTE_BLOCK_STATUS_INVALID',
    },
  ] as const;

  for (const item of invalid) {
    expect(() => transitionClassroomSource(source, item.input))
      .toThrow(item.error);
  }
});

test('rejects a malformed Lesson with multiple active Blocks', () => {
  const conflicting = source.replace(
    '- Status: pending\n- Depends on: problem-a',
    '- Status: active\n- Depends on: problem-a',
  );
  expect(() => transitionClassroomSource(conflicting, {
    action: 'complete',
    blockId: 'problem-a',
  })).toThrow(/CLASSROOM_ACTIVE_BLOCK_CONFLICT.*problem-a,repair/);
});

test('rejects transitions outside an active Lesson', () => {
  const paused = source.replace('status: active', 'status: paused');
  expect(() => transitionClassroomSource(paused, {
    action: 'complete',
    blockId: 'problem-a',
  })).toThrow('CLASSROOM_LESSON_NOT_ACTIVE: paused');
});
