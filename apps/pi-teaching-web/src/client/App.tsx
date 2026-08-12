import { useEffect, useReducer, useRef, useState } from 'react';
import type {
  CourseSnapshot,
  CourseTreeNode,
  CalendarAppointment,
  CalendarSnapshot,
  LearningAssetLibrarySnapshot,
  LearningContextReference,
  LearningFootprintSnapshot,
  LearningMaterial,
  LearningMaterialView,
  LearningSetHomeSnapshot,
  LessonHandout,
  ProblemAttemptResponse,
  PublicFocusCycle,
  SemanticRelation,
  SessionKey,
  StudyEvent,
} from '../shared/contracts';
import { api, type LearningNoteView, type ProblemCardView } from './api';
import { AppShell } from './components/AppShell';
import { formatBrowserRoute, parseBrowserRoute, type BrowserRoute } from './routes';
import { initialClientState, reduceClientState } from './state';
import { createReconnectGate } from './reconnect-gate';
import { CoursePage, type NodeLifecycleAction } from './pages/CoursePage';
import { CourseOverviewPage } from './pages/CourseOverviewPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { LessonHandoutPage } from './pages/LessonHandoutPage';
import { HomePage } from './pages/HomePage';
import { FreeLearningPage } from './pages/FreeLearningPage';
import type { CarriedContextItem } from './pages/FreeLearningPage';
import { AssetsPage } from './pages/AssetsPage';
import { NotePage } from './pages/NotePage';
import { ProblemCardPage } from './pages/ProblemCardPage';
import { FootprintPage } from './pages/FootprintPage';
import { MaterialPage } from './pages/MaterialPage';
import { MetaPage } from './pages/MetaPage';
import { CalendarPage } from './pages/CalendarPage';
import type { PrimaryView } from './view-state';
import { deriveFreeLearningTitle } from '../study/display-projections';
import { loadFreeLearningContexts } from './free-learning-contexts';
import { eventTransport } from './transport';
import { publicErrorText } from './public-errors';
import { resetRouteScroll } from './route-scroll';
import { useDesktopTools } from './desktop/DesktopContext';
import { deliverFocusAlert, playFocusChime } from './focus-alert';
import { calendarReviewSelection } from '../calendar/review-selection';
import { semanticAssetNeighbors } from './semantic-graph';

type ConnectionState = 'open' | 'connecting' | 'closed';

