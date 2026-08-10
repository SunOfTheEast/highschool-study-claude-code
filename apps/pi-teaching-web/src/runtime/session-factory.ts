import type { ImageContent } from '@earendil-works/pi-ai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createAgentSession,
  createEventBus,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
  type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import { createPlanCompactionPrompt } from './plan-compaction';
import { createLessonTools } from './lesson-tools';
import { createPlanTools } from './plan-tools';
import { createMetaTools } from './meta-tools';
import {
  createRoleResourceLoader,
  resolveStudyForgeResourceRoot,
} from './resource-loader';
import { appendSessionOwner } from './session-owner';
import {
  isFreeLearningScope,
  isMetaScope,
  isNodeSessionScope,
  META_MODEL_TOOLS,
  modelToolsForFreeLearning,
  modelToolsForNode,
  type NodeSessionScope,
  type StudySessionScope,
} from './session-scope';
import { configureStudySubagentDirectory } from './subagent-path';
import { memoryEnabled } from './memory-tools';
import { recoverDocumentTransactions } from './multi-document-transaction';
import { createFreeLearningTools } from './free-learning-tools';
import {
  clearSettledPendingMemoryToolResults,
  reconcilePendingMemoryToolResults,
} from './pending-tool-results';
import type { DesktopModelSelection } from '../desktop/contracts';
import { DesktopModelService } from '../desktop/model-service';
import { createPeerResponder, type PeerResponder } from './peer-runner';

export interface StudySession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: readonly unknown[];
  readonly entries: readonly SessionEntry[];
  readonly isStreaming: boolean;
  prompt(text: string, images?: ImageContent[]): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  appendCustomEntry?(customType: string, data?: unknown): void;
  dispose(): void;
}

export type SessionFactoryInput = StudySessionScope & {
  sessionFile: string | null;
};

export type StudySessionFactory = (input: SessionFactoryInput) => Promise<StudySession>;

export type PiRuntimeOptions = {
  agentDir: string;
  authPath: string;
  modelsPath: string;
  sessionsDir: string;
  teacher: DesktopModelSelection;
  scout: DesktopModelSelection;
};

export function sessionFactoryInput(
  scope: StudySessionScope,
  sessionFile: string | null,
): SessionFactoryInput {
  return { ...scope, sessionFile };
}

export function customToolsForNode(
  root: string,
  scope: NodeSessionScope,
  manager?: Pick<SessionManager, 'getSessionId' | 'getBranch'>,
) {
  if (scope.nodeKind === 'lesson') return createLessonTools(root, scope.nodePath, manager);
  if (scope.nodeKind === 'plan') return createPlanTools(root, scope, manager);
  return [];
}

export function customToolsForSession(
  root: string,
  scope: StudySessionScope,
  manager?: Pick<SessionManager, 'getSessionId' | 'getBranch'>,
  peerResponder?: PeerResponder,
) {
  if (isMetaScope(scope)) return createMetaTools(root);
  if (isNodeSessionScope(scope)) return customToolsForNode(root, scope, manager);
  if (!manager) throw new Error('FREE_LEARNING_SESSION_MANAGER_REQUIRED');
  return createFreeLearningTools(root, scope, manager, peerResponder);
}

type PiAgentSession = Awaited<ReturnType<typeof createAgentSession>>['session'];

export async function bindStudyExtensions(
  session: Pick<PiAgentSession, 'bindExtensions'>,
): Promise<void> {
  await session.bindExtensions({});
}

export function recoverSessionFactoryState(root: string): string[] {
  return recoverDocumentTransactions(root);
}

export function recoverOpenedSessionState(
  root: string,
  manager: Pick<SessionManager, 'getSessionId' | 'getBranch' | 'appendMessage'>,
): void {
  reconcilePendingMemoryToolResults(root, manager);
}

export function createStudySessionManager(
  root: string,
  sessionFile: string | null,
  sessionsDir?: string,
): SessionManager {
  return sessionFile
    ? SessionManager.open(sessionFile, sessionsDir, root)
    : SessionManager.create(root, sessionsDir);
}

export async function createPiSessionFactory(
  root: string,
  options?: PiRuntimeOptions,
): Promise<StudySessionFactory> {
  recoverSessionFactoryState(root);
  configureStudySubagentDirectory();
  if (options) {
    process.env.PI_CODING_AGENT_DIR = options.agentDir;
    process.env.PI_CODING_AGENT_SESSION_DIR = options.sessionsDir;
  }
  const modelRuntime = await ModelRuntime.create(options
    ? { authPath: options.authPath, modelsPath: options.modelsPath }
    : undefined);
  const modelService = options ? new DesktopModelService(modelRuntime) : undefined;
  const model = options ? await modelService!.resolve(options.teacher) : undefined;
  const peerModel = options ? await modelService!.resolve(options.scout) : undefined;
  const peerResponder = options
    ? createPeerResponder(
      (context, requestOptions) => modelRuntime.completeSimple(
        peerModel!,
        context,
        requestOptions,
      ),
      options.scout.thinking,
      readFileSync(join(resolveStudyForgeResourceRoot(), 'peers', 'acheng.md'), 'utf8'),
    )
    : undefined;
  const settingsManager = options ? SettingsManager.create(root, options.agentDir) : undefined;
  return async ({ sessionFile, ...scope }) => {
    const eventBus = createEventBus();
    const manager = createStudySessionManager(root, sessionFile, options?.sessionsDir);
    if (!sessionFile) {
      manager.appendSessionInfo(isFreeLearningScope(scope) || isMetaScope(scope)
        ? scope.title
        : `${scope.nodeKind} · ${scope.nodeId}`);
      appendSessionOwner(manager, scope);
    } else {
      recoverOpenedSessionState(root, manager);
    }
    const resourceLoader = await createRoleResourceLoader(root, scope, eventBus);
    const customTools = customToolsForSession(root, scope, manager, peerResponder);
    const { session } = await createAgentSession({
      cwd: root,
      modelRuntime,
      ...(options ? {
        agentDir: options.agentDir,
        model: model!,
        thinkingLevel: options.teacher.thinking,
        settingsManager: settingsManager!,
      } : {}),
      resourceLoader,
      sessionManager: manager,
      customTools,
      tools: [...(isMetaScope(scope)
        ? META_MODEL_TOOLS
        : isFreeLearningScope(scope)
          ? modelToolsForFreeLearning(memoryEnabled(root), Boolean(peerResponder))
          : modelToolsForNode(scope.nodeKind, memoryEnabled(root)))],
    });
    await bindStudyExtensions(session);
    const disposePendingCleanup = session.subscribe((event) => {
      if (event.type !== 'turn_end' || event.toolResults.length === 0) return;
      clearSettledPendingMemoryToolResults(root, manager);
    });
    const compaction = !isNodeSessionScope(scope)
      ? {
        prompt: (text: string, images: ImageContent[] = []) => session.prompt(text, { images }),
        dispose: () => {},
      }
      : createPlanCompactionPrompt(session, scope);
    return {
      get sessionId() {
        return session.sessionId;
      },
      get sessionFile() {
        return session.sessionFile;
      },
      get messages() {
        return session.messages;
      },
      get entries() {
        return manager.getBranch();
      },
      get isStreaming() {
        return session.isStreaming;
      },
      prompt: compaction.prompt,
      abort: () => session.abort(),
      subscribe: (listener) => session.subscribe(listener),
      appendCustomEntry: (customType, data) => {
        manager.appendCustomEntry(customType, data);
      },
      dispose: () => {
        disposePendingCleanup();
        compaction.dispose();
        session.dispose();
      },
    };
  };
}
