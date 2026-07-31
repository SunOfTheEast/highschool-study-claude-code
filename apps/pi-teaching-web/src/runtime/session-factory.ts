import type { ImageContent } from '@earendil-works/pi-ai';
import {
  createAgentSession,
  createEventBus,
  ModelRuntime,
  SessionManager,
  type AgentSessionEvent,
  type SessionEntry,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type {
  MemoryReviewSnapshot,
} from '../memory-review/contracts';
import { MemoryReviewStore } from '../memory-review/store';
import { createMemoryReviewProposeTool } from '../memory-review/tool';
import type { WorkflowSnapshot } from '../workflows/contracts';
import { DeepWorkflowRuntime } from '../workflows/runtime';
import { WorkflowStore } from '../workflows/store';
import { createDeepWorkflowTool } from '../workflows/tool';
import { createClassroomUpdateTool } from './classroom-update';
import { createCardAlternativeAppendTool } from './card-alternative-append';
import { createLessonCloseTool } from './lesson-close';
import { createLessonPrepareTool } from './lesson-prepare';
import { NodeAccessPolicy } from './node-access';
import {
  compileNodeContext,
  newlyResolvableContextIndexes,
} from './node-context';
import { createPlanPrepareTool } from './plan-prepare';
import { createPlanUpdateTool } from './plan-update';
import { createRoadmapUpdateTool } from './roadmap-update';
import { createRoleResourceLoader } from './resource-loader';
import { appendSessionOwner } from './session-owner';
import {
  isRoadmapCoachScope,
  roleForNode,
  roleToolNames,
  scopeToolNames,
  sessionKeyForNode,
  type NodeSessionScope,
  type SessionRole,
} from './session-scope';
import { createStudyTools } from './study-tools';
export type { SessionRole } from './session-scope';

export interface StudySession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: readonly unknown[];
  readonly entries: readonly SessionEntry[];
  readonly isStreaming: boolean;
  refreshNodeContext?(): Promise<void>;
  personaId(): string | null;
  setPersona(id: string, content: string): Promise<void>;
  deepModeEnabled(): boolean;
  setDeepMode(enabled: boolean): void;
  workflows(): WorkflowSnapshot[];
  memoryReview(): MemoryReviewSnapshot | null;
  saveMemoryReview(snapshot: MemoryReviewSnapshot): void;
  notifyMemoryReviewApplied(
    snapshot: Extract<MemoryReviewSnapshot, { status: 'applied' }>,
  ): Promise<void>;
  confirmWorkflow(id: string): Promise<WorkflowSnapshot>;
  cancelWorkflow(id: string): void;
  subscribeWorkflows(listener: (snapshot: WorkflowSnapshot) => void): () => void;
  triggerLessonStart(): Promise<void>;
  prompt(text: string, images?: ImageContent[]): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  dispose(): void;
}

export type SessionFactoryInput = NodeSessionScope & {
  readonly role: SessionRole;
  readonly ownerId: string;
  readonly ownerPath: string;
  sessionFile: string | null;
};

export type StudySessionFactory = (input: SessionFactoryInput) => Promise<StudySession>;

export function sessionFactoryInput(
  scope: NodeSessionScope,
  sessionFile: string | null,
): SessionFactoryInput {
  return {
    ...scope,
    role: roleForNode(scope.nodeKind),
    ownerId: scope.nodeId,
    ownerPath: scope.nodePath,
    sessionFile,
  };
}

type PiAgentSession = Awaited<ReturnType<typeof createAgentSession>>['session'];

export async function bindStudyExtensions(
  session: Pick<PiAgentSession, 'bindExtensions'>,
): Promise<void> {
  await session.bindExtensions({});
}

export type AgentEndSource = Pick<StudySession, 'subscribe'>;

export async function triggerAndWaitForAgentEnd(
  source: AgentEndSource,
  trigger: () => Promise<void>,
): Promise<void> {
  let unsubscribe = () => {};
  let ended = false;
  let resolveAgentEnd: () => void = () => {};
  const agentEnd = new Promise<void>((resolve) => {
    resolveAgentEnd = resolve;
  });
  const stop = source.subscribe((event) => {
    if (event.type !== 'agent_end' || event.willRetry) return;
    ended = true;
    unsubscribe();
    resolveAgentEnd();
  });
  unsubscribe = stop;
  if (ended) unsubscribe();

  try {
    await trigger();
    await agentEnd;
  } catch (error) {
    unsubscribe();
    throw error;
  }
}

