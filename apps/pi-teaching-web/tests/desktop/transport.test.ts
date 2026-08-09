import { afterEach, expect, test } from 'bun:test';
import {
  configureTransport,
  eventTransport,
  prepareTransportRequest,
  resetTransport,
} from '../../src/client/transport';

afterEach(resetTransport);

test('keeps ordinary browser development on same-origin relative paths', () => {
  const request = prepareTransportRequest('/api/home');
  expect(request.input).toBe('/api/home');
  expect(new Headers(request.init.headers).has('authorization')).toBe(false);
  expect(eventTransport({ protocol: 'http:', host: '127.0.0.1:65001' })).toEqual({
    url: 'ws://127.0.0.1:65001/events',
    protocols: [],
  });
});

test('routes desktop HTTP and WebSocket traffic to the authenticated sidecar', () => {
  configureTransport({ apiBase: 'http://127.0.0.1:43121', token: 'launch-token' });

  const request = prepareTransportRequest('/api/home', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  expect(request.input).toBe('http://127.0.0.1:43121/api/home');
  expect(new Headers(request.init.headers).get('authorization')).toBe('Bearer launch-token');
  expect(new Headers(request.init.headers).get('content-type')).toBe('application/json');
  expect(eventTransport({ protocol: 'tauri:', host: 'localhost' })).toEqual({
    url: 'ws://127.0.0.1:43121/events',
    protocols: ['studyforge', 'studyforge-token.launch-token'],
  });
});
