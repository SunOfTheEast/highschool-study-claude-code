import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  AbilityProjection,
  EvidenceView,
  LearningSetSnapshot,
  LessonReplay,
  PersonaPresentation,
  LessonNode,
  SessionKey,
  StudentNotebook,
  StudyViewEvent,
} from '../shared/contracts';
import { api } from './api';
import { AbilityMap } from './components/AbilityMap';
import { ChatPanel } from './components/ChatPanel';
import { EvidenceLens } from './components/EvidenceLens';
import { LearningSetHome } from './components/LearningSetHome';
import { LessonNotebook } from './components/LessonNotebook';
import { SessionTree } from './components/SessionTree';
import { initialClientState, preferLiveMessages, reduceClientState } from './state';

type ConnectionState = 'connecting' | 'open' | 'closed';

export function App() {
  const [learningSet, setLearningSet] = useState<LearningSetSnapshot | null>(null);
  const [client, setClient] = useState(initialClientState);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<StudentNotebook | null>(null);
  const [replay, setReplay] = useState<LessonReplay | null>(null);
  const [abilities, setAbilities] = useState<AbilityProjection | null>(null);
  const [evidence, setEvidence] = useState<EvidenceView | null>(null);
  const [persona, setPersona] = useState<PersonaPresentation | null>(null);

  useEffect(() => {
    void api.learningSet()
      .then(setLearningSet)
      .catch(() => setPageError('无法读取学习集，请确认本地服务与学习集目录。'))
      .finally(() => setLoading(false));
  }, []);

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
        setClient((current) => {
          const next = reduceClientState(current, event);
          if (event.type !== 'snapshot' || !current.selected?.startsWith('tutor:')) return next;
          const selectedLesson = event.workspace.lessons.find(
            (lesson) => lesson.sessionKey === current.selected,
          );
          return selectedLesson?.status === 'closed'
            ? { ...next, selected: event.workspace.coach.sessionKey }
            : next;
        });
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

  const openPlan = async (planId: string) => {
    setLoading(true);
    setPageError(null);
    try {
      const workspace = await api.workspace(planId);
      const selected = workspace.coach.sessionKey;
      const history = await api.history(selected);
      setClient((current) => ({
        ...current,
        workspace,
        selected,
        messages: { ...current.messages, [selected]: history },
      }));
    } catch {
      setPageError('无法打开这个 Plan，请检查 Markdown 索引。');
    } finally {
      setLoading(false);
    }
  };

  const selectedLesson = useMemo(() => {
    if (!client.workspace || !client.selected?.startsWith('tutor:')) return null;
    return client.workspace.lessons.find((lesson) => lesson.sessionKey === client.selected) ?? null;
  }, [client.selected, client.workspace]);

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
    if (!client.workspace) {
      setAbilities(null);
      return;
    }
    void api.abilities()
      .then(setAbilities)
      .catch(() => setPageError('无法读取方法证据投影。'));
  }, [client.workspace?.plan.id]);

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
      setPageError('这条证据的原始 Trace 已不可用。');
    }
  };

  const selectSession = async (nextKey: SessionKey) => {
    if (!client.workspace || nextKey === client.selected) return;
    setPageError(null);
    try {
      let workspace = client.workspace;
      const currentLesson = workspace.lessons.find(
        (lesson) => lesson.sessionKey === client.selected,
      );
      if (currentLesson?.status === 'active') {
        workspace = await api.lessonAction(currentLesson.id, 'pause');
      }
      const nextLesson = workspace.lessons.find((lesson) => lesson.sessionKey === nextKey);
      const shouldLoadHistory = nextKey.startsWith('coach:')
        || nextLesson?.status === 'active'
        || nextLesson?.status === 'paused';
      const history = shouldLoadHistory ? await api.history(nextKey) : null;
      setClient((current) => ({
        ...current,
        workspace,
        selected: nextKey,
        messages: history === null
          ? current.messages
          : { ...current.messages, [nextKey]: history },
      }));
    } catch {
      setPageError('切换 Session 失败，请稍后再试。');
    }
  };

  const startLesson = async (lesson: LessonNode) => {
    setPageError(null);
    try {
      const workspace = await api.lessonAction(lesson.id, 'start');
      const history = await api.history(lesson.sessionKey);
      setClient((current) => ({
        ...current,
        workspace,
        selected: lesson.sessionKey,
        messages: {
          ...current.messages,
          [lesson.sessionKey]: preferLiveMessages(
            current.messages[lesson.sessionKey],
            history,
          ),
        },
      }));
    } catch {
      setPageError('无法启动 Tutor Session，请检查 Pi 配置。');
    }
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
    } catch {
      setPageError('切换课堂人设失败。');
    }
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

  const goHome = () => {
    setClient(initialClientState);
    setEvidence(null);
    setPageError(null);
  };

  if (loading && !learningSet) {
    return <main className="loading-screen"><span>SF</span><p>正在展开学习集…</p></main>;
  }
  if (!learningSet) {
    return <main className="fatal-screen"><b>StudyForge</b><p>{pageError}</p></main>;
  }
  if (!client.workspace || !client.selected) {
    return (
      <>
        {pageError && <div className="page-alert" role="alert">{pageError}</div>}
        <LearningSetHome value={learningSet} onOpen={(id) => void openPlan(id)} />
      </>
    );
  }

  const selected = client.selected;
  const isCoach = selected.startsWith('coach:');
  const isReplay = selectedLesson?.status === 'closed'
    || selectedLesson?.status === 'abandoned';
  const view = isCoach ? 'coach' : isReplay ? 'replay' : 'tutor';
  const composerEnabled = isCoach || selectedLesson?.status === 'active';
  let gate: ReactNode = null;

  if (selectedLesson?.status === 'prepared') {
    gate = (
      <div className="lesson-gate prepared-gate">
        <span>Lesson 已备好</span>
        <h2>{selectedLesson.title}</h2>
        <p>先查看课堂积木。开始后 Tutor 才会创建独立 Session，并且只展开当前节点。</p>
        <button type="button" onClick={() => void startLesson(selectedLesson)}>开始上课 <i>↗</i></button>
      </div>
    );
  } else if (selectedLesson?.status === 'paused') {
    gate = (
      <div className="lesson-gate paused-gate">
        <span>Lesson 已暂停</span>
        <h2>上下文仍保留在这个 Tutor Session</h2>
        <p>继续后再恢复输入，Coach 的对话不会被复制进来。</p>
        <button type="button" onClick={() => void startLesson(selectedLesson)}>继续上课 <i>↗</i></button>
      </div>
    );
  } else if (selectedLesson?.status === 'closed' || selectedLesson?.status === 'abandoned') {
    gate = (
      <div className="lesson-gate archive-gate">
        <span>{selectedLesson.status === 'closed' ? 'Lesson 已完成' : 'Lesson 已归档'}</span>
        <h2>{selectedLesson.title}</h2>
        <p>这份课堂记录保持只读。返回 Coach 可以复盘，并决定下一节课或重新备课。</p>
        <button type="button" onClick={() => void selectSession(client.workspace!.coach.sessionKey)}>
          返回 Coach <i>↗</i>
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
          onHome={goHome}
        />
        <ChatPanel
          sessionKey={selected}
          messages={client.messages[selected] ?? []}
          work={client.work[selected] ?? ''}
          error={client.errors[selected]}
          composerEnabled={composerEnabled}
          {...(selectedLesson ? { lessonId: selectedLesson.id } : {})}
          persona={persona}
          deepMode={client.deepMode[selected] ?? false}
          workflows={client.workflows[selected] ?? []}
          workflowControlsEnabled={workflowSessionOpen}
          gate={gate}
          onSend={send}
          onPersona={changePersona}
          onDeepMode={changeDeepMode}
          onWorkflowAction={actOnWorkflow}
        />
        {isCoach
          ? <AbilityMap value={abilities} onOpen={(source) => void openEvidence(source)} />
          : <LessonNotebook lesson={selectedLesson} notebook={notebook} replay={replay} />}
      </div>
      {evidence && <EvidenceLens value={evidence} onClose={() => setEvidence(null)} />}
    </div>
  );
}
