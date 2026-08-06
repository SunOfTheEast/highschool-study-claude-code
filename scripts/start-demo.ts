import { resolve } from 'node:path';
import {
  defaultDoctorDependencies,
  formatDoctorReport,
  inspectStudyForge,
  resolveDemoPaths,
} from './lib/doctor';

const inheritedIo = {
  env: process.env,
  stdin: 'inherit' as const,
  stdout: 'inherit' as const,
  stderr: 'inherit' as const,
};

async function main(): Promise<number> {
  const repoRoot = resolve(import.meta.dir, '..');
  const { appRoot, learningSet, port } = resolveDemoPaths(repoRoot, process.env);
  const report = await inspectStudyForge(
    { repoRoot, learningSet, port },
    defaultDoctorDependencies(),
  );
  console.log(formatDoctorReport(report));
  if (!report.ok) return 1;

  const build = Bun.spawn(['bun', 'run', 'build'], { cwd: appRoot, ...inheritedIo });
  const buildExit = await build.exited;
  if (buildExit !== 0) return buildExit;

  const child = Bun.spawn([
    'bun',
    'run',
    'src/server/index.ts',
    '--learning-set',
    learningSet,
    '--port',
    String(port),
  ], { cwd: appRoot, ...inheritedIo });
  process.once('SIGINT', () => child.kill('SIGINT'));
  process.once('SIGTERM', () => child.kill('SIGTERM'));
  return child.exited;
}

process.exitCode = await main();
