import type {
  ConversationItem,
  CourseSnapshot,
  CourseTreeNode,
  LessonDocument,
  PlanDocument,
  RoadmapDocument,
  SessionKey,
} from '../../shared/contracts';
import { ActivityDrawer } from '../components/ActivityDrawer';
import { ChatPanel } from '../components/ChatPanel';
import { CourseTree } from '../components/CourseTree';
import { MarkdownView } from '../components/MarkdownView';

export type NodeLifecycleAction =
  | 'start-plan'
  | 'complete-plan'
  | 'start-lesson'
  | 'close-lesson';

function findNode(node: CourseTreeNode, path: string): CourseTreeNode | null {
  if (node.path === path) return node;
  for (const child of node.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}

function summary(document: RoadmapDocument | PlanDocument | LessonDocument): string {
  if (document.kind === 'roadmap') return document.overview;
  return document.kind === 'plan' ? document.stageGoal : document.lessonGoal;
}

function DocumentContext({
  document,
}: {
  document: RoadmapDocument | PlanDocument | LessonDocument;
}) {
  if (document.kind === 'lesson') return <ActivityDrawer lesson={document} />;
  const rows = document.kind === 'roadmap'
    ? [
      ['长期目标', document.longTermGoal],
      ['能力标准', document.capabilityStandard],
      ['检验方式', document.test],
      ['当前位置', document.currentPosition],
    ]
    : [
      ['阶段目标', document.stageGoal],
      ['能力标准', document.capabilityStandard],
      ['检验方式', document.test],
      ['当前位置', document.currentPosition],
      ['下一课安排', document.nextLessonArrangement],
    ];
  return (
    <aside className="document-context" aria-label="节点原文摘要">
      <header><span>Node document</span><h2>节点原文</h2></header>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd><MarkdownView>{value}</MarkdownView></dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function actionFor(document: RoadmapDocument | PlanDocument | LessonDocument): {
  action: NodeLifecycleAction;
  label: string;
} | null {
  if (document.kind === 'roadmap') return null;
  if (document.kind === 'plan') {
    if (document.status === 'prepared') return { action: 'start-plan', label: '开始这一阶段' };
    if (document.status === 'active') return { action: 'complete-plan', label: '完成这一阶段' };
    return null;
  }
  if (document.status === 'prepared') return { action: 'start-lesson', label: '开始本课' };
  if (document.status === 'active') return { action: 'close-lesson', label: '结束本课' };
  return null;
}

export function CoursePage({
  value,
  items,
  running,
  error,
  leftOpen,
  rightOpen,
  onNodeSelect,
  onSend,
  onLifecycle,
  onToggleLeft,
  onToggleRight,
}: {
  value: CourseSnapshot;
  items: ConversationItem[];
  running: boolean;
  error: string | null;
  leftOpen: boolean;
  rightOpen: boolean;
  onNodeSelect(node: CourseTreeNode): void;
  onSend(text: string): Promise<void>;
  onLifecycle(action: NodeLifecycleAction, id: string): Promise<void>;
  onToggleLeft(): void;
  onToggleRight(): void;
}) {
  const document = value.selected ?? value.roadmap;
  const selectedNode = findNode(value.tree, document.path) ?? value.tree;
  const sessionKey = `${document.kind}:${document.id}` as SessionKey;
  const action = actionFor(document);
  const activeBlock = document.kind === 'lesson'
    ? document.blocks.find((block) => block.status === 'active') ?? null
    : null;

  return (
    <main
      className="course-workspace"
      data-left={leftOpen ? 'open' : 'closed'}
      data-right={rightOpen ? 'open' : 'closed'}
    >
      <aside className="course-rail" data-open={leftOpen}>
        <button type="button" className="rail-toggle" onClick={onToggleLeft}>
          <span aria-hidden="true">{leftOpen ? '‹' : '›'}</span>
          <span className="sr-only">{leftOpen ? '收起课程树' : '展开课程树'}</span>
        </button>
        {leftOpen && (
          <CourseTree
            root={value.tree}
            selectedPath={selectedNode.path}
            onSelect={onNodeSelect}
          />
        )}
      </aside>

      <section className="dialogue-workspace">
        <header className="node-heading">
          <div>
            <small>{document.kind}</small>
            <h1>{document.title}</h1>
          </div>
          {action && (
            <button
              type="button"
              className="node-primary-action"
              onClick={() => void onLifecycle(action.action, document.id)}
            >
              {action.label}
            </button>
          )}
          <div className="node-summary"><MarkdownView>{summary(document)}</MarkdownView></div>
        </header>

        {activeBlock && (
          <section className="classroom-focus" aria-label="当前课堂节点">
            <span>当前 · {activeBlock.title}</span>
            <MarkdownView>{activeBlock.studentView}</MarkdownView>
          </section>
        )}

        <ChatPanel
          sessionKey={sessionKey}
          items={items}
          running={running}
          error={error}
          enabled={document.status === 'active'}
          onSend={onSend}
        />
      </section>

      <aside className="context-rail" data-open={rightOpen}>
        <button type="button" className="rail-toggle" onClick={onToggleRight}>
          <span aria-hidden="true">{rightOpen ? '›' : '‹'}</span>
          <span className="sr-only">{rightOpen ? '收起节点原文' : '展开节点原文'}</span>
        </button>
        {rightOpen && <DocumentContext document={document} />}
      </aside>
    </main>
  );
}

export default CoursePage;
