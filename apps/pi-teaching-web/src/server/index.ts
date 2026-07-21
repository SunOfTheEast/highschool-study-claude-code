import { createRequestHandler } from './app';

const port = Number.parseInt(process.env.STUDY_WEB_PORT ?? '65000', 10);
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch: createRequestHandler(),
});

console.log(`StudyForge Pi Web: http://${server.hostname}:${server.port}`);
