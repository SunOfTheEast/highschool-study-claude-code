import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  CourseSnapshot,
  CourseTreeNode,
  KnowledgeSnapshot,
  LessonHandout,
  SessionKey,
  StudyEvent,
} from '../shared/contracts';
import { api, ApiError } from './api';
import { AppShell } from './components/AppShell';
import {
  formatBrowserRoute,
  parseBrowserRoute,
  type BrowserRoute,
} from './routes';
import {
  initialClientState,
  reduceClientState,
} from './state';
import { CoursePage, type NodeLifecycleAction } from './pages/CoursePage';
import { CourseOverviewPage } from './pages/CourseOverviewPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { LessonHandoutPage } from './pages/LessonHandoutPage';
import type { PrimaryView } from './view-state';

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
  if (route.kind === 'knowledge') return 'ROADMAP.md';
  const node = route.kind === 'course-plan'
    ? base.tree.children.find((candidate) => (
      candidate.kind === 'plan' && candidate.id === route.planId
    )) ?? null
    : base.tree.children
      .find((candidate) => candidate.kind === 'plan' && candidate.id === route.planId)
      ?.children.find((candidate) => (
        candidate.kind === 'lesson' && candidate.id === route.lessonId
      )) ?? null;
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

export function App() {
  const [route, setRoute] = useState<BrowserRoute>(() => (
    parseBrowserRoute(window.location.pathname) ?? { kind: 'course' }
  ));
  const [course, setCourse] = useState<CourseSnapshot | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeSnapshot | null>(null);
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
    setNotice('正在读取当前节点…');
    try {
      if (next.kind === 'knowledge') {
        const value = await api.knowledge();
        if (revision !== routeLoadRevision.current) return;
        setKnowledge(value);
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
      const value = selectedPath === 'ROADMAP.md'
        ? base
        : await api.course(selectedPath);
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
    const initial = parsed ?? { kind: 'course' as const };
    if (!parsed) window.history.replaceState(null, '', '/course');
    void loadRoute(initial);
  }, []);

  useEffect(() => {
    const pop = () => void loadRoute(
      parseBrowserRoute(window.location.pathname) ?? { kind: 'course' },
    );
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  useEffect(() => {
    if (route.kind === 'lesson-handout') return undefined;
    let disposed = false;
    let socket: WebSocket | null = null;
    let retry: number | null = null;
    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/events`);
      socket.onopen = () => setConnection('open');
      socket.onmessage = (message) => {
        const event = JSON.parse(String(message.data)) as StudyEvent;
        const currentRoute = parseBrowserRoute(window.location.pathname) ?? { kind: 'course' };
        if (event.type === 'course-invalidated') {
          if (currentRoute.kind !== 'knowledge' && currentRoute.kind !== 'lesson-handout') {
            void loadRoute(currentRoute);
          }
          return;
        }
        if (event.type === 'knowledge-invalidated') {
          if (currentRoute.kind === 'knowledge') void loadRoute(currentRoute);
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

  const selectedKey = course ? keyForCourse(course) : null;
  const conversation = selectedKey ? client.conversations[selectedKey] ?? [] : [];
  const running = selectedKey ? client.running[selectedKey] ?? false : false;
  const sessionError = selectedKey ? client.errors[selectedKey] ?? null : null;

  const title = course?.guide.title ?? '本地学习工作台';
  const activeView: PrimaryView = route.kind === 'knowledge' ? 'knowledge' : 'course';

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
            ? await api.startLesson(
              parentPlan(course!.tree, node.path)!.id,
              node.id,
            )
            : await api.closeLesson(
              parentPlan(course!.tree, node.path)!.id,
              node.id,
            );
      const url = new URL(result.route, window.location.origin);
      navigate(parseBrowserRoute(url.pathname) ?? { kind: 'course' });
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const content = useMemo(() => {
    if (activeView === 'knowledge') {
      return knowledge
        ? <KnowledgePage value={knowledge} />
        : <div className="loading-screen"><b>正在读取知识图谱</b></div>;
    }
    if (!course || !selectedKey) {
      return <div className="loading-screen"><b>正在读取课程节点</b></div>;
    }
    if (route.kind === 'course') {
      return <CourseOverviewPage value={course} onNavigate={navigate} />;
    }
    return (
      <CoursePage
        value={course}
        items={conversation}
        running={running}
        error={sessionError}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onNodeSelect={(node) => navigate(nodeRoute(node))}
        onSend={(text) => api.send(selectedKey, text).then(() => undefined)}
        onLifecycle={lifecycle}
        onToggleLeft={() => setLeftOpen((value) => !value)}
        onToggleRight={() => setRightOpen((value) => !value)}
      />
    );
  }, [
    activeView,
    route,
    knowledge,
    course,
    selectedKey,
    conversation,
    running,
    sessionError,
    leftOpen,
    rightOpen,
  ]);

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

  return (
    <AppShell
      title={title}
      activeView={activeView}
      connection={connection}
      notice={notice}
      onNavigate={(view) => navigate(view === 'course' ? { kind: 'course' } : { kind: 'knowledge' })}
    >
      {content}
    </AppShell>
  );
}

export default App;
