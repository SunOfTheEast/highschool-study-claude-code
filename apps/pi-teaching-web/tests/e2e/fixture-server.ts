import { resolve } from 'node:path';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import { resolvePersona } from '../../src/study/persona';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';

const root = resolve(import.meta.dir, '../../../../examples/derivative-demo/learning-set');
const hub = new EventHub();
const registry = {
  snapshot: (planId = 'domain-integrity') => readPlanWorkspace(root, planId),
  history: () => [],
  subscribe: () => () => {},
  personaId: () => resolvePersona(root).id,
  setPersona: async () => {},
  startLesson: async () => ({}),
  pauseLesson: async () => {},
  abandonForReprepare: async () => {},
  send: async () => {},
};
const clients = new Set<{ send(data: string): void }>();
hub.subscribe((event) => {
  const data = JSON.stringify(event);
  for (const client of clients) client.send(data);
});
const fetch = createRequestHandler({
  root,
  authoring: false,
  registry: registry as never,
  hub,
});

Bun.serve({
  hostname: '127.0.0.1',
  port: 65000,
  fetch,
  websocket: {
    open(socket) { clients.add(socket); },
    close(socket) { clients.delete(socket); },
    message() {},
  },
});
