import { expect, test } from 'bun:test';
import { bootstrapPeerLive2D } from '../../src/client/live2d/bootstrap';
import type {
  CreatePeerLive2DRenderer,
  PeerLive2DRenderer,
  PeerVisualState,
} from '../../src/client/live2d/contracts';
import type { PeerLive2DPackage } from '../../src/client/live2d/private-package';

const state: PeerVisualState = {
  phase: 'calm', expression: 'neutral', mouth: 'closed',
};
const package_: PeerLive2DPackage = {
  manifest: {
    version: 1,
    modelFile: 'runtime/axia.model3.json',
    coreFile: 'runtime/live2dcubismcore.min.js',
    modelFiles: ['runtime/axia.model3.json'],
  },
  coreSource: 'globalThis.Live2DCubismCore = {};',
  modelFiles: [],
};
const renderer: PeerLive2DRenderer = {
  setState() {},
  setPaused() {},
  destroy() {},
};

test('loads package, installs Core, then imports and creates the renderer', async () => {
  const calls: string[] = [];
  const result = await bootstrapPeerLive2D({
    host: {} as HTMLElement,
    state,
    signal: new AbortController().signal,
    onFailure: () => calls.push('failure'),
  }, {
    loadPackage: async () => { calls.push('package'); return package_; },
    ensureCore: async () => { calls.push('core'); },
    importRenderer: async () => {
      calls.push('import');
      return {
        createPeerLive2DRenderer: (async () => {
          calls.push('create');
          return renderer;
        }) as CreatePeerLive2DRenderer,
      };
    },
  });

  expect(result).toBe(renderer);
  expect(calls).toEqual(['package', 'core', 'import', 'create']);
});

test('missing package and failed Core never import the renderer', async () => {
  for (const mode of ['missing', 'core'] as const) {
    const calls: string[] = [];
    const result = await bootstrapPeerLive2D({
      host: {} as HTMLElement,
      state,
      signal: new AbortController().signal,
      onFailure: () => calls.push('failure'),
    }, {
      loadPackage: async () => { calls.push('package'); return mode === 'missing' ? null : package_; },
      ensureCore: async () => {
        calls.push('core');
        if (mode === 'core') throw new Error('core failed');
      },
      importRenderer: async () => {
        calls.push('import');
        return { createPeerLive2DRenderer: async () => renderer };
      },
    });

    expect(result, mode).toBeNull();
    expect(calls, mode).not.toContain('import');
    expect(calls.filter((call) => call === 'failure'), mode).toHaveLength(1);
  }
});

test('coalesces renderer callback and thrown failure into one fallback signal', async () => {
  let failures = 0;
  const result = await bootstrapPeerLive2D({
    host: {} as HTMLElement,
    state,
    signal: new AbortController().signal,
    onFailure: () => { failures += 1; },
  }, {
    loadPackage: async () => package_,
    ensureCore: async () => {},
    importRenderer: async () => ({
      createPeerLive2DRenderer: async ({ onFailure }) => {
        onFailure();
        throw new Error('renderer failed');
      },
    }),
  });

  expect(result).toBeNull();
  expect(failures).toBe(1);
});
