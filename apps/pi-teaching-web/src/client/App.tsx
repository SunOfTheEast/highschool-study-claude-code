import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ROADMAP_COACH_SESSION_KEY } from '../shared/contracts';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../memory-review/contracts';
import type {
  AbilityProjection,
  CoachContextView,
  HomeLearningSetSnapshot,
  LearningSetSnapshot,
  LessonReplay,
  LessonNode,
  PersonaPresentation,
  PresentationPreferences,
  RoadmapWorkspaceSnapshot,
  SessionKey,
  StudentNotebook,
  StudyViewEvent,
} from '../shared/contracts';
import type {
  CourseTreeNode,
  PublicObjectionTarget,
  ViewQuery,
} from '../shared/view-contracts';
import { api, ApiError } from './api';
import { AppShell } from './components/AppShell';
import type { LessonCourseAction } from './components/CourseInspector';
import { ChatPanel } from './components/ChatPanel';
import { ContentExplorer } from './components/ContentExplorer';
import { ContextStack } from './components/ContextStack';
import { CurrentActivityStage } from './components/CurrentActivityStage';
import { MemoryReviewPanel } from './components/MemoryReviewPanel';
import { PersonaDrawer } from './components/PersonaDrawer';
import { PlanLearningReview } from './components/PlanLearningReview';
import { RoadmapCoachShell } from './components/RoadmapCoachShell';
import { SessionTree } from './components/SessionTree';
import {
  formatBrowserRoute,
  parseBrowserRoute,
  type BrowserRoute,
} from './routes';
import {
  routeForPrimaryView,
  selectionFromRoute,
} from './view-selection';
import {
  initialViewState,
  reduceViewState,
  type PrimaryView,
} from './view-state';
import {
  buildPublicContextPages,
  initialClientState,
  laterMemoryReview,
  preferLiveConversation,
  reduceClientState,
} from './state';
import {
  readPresentationPreferences,
  writePresentationPreferences,
} from './presentation';

type ConnectionState = 'connecting' | 'open' | 'closed';

const CoursePage = lazy(() => import('./pages/CoursePage'));
const FocusedClassroomPage = lazy(() => import('./pages/FocusedClassroomPage'));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const MemoryPage = lazy(() => import('./pages/MemoryPage'));

function primaryViewForRoute(route: BrowserRoute): PrimaryView {
  if (route.kind === 'knowledge') return 'knowledge';
  if (route.kind === 'memory') return 'memory';
  return 'course';
}

function queryForRoute(route: BrowserRoute): ViewQuery {
  if (route.kind === 'knowledge' || route.kind === 'memory') return route.query;
  const selection = selectionFromRoute(route);
  return {
    planId: selection.planId,
    lessonId: selection.lessonId,
    methodName: selection.methodName,
    cardPath: selection.cardPath,
    evidenceSource: selection.evidenceSource,
    topicId: null,
    timeRange: 'all',
  };
}

