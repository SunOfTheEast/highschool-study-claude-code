import { resolve } from 'node:path';
import { buildSidecars } from './build-sidecars';
import { packageResources } from './package-resources';

const appRoot = resolve(import.meta.dir, '../..');
packageResources(appRoot);
await buildSidecars(appRoot);

const frontend = Bun.spawn([process.execPath, 'run', 'build'], {
  cwd: appRoot,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (await frontend.exited !== 0) throw new Error('STUDYFORGE_FRONTEND_BUILD_FAILED');
