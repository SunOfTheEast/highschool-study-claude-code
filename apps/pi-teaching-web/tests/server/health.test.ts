import { expect, test } from 'bun:test';
import { createRequestHandler } from '../../src/server/app';

test('answers the local health endpoint', async () => {
  const response = await createRequestHandler()(new Request('http://local/api/health'));
  expect(response?.status).toBe(200);
  expect(await response?.json()).toEqual({ ok: true, runtime: 'pi' });
});
