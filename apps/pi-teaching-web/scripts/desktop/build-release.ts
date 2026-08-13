import { resolve } from 'node:path';
import { resolveDesktopTarget } from './platform';

const appRoot = resolve(import.meta.dir, '../..');
const requested = process.argv[2];
const target = resolveDesktopTarget(
  requested ? { STUDYFORGE_DESKTOP_TARGET: requested } : process.env,
);
const host = resolveDesktopTarget({}, process.platform, process.arch);
if (host.triple !== target.triple) {
  throw new Error(`STUDYFORGE_DESKTOP_RELEASE_HOST_REQUIRED: ${target.triple}`);
}

const child = Bun.spawn([process.execPath, 'run', 'tauri', 'build'], {
  cwd: appRoot,
  env: {
    ...process.env,
    CI: 'true',
    STUDYFORGE_DESKTOP_TARGET: target.triple,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});
if (await child.exited !== 0) {
  throw new Error(`STUDYFORGE_DESKTOP_RELEASE_FAILED: ${target.triple}`);
}
