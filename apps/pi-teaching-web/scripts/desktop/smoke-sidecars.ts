import { mkdtempSync } from 'node:fs';
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

export async function smokeSidecars(appRoot = resolve(import.meta.dir, '../..')): Promise<void> {
  const output = sidecarOutputs(appRoot);
  const resources = resourceLayout(appRoot);
  const root = mkdtempSync(join(tmpdir(), 'studyforge-sidecar-smoke-'));
  const emptyEnvironment = {
    HOME: join(root, 'home'),
    PATH: '',
    TMPDIR: tmpdir(),
    PI_CODING_AGENT_DIR: join(root, 'app/agent'),
    PI_PACKAGE_DIR: resources.piRuntimeRoot,
  };

  const pi = Bun.spawn([output.pi, '--version'], {
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

  const token = 'sidecar-smoke-token';
  const runtime = Bun.spawn([
    output.runtime,
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
  await fetch(`http://127.0.0.1:${receipt.port}/api/desktop/shutdown`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  if (await runtime.exited !== 0) throw new Error('STUDYFORGE_RUNTIME_SHUTDOWN_FAILED');

  console.log(JSON.stringify({
    runtime: 'passed',
    pi: 'passed',
    path: 'empty',
    realModelScout: 'blocked-until-desktop-provider-login',
  }));
}

if (import.meta.main) await smokeSidecars();
