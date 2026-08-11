import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { Server } from 'bun';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { projectConversationEntries, projectLiveSessionEvent } from '../projection/conversation';
import { NodeLifecycleService } from '../runtime/node-lifecycle';
import type { WorkspaceRegistry } from '../runtime/workspace-registry';
import type {
  CalendarDestination,
  CalendarLaunchReceipt,
  LearningContextReference,
  LearningNoteBlock,
  ProblemAttemptResponse,
  ReviewResult,
  SemanticTagDraft,
  SessionKey,
} from '../shared/contracts';
import { parseHandoutBlockSegment } from '../shared/handout-route';
import { readKnowledge } from '../study/knowledge';
import { readLessonHandout } from '../study/lesson-handout';
import { readCourseTree, StudyDocumentError } from '../study/markdown';
import { readWorkspace } from '../study/workspace';
import { readLearningSetHome } from '../study/learning-set-home';
import {
  planLearningNoteSave,
  planProblemCardSave,
  readLearningAssetLibrary,
  readLearningNote,
  readProblemCard,
  readStudentProblemCard,
} from '../study/learning-assets';
import {
  readProblemActivity,
  recordProblemAttempt,
  revealProblemAnswer,
} from '../study/problem-attempts';
import { commitDocumentCandidates } from '../runtime/multi-document-transaction';
import {
  importMaterial,
  listMaterials,
  readMaterialLocator,
  readMaterialView,
} from '../study/materials';
import {
  projectSemanticRelations,
  querySemanticRecall,
  refreshSemanticRecallIndex,
} from '../study/semantic-index';
import { projectAssetFormation } from '../study/display-projections';
import {
  planSemanticTagsSave,
  readSemanticTags,
  semanticTagsPath,
  type SemanticTags,
} from '../study/semantic-tags';
import { readLearningFootprint } from '../study/learning-footprint';
import { isProblemCardId } from '../study/problem-card-id';
import type { EventHub } from './event-hub';
import { publicSessionErrorText } from '../client/public-errors';
import type { FocusCycleSnapshot, FocusEnded, FocusTargetSeconds } from '../time/focus-cycle';
import type { CalendarRepository } from '../runtime/calendar-tools';
import type { CalendarAppointmentDraft, CalendarAppointmentPatch } from '../calendar/appointments';
import {
  localDateAt,
  readAssetReviewHistory,
  recordAssetReviewEvent,
  type AssetReviewEventDraft,
} from '../study/asset-reviews';

type Lifecycle = Pick<
  NodeLifecycleService,
  'startPlan' | 'startLesson'
>;

type Registry = Pick<
  WorkspaceRegistry,
  | 'readHistory'
  | 'send'
  | 'subscribe'
  | 'open'
  | 'abort'
  | 'release'
  | 'createFreeLearning'
  | 'listFreeLearning'
  | 'endFreeLearning'
  | 'createMeta'
  | 'listMeta'
  | 'listOwnedSessionFacts'
  | 'readFocus'
  | 'startFocus'
  | 'pauseFocus'
  | 'resumeFocus'
  | 'endFocus'
  | 'endFocusForSession'
  | 'openCalendarAppointment'
>;

export type AppDependencies = {
  root: string;
  registry: Registry;
  hub: EventHub;
  lifecycle?: Lifecycle;
  staticRoot?: string;
  readCourse?: typeof readWorkspace;
  readKnowledge?: typeof readKnowledge;
  calendar?: CalendarRepository;
};

const json = (value: unknown, status = 200) => Response.json(value, { status });
const MAX_MATERIAL_BYTES = 32 * 1024 * 1024;
const materialMediaTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/html',
  'text/csv',
  'application/json',
  'application/xml',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

function publicFocus(value: FocusCycleSnapshot | null) {
  if (!value) return null;
  return {
    sessionKey: value.sessionKey,
    targetSeconds: value.targetSeconds,
    startedAt: value.startedAt,
    status: value.status,
    elapsedSeconds: value.elapsedSeconds,
    remainingSeconds: value.remainingSeconds,
    expiresAt: value.expiresAt,
  };
}

function publicFocusEnd(value: FocusEnded) {
  return {
    targetSeconds: value.targetSeconds,
    elapsedSeconds: value.elapsedSeconds,
    endedAt: value.endedAt,
    reason: value.reason,
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof StudyDocumentError) {
    return json({ error: 'STUDY_DOCUMENT_INVALID', path: error.path, reason: error.reason }, 422);
  }
  const message = error instanceof Error ? error.message : String(error);
  const status = /NOT_FOUND|does not exist/.test(message)
    ? 404
    : /STALE|CONFLICT|ENDED|RUNNING|NOT_ACTIVE|NOT_ALLOWED|READ_ONLY|INELIGIBLE|ALREADY_ACTIVE/.test(message)
      ? 409
      : /INVALID|REQUIRED|LIMIT|DUPLICATE|must be|cannot/.test(message)
        ? 400
        : 500;
  return json({ error: message }, status);
}

function sessionKey(value: string): SessionKey | null {
  try {
    const decoded = decodeURIComponent(value);
    const id = '[A-Za-z0-9][A-Za-z0-9._-]*';
    return new RegExp(`^(?:(?:roadmap|plan):${id}|lesson:${id}:${id}|(?:free|meta):${id})$`).test(decoded)
      ? decoded as SessionKey
      : null;
  } catch {
    return null;
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('REQUEST_BODY_INVALID');
  }
  return value as Record<string, unknown>;
}

