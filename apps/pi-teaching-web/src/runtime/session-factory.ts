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
import {
  createPaperResearchResponder,
  type PaperResearchResponder,
} from './paper-research-runner';
import { sessionCustomMessageContent } from './session-custom-messages';
import { createCalendarRepository } from '../calendar/appointments';
import type { CalendarRepository } from './calendar-tools';
import { migrateHistoricalProblemReviews } from '../study/problem-attempts';

export interface StudySession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: readonly unknown[];
  readonly entries: readonly SessionEntry[];
  readonly isStreaming: boolean;
  prompt(text: string, images?: ImageContent[]): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  sendCustomMessage(
    customType: string,
    data: unknown,
    options: { triggerTurn: boolean; deliverAs?: 'followUp' },
  ): Promise<void>;
  appendCustomEntry?(customType: string, data?: unknown): void;
  dispose(): void;
}

export type SessionFactoryInput = StudySessionScope & {
  sessionFile: string | null;
};

export type StudySessionFactory = (input: SessionFactoryInput) => Promise<StudySession>;

export type PiRuntimeOptions = {
  appHome: string;
  calendar?: CalendarRepository;
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
  paperResearchResponder?: PaperResearchResponder,
  calendar?: CalendarRepository,
) {
  if (scope.nodeKind === 'lesson') {
    return createLessonTools(
      root,
      scope.nodePath,
      manager,
      paperResearchResponder,
      calendar,
      scope,
    );
  }
  if (scope.nodeKind === 'plan') return createPlanTools(root, scope, manager, calendar);
  return [];
}

export function customToolsForSession(
  root: string,
  scope: StudySessionScope,
  manager?: Pick<SessionManager, 'getSessionId' | 'getBranch'>,
  peerResponder?: PeerResponder,
  paperResearchResponder?: PaperResearchResponder,
  calendar?: CalendarRepository,
) {
  if (isMetaScope(scope)) return createMetaTools(root);
  if (isNodeSessionScope(scope)) {
    return customToolsForNode(root, scope, manager, paperResearchResponder, calendar);
  }
  if (!manager) throw new Error('FREE_LEARNING_SESSION_MANAGER_REQUIRED');
  return createFreeLearningTools(
    root,
    scope,
    manager,
    peerResponder,
    paperResearchResponder,
    calendar,
  );
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
  migrateHistoricalProblemReviews(root);
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
      readFileSync(join(resolveStudyForgeResourceRoot(), 'peers', 'axia.md'), 'utf8'),
    )
    : undefined;
  const paperResearchResponder = options
    ? createPaperResearchResponder({
      complete: (context, requestOptions) => modelRuntime.completeSimple(
        peerModel!,
        context,
        requestOptions,
      ),
      thinking: options.scout.thinking,
      systemPrompt: readFileSync(join(
        resolveStudyForgeResourceRoot(),
        'subagents',
        'paper-research-scout.md',
      ), 'utf8'),
    })
    : undefined;
  const settingsManager = options ? SettingsManager.create(root, options.agentDir) : undefined;
  const calendar = options ? options.calendar ?? createCalendarRepository(options.appHome) : undefined;
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
    const resourceLoader = await createRoleResourceLoader(
      root,
      scope,
      eventBus,
      process.env.STUDY_PERSONA,
      Boolean(calendar),
    );
    const customTools = customToolsForSession(
      root,
      scope,
      manager,
      peerResponder,
      paperResearchResponder,
      calendar,
    );
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
          ? modelToolsForFreeLearning(
            memoryEnabled(root),
            Boolean(peerResponder),
            Boolean(paperResearchResponder),
            Boolean(calendar),
            (scope.intent ?? 'open') === 'review',
          )
          : modelToolsForNode(
            scope.nodeKind,
            memoryEnabled(root),
            Boolean(paperResearchResponder),
            Boolean(calendar),
          ))],
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
      sendCustomMessage: async (customType, data, messageOptions) => {
        const content = sessionCustomMessageContent(customType, data);
        if (!messageOptions.triggerTurn && session.isStreaming) {
          manager.appendCustomMessageEntry(customType, content, true, data);
          return;
        }
        await session.sendCustomMessage({
          customType,
          content,
          display: true,
          details: data,
        }, messageOptions);
      },
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
