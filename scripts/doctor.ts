import { resolve } from 'node:path';
import {
  defaultDoctorDependencies,
  formatDoctorReport,
  inspectStudyForge,
  resolveDemoPaths,
} from './lib/doctor';

function valueAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const repoRoot = resolve(import.meta.dir, '..');
const env: Record<string, string | undefined> = { ...process.env };
env.STUDY_LEARNING_SET = valueAfter('--learning-set') ?? env.STUDY_LEARNING_SET;
env.STUDY_WEB_PORT = valueAfter('--port') ?? env.STUDY_WEB_PORT;
const paths = resolveDemoPaths(repoRoot, env);
const report = await inspectStudyForge({
  repoRoot,
  learningSet: paths.learningSet,
  port: paths.port,
}, defaultDoctorDependencies());

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report));
} else {
  console.log(formatDoctorReport(report));
}
process.exitCode = report.ok ? 0 : 1;
