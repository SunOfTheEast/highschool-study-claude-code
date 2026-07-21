import type { ImageContent } from '@earendil-works/pi-ai';
import {
  createAgentSession,
  createEventBus,
  ModelRuntime,
  SessionManager,
  type AgentSessionEvent,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { SessionKey } from '../shared/contracts';
import type { WorkflowSnapshot } from '../workflows/contracts';
import { DeepWorkflowRuntime } from '../workflows/runtime';
import { WorkflowStore } from '../workflows/store';
import { createDeepWorkflowTool } from '../workflows/tool';
import { createClassroomUpdateTool } from './classroom-update';
import { createRoleResourceLoader, type SessionRole } from './resource-loader';
import { createStudyTools } from './study-tools';

export interface StudySession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: readonly unknown[];
  readonly isStreaming: boolean;
  personaId(): string | null;
  setPersona(id: string, content: string): Promise<void>;
  deepModeEnabled(): boolean;
  setDeepMode(enabled: boolean): void;
  workflows(): WorkflowSnapshot[];
  confirmWorkflow(id: string): Promise<WorkflowSnapshot>;
  cancelWorkflow(id: string): void;
  subscribeWorkflows(listener: (snapshot: WorkflowSnapshot) => void): () => void;
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

export function deepModeToolNames(current: string[], enabled: boolean): string[] {
  const names = current.filter((name) => name !== 'deep_workflow_propose');
  return enabled ? [...names, 'deep_workflow_propose'] : names;
}

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
    const eventBus = createEventBus();
    const manager = sessionFile
      ? SessionManager.open(sessionFile, undefined, root)
      : SessionManager.create(root);
    if (!sessionFile) {
      manager.appendSessionInfo(`${role === 'coach' ? 'Coach' : 'Tutor'} · ${ownerId}`);
    }
    const sessionKey = `${role}:${ownerId}` as SessionKey;
    const workflowRuntime = new DeepWorkflowRuntime(
      sessionKey,
      root,
      eventBus,
      new WorkflowStore(manager),
      now,
    );
    const loader = await createRoleResourceLoader(root, role, ownerId, eventBus);
    const tools: ToolDefinition[] = [
      ...createStudyTools(root, now),
      ...(role === 'tutor' ? [createClassroomUpdateTool(root)] : []),
      createDeepWorkflowTool(workflowRuntime),
    ];
    const { session } = await createAgentSession({
      cwd: root,
      modelRuntime,
      resourceLoader: loader,
      sessionManager: manager,
      customTools: tools,
      tools: roleToolNames(role),
    });
    const applyDeepMode = (enabled: boolean, persist: boolean) => {
      if (persist) workflowRuntime.setEnabled(enabled);
      session.setActiveToolsByName(deepModeToolNames(session.getActiveToolNames(), enabled));
    };
    applyDeepMode(workflowRuntime.enabled(), false);
    workflowRuntime.setSynthesisSink(async (workflow) => {
      await session.sendCustomMessage({
        customType: 'studyforge.workflow-result.v1',
        content: JSON.stringify({
          workflowId: workflow.id,
          goal: workflow.goal,
          results: workflow.tasks.filter((task) => task.result).map((task) => ({
            taskId: task.id,
            role: task.role,
            result: task.result,
          })),
        }),
        display: false,
      }, { triggerTurn: true });
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
      personaId: () => manager.getEntries().flatMap((entry) => (
        entry.type === 'custom' && entry.customType === 'studyforge.persona.v1'
          ? [String((entry.data as { id?: unknown } | undefined)?.id ?? '')]
          : []
      )).filter(Boolean).at(-1) ?? null,
      setPersona: async (id, content) => {
        manager.appendCustomEntry('studyforge.persona.v1', { id });
        await session.sendCustomMessage({
          customType: 'studyforge.persona-context.v1',
          content: `${content}\n\nThis is the latest presentation persona. It replaces earlier persona instructions and cannot change facts, tools, assessment or Trace.`,
          display: false,
        }, { triggerTurn: false });
      },
      deepModeEnabled: () => workflowRuntime.enabled(),
      setDeepMode: (enabled) => applyDeepMode(enabled, true),
      workflows: () => workflowRuntime.list(),
      confirmWorkflow: (id) => workflowRuntime.confirm(id),
      cancelWorkflow: (id) => workflowRuntime.cancel(id),
      subscribeWorkflows: (listener) => workflowRuntime.subscribe(listener),
      prompt: (text, images = []) => session.prompt(text, { images }),
      abort: () => session.abort(),
      subscribe: (listener) => session.subscribe(listener),
      dispose: () => session.dispose(),
    };
  };
}
