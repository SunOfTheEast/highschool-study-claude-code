import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseReadyReceipt } from '../../src/server/start-server';
import { sidecarOutputs } from './build-sidecars';
import { resourceLayout } from './package-resources';

async function firstLine(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const next = await reader.read();
    if (next.done) throw new Error('SIDECAR_READY_RECEIPT_MISSING');
    text += decoder.decode(next.value, { stream: true });
    const newline = text.indexOf('\n');
    if (newline >= 0) return text.slice(0, newline).trim();
  }
}

async function waitForAuthPrompt(baseUrl: string, token: string, flowId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/desktop/auth/${flowId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const flow = await response.json() as {
      status?: string;
      prompt?: { type?: string; options?: Array<{ id?: string }> } | null;
      error?: string | null;
    };
    if (flow.status === 'waiting' || flow.status === 'failed') return flow;
    await Bun.sleep(20);
  }
  throw new Error('STUDYFORGE_OAUTH_SMOKE_TIMEOUT');
}

export async function smokeSidecars(appRoot = resolve(import.meta.dir, '../..')): Promise<void> {
  const output = sidecarOutputs(appRoot);
  const resources = resourceLayout(appRoot);
  const root = mkdtempSync(join(tmpdir(), 'studyforge-sidecar-smoke-'));
  const executable = process.platform === 'darwin'
    ? adHocSignedCopies(root, output, join(appRoot, 'src-tauri/entitlements.plist'))
    : output;
  const emptyEnvironment = {
    HOME: join(root, 'home'),
    PATH: '',
    TMPDIR: tmpdir(),
    PI_CODING_AGENT_DIR: join(root, 'app/agent'),
    PI_PACKAGE_DIR: resources.piRuntimeRoot,
    PI_SUBAGENT_PROMPT_RUNTIME_EXTENSION_PATH: resources.subagentPromptRuntime,
  };

  const dependencyProbe = Bun.spawn([
    executable.runtime,
    '--runtime-self-test',
    '--resource-root', resources.stagingRoot,
  ], {
    cwd: root,
    env: emptyEnvironment,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const dependencyOutput = (await new Response(dependencyProbe.stdout).text()).trim();
  const dependencyError = (await new Response(dependencyProbe.stderr).text()).trim();
  if (await dependencyProbe.exited !== 0) {
    throw new Error(`STUDYFORGE_RUNTIME_DEPENDENCY_SMOKE_FAILED: ${dependencyError || dependencyOutput}`);
  }
  const dependencyReceipt = JSON.parse(dependencyOutput) as {
    planSubagent?: string;
    subagentChildRuntime?: string;
    pdfImport?: string;
    bedrock?: string;
  };
  if (
    dependencyReceipt.planSubagent !== 'passed'
    || dependencyReceipt.subagentChildRuntime !== 'passed'
    || dependencyReceipt.pdfImport !== 'passed'
    || dependencyReceipt.bedrock !== 'passed'
  ) {
    throw new Error(`STUDYFORGE_RUNTIME_DEPENDENCY_SMOKE_FAILED: ${dependencyOutput}`);
  }

  const pi = Bun.spawn([executable.pi, '--version'], {
    cwd: root,
    env: emptyEnvironment,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const piVersion = (await new Response(pi.stdout).text()).trim();
  const piError = (await new Response(pi.stderr).text()).trim();
  if (await pi.exited !== 0 || piVersion !== '0.81.0') {
    throw new Error(`STUDYFORGE_PI_SMOKE_FAILED: ${piVersion || piError}`);
  }

  const childRuntime = Bun.spawn([
    executable.pi,
    '--offline',
    '--mode', 'rpc',
    '--no-session',
    '--no-extensions',
    '--extension', resources.subagentPromptRuntime,
  ], {
    cwd: root,
    env: {
      ...emptyEnvironment,
      PI_SUBAGENT_CHILD: '1',
      PI_SUBAGENT_FANOUT_CHILD: '0',
      PI_SUBAGENT_INHERIT_PROJECT_CONTEXT: '0',
      PI_SUBAGENT_INHERIT_SKILLS: '0',
    },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  childRuntime.stdin.write(`${JSON.stringify({ type: 'get_state', id: 'extension-smoke' })}\n`);
  childRuntime.stdin.end();
  const childRuntimeOutput = (await new Response(childRuntime.stdout).text()).trim();
  const childRuntimeError = (await new Response(childRuntime.stderr).text()).trim();
  const childRuntimeReceipt = childRuntimeOutput
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line) as { id?: string; success?: boolean };
      } catch {
        return undefined;
      }
    })
    .find((line) => line?.id === 'extension-smoke');
  if (await childRuntime.exited !== 0 || childRuntimeReceipt?.success !== true) {
    const error = childRuntimeError
      .replace(/base64,[A-Za-z0-9+/=]+/g, 'base64,<omitted>')
      .slice(-4_000);
    throw new Error(
      `STUDYFORGE_SUBAGENT_CHILD_RUNTIME_SMOKE_FAILED: ${error || childRuntimeOutput}`,
    );
  }

  const token = 'sidecar-smoke-token';
  const runtime = Bun.spawn([
    executable.runtime,
    '--port', '0',
    '--app-home', join(root, 'app'),
    '--documents-home', join(root, 'documents'),
    '--resource-root', resources.stagingRoot,
    '--token', token,
  ], { cwd: root, env: emptyEnvironment, stdout: 'pipe', stderr: 'pipe' });
  const receipt = parseReadyReceipt(await firstLine(runtime.stdout));
  const response = await fetch(`http://127.0.0.1:${receipt.port}/api/desktop/status`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const status = await response.json() as { state?: unknown };
  if (!response.ok || status.state !== 'needs-learning-set') {
    runtime.kill();
    throw new Error('STUDYFORGE_RUNTIME_SMOKE_FAILED');
  }

  const baseUrl = `http://127.0.0.1:${receipt.port}`;
  const authStart = await fetch(`${baseUrl}/api/desktop/auth`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ provider: 'openai-codex', type: 'oauth' }),
  });
  const startedAuth = await authStart.json() as { flowId?: string };
  if (!authStart.ok || !startedAuth.flowId) {
    runtime.kill();
    throw new Error('STUDYFORGE_OAUTH_SMOKE_START_FAILED');
  }
  const authFlow = await waitForAuthPrompt(baseUrl, token, startedAuth.flowId);
  const methods = authFlow.prompt?.options?.map((option) => option.id);
  if (
    authFlow.status !== 'waiting'
    || authFlow.prompt?.type !== 'select'
    || !methods?.includes('browser')
    || !methods.includes('device_code')
  ) {
    runtime.kill();
    throw new Error(`STUDYFORGE_OAUTH_SMOKE_FAILED: ${authFlow.error ?? authFlow.status}`);
  }
  await fetch(`http://127.0.0.1:${receipt.port}/api/desktop/shutdown`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  if (await runtime.exited !== 0) throw new Error('STUDYFORGE_RUNTIME_SHUTDOWN_FAILED');

  console.log(JSON.stringify({
    runtime: 'passed',
    pi: 'passed',
    oauthBootstrap: 'passed',
    planSubagent: dependencyReceipt.planSubagent,
    subagentChildRuntime: dependencyReceipt.subagentChildRuntime,
    pdfImport: dependencyReceipt.pdfImport,
    bedrock: dependencyReceipt.bedrock,
    path: 'empty',
    realModelScout: 'blocked-until-desktop-provider-login',
  }));
}

function adHocSignedCopies(
  root: string,
  output: ReturnType<typeof sidecarOutputs>,
  entitlements: string,
): ReturnType<typeof sidecarOutputs> {
  const directory = join(root, 'signed');
  mkdirSync(directory, { recursive: true });
  const copies = {
    runtime: join(directory, 'studyforge-runtime'),
    pi: join(directory, 'studyforge-pi'),
  };
  for (const key of ['runtime', 'pi'] as const) {
    copyFileSync(output[key], copies[key]);
    chmodSync(copies[key], 0o755);
    const signing = Bun.spawnSync([
      'codesign', '--force', '--options', 'runtime', '--entitlements', entitlements,
      '--sign', '-', copies[key],
    ], { stdout: 'pipe', stderr: 'pipe' });
    if (signing.exitCode !== 0) {
      throw new Error(`STUDYFORGE_SIDECAR_SIGNING_FAILED: ${signing.stderr.toString().trim()}`);
    }
  }
  return copies;
}

if (import.meta.main) await smokeSidecars();
