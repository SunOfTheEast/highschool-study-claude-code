import type { ImageContent } from '@earendil-works/pi-ai';
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  type AgentSessionEvent,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { createClassroomUpdateTool } from './classroom-update';
import { createRoleResourceLoader, type SessionRole } from './resource-loader';
import { createStudyTools } from './study-tools';

export interface StudySession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: readonly unknown[];
  readonly isStreaming: boolean;
  prompt(text: string, images?: ImageContent[]): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  dispose(): void;
}

export type SessionFactoryInput = {
  role: SessionRole;
  ownerId: string;
  sessionFile: string | null;
};

export type StudySessionFactory = (input: SessionFactoryInput) => Promise<StudySession>;

export function roleToolNames(role: SessionRole): string[] {
  return role === 'coach'
    ? [
      'read',
      'grep',
      'find',
      'ls',
      'write',
      'edit',
      'card_search',
      'trace_search',
      'source_resolve',
    ]
    : [
      'read',
      'grep',
      'find',
      'ls',
      'card_search',
      'trace_search',
      'trace_append',
      'source_resolve',
      'classroom_update',
    ];
}

export async function createPiSessionFactory(
  root: string,
  now: () => Date,
): Promise<StudySessionFactory> {
  const modelRuntime = await ModelRuntime.create();
  return async ({ role, ownerId, sessionFile }) => {
    const manager = sessionFile
      ? SessionManager.open(sessionFile, undefined, root)
      : SessionManager.create(root);
    if (!sessionFile) {
      manager.appendSessionInfo(`${role === 'coach' ? 'Coach' : 'Tutor'} · ${ownerId}`);
    }
    const loader = await createRoleResourceLoader(root, role, ownerId);
    const tools: ToolDefinition[] = [
      ...createStudyTools(root, now),
      ...(role === 'tutor' ? [createClassroomUpdateTool(root)] : []),
    ];
    const { session } = await createAgentSession({
      cwd: root,
      modelRuntime,
      resourceLoader: loader,
      sessionManager: manager,
      customTools: tools,
      tools: roleToolNames(role),
    });
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
