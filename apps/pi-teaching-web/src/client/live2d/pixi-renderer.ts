import { Application, extensions } from 'pixi.js';
import {
  config,
  Live2DModel,
  Live2DPlugin,
} from 'untitled-pixi-live2d-engine/cubism';
import * as CubismModule from 'untitled-pixi-live2d-engine/cubism';
import type {
  CreatePeerLive2DRenderer,
  PeerPresencePhase,
  PeerVisualDriver,
} from './contracts';
import { createPeerVisualController } from './state';

let pluginRegistered = false;

config.sound = false;

type CubismCoreModel = {
  addParameterValueById(id: unknown, value: number, weight?: number): void;
};

const CubismFramework = (CubismModule as unknown as {
  CubismFramework: {
    getIdManager(): { getId(id: string): unknown };
  };
}).CubismFramework;

export const createPeerLive2DRenderer: CreatePeerLive2DRenderer = async ({
  host,
  package: package_,
  initialState,
  onFailure,
}) => {
  let app: Application | null = null;
  let failed = false;

  const fail = () => {
    if (failed) return;
    failed = true;
    (app?.canvas as HTMLCanvasElement | null)?.remove();
    onFailure();
  };

  try {
    if (!pluginRegistered) {
      extensions.add(Live2DPlugin);
      pluginRegistered = true;
    }

    app = new Application();
    await app.init({
      preference: 'webgl',
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
      resizeTo: host,
    });

    const model = await Live2DModel.from(package_.modelFiles as never, {
      ticker: app.ticker,
      anchorMode: 'drawable',
      breathDepth: 0.35,
      eyeBlink: true,
      textureOptions: { lod: 'single-auto' },
    });
    model.anchor.set(0.5, 1);
    app.stage.addChild(model);

    const place = () => {
      const bounds = model.bounds;
      if (!bounds.width || !bounds.height || !host.clientWidth || !host.clientHeight) return;
      const scale = Math.min(
        host.clientWidth * 0.96 / bounds.width,
        host.clientHeight * 0.98 / bounds.height,
      );
      model.scale.set(scale);
      model.position.set(host.clientWidth / 2, host.clientHeight);
    };
    place();

    let phase: PeerPresencePhase = initialState.phase;
    let mouth = 0;
    let mouthGoal = 0;
    let elapsed = 0;
    const mouthId = CubismFramework.getIdManager().getId('ParamMouthOpenY');
    const applyMouth = () => {
      (model.internalModel.coreModel as CubismCoreModel)
        .addParameterValueById(mouthId, mouth, 1);
    };
    model.internalModel.on('beforeModelUpdate', applyMouth);

    const animate = () => {
      const delta = app!.ticker.deltaMS;
      mouth += (mouthGoal - mouth) * Math.min(1, delta / 90);
      elapsed += delta;
      if (phase === 'calm') {
        const drift = elapsed / 9_000;
        model.focus(
          host.clientWidth * (0.5 + Math.sin(drift) * 0.025),
          host.clientHeight * (0.42 + Math.cos(drift * 0.8) * 0.015),
        );
      }
    };
    app.ticker.add(animate);

    const canvas = app.canvas;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.addEventListener('webglcontextlost', fail);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(place);
    resizeObserver?.observe(host);
    if (!resizeObserver) window.addEventListener('resize', place);

    let destroyed = false;
    const driver: PeerVisualDriver = {
      setAttention(next) {
        phase = next;
        if (next === 'thinking') {
          model.focus(host.clientWidth * 0.28, host.clientHeight * 0.42);
        } else if (next === 'speaking') {
          model.focus(host.clientWidth * 0.34, host.clientHeight * 0.4);
        }
      },
      setExpression(expression) {
        void model.expression(expression).then((resolved) => {
          if (!resolved) fail();
        }).catch(fail);
      },
      setMouthTarget(value) {
        mouthGoal = value;
      },
      setPaused(paused) {
        if (paused) app!.ticker.stop();
        else app!.ticker.start();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        resizeObserver?.disconnect();
        if (!resizeObserver) window.removeEventListener('resize', place);
        canvas.removeEventListener('webglcontextlost', fail);
        app!.ticker.remove(animate);
        model.internalModel.off('beforeModelUpdate', applyMouth);
        model.removeFromParent();
        model.destroy({ children: true, texture: true, baseTexture: true });
        app!.destroy(
          { removeView: true },
          { children: true, texture: true, textureSource: true, context: true },
        );
        app = null;
      },
    };

    const controller = createPeerVisualController(driver, initialState);
    host.append(canvas);
    return controller;
  } catch (error) {
    if (app) {
      try {
        app.destroy(
          { removeView: true },
          { children: true, texture: true, textureSource: true, context: true },
        );
      } catch {
        // Preserve the original renderer failure.
      }
    }
    fail();
    throw error;
  }
};
