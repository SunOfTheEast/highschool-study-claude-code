import { resolve } from 'node:path';
import { buildSidecars } from './build-sidecars';
import { packageResources } from './package-resources';
import { resolveDesktopTarget } from './platform';
import { prepareWindowsArtifacts } from './windows-artifacts';

const appRoot = resolve(import.meta.dir, '../..');
const target = resolveDesktopTarget();
if (target.triple === 'x86_64-pc-windows-msvc') {
  await prepareWindowsArtifacts(appRoot);
}
packageResources(appRoot, target);
await buildSidecars(appRoot, target);

const frontend = Bun.spawn([process.execPath, 'run', 'build'], {
  cwd: appRoot,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (await frontend.exited !== 0) throw new Error('STUDYFORGE_FRONTEND_BUILD_FAILED');