function requiredBodyString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`${label.toUpperCase()}_REQUIRED`);
  }
  return value.trim();
}

function positiveRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error('EXPECTED_REVISION_INVALID');
  }
  return Number(value);
}

function learningContextReferences(value: unknown): LearningContextReference[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('SELECTED_ASSETS_INVALID');
  if (value.length > 12) throw new Error('SELECTED_CONTEXT_LIMIT_EXCEEDED');
  const seen = new Set<string>();
  return value.map((item) => {
    const reference = objectBody(item);
    const kind = reference.kind;
    const id = reference.id;
    if (typeof id !== 'string') throw new Error('SELECTED_ASSET_INVALID');
    if (kind === 'material') {
      if (!nodeId(id)) throw new Error('SELECTED_ASSET_INVALID');
      const revision = positiveRevision(reference.revision);
      const locator = reference.locator;
      if (locator !== null && (typeof locator !== 'string' || !locator.trim() || /[\r\n\t]/.test(locator))) {
        throw new Error('SELECTED_MATERIAL_LOCATOR_INVALID');
      }
      const selected = { kind: 'material' as const, id, revision, locator: locator as string | null };
      const key = `${kind}:${id}@${revision}#${locator ?? ''}`;
      if (seen.has(key)) throw new Error(`SELECTED_CONTEXT_DUPLICATE: ${key}`);
      seen.add(key);
      return selected;
    }
    if (
      (kind !== 'note' && kind !== 'problem-card')
      || (kind === 'note' ? !nodeId(id) : !isProblemCardId(id))
    ) throw new Error('SELECTED_ASSET_INVALID');
    const key = `${kind}:${id}`;
    if (seen.has(key)) throw new Error(`SELECTED_CONTEXT_DUPLICATE: ${key}`);
    seen.add(key);
    return { kind, id };
  });
}

function calendarDestination(root: string, value: unknown): CalendarDestination {
  const destination = objectBody(value);
  if (destination.kind === 'plan') {
    if (Object.keys(destination).length !== 2 || typeof destination.planId !== 'string') {
      throw new Error('CALENDAR_DESTINATION_INVALID');
    }
    const id = nodeId(destination.planId);
    const plan = id
      ? readCourseTree(root).tree.children.find((candidate) => (
        candidate.kind === 'plan' && candidate.id === id && candidate.status === 'active'
      ))
      : null;
    if (!id || !plan) throw new Error('CALENDAR_PLAN_DESTINATION_INVALID');
    return { kind: 'plan', planId: id };
  }
  if (
    destination.kind !== 'free-learning'
    || (destination.intent !== 'open' && destination.intent !== 'review')
    || !Array.isArray(destination.contexts)
    || Object.keys(destination).length !== 3
  ) throw new Error('CALENDAR_DESTINATION_INVALID');
  const contexts = learningContextReferences(destination.contexts);
  for (const context of contexts) {
    if (context.kind === 'note') readLearningNote(root, context.id);
    else if (context.kind === 'problem-card') readProblemCard(root, context.id);
    else if (context.kind === 'material') readMaterialLocator(root, context);
    else throw new Error('CALENDAR_CONTEXT_INVALID');
  }
  return { kind: 'free-learning', intent: destination.intent, contexts };
}

function calendarDraft(root: string, value: unknown): CalendarAppointmentDraft {
  const body = objectBody(value);
  if (typeof body.title !== 'string' || typeof body.startsAt !== 'string') {
    throw new Error('CALENDAR_APPOINTMENT_INVALID');
  }
  if (body.plannedMinutes !== null && !Number.isSafeInteger(body.plannedMinutes)) {
    throw new Error('CALENDAR_PLANNED_MINUTES_INVALID');
  }
  return {
    title: body.title,
    startsAt: body.startsAt,
    plannedMinutes: body.plannedMinutes as number | null,
    learningSetPath: resolve(root),
    destination: calendarDestination(root, body.destination),
  };
}

function calendarPatch(root: string, value: unknown): {
  expectedRevision: number;
  patch: CalendarAppointmentPatch;
} {
  const body = objectBody(value);
  const expectedRevision = positiveRevision(body.expectedRevision);
  const draft = calendarDraft(root, body);
  return { expectedRevision, patch: draft };
}

