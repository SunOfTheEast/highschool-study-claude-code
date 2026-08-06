import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPiSessionFactory } from '../runtime/session-factory';
import { WorkspaceRegistry } from '../runtime/workspace-registry';
import { createRequestHandler } from './app';
import { EventHub } from './event-hub';
import { createLoopbackOriginPolicy } from './origin-policy';

const valueAfter = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const root = resolve(valueAfter('--learning-set') ?? process.env.STUDY_LEARNING_SET ?? 'learning-set');
const port = Number.parseInt(valueAfter('--port') ?? process.env.STUDY_WEB_PORT ?? '65000', 10);
const hub = new EventHub();
const factory = await createPiSessionFactory(root);
const registry = new WorkspaceRegistry(root, factory);
const staticRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
const clients = new Set<{ send(data: string): void }>();
const originPolicy = createLoopbackOriginPolicy(
  port,
  process.env.STUDYFORGE_DEV_ORIGIN,
);

hub.subscribe((event) => {
  const data = JSON.stringify(event);
  for (const client of clients) client.send(data);
});

const fetch = createRequestHandler({ root, registry, hub, staticRoot, originPolicy });

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch,
  websocket: {
    open(socket) {
      clients.add(socket);
    },
    close(socket) {
      clients.delete(socket);
    },
    message() {},
  },
});

console.log(`StudyForge M0: http://${server.hostname}:${server.port}`);
