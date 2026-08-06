import { constants, existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { readKnowledge } from '../../apps/studyforge/src/study/knowledge';
import { readCourseTree } from '../../apps/studyforge/src/study/markdown';

export type DoctorStatus = 'pass' | 'warn' | 'fail';
export type DoctorCheck = {
  id: 'platform' | 'bun' | 'app' | 'learning-set' | 'write' | 'model' | 'port';
  status: DoctorStatus;
  message: string;
};
export type DoctorReport = { ok: boolean; checks: DoctorCheck[] };
export type DoctorInput = { repoRoot: string; learningSet: string; port: number };
export type DoctorDependencies = {
  bunVersion(): string | undefined;
  platform(): string;
  exists(path: string): boolean;
  writable(path: string): Promise<boolean>;
  validateLearningSet(path: string): void;
  availableModelProviders(): Promise<readonly string[]>;
  portAvailable(port: number): Promise<boolean>;
};

function versionAtLeast(actual: string | undefined, minimum: readonly number[]): boolean {
  if (!actual) return false;
  const values = actual.split('.').map((part) => Number.parseInt(part, 10));
  if (values.some(Number.isNaN)) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    const left = values[index] ?? 0;
    const right = minimum[index] ?? 0;
    if (left !== right) return left > right;
  }
  return true;
}

export function resolveDemoPaths(
  repoRoot: string,
  env: Record<string, string | undefined>,
) {
  return {
    appRoot: join(repoRoot, 'apps/studyforge'),
    learningSet: resolve(env.STUDY_LEARNING_SET ?? join(
      repoRoot,
      'examples/math-starter-m0/learning-set',
    )),
    port: Number.parseInt(env.STUDY_WEB_PORT ?? '65000', 10),
  };
}

export function defaultDoctorDependencies(): DoctorDependencies {
  return {
    bunVersion: () => process.versions.bun,
    platform: () => process.platform,
    exists: existsSync,
    writable: async (path) => {
      try {
        await access(path, constants.W_OK);
        return true;
      } catch {
        return false;
      }
    },
    validateLearningSet: (path) => {
      readCourseTree(path);
      readKnowledge(path);
    },
    availableModelProviders: async () => {
      const runtime = await ModelRuntime.create({ allowModelNetwork: false });
      return [...new Set((await runtime.getAvailable()).map((model) => model.provider))]
        .sort();
    },
    portAvailable: async (port) => {
      try {
        const server = Bun.serve({
          hostname: '127.0.0.1',
          port,
          fetch: () => new Response('doctor'),
        });
        server.stop(true);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export async function inspectStudyForge(
  input: DoctorInput,
  deps: DoctorDependencies = defaultDoctorDependencies(),
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const platform = deps.platform();
  checks.push({
    id: 'platform',
    status: platform === 'darwin' || platform === 'linux' ? 'pass' : 'warn',
    message: platform === 'darwin' || platform === 'linux'
      ? `已支持的平台：${platform}`
      : `尚未验收的平台：${platform}`,
  });

  const bun = deps.bunVersion();
  checks.push({
    id: 'bun',
    status: versionAtLeast(bun, [1, 3, 0]) ? 'pass' : 'fail',
    message: bun ? `Bun ${bun}` : '没有发现 Bun；需要 Bun 1.3.0 或更高版本。',
  });

  const appPath = join(input.repoRoot, 'apps/studyforge/package.json');
  const appExists = deps.exists(appPath);
  checks.push({
    id: 'app',
    status: appExists ? 'pass' : 'fail',
    message: appExists ? 'StudyForge App 完整。' : '缺少 apps/studyforge/package.json。',
  });

  try {
    deps.validateLearningSet(input.learningSet);
    checks.push({ id: 'learning-set', status: 'pass', message: 'Learning Set 契约有效。' });
  } catch (error) {
    checks.push({
      id: 'learning-set',
      status: 'fail',
      message: `Learning Set 无效：${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const writable = await deps.writable(input.learningSet);
  checks.push({
    id: 'write',
    status: writable ? 'pass' : 'fail',
    message: writable
      ? 'Learning Set 可写。'
      : 'Learning Set 不可写，无法保存课程状态。',
  });

  try {
    const providers = await deps.availableModelProviders();
    checks.push({
      id: 'model',
      status: providers.length > 0 ? 'pass' : 'fail',
      message: providers.length > 0
        ? `Pi 已发现 ${providers.length} 个可用模型提供商：${providers.join(', ')}`
        : 'Pi 没有发现已认证的可用模型；请先在 Pi 中完成 OAuth 或 API Key 配置。',
    });
  } catch {
    checks.push({
      id: 'model',
      status: 'fail',
      message: 'Pi 模型检查失败；请在 Pi 中检查本地认证配置。',
    });
  }

  const portOk = Number.isInteger(input.port)
    && input.port > 0
    && input.port <= 65_535
    && await deps.portAvailable(input.port);
  checks.push({
    id: 'port',
    status: portOk ? 'pass' : 'fail',
    message: portOk ? `端口 ${input.port} 可用。` : `端口 ${input.port} 无效或已占用。`,
  });

  return { ok: checks.every((check) => check.status !== 'fail'), checks };
}

export function formatDoctorReport(report: DoctorReport): string {
  return report.checks
    .map((check) => `[${check.status}] ${check.id}: ${check.message}`)
    .join('\n');
}
