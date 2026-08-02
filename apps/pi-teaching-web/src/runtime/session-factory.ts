import type { ImageContent } from '@earendil-works/pi-ai';
import {
  createAgentSession,
  createEventBus,
  ModelRuntime,
  SessionManager,
  type AgentSessionEvent,
  type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import { createRoleResourceLoader } from './resource-loader';
import { appendSessionOwner } from './session-owner';
import { M0_MODEL_TOOLS, type NodeSessionScope } from './session-scope';

export interface StudySession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: readonly unknown[];
  readonly entries: readonly SessionEntry[];
  readonly isStreaming: boolean;
  prompt(text: string, images?: ImageContent[]): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  dispose(): void;
}

export type SessionFactoryInput = NodeSessionScope & {
  sessionFile: string | null;
};

export type StudySessionFactory = (input: SessionFactoryInput) => Promise<StudySession>;

export function sessionFactoryInput(
  scope: NodeSessionScope,
  sessionFile: string | null,
): SessionFactoryInput {
  return { ...scope, sessionFile };
}

type PiAgentSession = Awaited<ReturnType<typeof createAgentSession>>['session'];

export async function bindStudyExtensions(
  session: Pick<PiAgentSession, 'bindExtensions'>,
): Promise<void> {
  await session.bindExtensions({});
}

export async function createPiSessionFactory(root: string): Promise<StudySessionFactory> {
  const modelRuntime = await ModelRuntime.create();
  return async ({ sessionFile, ...scope }) => {
    const eventBus = createEventBus();
    const manager = sessionFile
      ? SessionManager.open(sessionFile, undefined, root)
      : SessionManager.create(root);
    if (!sessionFile) {
      manager.appendSessionInfo(`${scope.nodeKind} · ${scope.nodeId}`);
      appendSessionOwner(manager, scope);
    }
    const resourceLoader = await createRoleResourceLoader(root, scope, eventBus);
    const { session } = await createAgentSession({
      cwd: root,
      modelRuntime,
      resourceLoader,
      sessionManager: manager,
      customTools: [],
      tools: [...M0_MODEL_TOOLS],
    });
    await bindStudyExtensions(session);
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
      prompt: (text, images = []) => session.prompt(text, { images }),
      abort: () => session.abort(),
      subscribe: (listener) => session.subscribe(listener),
      dispose: () => session.dispose(),
    };
  };
}
