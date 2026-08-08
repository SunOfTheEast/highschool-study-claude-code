import type { ImageContent } from '@earendil-works/pi-ai';
import {
  createAgentSession,
  createEventBus,
  ModelRuntime,
  SessionManager,
  type AgentSessionEvent,
  type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import { createPlanCompactionPrompt } from './plan-compaction';
import { createLessonTools } from './lesson-tools';
import { createPlanTools } from './plan-tools';
import { createMetaTools } from './meta-tools';
import { createRoleResourceLoader } from './resource-loader';
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
) {
  if (isMetaScope(scope)) {
    if (!manager) throw new Error('META_SESSION_MANAGER_REQUIRED');
    return createMetaTools(root, manager);
  }
  if (isNodeSessionScope(scope)) return customToolsForNode(root, scope, manager);
  if (!manager) throw new Error('FREE_LEARNING_SESSION_MANAGER_REQUIRED');
  return createFreeLearningTools(root, scope, manager);
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

export async function createPiSessionFactory(root: string): Promise<StudySessionFactory> {
  recoverSessionFactoryState(root);
  configureStudySubagentDirectory();
  const modelRuntime = await ModelRuntime.create();
  return async ({ sessionFile, ...scope }) => {
    const eventBus = createEventBus();
    const manager = sessionFile
      ? SessionManager.open(sessionFile, undefined, root)
      : SessionManager.create(root);
    if (!sessionFile) {
      manager.appendSessionInfo(isFreeLearningScope(scope) || isMetaScope(scope)
        ? scope.title
        : `${scope.nodeKind} · ${scope.nodeId}`);
      appendSessionOwner(manager, scope);
    }
    const resourceLoader = await createRoleResourceLoader(root, scope, eventBus);
    const customTools = customToolsForSession(root, scope, manager);
    const { session } = await createAgentSession({
      cwd: root,
      modelRuntime,
      resourceLoader,
      sessionManager: manager,
      customTools,
      tools: [...(isMetaScope(scope)
        ? META_MODEL_TOOLS
        : isFreeLearningScope(scope)
          ? modelToolsForFreeLearning(memoryEnabled(root))
          : modelToolsForNode(scope.nodeKind, memoryEnabled(root)))],
    });
    await bindStudyExtensions(session);
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
        compaction.dispose();
        session.dispose();
      },
    };
  };
}
