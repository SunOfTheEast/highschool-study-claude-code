import { expect, test } from 'bun:test';
import { resetRouteScroll } from '../../src/client/route-scroll';

test('resets the document to the top for an actual route change', () => {
  const calls: unknown[] = [];
  resetRouteScroll({
    scrollTo: (value: unknown) => calls.push(value),
  } as Pick<Window, 'scrollTo'>);

  expect(calls).toEqual([{ top: 0, left: 0, behavior: 'auto' }]);
});
