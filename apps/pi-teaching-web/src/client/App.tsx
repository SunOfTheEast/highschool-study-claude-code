import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ROADMAP_COACH_SESSION_KEY } from '../shared/contracts';
import { resolveContinuePath } from '../shared/home';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../memory-review/contracts';
import type {
  AbilityProjection,
  CoachContextView,
  EvidenceView,
  HomeSnapshot,
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
import { api, ApiError } from './api';
import { ChatPanel } from './components/ChatPanel';
import { ContentExplorer } from './components/ContentExplorer';
import { ContextStack } from './components/ContextStack';
import { CurrentActivityStage } from './components/CurrentActivityStage';
import { EvidenceLens } from './components/EvidenceLens';
import { LearningSetHome } from './components/LearningSetHome';
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

export function App() {
  const [learningSet, setLearningSet] =
    useState<LearningSetSnapshot | HomeLearningSetSnapshot | null>(null);
  const [homeSnapshot, setHomeSnapshot] = useState<HomeSnapshot | null>(null);
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
  const [evidence, setEvidence] = useState<EvidenceView | null>(null);
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

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;

    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${location.host}/events`);
      socket.onopen = () => setConnection('open');
      socket.onmessage = (message) => {
        const event = JSON.parse(String(message.data)) as StudyViewEvent;
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
      if (route.kind === 'home') {
        const home = await api.home();
        setHomeSnapshot(home);
        setLearningSet(home.learningSet);
        setRoadmapWorkspace(null);
        setClient(initialClientState);
        setEvidence(null);
        if (navigation === 'push') window.history.pushState(null, '', formatBrowserRoute(route));
        if (navigation === 'replace') window.history.replaceState(null, '', formatBrowserRoute(route));
        return;
      }

      if (route.kind === 'roadmap') {
        setHomeSnapshot(null);
        const workspace = await api.roadmapWorkspace();
        const selected = workspace.coach.sessionKey;
        const history = await api.history(selected);
        setLearningSet(workspace.learningSet);
        setRoadmapWorkspace(workspace);
        setClient({
          ...initialClientState,
          selected,
          conversations: { [selected]: history },
        });
        if (navigation === 'push') {
          window.history.pushState(null, '', formatBrowserRoute(route));
        }
        if (navigation === 'replace') {
          window.history.replaceState(null, '', formatBrowserRoute(route));
        }
        return;
      }
      setHomeSnapshot(null);
      setRoadmapWorkspace(null);
      const workspace = await api.workspace(route.planId);
      let selected: SessionKey;
      let history: Awaited<ReturnType<typeof api.history>> | null = null;
      if (route.kind === 'coach') {
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
      const selectedLesson = route.kind === 'lesson'
        ? workspace.lessons.find((candidate) => candidate.id === route.lessonId)
        : null;
      if (
        (route.kind === 'coach' && workspace.plan.status !== 'completed')
        || (
          selectedLesson
          && ['active', 'paused', 'prepared'].includes(selectedLesson.status)
        )
      ) {
        localStorage.setItem('studyforge.lastVisitedRoute', savedPath);
      }
    } catch {
      setRoadmapWorkspace(null);
      setClient(initialClientState);
      setEvidence(null);
      try {
        const home = await api.home();
        setHomeSnapshot(home);
        setLearningSet(home.learningSet);
      } catch {
        setHomeSnapshot(null);
      }
      setPageError(route ? '无法恢复这个学习位置，已返回学习集首页。' : '无效的学习路径，已返回学习集首页。');
      window.history.replaceState(null, '', '/');
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
        return openRoute(parseBrowserRoute(window.location.pathname));
      })
      .catch(() => setPageError('无法读取学习集，请确认本地服务与学习集目录。'))
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      void openRoute(parseBrowserRoute(window.location.pathname));
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
    if (route?.kind !== 'lesson' || route.planId !== client.workspace.plan.id) return;
    window.history.replaceState(
      null,
      '',
      formatBrowserRoute({ kind: 'coach', planId: client.workspace.plan.id }),
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

  const openEvidence = async (source: string) => {
    setPageError(null);
    try {
      setEvidence(await api.evidence(source));
    } catch {
      setPageError('这条学习记录的原始来源已不可用。');
    }
  };

  const selectSession = async (nextKey: SessionKey) => {
    if (!client.workspace || nextKey === client.selected) return;
    try {
      let workspace = client.workspace;
      const currentLesson = workspace.lessons.find(
        (lesson) => lesson.sessionKey === client.selected,
      );
      if (currentLesson?.status === 'active') {
        workspace = await api.lessonAction(currentLesson.id, 'pause');
      }
      const nextLesson = workspace.lessons.find((lesson) => lesson.sessionKey === nextKey);
      const route: BrowserRoute | null = nextKey.startsWith('coach:')
        ? { kind: 'coach', planId: workspace.plan.id }
        : nextLesson
          ? { kind: 'lesson', planId: workspace.plan.id, lessonId: nextLesson.id }
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

  const openReadyLesson = async (lessonId: string) => {
    const lesson = client.workspace?.lessons.find((candidate) => candidate.id === lessonId);
    if (!lesson || !client.workspace) {
      setPageError('这节课暂时无法打开，请让学习顾问重新确认。');
      return;
    }
    if (lesson.status === 'prepared') {
      if (await startLesson(lesson)) {
        const route = formatBrowserRoute({
          kind: 'lesson',
          planId: client.workspace.plan.id,
          lessonId,
        });
        window.history.pushState(null, '', route);
        localStorage.setItem('studyforge.lastVisitedRoute', route);
      }
      return;
    }
    await openRoute({
      kind: 'lesson',
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
    void openRoute({ kind: 'home' }, 'push');
  };

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
    return (
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
        {personaDrawerOpen && persona && (
          <PersonaDrawer
            value={persona}
            preferences={presentation}
            onClose={() => setPersonaDrawerOpen(false)}
            onSelect={changePersona}
            onPreferences={changePresentation}
          />
        )}
      </div>
    );
  }
  if (!client.workspace || !client.selected) {
    if (!homeSnapshot) {
      return <main className="loading-screen"><span>SF</span><p>正在整理继续位置…</p></main>;
    }
    const continuePath = resolveContinuePath(
      homeSnapshot,
      localStorage.getItem('studyforge.lastVisitedRoute'),
    );
    return (
      <>
        {pageError && <div className="page-alert" role="alert">{pageError}</div>}
        <LearningSetHome
          value={homeSnapshot}
          continuePath={continuePath}
          onContinue={(path) => void openRoute(parseBrowserRoute(path), 'push')}
          onOpen={(id) => void openRoute({ kind: 'coach', planId: id }, 'push')}
          onRoadmapOpen={() => void openRoute({ kind: 'roadmap' }, 'push')}
        />
      </>
    );
  }

  const selected = client.selected;
  const isCoach = selected.startsWith('coach:');
  const isReplay = selectedLesson?.status === 'closed'
    || selectedLesson?.status === 'abandoned';
  const view = isCoach ? 'coach' : isReplay ? 'replay' : 'tutor';
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

  return (
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
            void openRoute({ kind: 'coach', planId }, 'push');
          }}
          onHome={goHome}
          explorerEnabled={isCoach || selectedLesson?.status !== 'prepared'}
          onExplore={() => setContentExplorerOpen(true)}
        />
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
          ) : selectedLesson && (
              selectedLesson.status === 'active' || selectedLesson.status === 'paused'
            ) ? (
              <CurrentActivityStage
                notebook={notebook}
                paused={selectedLesson.status === 'paused'}
                onResume={() => void startLesson(selectedLesson)}
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
        <ContextStack
          view={view}
          coachContext={isCoach ? coachContext : null}
          lesson={selectedLesson}
          notebook={notebook}
          replay={replay}
          abilities={abilities}
          workflows={client.workflows[selected] ?? []}
          onEvidence={(source) => void openEvidence(source)}
          onWorkflowAction={actOnWorkflow}
        />
      </div>
      {completionFeedback && (
        <div className="completion-feedback" role="status">{completionFeedback}</div>
      )}
      {personaDrawerOpen && persona && (
        <PersonaDrawer
          value={persona}
          preferences={presentation}
          onClose={() => setPersonaDrawerOpen(false)}
          onSelect={changePersona}
          onPreferences={changePresentation}
        />
      )}
      {contentExplorerOpen && (
        <ContentExplorer
          onClose={() => setContentExplorerOpen(false)}
          onEvidence={(source) => void openEvidence(source)}
          onSearch={(query) => api.contentSearch(selected, query)}
        />
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
      {evidence && <EvidenceLens value={evidence} onClose={() => setEvidence(null)} />}
    </div>
  );
}
