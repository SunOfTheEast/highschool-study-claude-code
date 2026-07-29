import type {
  ActivityKind,
  LessonReadyNotice,
  LessonStatus,
} from '../../shared/contracts';

const kindLabel: Record<ActivityKind, string> = {
  dialogue: '讨论',
  problem: '尝试',
  material: '材料',
  reflection: '小结',
};

function actionLabel(status: LessonStatus | null): string {
  if (status === 'prepared') return '开始上课';
  if (status === 'active' || status === 'paused') return '继续课堂';
  if (status === 'closed' || status === 'abandoned') return '查看记录';
  return '查看课程';
}

export function LessonReadyCard({
  value,
  status,
  onPrimary,
  onDiscuss,
}: {
  value: LessonReadyNotice;
  status: LessonStatus | null;
  onPrimary(lessonId: string): void;
  onDiscuss(): void;
}) {
  return (
    <article className="lesson-ready-card">
      <span>这一节已经准备好</span>
      <h3>共 {value.blockCount} 个课堂环节</h3>
      <p className="lesson-ready-kinds">
        {value.blockKinds.map((kind) => kindLabel[kind]).join(' · ')}
      </p>
      <p>具体题目会由课堂导师逐步展开。</p>
      <footer>
        <button type="button" onClick={() => onPrimary(value.lessonId)}>
          {actionLabel(status)}
        </button>
        <button type="button" onClick={onDiscuss}>返回讨论</button>
      </footer>
    </article>
  );
}
