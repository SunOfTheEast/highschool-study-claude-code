import { useEffect, useReducer, useRef, useState } from 'react';
import type {
  CourseSnapshot,
  CourseTreeNode,
  LearningAssetLibrarySnapshot,
  LearningContextReference,
  LearningFootprintSnapshot,
  LearningMaterial,
  LearningMaterialView,
  LearningSetHomeSnapshot,
  LessonHandout,
  ProblemAttemptResponse,
  SemanticRelation,
  SessionKey,
  StudyEvent,
} from '../shared/contracts';
import { api, ApiError, type LearningNoteView, type ProblemCardView } from './api';
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
import type { PrimaryView } from './view-state';
import { deriveFreeLearningTitle } from '../study/display-projections';
import { formatMaterialLocator } from './material-locator';

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
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = error.body as { reason?: unknown; error?: unknown };
    if (typeof body.reason === 'string') return body.reason;
    if (typeof body.error === 'string') return body.error;
  }
  return error instanceof Error ? error.message : '本地学习工作区暂时无法读取。';
}

function routeIsCourse(route: BrowserRoute): boolean {
  return route.kind === 'course'
    || route.kind === 'course-roadmap'
    || route.kind === 'course-plan'
    || route.kind === 'course-lesson';
}

export function App() {
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
  const routeLoadRevision = useRef(0);

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
      const homeValue = await api.home();
      if (revision !== routeLoadRevision.current) return;
      setHome(homeValue);

      if (next.kind === 'home') {
        setRoute(next);
        setNotice(null);
        return;
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
        const value = await api.note(next.id);
        if (revision !== routeLoadRevision.current) return;
        setNote(value);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'problem-card') {
        const value = await api.problemCard(next.id);
        if (revision !== routeLoadRevision.current) return;
        setProblem(value);
        setRoute(next);
        setNotice(null);
        return;
      }
      if (next.kind === 'free-learning') {
        const key = `free:${next.sessionId}` as const;
        const session = homeValue.recentFreeLearning.find((candidate) => (
          candidate.id === next.sessionId
        ));
        const [history, assetLibrary, materialValues] = await Promise.all([
          api.history(key),
          api.assets(),
          api.materials(),
        ]);
        const selectedProblems = session?.selectedAssets.filter((reference) => (
          reference.kind === 'problem-card'
        )) ?? [];
        const problemStates = new Map(await Promise.all(selectedProblems.map(async (reference) => {
          const value = await api.problemCard(reference.id);
          return [reference.id, value] as const;
        })));
        if (revision !== routeLoadRevision.current) return;
        setAssets(assetLibrary);
        setMaterials(materialValues);
        setFreeContexts((session?.selectedAssets ?? []).map((reference) => {
          if (reference.kind === 'material') {
            const materialValue = materialValues.find((candidate) => candidate.id === reference.id);
            const materialRevision = materialValue?.revisions.find((candidate) => (
              candidate.revision === reference.revision
            ));
            return {
              key: `material:${reference.id}@${reference.revision}#${reference.locator ?? ''}`,
              kind: '资料',
              title: materialRevision?.title ?? reference.id,
              detail: `第 ${reference.revision} 版 · ${formatMaterialLocator(reference.locator).human}`,
            };
          }
          if (reference.kind === 'note') {
            const value = assetLibrary.notes.find((asset) => asset.id === reference.id);
            return {
              key: `note:${reference.id}`,
              kind: '笔记',
              title: value?.title ?? reference.id,
              detail: value ? `第 ${value.revision} 版` : reference.id,
            };
          }
          const value = assetLibrary.problemCards.find((asset) => asset.id === reference.id);
          const state = problemStates.get(reference.id);
          return {
            key: `problem-card:${reference.id}`,
            kind: '题卡',
            title: value?.title ?? reference.id,
            detail: `${value ? `第 ${value.revision} 版 · ` : ''}${
              state?.activity.latestAttempt ? '已有作答' : '尚未作答'
            }`,
          };
        }));
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
    void loadRoute(next);
  };

  useEffect(() => {
    const parsed = parseBrowserRoute(window.location.pathname);
    const initial = parsed ?? { kind: 'home' as const };
    if (!parsed || window.location.pathname === '/') window.history.replaceState(null, '', '/home');
    void loadRoute(initial);
  }, []);

  useEffect(() => {
    const pop = () => void loadRoute(
      parseBrowserRoute(window.location.pathname) ?? { kind: 'home' },
    );
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
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/events`);
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
    setNotice('正在更新学习位置…');
    try {
      const result = action === 'start-plan'
        ? await api.startPlan(node.id)
        : action === 'complete-plan'
          ? await api.completePlan(node.id)
          : action === 'start-lesson'
            ? await api.startLesson(parentPlan(course!.tree, node.path)!.id, node.id)
            : await api.closeLesson(parentPlan(course!.tree, node.path)!.id, node.id);
      const url = new URL(result.route, window.location.origin);
      navigate(parseBrowserRoute(url.pathname) ?? { kind: 'home' });
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const startFree = async (selectedAssets: LearningContextReference[] = []) => {
    try {
      const created = await api.createFreeLearning(selectedAssets);
      const next = parseBrowserRoute(new URL(created.route, window.location.origin).pathname);
      if (!next) throw new Error('FREE_LEARNING_ROUTE_INVALID');
      navigate(next);
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
        onImport={async (input) => {
          await api.importMaterial(input);
          await loadRoute({ kind: 'assets' });
        }}
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
      }} onAskTeacher={() => void startFree([{ kind: 'note', id: note.id }])} onReload={() => {
        void loadRoute(route);
      }} />
    ) : <div className="loading-screen"><b>正在读取 Note</b></div>;
  } else if (route.kind === 'problem-card') {
    content = problem ? (
      <ProblemCardPage
        value={problem}
        onAttempt={async (response: ProblemAttemptResponse) => {
          await api.attemptProblem(problem.id, response);
          setProblem(await api.problemCard(problem.id));
        }}
        onReveal={async () => {
          await api.revealProblem(problem.id);
          setProblem(await api.problemCard(problem.id));
        }}
        onSaveNote={async (input) => {
          await api.updateProblemNote(problem.id, input);
          setProblem(await api.problemCard(problem.id));
        }}
        onAskTeacher={async () => {
          const created = await api.askProblemTeacher(problem.id);
          const next = parseBrowserRoute(new URL(created.route, window.location.origin).pathname);
          if (next) navigate(next);
        }}
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
          await loadRoute(route);
        }}
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
      : <div className="loading-screen"><b>正在读取知识关系</b></div>;
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
      onNavigate={(view) => navigate(
        view === 'home' ? { kind: 'home' } : view === 'assets' ? { kind: 'assets' } : { kind: 'course' },
      )}
    >
      {content}
    </AppShell>
  );
}

export default App;
