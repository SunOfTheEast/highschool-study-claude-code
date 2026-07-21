import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  LearningSetSnapshot,
  LessonNode,
  SessionKey,
  StudentNotebook,
  StudyViewEvent,
} from '../shared/contracts';
import { api } from './api';
import { ChatPanel } from './components/ChatPanel';
import { LearningSetHome } from './components/LearningSetHome';
import { LessonNotebook } from './components/LessonNotebook';
import { SessionTree } from './components/SessionTree';
import { initialClientState, reduceClientState } from './state';

type ConnectionState = 'connecting' | 'open' | 'closed';

export function App() {
  const [learningSet, setLearningSet] = useState<LearningSetSnapshot | null>(null);
  const [client, setClient] = useState(initialClientState);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<StudentNotebook | null>(null);

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

  useEffect(() => {
    let current = true;
    setNotebook(null);
    if (selectedLesson) {
      void api.notebook(selectedLesson.id)
        .then((value) => { if (current) setNotebook(value); })
        .catch(() => { if (current) setPageError('无法读取学生课堂本。'); });
    }
    return () => { current = false; };
  }, [selectedLesson?.id]);

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
        messages: { ...current.messages, [lesson.sessionKey]: history },
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

  const goHome = () => {
    setClient(initialClientState);
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
    <>
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
          gate={gate}
          onSend={send}
        />
        <LessonNotebook lesson={selectedLesson} notebook={notebook} />
      </div>
    </>
  );
}
