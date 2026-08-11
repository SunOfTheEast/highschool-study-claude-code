import { expect, test } from 'bun:test';
import {
  pointInCompanionTarget,
  restoreCompanionPosition,
} from '../../src/client/companion/window-controls';

const monitor = {
  position: { x: 0, y: 0 },
  size: { width: 1440, height: 900 },
};
const windowSize = { width: 340, height: 560 };

test('keeps a visible saved position and restores an offscreen pet near the primary corner', () => {
  expect(restoreCompanionPosition({ x: 880, y: 210 }, [monitor], windowSize))
    .toEqual({ x: 880, y: 210 });
  expect(restoreCompanionPosition({ x: 1800, y: 1200 }, [monitor], windowSize))
    .toEqual({ x: 1050, y: 280 });
});

test('makes only the model target or open menu interactive', () => {
  const target = { left: 55, top: 100, right: 285, bottom: 550 };
  const menu = { left: 90, top: 240, right: 260, bottom: 390 };

  expect(pointInCompanionTarget({ x: 160, y: 420 }, target, null)).toBe(true);
  expect(pointInCompanionTarget({ x: 12, y: 16 }, target, null)).toBe(false);
  expect(pointInCompanionTarget({ x: 120, y: 300 }, target, menu)).toBe(true);
});
