import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'bun';
import { loadAppConfig, resolveStudyForgePaths } from '../desktop/app-config';
import { validateLearningSet } from '../desktop/learning-sets';
import { createDesktopModelService } from '../desktop/model-service';
import { createPeerMediaService } from '../desktop/peer-media';
import { writeDesktopPiSettings } from '../desktop/pi-settings';
import { createPiSessionFactory } from '../runtime/session-factory';
import { WorkspaceRegistry } from '../runtime/workspace-registry';
import { createRequestHandler } from './app';
import {
  createDesktopRequestHandler,
  knownDesktopLearningSetRoots,
  withDesktopCors,
} from './desktop-app';
import { EventHub } from './event-hub';
import { createCalendarRepository } from '../calendar/appointments';
import { readCalendarReviewCandidates } from '../calendar/review-candidates';

export type RuntimeArguments = {
  port: number;
  appHome: string | null;
  documentsHome: string | null;
  resourceRoot: string | null;
  token: string | null;
  learningSet: string | null;
  desktop: boolean;
};

export type ReadyReceipt = {
  type: 'studyforge-ready';
  protocol: 1;
  port: number;
  workspace: 'setup' | 'selected';
};

function valueAfter(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

export function parseRuntimeArguments(argv: readonly string[]): RuntimeArguments {
  const rawPort = valueAfter(argv, '--port') ?? process.env.STUDY_WEB_PORT ?? '65000';
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error('STUDYFORGE_PORT_INVALID');
  }
  const appHome = valueAfter(argv, '--app-home');
  const documentsHome = valueAfter(argv, '--documents-home');
  const resourceRoot = valueAfter(argv, '--resource-root');
  const token = valueAfter(argv, '--token');
  const learningSet = valueAfter(argv, '--learning-set') ?? process.env.STUDY_LEARNING_SET ?? null;
  const desktop = appHome !== null || documentsHome !== null || resourceRoot !== null || token !== null;
  if (desktop) {
    for (const value of [appHome, documentsHome, resourceRoot]) {
      if (!value || !isAbsolute(value)) throw new Error('STUDYFORGE_DESKTOP_PATH_INVALID');
    }
    if (!token) throw new Error('STUDYFORGE_DESKTOP_TOKEN_REQUIRED');
  }
  return { port, appHome, documentsHome, resourceRoot, token, learningSet, desktop };
}

export function formatReadyReceipt(input: Pick<ReadyReceipt, 'port' | 'workspace'>): string {
  return JSON.stringify({
    type: 'studyforge-ready',
    protocol: 1,
    port: input.port,
    workspace: input.workspace,
  } satisfies ReadyReceipt);
}

export function parseReadyReceipt(value: string): ReadyReceipt {
  try {
    const parsed = JSON.parse(value) as Partial<ReadyReceipt>;
    if (
      parsed.type !== 'studyforge-ready'
      || parsed.protocol !== 1
      || !Number.isSafeInteger(parsed.port)
      || (parsed.workspace !== 'setup' && parsed.workspace !== 'selected')
    ) throw new Error();
    return parsed as ReadyReceipt;
  } catch {
    throw new Error('STUDYFORGE_READY_RECEIPT_INVALID');
  }
}

function runtimeIssue(error: unknown) {
  const message = error instanceof Error ? error.message : 'RUNTIME_FAILURE';
  if (message.startsWith('STUDYFORGE_MODEL_UNAVAILABLE: ')) {
    return { code: 'MODEL_UNAVAILABLE' as const, detail: message };
  }
  if (message.startsWith('LEARNING_SET_')) {
    return { code: 'LEARNING_SET_INVALID' as const, detail: message };
  }
  return { code: 'RUNTIME_FAILURE' as const, detail: message };
}

