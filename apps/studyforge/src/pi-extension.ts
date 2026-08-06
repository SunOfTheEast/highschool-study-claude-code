import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function waitForServer(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // The local process may still be starting.
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  return false;
}

export default function studyWebExtension(pi: ExtensionAPI) {
  let child: ChildProcess | null = null;
  const serverEntry = join(dirname(fileURLToPath(import.meta.url)), 'server', 'index.ts');

  pi.registerCommand('study-web', {
    description: 'Open the StudyForge local teaching frontend',
    handler: async (args, ctx) => {
      const requested = args.trim()
        ? resolve(ctx.cwd, args.trim())
        : join(ctx.cwd, 'learning-set');
      const root = existsSync(join(requested, 'ROADMAP.md')) ? requested : ctx.cwd;
      if (!existsSync(join(root, 'ROADMAP.md'))) {
        ctx.ui.notify('没有找到 ROADMAP.md；请从 learning-set 或其父目录运行。', 'error');
        return;
      }
      if (!child || child.exitCode !== null) {
        child = spawn('bun', [
          'run',
          serverEntry,
          '--learning-set',
          root,
          '--port',
          '65000',
        ], { stdio: 'ignore', env: process.env });
      }
      if (!await waitForServer('http://127.0.0.1:65000/api/health')) {
        ctx.ui.notify('StudyForge 本地服务没有成功启动；请先确认已安装 Bun。', 'error');
        return;
      }
      await pi.exec(process.platform === 'darwin' ? 'open' : 'xdg-open', [
        'http://127.0.0.1:65000',
      ]);
      ctx.ui.notify('StudyForge 已打开：http://127.0.0.1:65000', 'info');
    },
  });

  pi.on('session_shutdown', () => {
    child?.kill();
    child = null;
  });
}