export function App() {
  const [learningSet, setLearningSet] =
    useState<LearningSetSnapshot | HomeLearningSetSnapshot | null>(null);
  const [roadmapWorkspace, setRoadmapWorkspace] =
    useState<RoadmapWorkspaceSnapshot | null>(null);
  const [client, setClient] = useState(initialClientState);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<StudentNotebook | null>(null);
  const [replay, setReplay] = useState<LessonReplay | null>(null);
  const [abilities, setAbilities] = useState<AbilityProjection | null>(null);
  const [coachContext, setCoachContext] = useState<CoachContextView | null>(null);
  const [persona, setPersona] = useState<PersonaPresentation | null>(null);
  const [memoryReview, setMemoryReview] = useState<MemoryReviewSnapshot | null>(null);
  const [submittingMemoryReview, setSubmittingMemoryReview] = useState(false);
  const [contentExplorerOpen, setContentExplorerOpen] = useState(false);
  const [personaDrawerOpen, setPersonaDrawerOpen] = useState(false);
  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [presentation, setPresentation] = useState<PresentationPreferences>(() => (
    readPresentationPreferences(localStorage, systemReducedMotion)
  ));
  const [completionFeedback, setCompletionFeedback] = useState('');
  const [composerPrefill, setComposerPrefill] =
    useState<{ id: string; text: string } | null>(null);
  const priorNotebook = useRef<{
    lessonId: string;
    statuses: Record<string, string>;
  } | null>(null);
  const [browserRoute, setBrowserRoute] = useState<BrowserRoute>(() => (
    parseBrowserRoute(window.location.pathname, window.location.search)
      ?? { kind: 'course' }
  ));
  const [views, dispatchViews] = useReducer(reduceViewState, initialViewState);
  const [visibleRevision, setVisibleRevision] = useState(0);
  const [courseSelectedKey, setCourseSelectedKey] = useState<string | null>(null);

  const loadProjection = async (route: BrowserRoute) => {
    const view = primaryViewForRoute(route);
    const query = queryForRoute(route);
    dispatchViews({ type: 'loading', view });
    try {
      if (view === 'course') {
        dispatchViews({
          type: 'loaded',
          view,
          value: await api.courseView(query),
        });
      } else if (view === 'knowledge') {
        dispatchViews({
          type: 'loaded',
          view,
          value: await api.knowledgeView(query),
        });
      } else {
        dispatchViews({
          type: 'loaded',
          view,
          value: await api.memoryView(query),
        });
      }
    } catch {
      dispatchViews({
        type: 'failed',
        view,
        error: '当前页面暂时无法整理，请稍后重试。',
      });
    }
  };

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;

    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${location.host}/events`);
      socket.onopen = () => {
        setConnection('open');
        setVisibleRevision((value) => value + 1);
      };
      socket.onmessage = (message) => {
        const event = JSON.parse(String(message.data)) as StudyViewEvent;
        if (event.type === 'views-invalidated') {
          dispatchViews({
            type: 'invalidated',
            views: event.views,
          });
          setVisibleRevision((value) => value + 1);
          return;
        }
        if (event.type === 'ability-update') setAbilities(event.projection);
        if (event.type === 'learning-set') {
          setLearningSet(event.value);
          setRoadmapWorkspace((current) => (
            current ? { ...current, learningSet: event.value } : current
          ));
          return;
        }
        setClient((current) => reduceClientState(current, event));
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        setConnection('closed');
        retry = window.setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retry !== undefined) window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  type Navigation = 'push' | 'replace' | 'none';

  const openRoute = async (route: BrowserRoute | null, navigation: Navigation = 'none') => {
    setLoading(true);
    setPageError(null);
    setMemoryReview(null);
    setComposerPrefill(null);
    setContentExplorerOpen(false);
    setPersonaDrawerOpen(false);
    try {
      if (!route) throw new Error('INVALID_ROUTE');
      setBrowserRoute(route);
      if (route.kind === 'course') {
        setCourseSelectedKey('roadmap:@roadmap');
      } else if (route.kind === 'course-plan') {
        setCourseSelectedKey(`plan:${route.planId}`);
      } else if (route.kind === 'course-lesson') {
        setCourseSelectedKey(`lesson:${route.lessonId}`);
      }
      await loadProjection(route);
      if (route.kind === 'knowledge' || route.kind === 'memory') {
        const path = formatBrowserRoute(route);
        if (navigation === 'push') window.history.pushState(null, '', path);
        if (navigation === 'replace') window.history.replaceState(null, '', path);
        return;
      }
      if (route.kind === 'course') {
        const workspace = await api.roadmapWorkspace();
        const selected = workspace.coach.sessionKey;
        const history = await api.history(selected);
        setLearningSet(workspace.learningSet);
        setRoadmapWorkspace(workspace);
        setClient((current) => ({
          ...current,
          selected,
          conversations: { ...current.conversations, [selected]: history },
        }));
        if (navigation === 'push') {
          window.history.pushState(null, '', formatBrowserRoute(route));
        }
        if (navigation === 'replace') {
          window.history.replaceState(null, '', formatBrowserRoute(route));
        }
        return;
      }
      setRoadmapWorkspace(null);
      const workspace = await api.workspace(route.planId);
      let selected: SessionKey;
      let history: Awaited<ReturnType<typeof api.history>> | null = null;
      if (route.kind === 'course-plan') {
        selected = workspace.coach.sessionKey;
        history = await api.history(selected);
      } else {
        const lesson = workspace.lessons.find((item) => item.id === route.lessonId);
        if (!lesson || lesson.planId !== workspace.plan.id) throw new Error('LESSON_NOT_FOUND');
        selected = lesson.sessionKey;
        if (lesson.status === 'active' || lesson.status === 'paused') {
          history = await api.history(selected);
        }
      }

      setClient((current) => ({
        ...current,
        workspace,
        selected,
        conversations: history === null
          ? { ...current.conversations, [selected]: [] }
          : { ...current.conversations, [selected]: history },
      }));
      if (navigation === 'push') window.history.pushState(null, '', formatBrowserRoute(route));
      if (navigation === 'replace') window.history.replaceState(null, '', formatBrowserRoute(route));
      const savedPath = formatBrowserRoute(route);
      const selectedLesson = route.kind === 'course-lesson'
        ? workspace.lessons.find((candidate) => candidate.id === route.lessonId)
        : null;
      if (
        (route.kind === 'course-plan' && workspace.plan.status !== 'completed')
        || (
          selectedLesson
          && ['active', 'paused', 'prepared'].includes(selectedLesson.status)
        )
      ) {
        localStorage.setItem('studyforge.lastVisitedRoute', savedPath);
      }
    } catch {
      setRoadmapWorkspace(null);
      setPageError(route ? '无法恢复这个学习位置，已返回学习集首页。' : '无效的学习路径，已返回学习集首页。');
      setBrowserRoute({ kind: 'course' });
      window.history.replaceState(null, '', '/course');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    void api.learningSet()
      .then((value) => {
        if (!current) return;
        setLearningSet(value);
        const route = parseBrowserRoute(
          window.location.pathname,
          window.location.search,
        );
        return openRoute(route ?? { kind: 'course' }, route ? 'none' : 'replace');
      })
      .catch(() => setPageError('无法读取学习集，请确认本地服务与学习集目录。'))
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (visibleRevision === 0) return;
    void loadProjection(browserRoute);
  }, [visibleRevision]);

  useEffect(() => {
    const onPopState = () => {
      void openRoute(parseBrowserRoute(
        window.location.pathname,
        window.location.search,
      ) ?? { kind: 'course' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectedLesson = useMemo(() => {
    if (!client.workspace || !client.selected?.startsWith('tutor:')) return null;
    return client.workspace.lessons.find((lesson) => lesson.sessionKey === client.selected) ?? null;
  }, [client.selected, client.workspace]);

  useEffect(() => {
    if (!client.workspace || !client.selected?.startsWith('coach:')) return;
    const route = parseBrowserRoute(window.location.pathname);
    if (
      route?.kind !== 'course-lesson'
      || route.planId !== client.workspace.plan.id
    ) return;
    window.history.replaceState(
      null,
      '',
      formatBrowserRoute({ kind: 'course-plan', planId: client.workspace.plan.id }),
    );
  }, [client.selected, client.workspace?.plan.id]);

  const workflowSessionOpen = Boolean(
    client.selected?.startsWith('coach:')
    || selectedLesson?.status === 'active'
    || selectedLesson?.status === 'paused',
  );

  useEffect(() => {
    let current = true;
    const selected = client.selected;
    if (!selected || !workflowSessionOpen) return () => { current = false; };
    void api.deep(selected)
      .then((value) => {
        if (!current) return;
        setClient((state) => ({
          ...state,
          deepMode: { ...state.deepMode, [selected]: value.enabled },
          workflows: { ...state.workflows, [selected]: value.workflows },
        }));
      })
      .catch(() => {
        if (current) setPageError('无法读取当前 Session 的深度模式。');
      });
    return () => { current = false; };
  }, [client.selected, workflowSessionOpen]);

  useEffect(() => {
    let current = true;
    setNotebook(null);
    setReplay(null);
    if (selectedLesson) {
      void api.notebook(selectedLesson.id)
        .then((value) => { if (current) setNotebook(value); })
        .catch(() => { if (current) setPageError('无法读取学生课堂本。'); });
      if (selectedLesson.status === 'closed' || selectedLesson.status === 'abandoned') {
        void api.replay(selectedLesson.id)
          .then((value) => { if (current) setReplay(value); })
          .catch(() => { if (current) setPageError('无法读取 Lesson 回放。'); });
      }
    }
    return () => { current = false; };
  }, [selectedLesson]);

  useEffect(() => {
    if (!notebook) return;
    const current = {
      lessonId: notebook.lesson.id,
      statuses: Object.fromEntries(notebook.lesson.blocks.map((block) => [block.id, block.status])),
    };
    const prior = priorNotebook.current;
    if (
      prior?.lessonId === current.lessonId
      && presentation.completionFeedback
      && notebook.lesson.status !== 'closed'
    ) {
      const completed = notebook.lesson.blocks.find((block) => (
        prior.statuses[block.id] === 'active' && block.status === 'completed'
      ));
      if (completed) setCompletionFeedback(`已完成：${completed.title}`);
    }
    priorNotebook.current = current;
  }, [notebook, presentation.completionFeedback]);

  useEffect(() => {
    if (!completionFeedback) return;
    const timeout = window.setTimeout(() => setCompletionFeedback(''), 1800);
    return () => window.clearTimeout(timeout);
  }, [completionFeedback]);

  useEffect(() => {
    if (!client.workspace) {
      setAbilities(null);
      return;
    }
    void api.abilities()
      .then(setAbilities)
      .catch(() => setPageError('无法读取方法进展。'));
  }, [client.workspace?.plan.id]);

  useEffect(() => {
    let current = true;
    setCoachContext(null);
    if (!client.workspace || client.selected !== client.workspace.coach.sessionKey) {
      return () => { current = false; };
    }
    void api.coachContext(client.workspace.plan.id)
      .then((value) => { if (current) setCoachContext(value); })
      .catch(() => { if (current) setCoachContext(null); });
    return () => { current = false; };
  }, [
    client.selected,
    client.workspace,
  ]);

  useEffect(() => {
    let current = true;
    setPersona(null);
    if (client.selected) {
      void api.persona(client.selected)
        .then((value) => { if (current) setPersona(value); })
        .catch(() => { if (current) setPageError('无法读取当前 Session 人设。'); });
    }
    return () => { current = false; };
  }, [client.selected]);

  const openEvidence = (source: string) => {
    const query = queryForRoute(browserRoute);
    void openRoute({
      kind: 'memory',
      query: {
        ...query,
        evidenceSource: source,
        topicId: null,
      },
    }, 'push');
  };

  const openObjection = async (target: PublicObjectionTarget): Promise<void> => {
    const url = new URL(target.route, window.location.origin);
    const route = parseBrowserRoute(url.pathname, url.search);
    const expectedSession = route?.kind === 'course'
      ? ROADMAP_COACH_SESSION_KEY
      : route?.kind === 'course-plan'
        ? `coach:${route.planId}` as SessionKey
        : null;
    if (!route || expectedSession !== target.sessionKey) {
      setPageError('这条异议暂时找不到可写入的学习顾问会话。');
      return;
    }
    await openRoute(route, 'push');
    setComposerPrefill({
      id: crypto.randomUUID(),
      text: target.prefill,
    });
  };

  const selectSession = async (nextKey: SessionKey) => {
    if (!client.workspace || nextKey === client.selected) return;
    try {
      const workspace = client.workspace;
      const nextLesson = workspace.lessons.find((lesson) => lesson.sessionKey === nextKey);
      const route: BrowserRoute | null = nextKey.startsWith('coach:')
        ? { kind: 'course-plan', planId: workspace.plan.id }
        : nextLesson
          ? {
            kind: 'course-lesson',
            planId: workspace.plan.id,
            lessonId: nextLesson.id,
          }
          : null;
      if (!route) throw new Error('SESSION_NOT_FOUND');
      await openRoute(route, 'push');
    } catch {
      setPageError('切换 Session 失败，请稍后再试。');
    }
  };

  const startLesson = async (lesson: LessonNode): Promise<boolean> => {
    setPageError(null);
    try {
      const workspace = await api.lessonAction(lesson.id, 'start');
      const history = await api.history(lesson.sessionKey);
      setClient((current) => ({
        ...current,
        workspace,
        selected: lesson.sessionKey,
        conversations: {
          ...current.conversations,
          [lesson.sessionKey]: preferLiveConversation(
            current.conversations[lesson.sessionKey],
            history,
          ),
        },
      }));
      return true;
    } catch (error) {
      if (
        error instanceof ApiError
        && error.status === 422
        && error.body !== null
        && typeof error.body === 'object'
        && (error.body as { error?: unknown }).error === 'PREPARED_LESSON_INVALID'
      ) {
        const issues = (error.body as { issues?: unknown }).issues;
        const messages = Array.isArray(issues)
          ? issues.flatMap((issue) => (
              issue !== null
              && typeof issue === 'object'
              && typeof (issue as { message?: unknown }).message === 'string'
                ? [(issue as { message: string }).message]
                : []
            ))
          : [];
        setPageError(
          `这节课还没备完整：${messages.join('；') || '存在无法执行的结构问题'}。请返回学习顾问修正。`,
        );
      } else {
        setPageError('无法启动课堂导师会话，请检查 Pi 配置。');
      }
      return false;
    }
  };

  const pauseLesson = async (lessonId: string): Promise<void> => {
    const workspace = await api.lessonAction(lessonId, 'pause');
    setClient((current) => ({ ...current, workspace }));
    await loadProjection(browserRoute);
  };

  const reprepareLesson = async (lessonId: string): Promise<void> => {
    const workspace = await api.lessonAction(lessonId, 'reprepare');
    setClient((current) => ({ ...current, workspace }));
    await openRoute({
      kind: 'course-plan',
      planId: workspace.plan.id,
    }, 'replace');
  };

  const openReadyLesson = async (lessonId: string) => {
    const lesson = client.workspace?.lessons.find((candidate) => candidate.id === lessonId);
    if (!lesson || !client.workspace) {
      setPageError('这节课暂时无法打开，请让学习顾问重新确认。');
      return;
    }
    if (lesson.status === 'prepared') {
      if (await startLesson(lesson)) {
        const route = formatBrowserRoute({
          kind: 'course-lesson',
          planId: client.workspace.plan.id,
          lessonId,
        });
        window.history.pushState(null, '', route);
        localStorage.setItem('studyforge.lastVisitedRoute', route);
      }
      return;
    }
    await openRoute({
      kind: 'course-lesson',
      planId: client.workspace.plan.id,
      lessonId,
    }, 'push');
  };

  const send = async (text: string, imagePaths: string[]) => {
    if (!client.selected) return;
    setClient((current) => ({
      ...current,
      errors: { ...current.errors, [client.selected!]: '' },
    }));
    await api.message(client.selected, text, imagePaths);
  };

  const changePersona = async (id: string) => {
    if (!client.selected) return;
    setPageError(null);
    try {
      setPersona(await api.setPersona(client.selected, id));
    } catch (error) {
      setPageError('切换陪伴风格失败。');
      throw error;
    }
  };

  const changePresentation = (value: PresentationPreferences) => {
    const next = systemReducedMotion ? { ...value, motion: 'reduced' as const } : value;
    writePresentationPreferences(localStorage, next);
    setPresentation(next);
  };

  const changeDeepMode = async (enabled: boolean) => {
    if (!client.selected) return;
    const selected = client.selected;
    setPageError(null);
    try {
      const value = await api.setDeep(selected, enabled);
      setClient((current) => ({
        ...current,
        deepMode: { ...current.deepMode, [selected]: value.enabled },
        workflows: { ...current.workflows, [selected]: value.workflows },
      }));
    } catch {
      setPageError('切换深度模式失败。');
    }
  };

  const actOnWorkflow = async (id: string, action: 'confirm' | 'cancel') => {
    if (!client.selected) return;
    const selected = client.selected;
    setPageError(null);
    try {
      const workflow = await api.workflowAction(selected, id, action);
      setClient((current) => reduceClientState(current, {
        type: 'workflow',
        sessionKey: selected,
        workflow,
      }));
    } catch {
      setPageError(action === 'confirm' ? '无法启动这个工作流。' : '无法取消这个工作流。');
    }
  };

  const submitMemoryReview = async (decisions: MemoryReviewDecision[]) => {
    if (!client.selected || !memoryReview) return;
    const selected = client.selected;
    const reviewId = memoryReview.id;
    setSubmittingMemoryReview(true);
    setPageError(null);
    try {
      const submitted = await api.submitMemoryReview(selected, reviewId, decisions);
      setClient((current) => ({
        ...current,
        conversations: {
          ...current.conversations,
          [selected]: (current.conversations[selected] ?? []).map((item) => (
            item.kind === 'memory-review' && item.review.id === reviewId
              ? {
                kind: 'memory-review',
                review: laterMemoryReview(item.review, submitted),
              }
              : item
          )),
        },
      }));
      setMemoryReview(null);
    } catch {
      setPageError('长期记忆确认未能提交，原候选仍然保留。');
    } finally {
      setSubmittingMemoryReview(false);
    }
  };

  const goHome = () => {
    void openRoute({ kind: 'course' }, 'push');
  };

  const openPlan = async (planId: string): Promise<void> => {
    setPageError(null);
    try {
      const entry = learningSet?.planTree.find(
        (candidate) => candidate.nodeId === planId,
      );
      if (entry?.status === 'prepared') {
        await api.startPlan(planId);
      }
      await openRoute({ kind: 'course-plan', planId }, 'push');
    } catch {
      setPageError('这个学习周期暂时无法启动，请回到学习总览确认当前安排。');
    }
  };

  const selectCourseNode = (node: CourseTreeNode) => {
    setCourseSelectedKey(node.key);
    if (!node.route) return;
    const url = new URL(node.route, window.location.origin);
    void openRoute(parseBrowserRoute(url.pathname, url.search), 'push');
  };

  const openPrimaryView = (view: PrimaryView) => {
    void openRoute(
      routeForPrimaryView(view, selectionFromRoute(browserRoute)),
      'push',
    );
  };

  const actOnCourseLesson = async (action: LessonCourseAction) => {
    if (
      browserRoute.kind !== 'course-lesson'
      || !client.workspace
    ) return;
    const lesson = client.workspace.lessons.find(
      (candidate) => candidate.id === browserRoute.lessonId,
    );
    if (!lesson) return;
    if (action === 'start') {
      await openReadyLesson(lesson.id);
      return;
    }
    if (action === 'reprepare') {
      await reprepareLesson(lesson.id);
      return;
    }
    if (action === 'continue' && lesson.status === 'paused') {
      if (!await startLesson(lesson)) return;
    }
    await openRoute(browserRoute, 'none');
  };

  const activeView = primaryViewForRoute(browserRoute);
  const viewSelection = selectionFromRoute(browserRoute);
  const viewHrefs: Record<PrimaryView, string> = {
    course: formatBrowserRoute(routeForPrimaryView('course', viewSelection)),
    knowledge: formatBrowserRoute(routeForPrimaryView('knowledge', viewSelection)),
    memory: formatBrowserRoute(routeForPrimaryView('memory', viewSelection)),
  };
  viewHrefs[activeView] = formatBrowserRoute(browserRoute);
  const activeSlot = views[activeView];
  const selectionLabel = viewSelection.lessonId
    ? `Lesson ${viewSelection.lessonId.replace(/^lesson-?/i, '')}`
    : viewSelection.planId
      ? views.course.value?.selectedPlan?.title ?? viewSelection.planId
      : '学习总览';
  const withAppShell = (children: ReactNode) => (
    <AppShell
      title={learningSet?.title ?? views.course.value?.learningSet.title ?? 'StudyForge'}
      activeView={activeView}
      viewHrefs={viewHrefs}
      selectionLabel={selectionLabel}
      connection={connection}
      viewLoading={activeSlot.loading}
      viewError={activeSlot.error}
      personaControl={(
        <button
          type="button"
          disabled={!client.selected}
          onClick={() => setPersonaDrawerOpen(true)}
        >
          {persona?.choices.find((choice) => choice.id === persona.id)?.name ?? '陪伴风格'}
        </button>
      )}
      onNavigate={(view) => {
        const route = view === activeView
          ? browserRoute
          : routeForPrimaryView(view, viewSelection);
        void openRoute(route, 'push');
      }}
      onReturnCourse={() => {
        const url = new URL(viewSelection.courseReturnRoute, window.location.origin);
        void openRoute(parseBrowserRoute(url.pathname, url.search), 'push');
      }}
    >
      <Suspense fallback={<p className="workspace-notice">正在展开当前页面…</p>}>
        {children}
      </Suspense>
      {personaDrawerOpen && persona && (
        <PersonaDrawer
          value={persona}
          preferences={presentation}
          onClose={() => setPersonaDrawerOpen(false)}
          onSelect={changePersona}
          onPreferences={changePresentation}
        />
      )}
      {contentExplorerOpen && client.selected && (
        <ContentExplorer
          onClose={() => setContentExplorerOpen(false)}
          onEvidence={(source) => void openEvidence(source)}
          onSearch={(query) => api.contentSearch(client.selected!, query)}
        />
      )}
    </AppShell>
  );

  if (activeView === 'knowledge') {
    const query = browserRoute.kind === 'knowledge'
      ? browserRoute.query
      : queryForRoute(browserRoute);
    return withAppShell(
      views.knowledge.value
        ? (
          <KnowledgePage
            value={views.knowledge.value}
            onSelectMethod={(node) => void openRoute({
              kind: 'knowledge',
              query: {
                ...query,
                methodName: node.label,
                cardPath: null,
                evidenceSource: null,
              },
            }, 'push')}
            onSelectCard={(cardPath, methodName) => void openRoute({
              kind: 'knowledge',
              query: {
                ...query,
                methodName,
                cardPath,
                evidenceSource: null,
              },
            }, 'push')}
            onSelectMaterial={() => setContentExplorerOpen(true)}
            onFilter={(patch) => void openRoute({
              kind: 'knowledge',
              query: { ...query, ...patch },
            }, 'replace')}
            onCourse={(route) => {
              const url = new URL(route, window.location.origin);
              void openRoute(parseBrowserRoute(url.pathname, url.search), 'push');
            }}
            onMemory={(source) => void openRoute({
              kind: 'memory',
              query: {
                ...query,
                evidenceSource: source,
                topicId: null,
              },
            }, 'push')}
          />
        )
        : (
          <main className="coordinate-page knowledge-page" aria-label="知识山河">
            <p>正在整理知识山河…</p>
          </main>
        ),
    );
  }
  if (activeView === 'memory') {
    const query = browserRoute.kind === 'memory'
      ? browserRoute.query
      : queryForRoute(browserRoute);
    return withAppShell(
      views.memory.value
        ? (
          <MemoryPage
            value={views.memory.value}
            onSelectSource={(source) => void openRoute({
              kind: 'memory',
              query: { ...query, evidenceSource: source },
            }, 'push')}
            onFilter={(patch) => void openRoute({
              kind: 'memory',
              query: { ...query, ...patch },
            }, 'replace')}
            onCourse={(planId, lessonId) => {
              const route: BrowserRoute = planId && lessonId
                ? { kind: 'course-lesson', planId, lessonId }
                : planId
                  ? { kind: 'course-plan', planId }
                  : { kind: 'course' };
              void openRoute(route, 'push');
            }}
            onKnowledge={(methodName, cardPath) => void openRoute({
              kind: 'knowledge',
              query: {
                ...query,
                methodName,
                cardPath,
                evidenceSource: null,
                topicId: null,
              },
            }, 'push')}
            onObject={(target) => void openObjection(target)}
          />
        )
        : (
          <main className="coordinate-page memory-page" aria-label="研习留痕">
            <p>正在整理研习留痕…</p>
          </main>
        ),
    );
  }

  if (loading && !learningSet) {
    return <main className="loading-screen"><span>SF</span><p>正在展开学习集…</p></main>;
  }
  if (!learningSet) {
    return <main className="fatal-screen"><b>StudyForge</b><p>{pageError}</p></main>;
  }
  if (
    roadmapWorkspace
    && client.selected === ROADMAP_COACH_SESSION_KEY
  ) {
    const selected = ROADMAP_COACH_SESSION_KEY;
    const sessionBusy = Boolean(client.busy[selected]);
    const currentPersona = persona?.choices.find((choice) => choice.id === persona.id);
    const roadmapContent = (
      <div
        className="app-root"
        data-theme="liubai-xinzhongshi"
        data-view="roadmap"
        data-persona={persona?.id ?? 'neutral-tutor'}
        data-motion={presentation.motion}
        data-completion-feedback={presentation.completionFeedback ? 'on' : 'off'}
        style={{
          '--persona-accent': currentPersona?.accent,
        } as CSSProperties}
      >
        {connection !== 'open' && (
          <div className="connection-banner" role="status">
            <span />
            {connection === 'connecting'
              ? '正在连接规划事件流…'
              : '事件流已断开，正在重连…'}
          </div>
        )}
        {pageError && <div className="page-alert" role="alert">{pageError}</div>}
        <RoadmapCoachShell
          learningSet={roadmapWorkspace.learningSet}
          onHome={goHome}
        >
          <ChatPanel
            sessionKey={selected}
            items={client.conversations[selected] ?? []}
            work={client.work[selected] || client.busy[selected] || ''}
            error={client.errors[selected]}
            composerEnabled={!sessionBusy}
            persona={persona}
            deepMode={client.deepMode[selected] ?? false}
            workflows={client.workflows[selected] ?? []}
            workflowControlsEnabled
            workflowRailInline
            gate={null}
            prefill={null}
            onSend={send}
            onPrefillConsumed={() => {}}
            lessonStatus={() => null}
            onLessonReadyPrimary={() => {}}
            onLessonReadyDiscuss={() => {}}
            onPersonaOpen={() => setPersonaDrawerOpen(true)}
            onDeepMode={changeDeepMode}
            onWorkflowAction={actOnWorkflow}
            onMemoryReview={setMemoryReview}
          />
        </RoadmapCoachShell>
      </div>
    );
    return withAppShell(
      views.course.value
        ? (
          <CoursePage
            value={views.course.value}
            coachPanel={roadmapContent}
            selectedKey={courseSelectedKey}
            onNodeSelect={selectCourseNode}
            onLessonAction={(action) => void actOnCourseLesson(action)}
            onKnowledge={() => openPrimaryView('knowledge')}
            onMemory={() => openPrimaryView('memory')}
          />
        )
        : roadmapContent,
    );
  }
  if (!client.workspace || !client.selected) {
    return withAppShell(
      views.course.value
        ? (
          <CoursePage
            value={views.course.value}
            coachPanel={<p>{pageError ?? '正在打开学习顾问…'}</p>}
            selectedKey={courseSelectedKey}
            onNodeSelect={selectCourseNode}
            onLessonAction={(action) => void actOnCourseLesson(action)}
            onKnowledge={() => openPrimaryView('knowledge')}
            onMemory={() => openPrimaryView('memory')}
          />
        )
        : <p className="workspace-notice">正在整理课程脉络…</p>,
    );
  }

  const selected = client.selected;
  const isCoach = selected.startsWith('coach:');
  const isReplay = selectedLesson?.status === 'closed'
    || selectedLesson?.status === 'abandoned';
  const view = isCoach ? 'coach' : isReplay ? 'replay' : 'tutor';
  const contextPages = buildPublicContextPages({
    view,
    workspace: client.workspace,
    coachContext: isCoach ? coachContext : null,
    notebook,
  });
  const sessionBusy = Boolean(client.busy[selected]);
  const composerEnabled = (isCoach || selectedLesson?.status === 'active')
    && !sessionBusy;
  const currentPersona = persona?.choices.find((choice) => choice.id === persona.id);
  let gate: ReactNode = null;

  if (selectedLesson?.status === 'prepared') {
    gate = (
      <div className="lesson-gate prepared-gate">
        <span>课程已备好</span>
        <h2>待开始课程</h2>
        <p>
          已安排 {selectedLesson.blocks.length} 个课堂环节。开始后，课堂导师会逐步展开具体内容。
        </p>
        <button type="button" onClick={() => void startLesson(selectedLesson)}>开始上课 <i>↗</i></button>
      </div>
    );
  } else if (selectedLesson?.status === 'closed' || selectedLesson?.status === 'abandoned') {
    gate = (
      <div className="lesson-gate archive-gate">
        <span>{selectedLesson.status === 'closed' ? 'Lesson 已完成' : 'Lesson 已归档'}</span>
        <h2>{selectedLesson.title}</h2>
        <p>这份课堂记录保持只读。返回学习顾问可以复盘，并决定下一节课或重新备课。</p>
        <button type="button" onClick={() => void selectSession(client.workspace!.coach.sessionKey)}>
          返回学习顾问 <i>↗</i>
        </button>
      </div>
    );
  }

  const sessionChatPanel = (
    <ChatPanel
      sessionKey={selected}
      items={client.conversations[selected] ?? []}
      work={client.work[selected] || client.busy[selected] || ''}
      error={client.errors[selected]}
      composerEnabled={composerEnabled}
      {...(selectedLesson ? { lessonId: selectedLesson.id } : {})}
      persona={persona}
      deepMode={client.deepMode[selected] ?? false}
      workflows={client.workflows[selected] ?? []}
      workflowControlsEnabled={workflowSessionOpen}
      gate={gate}
      stage={isCoach && coachContext?.plan.learningReview ? (
        <PlanLearningReview
          value={coachContext.plan.learningReview}
          onEvidence={(source) => void openEvidence(source)}
          onDisputePrefill={(text) => setComposerPrefill({
            id: crypto.randomUUID(),
            text,
          })}
        />
      ) : null}
      prefill={composerPrefill}
      onSend={send}
      onPrefillConsumed={(id) => setComposerPrefill((current) => (
        current?.id === id ? null : current
      ))}
      lessonStatus={(lessonId) => (
        client.workspace?.lessons.find((lesson) => lesson.id === lessonId)?.status ?? null
      )}
      onLessonReadyPrimary={(lessonId) => void openReadyLesson(lessonId)}
      onLessonReadyDiscuss={() => void selectSession(client.workspace!.coach.sessionKey)}
      onPersonaOpen={() => setPersonaDrawerOpen(true)}
      onDeepMode={changeDeepMode}
      onWorkflowAction={actOnWorkflow}
      onMemoryReview={setMemoryReview}
    />
  );

  const workspaceContent = (
    <div
      className="app-root"
      data-theme="liubai-xinzhongshi"
      data-view={view}
      data-persona={persona?.id ?? 'neutral-tutor'}
      data-motion={presentation.motion}
      data-completion-feedback={presentation.completionFeedback ? 'on' : 'off'}
      style={{
        '--persona-accent': currentPersona?.accent,
      } as CSSProperties}
    >
      {connection !== 'open' && (
        <div className="connection-banner" role="status">
          <span />{connection === 'connecting' ? '正在连接课堂事件流…' : '事件流已断开，正在重连…'}
        </div>
      )}
      {pageError && <div className="page-alert" role="alert">{pageError}</div>}
      <div className="workspace-shell">
        <SessionTree
          workspace={client.workspace}
          selected={selected}
          onSelect={(key) => void selectSession(key)}
          onPlanSelect={(planId) => {
            void openPlan(planId);
          }}
          onHome={goHome}
          explorerEnabled={isCoach || selectedLesson?.status !== 'prepared'}
          onExplore={() => setContentExplorerOpen(true)}
        />
        {sessionChatPanel}
        <ContextStack
          view={view}
          coachContext={isCoach ? coachContext : null}
          lesson={selectedLesson}
          notebook={notebook}
          replay={replay}
          abilities={abilities}
          workflows={client.workflows[selected] ?? []}
          contextPages={contextPages}
          onEvidence={(source) => void openEvidence(source)}
          onWorkflowAction={actOnWorkflow}
        />
      </div>
      {completionFeedback && (
        <div className="completion-feedback" role="status">{completionFeedback}</div>
      )}
      {memoryReview?.status === 'proposed' && (
        <MemoryReviewPanel
          review={memoryReview}
          submitting={submittingMemoryReview}
          onClose={() => setMemoryReview(null)}
          onSource={(source) => void openEvidence(source)}
          onSubmit={submitMemoryReview}
        />
      )}
    </div>
  );
  if (browserRoute.kind === 'course-lesson' && selectedLesson) {
    const classroomStage = (
      selectedLesson.status === 'active' || selectedLesson.status === 'paused'
    ) ? (
      <CurrentActivityStage
        notebook={notebook}
        paused={selectedLesson.status === 'paused'}
        onResume={() => void startLesson(selectedLesson)}
      />
    ) : gate;
    return withAppShell(
      <>
        <FocusedClassroomPage
          lesson={selectedLesson}
          notebook={notebook}
          replay={replay}
          stage={classroomStage}
          chatPanel={sessionChatPanel}
          onStart={() => void startLesson(selectedLesson)}
          onPause={() => void pauseLesson(selectedLesson.id)}
          onReprepare={() => void reprepareLesson(selectedLesson.id)}
        />
        {completionFeedback && (
          <div className="completion-feedback" role="status">{completionFeedback}</div>
        )}
        {memoryReview?.status === 'proposed' && (
          <MemoryReviewPanel
            review={memoryReview}
            submitting={submittingMemoryReview}
            onClose={() => setMemoryReview(null)}
            onSource={(source) => void openEvidence(source)}
            onSubmit={submitMemoryReview}
          />
        )}
      </>,
    );
  }
  return withAppShell(
    views.course.value
      ? (
        <CoursePage
          value={views.course.value}
          coachPanel={workspaceContent}
          selectedKey={courseSelectedKey}
          onNodeSelect={selectCourseNode}
          onLessonAction={(action) => void actOnCourseLesson(action)}
          onKnowledge={() => openPrimaryView('knowledge')}
          onMemory={() => openPrimaryView('memory')}
        />
      )
      : workspaceContent,
  );
}