function findNode(
  node: CourseTreeNode,
  predicate: (node: CourseTreeNode) => boolean,
): CourseTreeNode | null {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function parentPlan(root: CourseTreeNode, lessonPath: string): CourseTreeNode | null {
  for (const plan of root.children) {
    if (plan.kind !== 'plan') continue;
    if (plan.children.some((lesson) => lesson.kind === 'lesson' && lesson.path === lessonPath)) {
      return plan;
    }
  }
  return null;
}

function routePath(route: BrowserRoute, base: CourseSnapshot): string {
  if (route.kind === 'course' || route.kind === 'course-roadmap') return 'ROADMAP.md';
  const node = route.kind === 'course-plan'
    ? base.tree.children.find((candidate) => (
      candidate.kind === 'plan' && candidate.id === route.planId
    )) ?? null
    : route.kind === 'course-lesson'
      ? base.tree.children
        .find((candidate) => candidate.kind === 'plan' && candidate.id === route.planId)
        ?.children.find((candidate) => (
          candidate.kind === 'lesson' && candidate.id === route.lessonId
        )) ?? null
      : null;
  if (!node) throw new Error('ROUTE_NODE_NOT_FOUND');
  return node.path;
}

function keyForCourse(course: CourseSnapshot): SessionKey {
  const document = course.selected ?? course.roadmap;
  const node = findNode(course.tree, (candidate) => candidate.path === document.path);
  if (!node) throw new Error('COURSE_SESSION_NODE_NOT_FOUND');
  return node.sessionKey;
}

function errorText(error: unknown): string {
  return publicErrorText(error, '本地学习工作区暂时无法读取，请稍后重试。');
}

function routeIsCourse(route: BrowserRoute): boolean {
  return route.kind === 'course'
    || route.kind === 'course-roadmap'
    || route.kind === 'course-plan'
    || route.kind === 'course-lesson';
}

export function App() {
  const desktopTools = useDesktopTools();
  const [route, setRoute] = useState<BrowserRoute>(() => (
    parseBrowserRoute(window.location.pathname) ?? { kind: 'home' }
  ));
  const [home, setHome] = useState<LearningSetHomeSnapshot | null>(null);
  const [assets, setAssets] = useState<LearningAssetLibrarySnapshot | null>(null);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [material, setMaterial] = useState<LearningMaterialView | null>(null);
  const [footprint, setFootprint] = useState<LearningFootprintSnapshot | null>(null);
  const [note, setNote] = useState<LearningNoteView | null>(null);
  const [problem, setProblem] = useState<ProblemCardView | null>(null);
  const [course, setCourse] = useState<CourseSnapshot | null>(null);
  const [calendar, setCalendar] = useState<CalendarSnapshot | null>(null);
  const [calendarReminderPermission, setCalendarReminderPermission] = useState<
    'granted' | 'denied' | 'unsupported' | 'unavailable' | null
  >(null);
  const [semanticRelations, setSemanticRelations] = useState<SemanticRelation[] | null>(null);
  const [freeContexts, setFreeContexts] = useState<CarriedContextItem[]>([]);
  const [handout, setHandout] = useState<LessonHandout | null>(null);
  const [handoutError, setHandoutError] = useState<string | null>(null);
  const [handoutLoading, setHandoutLoading] = useState(route.kind === 'lesson-handout');
  const [client, dispatch] = useReducer(reduceClientState, initialClientState);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [notice, setNotice] = useState<string | null>('正在打开学习集…');
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [focus, setFocus] = useState<PublicFocusCycle | null>(null);
  const routeLoadRevision = useRef(0);

  const acceptCalendarSnapshot = (value: CalendarSnapshot) => {
    setCalendar(value);
    if (!desktopTools) return;
    void desktopTools.reconcileCalendarNotifications(value.appointments).then(
      (status) => setCalendarReminderPermission(status.permission),
      () => setCalendarReminderPermission('unavailable'),
    );
  };

  const loadRoute = async (next: BrowserRoute) => {
    const revision = ++routeLoadRevision.current;
    if (next.kind === 'lesson-handout') {
      setRoute(next);
      setHandout(null);
      setHandoutError(null);
      setHandoutLoading(true);
      setNotice(null);
      try {
        const value = await api.lessonHandout(next.planId, next.lessonId, next.blockIds);
        if (revision !== routeLoadRevision.current) return;
        setHandout(value);
      } catch (error) {
        if (revision === routeLoadRevision.current) setHandoutError(errorText(error));
      } finally {
        if (revision === routeLoadRevision.current) setHandoutLoading(false);
      }
      return;
    }
    setHandout(null);
    setHandoutError(null);
    setHandoutLoading(false);
    setNotice('正在读取学习集…');
    try {
      const homeRequest = api.home();

      if (next.kind === 'home') {
        const homeValue = await homeRequest;
        if (revision !== routeLoadRevision.current) return;
        setHome(homeValue);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'calendar') {
        const [calendarValue, homeValue] = await Promise.all([api.calendar(), homeRequest]);
        if (revision !== routeLoadRevision.current) return;
        acceptCalendarSnapshot(calendarValue);
        setHome(homeValue);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind !== 'free-learning') {
        void homeRequest.then((homeValue) => {
          if (revision === routeLoadRevision.current) setHome(homeValue);
        }, () => {});
      }
      if (next.kind === 'assets') {
        const [value, materialValues] = await Promise.all([api.assets(), api.materials()]);
        if (revision !== routeLoadRevision.current) return;
        setAssets(value);
        setMaterials(materialValues);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'material') {
        const value = await api.material(next.id);
        if (revision !== routeLoadRevision.current) return;
        setMaterial(value);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'footprint') {
        const value = await api.footprint();
        if (revision !== routeLoadRevision.current) return;
        setFootprint(value);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'note') {
        const [value, assetLibrary, relations] = await Promise.all([
          api.note(next.id),
          assets ? Promise.resolve(assets) : api.assets(),
          semanticRelations ? Promise.resolve(semanticRelations) : api.semanticRelations(),
        ]);
        if (revision !== routeLoadRevision.current) return;
        setNote(value);
        setAssets(assetLibrary);
        setSemanticRelations(relations);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'problem-card') {
        const [value, assetLibrary, relations] = await Promise.all([
          api.problemCard(next.id),
          assets ? Promise.resolve(assets) : api.assets(),
          semanticRelations ? Promise.resolve(semanticRelations) : api.semanticRelations(),
        ]);
        if (revision !== routeLoadRevision.current) return;
        setProblem(value);
        setAssets(assetLibrary);
        setSemanticRelations(relations);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'free-learning') {
        const key = `free:${next.sessionId}` as const;
        const [homeValue, history] = await Promise.all([
          homeRequest,
          api.history(key),
        ]);
        const session = homeValue.recentFreeLearning.find((candidate) => (
          candidate.id === next.sessionId
        ));
        const contexts = await loadFreeLearningContexts(session?.selectedAssets ?? [], api);
        if (revision !== routeLoadRevision.current) return;
        setHome(homeValue);
        setFreeContexts(contexts);
        dispatch({ type: 'conversation-snapshot', sessionKey: key, items: history });
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'meta') {
        const key = `meta:${next.sessionId}` as const;
        const history = await api.history(key);
        if (revision !== routeLoadRevision.current) return;
        dispatch({ type: 'conversation-snapshot', sessionKey: key, items: history });
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'knowledge') {
        const [relations, assetLibrary, materialValues] = await Promise.all([
          api.semanticRelations(),
          api.assets(),
          api.materials(),
        ]);
        if (revision !== routeLoadRevision.current) return;
        setSemanticRelations(relations);
        setAssets(assetLibrary);
        setMaterials(materialValues);
        setRoute(next);
        setNotice(null);
        return;
      }
      const base = await api.course();
      if (next.kind === 'course') {
        if (revision !== routeLoadRevision.current) return;
        setCourse(base);
        setRoute(next);
        setNotice(null);
        return;
      }
      const selectedPath = routePath(next, base);
      const value = selectedPath === 'ROADMAP.md' ? base : await api.course(selectedPath);
      const key = keyForCourse(value);
      const history = await api.history(key);
      if (revision !== routeLoadRevision.current) return;
      setCourse(value);
      setRoute(next);
      dispatch({ type: 'conversation-snapshot', sessionKey: key, items: history });
      setNotice(null);
    } catch (error) {
      if (revision === routeLoadRevision.current) setNotice(errorText(error));
    }
  };

  const navigate = (next: BrowserRoute, replace = false) => {
    const path = formatBrowserRoute(next);
    window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
    resetRouteScroll();
    void loadRoute(next);
  };

  const openKnowledgeTag = (tag: string) => {
    const path = `/knowledge?focus=${encodeURIComponent(`tag:${tag}`)}`;
    window.history.pushState(null, '', path);
    resetRouteScroll();
    void loadRoute({ kind: 'knowledge' });
  };

  useEffect(() => {
    const parsed = parseBrowserRoute(window.location.pathname);
    const initial = parsed ?? { kind: 'home' as const };
    if (!parsed || window.location.pathname === '/') window.history.replaceState(null, '', '/home');
    void loadRoute(initial);
  }, []);

  useEffect(() => {
    void api.focus().then(setFocus, () => {});
  }, []);

  useEffect(() => {
    if (focus?.status !== 'running' || !focus.expiresAt) return undefined;
    const delay = Math.max(0, Date.parse(focus.expiresAt) - Date.now()) + 80;
    const timer = window.setTimeout(() => {
      const targetMinutes = focus.targetSeconds / 60;
      void api.focus().then(async (next) => {
        setFocus(next);
        if (next) return;
        const copy = { title: 'StudyForge', body: `${targetMinutes} 分钟计时已到` };
        setNotice(copy.body);
        await deliverFocusAlert({
          play: playFocusChime,
          notify: desktopTools
            ? () => desktopTools.showNotification(copy.title, copy.body)
            : async () => {},
        }, copy);
      }, () => {});
    }, Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [focus?.status, focus?.expiresAt, focus?.targetSeconds, desktopTools]);

  useEffect(() => {
    const pop = () => {
      resetRouteScroll();
      void loadRoute(parseBrowserRoute(window.location.pathname) ?? { kind: 'home' });
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  useEffect(() => {
    if (route.kind === 'lesson-handout') return undefined;
    let disposed = false;
    let socket: WebSocket | null = null;
    let retry: number | null = null;
    const reconnect = createReconnectGate();
    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      const connection = eventTransport(window.location);
      socket = connection.protocols.length > 0
        ? new WebSocket(connection.url, connection.protocols)
        : new WebSocket(connection.url);
      socket.onopen = () => {
        setConnection('open');
        if (!reconnect.opened()) return;
        const current = parseBrowserRoute(window.location.pathname) ?? { kind: 'home' as const };
        void loadRoute(current);
      };
      socket.onmessage = (message) => {
        const event = JSON.parse(String(message.data)) as StudyEvent;
        const current = parseBrowserRoute(window.location.pathname) ?? { kind: 'home' as const };
        if (event.type === 'course-invalidated') {
          if (routeIsCourse(current)) void loadRoute(current);
          return;
        }
        if (event.type === 'knowledge-invalidated') {
          if (current.kind === 'knowledge') void loadRoute(current);
          return;
        }
        if (event.type === 'home-invalidated') {
          if (current.kind === 'home') void loadRoute(current);
          else void api.home().then(setHome);
          return;
        }
        if (event.type === 'assets-invalidated') {
          if (
            current.kind === 'assets'
            || current.kind === 'note'
            || current.kind === 'problem-card'
            || current.kind === 'material'
          ) {
            void loadRoute(current);
          }
          return;
        }
        if (event.type === 'focus-invalidated') {
          void api.focus().then(setFocus, () => {});
          return;
        }
        if (event.type === 'calendar-invalidated') {
          if (current.kind === 'calendar') void loadRoute(current);
          else void api.calendar().then(acceptCalendarSnapshot, () => {});
          return;
        }
        dispatch(event);
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        setConnection('closed');
        retry = window.setTimeout(connect, 1200);
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retry !== null) window.clearTimeout(retry);
      socket?.close();
    };
  }, [route]);

  const selectedKey: SessionKey | null = route.kind === 'free-learning'
    ? `free:${route.sessionId}`
    : route.kind === 'meta'
      ? `meta:${route.sessionId}`
      : routeIsCourse(route) && course ? keyForCourse(course) : null;
  const conversation = selectedKey ? client.conversations[selectedKey] ?? [] : [];
  const running = selectedKey ? client.running[selectedKey] ?? false : false;
  const sessionError = selectedKey ? client.errors[selectedKey] ?? null : null;
  const freeSummary = route.kind === 'free-learning'
    ? home?.recentFreeLearning.find((session) => session.id === route.sessionId) ?? null
    : null;
  const freeStatus = freeSummary?.status ?? 'active';
  const conversationTitle = deriveFreeLearningTitle(conversation);
  const freeTitle = conversationTitle === '自由学习'
    ? freeSummary?.title ?? conversationTitle
    : conversationTitle;

  const nodeRoute = (node: CourseTreeNode): BrowserRoute => {
    if (node.kind === 'roadmap') return { kind: 'course-roadmap' };
    if (node.kind === 'plan') return { kind: 'course-plan', planId: node.id };
    const plan = course ? parentPlan(course.tree, node.path) : null;
    if (!plan) throw new Error('LESSON_PARENT_NOT_FOUND');
    return { kind: 'course-lesson', planId: plan.id, lessonId: node.id };
  };

  const lifecycle = async (action: NodeLifecycleAction, node: CourseTreeNode) => {
    try {
      if (action === 'complete-plan') {
        await api.completePlan(node.id);
        return;
      }
      const plan = node.kind === 'lesson' ? parentPlan(course!.tree, node.path) : null;
      if (action === 'close-lesson') {
        if (!plan) throw new Error('LESSON_PARENT_NOT_FOUND');
        await api.closeLesson(plan.id, node.id);
        return;
      }
      setNotice('正在更新学习位置…');
      const result = action === 'start-plan'
        ? await api.startPlan(node.id)
        : await api.startLesson(plan!.id, node.id);
      const url = new URL(result.route, window.location.origin);
      navigate(parseBrowserRoute(url.pathname) ?? { kind: 'home' });
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const startFree = async (
    selectedAssets: LearningContextReference[] = [],
    intent: 'open' | 'review' = 'open',
  ) => {
    try {
      const created = await api.createFreeLearning(selectedAssets, intent);
      const next = parseBrowserRoute(new URL(created.route, window.location.origin).pathname);
      if (!next) throw new Error('FREE_LEARNING_ROUTE_INVALID');
      navigate(next);
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const startCalendarReview = async (
    candidates: CalendarSnapshot['reviewCandidates'],
  ) => {
    try {
      const selection = calendarReviewSelection(candidates);
      if (desktopTools?.openReview) {
        await desktopTools.openReview(selection.learningSetPath, selection.contexts);
        return;
      }
      if (selection.learningSetPath !== calendar?.currentLearningSetPath) {
        throw new Error('CALENDAR_REVIEW_LEARNING_SET_UNAVAILABLE');
      }
      await startFree(selection.contexts, 'review');
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const startMeta = async (selectedAssets: LearningContextReference[] = []) => {
    try {
      const existing = home?.recentMeta[0];
      if (existing) {
        navigate({ kind: 'meta', sessionId: existing.id });
        return;
      }
      const created = await api.createMeta(selectedAssets);
      const next = parseBrowserRoute(new URL(created.route, window.location.origin).pathname);
      if (!next) throw new Error('META_ROUTE_INVALID');
      navigate(next);
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const startFocus = async (
    key: SessionKey,
    targetSeconds: 900 | 1500 | 2700,
  ) => {
    try {
      setFocus(await api.startFocus(key, targetSeconds));
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const pauseFocus = async () => {
    try {
      setFocus(await api.pauseFocus());
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const resumeFocus = async () => {
    try {
      setFocus(await api.resumeFocus());
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const endFocus = async () => {
    try {
      const ended = await api.endFocus();
      setFocus(null);
      const copy = { title: 'StudyForge', body: '本次专注已结束' };
      setNotice(copy.body);
      await deliverFocusAlert({
        play: playFocusChime,
        notify: desktopTools
          ? () => desktopTools.showNotification(copy.title, copy.body)
          : async () => {},
      }, copy);
      if (ended.reason === 'elapsed') setNotice(`${ended.targetSeconds / 60} 分钟计时已到`);
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const openCalendarAppointment = async (appointment: CalendarAppointment) => {
    try {
      if (desktopTools) {
        await desktopTools.openCalendarAppointment(appointment);
        return;
      }
      const launched = await api.launchCalendarAppointment(appointment.id, appointment.revision);
      const next = parseBrowserRoute(new URL(launched.route, window.location.origin).pathname);
      if (!next) throw new Error('CALENDAR_LAUNCH_ROUTE_INVALID');
      navigate(next);
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  let content: React.ReactNode;
  if (route.kind === 'home') {
    content = home
      ? (
        <HomePage
          value={home}
          onNavigate={navigate}
          onStartFree={() => void startFree()}
          onPlan={() => void startMeta()}
          onOpenFootprint={() => navigate({ kind: 'footprint' })}
        />
      )
      : <div className="loading-screen"><b>正在打开学习集</b></div>;
  } else if (route.kind === 'calendar') {
    content = calendar ? (
      <CalendarPage
        appointments={calendar.appointments}
        currentLearningSetPath={calendar.currentLearningSetPath}
        plans={calendar.plans}
        reviewCandidates={calendar.reviewCandidates}
        reminderPermission={calendarReminderPermission}
        onCreate={async (input) => {
          await api.createCalendarAppointment(input);
          await loadRoute({ kind: 'calendar' });
        }}
        onUpdate={async (appointment, input) => {
          await api.updateCalendarAppointment(appointment.id, {
            expectedRevision: appointment.revision,
            ...input,
            learningSetPath: appointment.learningSetPath,
            destination: appointment.destination,
          });
          await loadRoute({ kind: 'calendar' });
        }}
        onDelete={async (appointment) => {
          await api.deleteCalendarAppointment(appointment.id, appointment.revision);
          await loadRoute({ kind: 'calendar' });
        }}
        onOpen={openCalendarAppointment}
        onReview={startCalendarReview}
      />
    ) : <div className="loading-screen"><b>正在读取学习日历</b></div>;
  } else if (route.kind === 'assets') {
    content = assets ? (
      <AssetsPage
        value={assets}
        materials={materials}
        onOpen={(reference) => navigate(reference.kind === 'note'
          ? { kind: 'note', id: reference.id }
          : { kind: 'problem-card', id: reference.id })}
        onOpenMaterial={(id) => navigate({ kind: 'material', id })}
        onAsk={(references) => void startFree(references)}
        onReview={(references) => void startFree(references, 'review')}
        onImport={async (input) => {
          await api.importMaterial(input);
          await loadRoute({ kind: 'assets' });
        }}
        {...(desktopTools?.importBook ? {
          onImportBook: async (title: string) => {
            const receipt = await desktopTools.importBook!(title);
            if (receipt) await loadRoute({ kind: 'assets' });
          },
        } : {})}
        onOpenFootprint={() => navigate({ kind: 'footprint' })}
        onOpenKnowledge={() => navigate({ kind: 'knowledge' })}
      />
    ) : <div className="loading-screen"><b>正在读取学习资料</b></div>;
  } else if (route.kind === 'material') {
    content = material ? (
      <MaterialPage
        value={material}
        onRead={(locator) => api.materialLocator(
          material.material.id,
          material.current.revision,
          locator,
        )}
        onAsk={(reference) => void startFree([reference])}
      />
    ) : <div className="loading-screen"><b>正在读取原始资料</b></div>;
  } else if (route.kind === 'footprint') {
    content = footprint ? (
      <FootprintPage value={footprint} onOpen={(path) => {
        const next = parseBrowserRoute(new URL(path, window.location.origin).pathname);
        if (next) navigate(next);
      }} />
    ) : <div className="loading-screen"><b>正在读取学习足迹</b></div>;
  } else if (route.kind === 'note') {
    content = note ? (
      <NotePage value={note} onSave={async (input) => {
        setNote(await api.updateNote(note.id, input));
      }} onReview={async (result) => {
        await api.assetReview('note', note.id, {
          action: 'review', expectedRevision: note.revision, result,
        });
        setNote(await api.note(note.id));
      }} onReviewAction={async (action) => {
        await api.assetReview('note', note.id, {
          action, expectedRevision: note.revision,
        });
        setNote(await api.note(note.id));
      }} onAskTeacher={() => void startFree([{ kind: 'note', id: note.id }])} onReload={() => {
        void loadRoute(route);
      }} onTag={openKnowledgeTag} neighbors={assets
        ? semanticAssetNeighbors(assets, { kind: 'note', id: note.id })
        : []} onOpenNeighbor={(reference) => navigate(reference.kind === 'note'
        ? { kind: 'note', id: reference.id }
        : { kind: 'problem-card', id: reference.id })} />
    ) : <div className="loading-screen"><b>正在读取 Note</b></div>;
  } else if (route.kind === 'problem-card') {
    content = problem ? (
      <ProblemCardPage
        value={problem}
        onAttempt={async (response: ProblemAttemptResponse) => {
          const result = await api.attemptProblem(problem.id, response);
          setProblem(await api.problemCard(problem.id));
          return result.event;
        }}
        onReveal={async () => {
          await api.revealProblem(problem.id);
          setProblem(await api.problemCard(problem.id));
        }}
        onSaveNote={async (input) => {
          await api.updateProblemNote(problem.id, input);
          setProblem(await api.problemCard(problem.id));
        }}
        onReview={async (result, problemAttemptId) => {
          await api.assetReview('problem-card', problem.id, {
            action: 'review', expectedRevision: problem.revision, result, problemAttemptId,
          });
          setProblem(await api.problemCard(problem.id));
        }}
        onReviewAction={async (action) => {
          await api.assetReview('problem-card', problem.id, {
            action, expectedRevision: problem.revision,
          });
          setProblem(await api.problemCard(problem.id));
        }}
        onAskTeacher={async () => {
          const created = await api.askProblemTeacher(problem.id);
          const next = parseBrowserRoute(new URL(created.route, window.location.origin).pathname);
          if (next) navigate(next);
        }}
        onTag={openKnowledgeTag}
        neighbors={assets
          ? semanticAssetNeighbors(assets, { kind: 'problem-card', id: problem.id })
          : []}
        onOpenNeighbor={(reference) => navigate(reference.kind === 'note'
          ? { kind: 'note', id: reference.id }
          : { kind: 'problem-card', id: reference.id })}
      />
    ) : <div className="loading-screen"><b>正在读取题卡</b></div>;
  } else if (route.kind === 'free-learning' && selectedKey) {
    content = (
      <FreeLearningPage
        sessionKey={selectedKey}
        title={freeTitle}
        contexts={freeContexts}
        connected={connection === 'open'}
        status={freeStatus}
        items={conversation}
        running={running}
        error={sessionError}
        onSend={(text) => api.send(selectedKey, text).then(() => undefined)}
        onEnd={async () => {
          await api.endFreeLearning(route.sessionId);
          setFocus(null);
          await loadRoute(route);
        }}
        onStartFocus={focus ? null : (seconds) => startFocus(selectedKey, seconds)}
      />
    );
  } else if (route.kind === 'meta' && selectedKey?.startsWith('meta:')) {
    const metaKey = `meta:${route.sessionId}` as const;
    content = (
      <MetaPage
        sessionKey={metaKey}
        items={conversation}
        running={running}
        error={sessionError}
        hasCourse={home?.hasCourse ?? false}
        connected={connection === 'open'}
        onSend={(text) => api.send(metaKey, text).then(() => undefined)}
        onEnterCourse={() => navigate({ kind: 'course' })}
      />
    );
  } else if (route.kind === 'knowledge') {
    content = semanticRelations && assets
      ? (
        <KnowledgePage
          relations={semanticRelations}
          assets={assets}
          materials={materials}
          initialFocus={new URLSearchParams(window.location.search).get('focus')}
          onFocus={(focus) => {
            const url = new URL(window.location.href);
            url.search = '';
            url.searchParams.set('focus', focus);
            window.history.replaceState(null, '', `${url.pathname}${url.search}`);
          }}
          onOpenAsset={(reference) => navigate(reference.kind === 'note'
            ? { kind: 'note', id: reference.id }
            : { kind: 'problem-card', id: reference.id })}
          onAskAsset={(reference) => void startFree([reference])}
          onOpenMaterial={(id) => navigate({ kind: 'material', id })}
          onOpenAssets={() => navigate({ kind: 'assets' })}
        />
      )
      : <div className="loading-screen"><b>正在读取知识图谱</b></div>;
  } else if (!course || !selectedKey) {
    content = <div className="loading-screen"><b>正在读取课程节点</b></div>;
  } else if (route.kind === 'course') {
    content = <CourseOverviewPage value={course} onNavigate={navigate} />;
  } else {
    content = (
      <CoursePage
        value={course}
        items={conversation}
        running={running}
        error={sessionError}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        connected={connection === 'open'}
        onNodeSelect={(node) => navigate(nodeRoute(node))}
        onSend={(text) => api.send(selectedKey, text).then(() => undefined)}
        onLifecycle={lifecycle}
        onToggleLeft={() => setLeftOpen((value) => !value)}
        onToggleRight={() => setRightOpen((value) => !value)}
        onStartFocus={focus ? null : (seconds) => startFocus(selectedKey, seconds)}
      />
    );
  }

  if (route.kind === 'lesson-handout') {
    return (
      <LessonHandoutPage
        value={handout}
        error={handoutError}
        loading={handoutLoading}
        backHref={formatBrowserRoute({
          kind: 'course-lesson',
          planId: route.planId,
          lessonId: route.lessonId,
        })}
        onPrint={() => window.print()}
      />
    );
  }

  const activeView: PrimaryView = routeIsCourse(route)
    ? 'course'
    : route.kind === 'calendar'
      ? 'calendar'
    : route.kind === 'assets' || route.kind === 'note' || route.kind === 'problem-card'
      || route.kind === 'material'
      || route.kind === 'knowledge'
      || route.kind === 'footprint'
      ? 'assets'
      : 'home';
  return (
    <AppShell
      title={home?.guide.title ?? course?.guide.title ?? '本地学习工作台'}
      activeView={activeView}
      hasCourse={home?.hasCourse ?? course !== null}
      connection={connection}
      notice={notice}
      focus={focus}
      onPauseFocus={pauseFocus}
      onResumeFocus={resumeFocus}
      onEndFocus={endFocus}
      onNavigate={(view) => navigate(
        view === 'home'
          ? { kind: 'home' }
          : view === 'assets'
            ? { kind: 'assets' }
            : view === 'calendar'
              ? { kind: 'calendar' }
              : { kind: 'course' },
      )}
    >
      {content}
    </AppShell>
  );
}

export default App;