function calendarRoute(
  appointment: { destination: CalendarDestination },
  sessionKey: SessionKey,
): string {
  if (appointment.destination.kind === 'plan') {
    if (sessionKey !== `plan:${appointment.destination.planId}`) {
      throw new Error('CALENDAR_LAUNCH_SESSION_MISMATCH');
    }
    return `/course/plan/${encodeURIComponent(appointment.destination.planId)}`;
  }
  if (!sessionKey.startsWith('free:')) throw new Error('CALENDAR_LAUNCH_SESSION_MISMATCH');
  return `/learn/${encodeURIComponent(sessionKey.slice('free:'.length))}`;
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label.toUpperCase()}_INVALID`);
  return value.map((item) => {
    if (typeof item !== 'string') throw new Error(`${label.toUpperCase()}_INVALID`);
    return item;
  });
}

function semanticDraft(value: Record<string, unknown>): SemanticTagDraft {
  return {
    core: stringList(value.core, 'semantic tag core'),
    related: stringList(value.related, 'semantic tag related'),
  };
}

function publicSemanticTags(tags: SemanticTags) {
  return {
    subject: tags.subject,
    revision: tags.revision,
    core: tags.core,
    related: tags.related,
    updatedAt: tags.updatedAt,
  };
}

function assetSemanticTags(root: string, kind: 'note' | 'problem-card', id: string) {
  const subject = { kind, id } as const;
  return existsSync(join(root, semanticTagsPath(subject)))
    ? publicSemanticTags(readSemanticTags(root, subject))
    : null;
}

function refreshSemanticProjection(root: string): string | undefined {
  try {
    refreshSemanticRecallIndex(root);
    return undefined;
  } catch (error) {
    return `SEMANTIC_INDEX_REFRESH_FAILED: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function formText(form: FormData, name: string, required = true): string | null {
  const value = form.get(name);
  if (value === null && !required) return null;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name.toUpperCase()}_REQUIRED`);
  return value.trim();
}

function noteBlocks(value: unknown): LearningNoteBlock[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('NOTE_BLOCKS_REQUIRED');
  return value.map((item) => {
    const block = objectBody(item);
    if (block.kind === 'markdown') {
      return { kind: 'markdown', body: requiredBodyString(block.body, 'note block body') };
    }
    if (block.kind === 'recall') {
      return {
        kind: 'recall',
        prompt: requiredBodyString(block.prompt, 'recall prompt'),
        answer: requiredBodyString(block.answer, 'recall answer'),
      };
    }
    throw new Error('NOTE_BLOCK_KIND_INVALID');
  });
}

function reviewResult(value: unknown): ReviewResult {
  if (value === 'forgot' || value === 'effortful' || value === 'fluent') return value;
  throw new Error('ASSET_REVIEW_RESULT_INVALID');
}

function nodeId(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function problemCardId(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return isProblemCardId(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function safeStaticPath(root: string, pathname: string): string | null {
  const requested = normalize(pathname.replace(/^\/+/, ''));
  if (requested.startsWith('..')) return null;
  const direct = join(root, requested);
  if (extname(direct) && existsSync(direct)) return direct;
  const index = join(root, 'index.html');
  return existsSync(index) ? index : null;
}

export function createRequestHandler(deps?: AppDependencies) {
  const bound = new Map<SessionKey, () => void>();
  const pendingTerminalIntents = new Set<SessionKey>();
  const settledCourseInvalidations = new Set<SessionKey>();
  const calendarLaunches = new Map<string, Promise<CalendarLaunchReceipt>>();

  return async (
    request: Request,
    server?: Server<undefined>,
  ): Promise<Response | undefined> => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, runtime: 'pi-m1' });
    }
    if (!deps) return new Response('Not found', { status: 404 });
    const lifecycle = deps.lifecycle ?? new NodeLifecycleService(deps.root);
    const courseReader = deps.readCourse ?? readWorkspace;
    const knowledgeReader = deps.readKnowledge ?? readKnowledge;

    const bind = async (key: SessionKey) => {
      if (bound.has(key)) return;
      const unsubscribe = await deps.registry.subscribe(key, (event: AgentSessionEvent) => {
        for (const projected of projectLiveSessionEvent(key, event)) {
          deps.hub.publish(projected);
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (event.toolName === 'finish_plan' || event.toolName === 'finish_lesson')
        ) {
          settledCourseInvalidations.add(key);
          if (event.toolName === 'finish_lesson') {
            void deps.registry.endFocusForSession(key).then((ended) => {
              if (ended) deps.hub.publish({ type: 'focus-invalidated' });
            }, () => {});
          }
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (
            event.toolName === 'calendar_create'
            || event.toolName === 'calendar_update'
            || event.toolName === 'calendar_delete'
          )
        ) {
          deps.hub.publish({ type: 'calendar-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (
            event.toolName === 'lesson_memory_commit'
            || event.toolName === 'memory_route_resolve'
          )
        ) {
          deps.hub.publish({ type: 'course-invalidated' });
          deps.hub.publish({ type: 'knowledge-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (
            event.toolName === 'save_note'
            || event.toolName === 'save_problem_card'
            || event.toolName === 'save_prepared_problem_card'
          )
        ) {
          deps.hub.publish({ type: 'home-invalidated' });
          deps.hub.publish({ type: 'assets-invalidated' });
          deps.hub.publish({ type: 'knowledge-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && event.toolName === 'free_learning_memory_commit'
        ) {
          deps.hub.publish({ type: 'knowledge-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && event.toolName === 'create_roadmap'
        ) {
          deps.hub.publish({ type: 'home-invalidated' });
          deps.hub.publish({ type: 'course-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (event.toolName === 'edit' || event.toolName === 'write')
        ) {
          deps.hub.publish({ type: 'course-invalidated' });
          deps.hub.publish({ type: 'knowledge-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (
            event.toolName === 'classroom_log_append'
            || event.toolName === 'classroom_update'
          )
        ) {
          deps.hub.publish({ type: 'course-invalidated' });
        }
        if (event.type === 'agent_end' && !event.willRetry) {
          void deps.registry.readHistory(key).then((entries) => {
            deps.hub.publish({
              type: 'conversation-snapshot',
              sessionKey: key,
              items: projectConversationEntries(key, entries),
            });
          });
        }
      });
      bound.set(key, unsubscribe);
    };

    const queueTurn = async (key: SessionKey, text: string, onSettled?: () => void) => {
      await bind(key);
      deps.hub.publish({ type: 'session-run', sessionKey: key, status: 'running' });
      void deps.registry.send(key, text)
        .catch(() => deps.hub.publish({
          type: 'session-error',
          sessionKey: key,
          message: publicSessionErrorText(),
        }))
        .finally(() => {
          onSettled?.();
          deps.hub.publish({ type: 'session-run', sessionKey: key, status: 'idle' });
          if (settledCourseInvalidations.delete(key)) {
            deps.hub.publish({ type: 'course-invalidated' });
          }
        });
      return json({ accepted: true }, 202);
    };

    const queueTerminalIntent = async (key: SessionKey, text: string) => {
      if (pendingTerminalIntents.has(key)) return json({ accepted: true }, 202);
      pendingTerminalIntents.add(key);
      try {
        return await queueTurn(key, text, () => pendingTerminalIntents.delete(key));
      } catch (error) {
        pendingTerminalIntents.delete(key);
        throw error;
      }
    };

    try {
      if (request.method === 'GET' && url.pathname === '/api/home') {
        return json(readLearningSetHome(
          deps.root,
          await deps.registry.listFreeLearning(),
          await deps.registry.listMeta(),
        ));
      }
      if (request.method === 'GET' && url.pathname === '/api/calendar') {
        if (!deps.calendar) return json({ error: 'CALENDAR_UNAVAILABLE' }, 404);
        let plans: Array<{ id: string; title: string }> = [];
        try {
          plans = readCourseTree(deps.root).tree.children
            .filter((node) => node.kind === 'plan' && node.status === 'active')
            .map((node) => ({ id: node.id, title: node.title }));
        } catch {
          plans = [];
        }
        return json({
          appointments: deps.calendar.list(),
          currentLearningSetPath: resolve(deps.root),
          plans,
          reviewCandidates: [],
        });
      }
      if (request.method === 'POST' && url.pathname === '/api/calendar') {
        if (!deps.calendar) return json({ error: 'CALENDAR_UNAVAILABLE' }, 404);
        const appointment = deps.calendar.create(calendarDraft(deps.root, await request.json()));
        deps.hub.publish({ type: 'calendar-invalidated' });
        return json({ appointment }, 201);
      }
      const calendarItem = /^\/api\/calendar\/([^/]+)$/.exec(url.pathname);
      if (calendarItem && (request.method === 'PUT' || request.method === 'DELETE')) {
        if (!deps.calendar) return json({ error: 'CALENDAR_UNAVAILABLE' }, 404);
        const id = nodeId(calendarItem[1]!);
        if (!id) throw new Error('CALENDAR_APPOINTMENT_ID_INVALID');
        const body = objectBody(await request.json());
        const expectedRevision = positiveRevision(body.expectedRevision);
        const appointment = request.method === 'DELETE'
          ? deps.calendar.remove(id, expectedRevision)
          : deps.calendar.update(id, expectedRevision, calendarPatch(deps.root, body).patch);
        deps.hub.publish({ type: 'calendar-invalidated' });
        return json(request.method === 'DELETE' ? { deleted: appointment } : { appointment });
      }
      const calendarLaunch = /^\/api\/calendar\/([^/]+)\/launch$/.exec(url.pathname);
      if (calendarLaunch && request.method === 'POST') {
        if (!deps.calendar) return json({ error: 'CALENDAR_UNAVAILABLE' }, 404);
        const id = nodeId(calendarLaunch[1]!);
        if (!id) throw new Error('CALENDAR_APPOINTMENT_ID_INVALID');
        const body = objectBody(await request.json());
        const revision = positiveRevision(body.expectedRevision);
        const key = `${id}@${revision}`;
        let launch = calendarLaunches.get(key);
        if (!launch) {
          launch = (async () => {
            const appointment = deps.calendar!.read(id);
            if (!appointment) throw new Error('CALENDAR_APPOINTMENT_NOT_FOUND');
            if (appointment.revision !== revision) throw new Error('CALENDAR_APPOINTMENT_STALE');
            if (appointment.learningSetPath !== resolve(deps.root)) {
              throw new Error('CALENDAR_APPOINTMENT_OUT_OF_SCOPE');
            }
            const openedAt = deps.calendar!.now();
            const sessionKey = appointment.opened?.sessionKey
              ?? await deps.registry.openCalendarAppointment(appointment, openedAt);
            const opened = appointment.opened
              ? appointment
              : deps.calendar!.markOpened(id, revision, { at: openedAt, sessionKey });
            if (opened.destination.kind === 'free-learning') {
              deps.hub.publish({ type: 'home-invalidated' });
            }
            deps.hub.publish({ type: 'calendar-invalidated' });
            return {
              appointment: opened,
              sessionKey,
              route: calendarRoute(opened, sessionKey),
            };
          })();
          calendarLaunches.set(key, launch);
          void launch.finally(() => calendarLaunches.delete(key));
        }
        return json(await launch);
      }
      if (request.method === 'GET' && url.pathname === '/api/focus') {
        return json(publicFocus(await deps.registry.readFocus()));
      }
      if (request.method === 'POST' && url.pathname === '/api/focus/start') {
        const body = objectBody(await request.json());
        if (typeof body.sessionKey !== 'string') throw new Error('FOCUS_SESSION_KEY_REQUIRED');
        const key = sessionKey(encodeURIComponent(body.sessionKey));
        if (!key) throw new Error('FOCUS_SESSION_KEY_INVALID');
        if (body.targetSeconds !== 900 && body.targetSeconds !== 1500 && body.targetSeconds !== 2700) {
          throw new Error('FOCUS_TARGET_INVALID');
        }
        const value = await deps.registry.startFocus(
          key,
          body.targetSeconds as FocusTargetSeconds,
        );
        deps.hub.publish({ type: 'focus-invalidated' });
        return json(publicFocus(value));
      }
      if (request.method === 'POST' && url.pathname === '/api/focus/pause') {
        const value = deps.registry.pauseFocus();
        deps.hub.publish({ type: 'focus-invalidated' });
        return json(publicFocus(value));
      }
      if (request.method === 'POST' && url.pathname === '/api/focus/resume') {
        const value = deps.registry.resumeFocus();
        deps.hub.publish({ type: 'focus-invalidated' });
        return json(publicFocus(value));
      }
      if (request.method === 'POST' && url.pathname === '/api/focus/end') {
        const value = await deps.registry.endFocus('manual');
        deps.hub.publish({ type: 'focus-invalidated' });
        return json(publicFocusEnd(value));
      }
      if (url.pathname === '/api/free-learning' && request.method === 'GET') {
        return json(await deps.registry.listFreeLearning());
      }
      if (url.pathname === '/api/free-learning' && request.method === 'POST') {
        const requestBody = objectBody(await request.json());
        const intent = requestBody.intent === undefined ? 'open' : requestBody.intent;
        if (intent !== 'open' && intent !== 'review') {
          throw new Error('FREE_LEARNING_INTENT_INVALID');
        }
        const session = await deps.registry.createFreeLearning(
          learningContextReferences(requestBody.selectedAssets),
          intent,
        );
        deps.hub.publish({ type: 'home-invalidated' });
        return json({ session, route: `/learn/${encodeURIComponent(session.id)}` }, 201);
      }

      const freeEnd = /^\/api\/free-learning\/([^/]+)\/end$/.exec(url.pathname);
      if (request.method === 'POST' && freeEnd) {
        const id = nodeId(freeEnd[1]!);
        if (!id) return json({ error: 'FREE_LEARNING_SESSION_ID_INVALID' }, 400);
        const session = await deps.registry.endFreeLearning(`free:${id}`);
        deps.hub.publish({ type: 'home-invalidated' });
        deps.hub.publish({ type: 'focus-invalidated' });
        return json({ session });
      }

      if (url.pathname === '/api/meta' && request.method === 'GET') {
        return json(await deps.registry.listMeta());
      }
      if (url.pathname === '/api/meta' && request.method === 'POST') {
        const requestBody = objectBody(await request.json());
        const session = await deps.registry.createMeta(
          learningContextReferences(requestBody.selectedAssets),
        );
        deps.hub.publish({ type: 'home-invalidated' });
        return json({ session, route: `/meta/${encodeURIComponent(session.id)}` }, 201);
      }

      if (url.pathname === '/api/materials' && request.method === 'GET') {
        return json(listMaterials(deps.root));
      }
      if (url.pathname === '/api/materials' && request.method === 'POST') {
        if (!(request.headers.get('content-type') ?? '').startsWith('multipart/form-data;')) {
          throw new Error('MATERIAL_FORM_INVALID');
        }
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File) || file.size === 0) throw new Error('MATERIAL_FILE_REQUIRED');
        if (file.size > MAX_MATERIAL_BYTES) throw new Error('MATERIAL_FILE_LIMIT_EXCEEDED');
        if (!materialMediaTypes.has(file.type.toLowerCase())) throw new Error('MATERIAL_MIME_INVALID');
        const targetId = formText(form, 'targetId', false);
        const expected = formText(form, 'expectedRevision', false);
        if ((targetId === null) !== (expected === null)) throw new Error('MATERIAL_TARGET_INCOMPLETE');
        if (targetId !== null && !nodeId(targetId)) throw new Error('MATERIAL_ID_INVALID');
        const receipt = await importMaterial(deps.root, {
          requestId: formText(form, 'requestId')!,
          title: formText(form, 'title')!,
          filename: file.name,
          mediaType: file.type.toLowerCase(),
          bytes: new Uint8Array(await file.arrayBuffer()),
          ...(targetId === null ? {} : {
            target: { id: targetId, expectedRevision: positiveRevision(Number(expected)) },
          }),
        }, new Date().toISOString());
        deps.hub.publish({ type: 'home-invalidated' });
        deps.hub.publish({ type: 'assets-invalidated' });
        deps.hub.publish({ type: 'knowledge-invalidated' });
        return json(receipt, 201);
      }

      const materialLocator = /^\/api\/materials\/([^/]+)\/revisions\/([^/]+)\/locators\/([^/]+)$/.exec(
        url.pathname,
      );
      if (request.method === 'GET' && materialLocator) {
        const id = nodeId(materialLocator[1]!);
        let revision: number;
        let locator: string;
        try {
          revision = Number(decodeURIComponent(materialLocator[2]!));
          locator = decodeURIComponent(materialLocator[3]!);
        } catch {
          throw new Error('MATERIAL_LOCATOR_INVALID');
        }
        if (!id) throw new Error('MATERIAL_ID_INVALID');
        if (!Number.isSafeInteger(revision) || revision < 1) {
          throw new Error('MATERIAL_REVISION_INVALID');
        }
        if (locator !== 'whole' && !/^lines-[1-9][0-9]*-[1-9][0-9]*$|^page-[0-9]{4}$/.test(locator)) {
          throw new Error('MATERIAL_LOCATOR_INVALID');
        }
        return json(readMaterialLocator(deps.root, {
          id,
          revision,
          locator: locator === 'whole' ? null : locator,
        }));
      }

      const material = /^\/api\/materials\/([^/]+)$/.exec(url.pathname);
      if (request.method === 'GET' && material) {
        const id = nodeId(material[1]!);
        if (!id) throw new Error('MATERIAL_ID_INVALID');
        return json(readMaterialView(deps.root, id));
      }

      if (request.method === 'GET' && url.pathname === '/api/assets') {
        return json(readLearningAssetLibrary(deps.root));
      }

      const semanticAsset = /^\/api\/semantics\/assets\/(note|problem-card)\/([^/]+)$/.exec(
        url.pathname,
      );
      if (semanticAsset) {
        const kind = semanticAsset[1] as 'note' | 'problem-card';
        const id = nodeId(semanticAsset[2]!);
        if (!id) throw new Error('SEMANTIC_TAG_SUBJECT_INVALID');
        if (kind === 'note') readLearningNote(deps.root, id);
        else readProblemCard(deps.root, id);
        if (request.method === 'GET') {
          const tags = assetSemanticTags(deps.root, kind, id);
          return tags === null ? json({ error: 'SEMANTIC_TAGS_NOT_FOUND' }, 404) : json(tags);
        }
        if (request.method === 'PUT') {
          const requestBody = objectBody(await request.json());
          const expectedRevision = requestBody.expectedRevision === undefined
            ? undefined
            : positiveRevision(requestBody.expectedRevision);
          const planned = planSemanticTagsSave(deps.root, { kind, id }, {
            ...(expectedRevision === undefined ? {} : { expectedRevision }),
            tags: semanticDraft(requestBody),
          }, new Date().toISOString());
          commitDocumentCandidates(deps.root, [planned.candidate]);
          const warning = refreshSemanticProjection(deps.root);
          deps.hub.publish({ type: 'assets-invalidated' });
          deps.hub.publish({ type: 'knowledge-invalidated' });
          return json({
            ...publicSemanticTags(planned.tags),
            ...(warning ? { warning } : {}),
          });
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/semantics/query') {
        const requestBody = objectBody(await request.json());
        const terms = stringList(requestBody.terms, 'semantic recall terms');
        if (
          terms.length === 0
          || terms.length > 12
          || terms.some((term) => !term.trim() || term !== term.trim() || /[\r\n\t]/.test(term) || [...term].length > 40)
        ) throw new Error('SEMANTIC_RECALL_TERMS_INVALID');
        const limit = positiveRevision(requestBody.limit);
        if (limit > 50) throw new Error('SEMANTIC_RECALL_LIMIT_INVALID');
        if (typeof requestBody.allowRelatedExpansion !== 'boolean') {
          throw new Error('SEMANTIC_RECALL_EXPANSION_INVALID');
        }
        return json(querySemanticRecall(deps.root, {
          terms,
          limit,
          allowRelatedExpansion: requestBody.allowRelatedExpansion,
        }));
      }

      if (request.method === 'GET' && url.pathname === '/api/semantics/relations') {
        return json(projectSemanticRelations(deps.root));
      }

      const noteAsset = /^\/api\/assets\/notes\/([^/]+)$/.exec(url.pathname);
      if (noteAsset) {
        const id = nodeId(noteAsset[1]!);
        if (!id) return json({ error: 'NOTE_ID_INVALID' }, 400);
        if (request.method === 'GET') {
          const note = readLearningNote(deps.root, id);
          return json({
            ...note,
            review: readAssetReviewHistory(deps.root, { kind: 'note', id }).projection,
            semanticTags: assetSemanticTags(deps.root, 'note', id),
            formation: projectAssetFormation(
              await deps.registry.listOwnedSessionFacts(),
              note.createdSessionId,
            ),
          });
        }
        if (request.method === 'PUT') {
          const requestBody = objectBody(await request.json());
          const current = readLearningNote(deps.root, id);
          const planned = planLearningNoteSave(deps.root, 'student-editor', {
            target: { id, expectedRevision: positiveRevision(requestBody.expectedRevision) },
            title: requiredBodyString(requestBody.title, 'note title'),
            blocks: noteBlocks(requestBody.blocks),
            sources: current.sources,
          }, new Date().toISOString());
          commitDocumentCandidates(deps.root, planned.candidates);
          const warning = refreshSemanticProjection(deps.root);
          deps.hub.publish({ type: 'home-invalidated' });
          deps.hub.publish({ type: 'assets-invalidated' });
          return json({
            ...planned.note,
            review: readAssetReviewHistory(deps.root, { kind: 'note', id }).projection,
            semanticTags: assetSemanticTags(deps.root, 'note', id),
            formation: projectAssetFormation(
              await deps.registry.listOwnedSessionFacts(),
              planned.note.createdSessionId,
            ),
            ...(warning ? { warning } : {}),
          });
        }
      }

      const assetReview = /^\/api\/assets\/(notes|problem-cards)\/([^/]+)\/review$/.exec(
        url.pathname,
      );
      if (request.method === 'POST' && assetReview) {
        const kind = assetReview[1] === 'notes' ? 'note' as const : 'problem-card' as const;
        const id = kind === 'note' ? nodeId(assetReview[2]!) : problemCardId(assetReview[2]!);
        if (!id) return json({ error: 'ASSET_ID_INVALID' }, 400);
        const requestBody = objectBody(await request.json());
        const expectedRevision = positiveRevision(requestBody.expectedRevision);
        const requestId = requiredBodyString(requestBody.requestId, 'request id');
        const asset = { kind, id } as const;
        const current = kind === 'note'
          ? readLearningNote(deps.root, id)
          : readProblemCard(deps.root, id);
        if (current.revision !== expectedRevision) throw new Error(`ASSET_REVISION_STALE: ${id}`);
        const history = readAssetReviewHistory(deps.root, asset);
        let event: AssetReviewEventDraft;
        if (requestBody.action === 'enroll') {
          if (history.projection?.active) throw new Error(`ASSET_REVIEW_ALREADY_ACTIVE: ${id}`);
          event = {
            kind: 'enrolled', assetRevision: current.revision, trigger: { kind: 'manual' },
          };
        } else if (requestBody.action === 'remove') {
          event = { kind: 'removed' };
        } else if (requestBody.action === 'restart') {
          event = { kind: 'restarted', assetRevision: current.revision };
        } else if (requestBody.action === 'review') {
          const result = reviewResult(requestBody.result);
          if (kind === 'note') {
            const note = readLearningNote(deps.root, id);
            if (!note.blocks.some((block) => block.kind === 'recall')) {
              throw new Error(`NOTE_DIRECT_REVIEW_INELIGIBLE: ${id}`);
            }
            event = {
              kind: 'reviewed', assetRevision: current.revision, result,
              evidence: { kind: 'self-report', problemAttemptId: null },
            };
          } else {
            const attemptId = requiredBodyString(requestBody.problemAttemptId, 'problem attempt id');
            const activity = readProblemActivity(deps.root, id);
            if (
              activity.latestAttempt?.id !== attemptId
              || activity.latestAttempt.cardRevision !== current.revision
              || !activity.events.some((item) => (
                item.kind === 'answer-reveal' && item.attemptId === attemptId
              ))
            ) throw new Error(`PROBLEM_REVIEW_INELIGIBLE: ${id}`);
            event = {
              kind: 'reviewed', assetRevision: current.revision, result,
              evidence: { kind: 'self-report', problemAttemptId: attemptId },
            };
          }
        } else {
          throw new Error('ASSET_REVIEW_ACTION_INVALID');
        }
        const at = new Date().toISOString();
        const recorded = recordAssetReviewEvent(deps.root, asset, {
          requestId, at, localDate: localDateAt(at), event,
        });
        deps.hub.publish({ type: 'assets-invalidated' });
        return json({ event: recorded.event, review: recorded.projection }, 201);
      }

      const problemAsset = /^\/api\/assets\/problem-cards\/([^/]+)$/.exec(url.pathname);
      if (request.method === 'GET' && problemAsset) {
        const id = problemCardId(problemAsset[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const card = readProblemCard(deps.root, id);
        const activity = readProblemActivity(deps.root, id);
        const revealed = activity.answerRevealedForLatestAttempt
          && activity.latestAttempt?.cardRevision === card.revision;
        return json({
          ...readStudentProblemCard(deps.root, id, revealed),
          activity,
          review: readAssetReviewHistory(deps.root, { kind: 'problem-card', id }).projection,
          semanticTags: assetSemanticTags(deps.root, 'problem-card', id),
          formation: projectAssetFormation(
            await deps.registry.listOwnedSessionFacts(),
            card.createdSessionId,
          ),
        });
      }

      const problemNote = /^\/api\/assets\/problem-cards\/([^/]+)\/note$/.exec(url.pathname);
      if (request.method === 'PUT' && problemNote) {
        const id = problemCardId(problemNote[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const requestBody = objectBody(await request.json());
        const current = readProblemCard(deps.root, id);
        const planned = planProblemCardSave(deps.root, 'student-editor', {
          target: { id, expectedRevision: positiveRevision(requestBody.expectedRevision) },
          stem: current.stem,
          standardAnswer: current.standardAnswer,
          teacherRationale: current.teacherRationale,
          studentNote: requiredBodyString(requestBody.studentNote, 'student note', true),
          sources: current.sources,
        }, new Date().toISOString());
        commitDocumentCandidates(deps.root, planned.candidates);
        deps.hub.publish({ type: 'home-invalidated' });
        deps.hub.publish({ type: 'assets-invalidated' });
        deps.hub.publish({ type: 'knowledge-invalidated' });
        return json(readStudentProblemCard(deps.root, id, false));
      }

      const attempt = /^\/api\/problem-cards\/([^/]+)\/attempts$/.exec(url.pathname);
      if (request.method === 'POST' && attempt) {
        const id = problemCardId(attempt[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const requestBody = objectBody(await request.json());
        const response = objectBody(requestBody.response);
        let semantic: ProblemAttemptResponse;
        if (response.kind === 'cannot') semantic = { kind: 'cannot' };
        else if (response.kind === 'answer') {
          semantic = { kind: 'answer', text: requiredBodyString(response.text, 'answer text') };
        } else throw new Error('ATTEMPT_RESPONSE_INVALID');
        const event = recordProblemAttempt(
          deps.root,
          id,
          semantic,
          requiredBodyString(requestBody.requestId, 'request id'),
        );
        deps.hub.publish({ type: 'assets-invalidated' });
        return json({ event }, 201);
      }

      const reveal = /^\/api\/problem-cards\/([^/]+)\/reveal$/.exec(url.pathname);
      if (request.method === 'POST' && reveal) {
        const id = problemCardId(reveal[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const requestBody = objectBody(await request.json());
        const result = revealProblemAnswer(
          deps.root,
          id,
          requiredBodyString(requestBody.requestId, 'request id'),
        );
        deps.hub.publish({ type: 'assets-invalidated' });
        return json(result);
      }

      const askTeacher = /^\/api\/problem-cards\/([^/]+)\/ask-teacher$/.exec(url.pathname);
      if (request.method === 'POST' && askTeacher) {
        const id = problemCardId(askTeacher[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        readProblemCard(deps.root, id);
        const session = await deps.registry.createFreeLearning([{ kind: 'problem-card', id }]);
        deps.hub.publish({ type: 'home-invalidated' });
        return json({ session, route: `/learn/${encodeURIComponent(session.id)}` }, 201);
      }

      if (request.method === 'GET' && url.pathname === '/api/course') {
        return json(courseReader(deps.root, url.searchParams.get('selected')));
      }
      if (request.method === 'GET' && url.pathname === '/api/footprint') {
        return json(readLearningFootprint(
          deps.root,
          await deps.registry.listOwnedSessionFacts(),
        ));
      }
      if (request.method === 'GET' && url.pathname === '/api/knowledge') {
        return json(knowledgeReader(deps.root));
      }
      if (request.method === 'GET' && url.pathname === '/events') {
        if (!server || !server.upgrade(request)) return json({ error: 'WEBSOCKET_UPGRADE_REQUIRED' }, 426);
        return undefined;
      }

      const history = /^\/api\/sessions\/([^/]+)\/history$/.exec(url.pathname);
      if (request.method === 'GET' && history) {
        const key = sessionKey(history[1]!);
        if (!key) return json({ error: 'SESSION_KEY_INVALID' }, 400);
        return json(projectConversationEntries(key, await deps.registry.readHistory(key)));
      }

      const messages = /^\/api\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
      if (request.method === 'POST' && messages) {
        const key = sessionKey(messages[1]!);
        if (!key) return json({ error: 'SESSION_KEY_INVALID' }, 400);
        const body = await request.json() as { text?: unknown };
        if (typeof body.text !== 'string' || body.text.trim().length === 0) {
          return json({ error: 'MESSAGE_TEXT_REQUIRED' }, 400);
        }
        return queueTurn(key, body.text.trim());
      }

      const handout = /^\/api\/plans\/([^/]+)\/lessons\/([^/]+)\/handout\/([^/]+)$/.exec(
        url.pathname,
      );
      if (request.method === 'GET' && handout) {
        const planId = nodeId(handout[1]!);
        const lessonId = nodeId(handout[2]!);
        const blockIds = parseHandoutBlockSegment(handout[3]!);
        if (!planId || !lessonId || !blockIds) {
          return json({ error: 'HANDOUT_ROUTE_INVALID' }, 400);
        }
        return json(readLessonHandout(deps.root, planId, lessonId, blockIds));
      }

      const lessonAction = /^\/api\/plans\/([^/]+)\/lessons\/([^/]+)\/(start|close)$/.exec(
        url.pathname,
      );
      if (request.method === 'POST' && lessonAction) {
        const planId = nodeId(lessonAction[1]!);
        const lessonId = nodeId(lessonAction[2]!);
        if (!planId || !lessonId) return json({ error: 'NODE_ID_INVALID' }, 400);
        if (lessonAction[3] === 'close') {
          return queueTerminalIntent(
            `lesson:${planId}:${lessonId}` as SessionKey,
            '我想结束本课。',
          );
        }
        const result = await lifecycle.startLesson(planId, lessonId);
        deps.hub.publish({ type: 'course-invalidated' });
        return json(result);
      }

      const planAction = /^\/api\/plans\/([^/]+)\/(start|complete)$/.exec(url.pathname);
      if (request.method === 'POST' && planAction) {
        const id = nodeId(planAction[1]!);
        if (!id) return json({ error: 'NODE_ID_INVALID' }, 400);
        if (planAction[2] === 'complete') {
          return queueTerminalIntent(`plan:${id}` as SessionKey, '我想完成这一阶段。');
        }
        const result = await lifecycle.startPlan(id);
        deps.hub.publish({ type: 'course-invalidated' });
        return json(result);
      }

      if (url.pathname.startsWith('/api/')) return json({ error: 'NOT_FOUND' }, 404);
      if (request.method === 'GET' && deps.staticRoot) {
        const path = safeStaticPath(deps.staticRoot, url.pathname);
        if (path) return new Response(Bun.file(path));
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