export async function startStudyForgeServer(arguments_: RuntimeArguments) {
  const hub = new EventHub();
  const clients = new Set<{ send(data: string): void }>();
  const staticRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
  let registry: WorkspaceRegistry | null = null;
  let teachingHandler = createRequestHandler();
  let desktopHandler: ReturnType<typeof createDesktopRequestHandler> | null = null;
  let issue: ReturnType<typeof runtimeIssue> | null = null;
  let server: Server<undefined>;

  if (arguments_.desktop) {
    const paths = resolveStudyForgePaths({
      appHome: arguments_.appHome!,
      documentsHome: arguments_.documentsHome!,
    });
    process.env.STUDYFORGE_RESOURCE_ROOT = arguments_.resourceRoot!;
    const models = await createDesktopModelService({
      authPath: paths.authPath,
      modelsPath: paths.modelsPath,
    });
    const config = loadAppConfig(paths.appConfigPath);
    const root = arguments_.learningSet ?? config.currentLearningSet;
    if (root && config.teacher && config.scout) {
      try {
        const validation = validateLearningSet(root);
        if (!validation.ok) throw new Error(validation.code);
        writeDesktopPiSettings(paths.settingsPath, {
          sessionsDir: paths.sessionsDir,
          teacher: config.teacher,
          scout: config.scout,
        });
        const calendar = createCalendarRepository(paths.appHome);
        const factory = await createPiSessionFactory(validation.root, {
          appHome: paths.appHome,
          calendar,
          agentDir: paths.agentDir,
          authPath: paths.authPath,
          modelsPath: paths.modelsPath,
          sessionsDir: paths.sessionsDir,
          teacher: config.teacher,
          scout: config.scout,
        });
        registry = new WorkspaceRegistry(validation.root, factory);
        teachingHandler = createRequestHandler({
          root: validation.root,
          registry,
          hub,
          staticRoot,
          calendar,
          knownLearningSetRoots: () => knownDesktopLearningSetRoots(paths),
          reviewCandidates: () => readCalendarReviewCandidates([
            validation.root,
            ...knownDesktopLearningSetRoots(paths),
          ]),
        });
      } catch (error) {
        issue = runtimeIssue(error);
      }
    }
    desktopHandler = createDesktopRequestHandler({
      token: arguments_.token!,
      paths,
      resourceRoot: arguments_.resourceRoot!,
      derivativeExampleRoot: join(arguments_.resourceRoot!, 'examples', 'derivative-m0', 'learning-set'),
      modelService: models,
      peerMedia: createPeerMediaService({
        actorsDir: paths.actorsDir,
        resolveSpeechApiKey: () => models.apiKey('xiaomi'),
      }),
      onMaterialsChanged: () => {
        hub.publish({ type: 'home-invalidated' });
        hub.publish({ type: 'assets-invalidated' });
        hub.publish({ type: 'knowledge-invalidated' });
      },
      runtimeIssue: issue,
      canChangeLearningSet: async () => !registry || await registry.readFocus() === null,
      shutdown: () => {
        registry?.dispose();
        server.stop(true);
      },
    });
  } else {
    const root = resolve(arguments_.learningSet ?? 'learning-set');
    const factory = await createPiSessionFactory(root);
    registry = new WorkspaceRegistry(root, factory);
    teachingHandler = createRequestHandler({ root, registry, hub, staticRoot });
  }

  hub.subscribe((event) => {
    const data = JSON.stringify(event);
    for (const client of clients) client.send(data);
  });

  server = Bun.serve({
    hostname: '127.0.0.1',
    port: arguments_.port,
    fetch: async (request, bunServer) => {
      const desktopResponse = await desktopHandler?.(request);
      if (desktopResponse) return desktopResponse;
      const teachingResponse = await teachingHandler(request, bunServer);
      return arguments_.desktop && teachingResponse
        ? withDesktopCors(request, teachingResponse)
        : teachingResponse;
    },
    websocket: {
      open(socket) {
        clients.add(socket);
      },
      close(socket) {
        clients.delete(socket);
      },
      message() {},
    },
  });
  if (server.port === undefined) {
    server.stop(true);
    throw new Error('STUDYFORGE_PORT_UNAVAILABLE');
  }

  return {
    server,
    receipt: {
      port: server.port,
      workspace: registry ? 'selected' as const : 'setup' as const,
    },
    stop: () => {
      registry?.dispose();
      server.stop(true);
    },
  };
}
