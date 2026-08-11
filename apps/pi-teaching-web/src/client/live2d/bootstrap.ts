import { ensureCubismCore } from './cubism-core';
import type {
  CreatePeerLive2DRenderer,
  PeerLive2DRenderer,
  PeerVisualState,
} from './contracts';
import { loadPeerLive2DPackage } from './private-package';

type BootstrapDependencies = {
  loadPackage: typeof loadPeerLive2DPackage;
  ensureCore: typeof ensureCubismCore;
  importRenderer(): Promise<{ createPeerLive2DRenderer: CreatePeerLive2DRenderer }>;
};

const defaults: BootstrapDependencies = {
  loadPackage: loadPeerLive2DPackage,
  ensureCore: ensureCubismCore,
  importRenderer: () => import('./pixi-renderer'),
};

export async function bootstrapPeerLive2D(input: {
  host: HTMLElement;
  state: PeerVisualState;
  signal: AbortSignal;
  onFailure(): void;
}, dependencies: BootstrapDependencies = defaults): Promise<PeerLive2DRenderer | null> {
  let failed = false;
  const fail = () => {
    if (failed || input.signal.aborted) return;
    failed = true;
    input.onFailure();
  };

  try {
    const package_ = await dependencies.loadPackage('peer-axia', input.signal);
    if (input.signal.aborted) return null;
    if (!package_) {
      fail();
      return null;
    }

    await dependencies.ensureCore(package_.coreSource);
    if (input.signal.aborted) return null;

    const { createPeerLive2DRenderer } = await dependencies.importRenderer();
    if (input.signal.aborted) return null;

    const renderer = await createPeerLive2DRenderer({
      host: input.host,
      package: package_,
      initialState: input.state,
      onFailure: fail,
    });
    if (input.signal.aborted) {
      renderer.destroy();
      return null;
    }
    return renderer;
  } catch {
    fail();
    return null;
  }
}