export function deepModeToolNames(
  current: string[],
  enabled: boolean,
  options: { mandatoryQuickScout: boolean },
): string[] {
  const names = current.filter((name) => name !== 'deep_workflow_propose');
  return enabled || options.mandatoryQuickScout
    ? [...names, 'deep_workflow_propose']
    : names;
}

export function memoryReviewAppliedMessage(
  snapshot: Extract<MemoryReviewSnapshot, { status: 'applied' }>,
) {
  return {
    customType: 'studyforge.memory-review-applied.v1',
    content: JSON.stringify({
      reviewId: snapshot.id,
      planId: snapshot.planId,
      receipt: snapshot.receipt,
      instruction: [
        'The trusted runtime has already applied exactly the student decisions below.',
        'It parsed both complete profile files before and after the atomic write.',
        'Do not reconsider, repropose, or modify this review.',
        'Do not call tools or attempt another profile read; explain only the exact applied decisions and this receipt.',
      ],
      items: snapshot.items,
      decisions: snapshot.decisions,
    }),
    display: false,
  } as const;
}

export { roleToolNames, scopeToolNames } from './session-scope';

export async function createPiSessionFactory(
  root: string,
  now: () => Date,
): Promise<StudySessionFactory> {
  const modelRuntime = await ModelRuntime.create();
  return async ({
    sessionFile,
    role: _derivedRole,
    ownerId: _derivedOwnerId,
    ownerPath: _derivedOwnerPath,
    ...scope
  }) => {
    const role = roleForNode(scope.nodeKind);
    const ownerId = scope.nodeId;
    const ownerPath = scope.nodePath;
    const eventBus = createEventBus();
    const manager = sessionFile
      ? SessionManager.open(sessionFile, undefined, root)
      : SessionManager.create(root);
    if (!sessionFile) {
      manager.appendSessionInfo(`${role === 'coach' ? 'Coach' : 'Tutor'} · ${ownerId}`);
      appendSessionOwner(manager, scope);
    }
    const sessionKey = sessionKeyForNode(scope);
    const workflowRuntime = new DeepWorkflowRuntime(
      sessionKey,
      root,
      eventBus,
      new WorkflowStore(manager),
      now,
    );
    const memoryReviewStore = new MemoryReviewStore(manager);
    const nodeContext = compileNodeContext(root, scope, {
      sessionId: manager.getSessionId(),
    });
    const knownResolvableSources = new Set(nodeContext.resolvableSources);
    const accessPolicy = new NodeAccessPolicy(
      root,
      nodeContext,
      {
        sessionId: manager.getSessionId(),
        sessionEntries: () => manager.getBranch(),
      },
    );
    const loader = await createRoleResourceLoader(root, scope, eventBus, {
      sessionId: manager.getSessionId(),
    });
    const ownerTools: ToolDefinition[] = role === 'tutor'
      ? [
        createClassroomUpdateTool(root, ownerPath, { accessPolicy }),
        createLessonCloseTool(root, ownerPath, {
          sessionId: manager.getSessionId(),
          sessionEntries: () => manager.getBranch(),
          now,
        }),
        createCardAlternativeAppendTool(root, ownerPath, now),
      ]
      : isRoadmapCoachScope(scope)
        ? [
          createRoadmapUpdateTool(root, { now, accessPolicy }),
          createPlanPrepareTool(root, {
            activationSources: [
              ...nodeContext.resolvableSources,
              ...nodeContext.pages.map((page) => page.source),
            ],
          }),
        ]
        : [
          createLessonPrepareTool(root, ownerId, ownerPath, {
            accessPolicy,
            activationSources: [
              ...nodeContext.resolvableSources,
              ...nodeContext.pages.map((page) => page.source),
            ],
          }),
          createPlanUpdateTool(root, ownerPath, { now, accessPolicy }),
          createMemoryReviewProposeTool(
            root,
            ownerId,
            ownerPath,
            memoryReviewStore,
          ),
        ];
    const tools: ToolDefinition[] = [
      ...createStudyTools(root, now, scope, {
        accessPolicy,
        sessionId: manager.getSessionId(),
        sessionEntries: () => manager.getBranch(),
      }),
      ...ownerTools,
      createDeepWorkflowTool(workflowRuntime),
    ];
    const { session } = await createAgentSession({
      cwd: root,
      modelRuntime,
      resourceLoader: loader,
      sessionManager: manager,
      customTools: tools,
      tools: scopeToolNames(scope),
    });
    await bindStudyExtensions(session);
    const applyDeepMode = (enabled: boolean, persist: boolean) => {
      if (persist) workflowRuntime.setEnabled(enabled);
      session.setActiveToolsByName(deepModeToolNames(
        session.getActiveToolNames(),
        enabled,
        {
          mandatoryQuickScout: role === 'coach' && !isRoadmapCoachScope(scope),
        },
      ));
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
      get entries() {
        return manager.getBranch();
      },
      get isStreaming() {
        return session.isStreaming;
      },
      refreshNodeContext: async () => {
        const refreshed = compileNodeContext(root, scope, {
          sessionId: manager.getSessionId(),
        });
        const indexes = newlyResolvableContextIndexes(
          [...knownResolvableSources],
          refreshed,
        );
        const newSources = refreshed.resolvableSources.filter(
          (source) => !knownResolvableSources.has(source),
        );
        if (newSources.length === 0) return;

        accessPolicy.grant(newSources);
        for (const source of newSources) knownResolvableSources.add(source);
        if (indexes.length === 0) return;

        await session.sendCustomMessage({
          customType: 'studyforge.node-context-refresh.v1',
          content: JSON.stringify({
            instruction: [
              'New sealed child Handoffs became available after this parent Session began.',
              'Resolve the handoff handle before reviewing the child or updating the parent.',
              'Use its Claims to distinguish independent work, supported work, boundaries, and open questions; do not infer the whole lesson from Trace alone.',
            ],
            indexes: indexes.map(({ label, source }) => ({ label, source })),
          }),
          display: false,
        }, { triggerTurn: false });
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
      memoryReview: () => (
        role === 'coach' && !isRoadmapCoachScope(scope)
          ? memoryReviewStore.latest()
          : null
      ),
      saveMemoryReview: (snapshot) => {
        if (role !== 'coach' || isRoadmapCoachScope(scope)) {
          throw new Error('MEMORY_REVIEW_PLAN_COACH_ONLY');
        }
        if (snapshot.planId !== ownerId) {
          throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');
        }
        memoryReviewStore.save(snapshot);
      },
      notifyMemoryReviewApplied: async (snapshot) => {
        if (role !== 'coach' || isRoadmapCoachScope(scope)) {
          throw new Error('MEMORY_REVIEW_PLAN_COACH_ONLY');
        }
        if (snapshot.planId !== ownerId || snapshot.status !== 'applied') {
          throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');
        }
        const previousTools = session.getActiveToolNames();
        session.setActiveToolsByName(previousTools.filter(
          (name) => name !== 'memory_review_propose',
        ));
        try {
          await triggerAndWaitForAgentEnd(session, () => session.sendCustomMessage(
            memoryReviewAppliedMessage(snapshot),
            { triggerTurn: true },
          ));
        } finally {
          session.setActiveToolsByName(previousTools);
        }
      },
      confirmWorkflow: (id) => workflowRuntime.confirm(id),
      cancelWorkflow: (id) => workflowRuntime.cancel(id),
      subscribeWorkflows: (listener) => workflowRuntime.subscribe(listener),
      triggerLessonStart: async () => {
        const resuming = Boolean(sessionFile);
        await triggerAndWaitForAgentEnd(session, () => session.sendCustomMessage({
          customType: resuming
            ? 'studyforge.lesson-resume.v1'
            : 'studyforge.lesson-start.v1',
          content: JSON.stringify({
            lessonId: ownerId,
            instruction: resuming
              ? 'The student clicked Continue. Resume from the recorded active block without asking whether they are ready.'
              : 'The student clicked Start. This is consent to begin. Activate orientation and present the first answerable Student View without asking whether they are ready.',
          }),
          display: false,
        }, { triggerTurn: true }));
      },
      prompt: (text, images = []) => session.prompt(text, { images }),
      abort: () => session.abort(),
      subscribe: (listener) => session.subscribe(listener),
      dispose: () => session.dispose(),
    };
  };
}
