import { expect, test } from 'bun:test';
import {
  readPresentationPreferences,
  writePresentationPreferences,
} from '../../src/client/presentation';

function storage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    value: () => value,
  };
}

test('uses system-aware defaults and survives invalid browser storage', () => {
  expect(readPresentationPreferences(storage(), false)).toEqual({
    motion: 'gentle',
    completionFeedback: true,
  });
  expect(readPresentationPreferences(storage(), true).motion).toBe('reduced');
  expect(readPresentationPreferences(storage('{broken'), false)).toEqual({
    motion: 'gentle',
    completionFeedback: true,
  });
});

test('round-trips preferences while system reduced motion remains authoritative', () => {
  const target = storage();
  writePresentationPreferences(target, {
    motion: 'gentle',
    completionFeedback: false,
  });
  expect(JSON.parse(target.value()!)).toEqual({
    motion: 'gentle',
    completionFeedback: false,
  });
  expect(readPresentationPreferences(target, false)).toEqual({
    motion: 'gentle',
    completionFeedback: false,
  });
  expect(readPresentationPreferences(target, true).motion).toBe('reduced');
});
