import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { installPeerLive2D } from '../../src/desktop/peer-live2d-installer';

export function parseImportPeerLive2DArguments(argv: readonly string[]): {
  source: string;
  appHome: string | null;
  core: string | null;
} {
  let source: string | null = null;
  let appHome: string | null = null;
  let core: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--') continue;
    if (name !== '--source' && name !== '--app-home' && name !== '--core') {
      throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_UNKNOWN');
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`STUDYFORGE_LIVE2D_ARGUMENT_MISSING: ${name}`);
    }
    if (name === '--source') {
      if (source) throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_DUPLICATE');
      source = value;
    } else if (name === '--app-home') {
      if (appHome) throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_DUPLICATE');
      appHome = value;
    } else {
      if (core) throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_DUPLICATE');
      core = value;
    }
    index += 1;
  }
  if (!source) throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_MISSING: --source');
  return { source, appHome, core };
}

if (import.meta.main) {
  const input = parseImportPeerLive2DArguments(process.argv.slice(2));
  const appHome = input.appHome
    ?? join(homedir(), 'Library', 'Application Support', 'StudyForge');
  console.log(JSON.stringify(installPeerLive2D({
    source: resolve(input.source),
    appHome: resolve(appHome),
    ...(input.core ? { core: resolve(input.core) } : {}),
  })));
}
